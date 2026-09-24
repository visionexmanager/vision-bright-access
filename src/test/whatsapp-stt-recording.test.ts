// Phase 2I: WhatsApp voice-note transcription is recorded in the provider
// registry (groq-stt / openai-stt) through the same code speech-transcribe
// uses — after the fact, off the reply path, and without changing what the
// sender gets back.

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeVoice } from "../../supabase/functions/_shared/whatsappTranscribe.ts";
import { recordSttAttempts, STT_PROVIDER_SLUG } from "../../supabase/functions/_shared/providerRecording.ts";
import type { TranscribeAttempt } from "../../supabase/functions/_shared/voice/stt.ts";

const VOICE = new Uint8Array(4_000); // ~1 s of opus: well under the length ceiling

function withKeys(keys: Record<string, string>) {
  vi.stubGlobal("Deno", { env: { get: (name: string) => keys[name] } });
}

/** Answers each provider in turn: a string is a transcript, a number an HTTP failure. */
function whisper(...answers: Array<string | number>) {
  const queue = [...answers];
  return vi.fn(async () => {
    const next = queue.shift();
    if (typeof next === "number") return new Response(JSON.stringify({ error: { message: "upstream said no" } }), { status: next });
    return new Response(JSON.stringify({ text: next ?? "" }), { status: 200 });
  }) as unknown as typeof fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("transcribeVoice reports what the chain did", () => {
  it("a first-try success: no failed attempts, the provider that answered", async () => {
    withKeys({ GROQ_API_KEY: "gsk" });
    const record = vi.fn();
    const result = await transcribeVoice({ bytes: VOICE, mimeType: "audio/ogg", fetchImpl: whisper("hello"), record });
    expect(result).toEqual({ ok: true, text: "hello", provider: "groq" });
    expect(record).toHaveBeenCalledTimes(1);
    const [attempts, final] = record.mock.calls[0];
    expect(attempts).toEqual([]);
    expect(final).toMatchObject({ provider: "groq" });
    expect(final.ms).toBeGreaterThanOrEqual(0);
  });

  it("a fallback: the failed attempt, then the provider that answered", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    withKeys({ GROQ_API_KEY: "gsk", OPENAI_API_KEY: "sk" });
    const record = vi.fn();
    const result = await transcribeVoice({ bytes: VOICE, mimeType: "audio/ogg", fetchImpl: whisper(500, "hi"), record });
    expect(result).toEqual({ ok: true, text: "hi", provider: "openai" });
    const [attempts, final] = record.mock.calls[0] as [TranscribeAttempt[], { provider: string }];
    expect(attempts.map((a) => [a.provider, a.failure.reason])).toEqual([["groq", "rejected"]]);
    expect(final.provider).toBe("openai");
  });

  it("every provider failing: the attempts, and no final", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    withKeys({ GROQ_API_KEY: "gsk", OPENAI_API_KEY: "sk" });
    const record = vi.fn();
    const result = await transcribeVoice({ bytes: VOICE, mimeType: "audio/ogg", fetchImpl: whisper(500, 503), record });
    expect(result).toEqual({ ok: false, reason: "provider_error" });
    const [attempts, final] = record.mock.calls[0] as [TranscribeAttempt[], unknown];
    expect(attempts.map((a) => a.provider)).toEqual(["groq", "openai"]);
    expect(final).toBeUndefined();
  });

  it("too long: no provider call and nothing to record", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    withKeys({ GROQ_API_KEY: "gsk" });
    const record = vi.fn();
    const fetchImpl = whisper("never");
    const result = await transcribeVoice({ bytes: new Uint8Array(24_000 * 400 / 8), mimeType: "audio/ogg", fetchImpl, record });
    expect(result).toEqual({ ok: false, reason: "too_long" });
    expect(record).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("a recorder that throws changes nothing the sender gets", async () => {
    withKeys({ GROQ_API_KEY: "gsk" });
    const result = await transcribeVoice({
      bytes: VOICE, mimeType: "audio/ogg", fetchImpl: whisper("hello"),
      record: () => { throw new Error("registry down"); },
    });
    expect(result).toEqual({ ok: true, text: "hello", provider: "groq" });
  });

  it("is not awaited: a recorder that never settles does not hold the reply", async () => {
    withKeys({ GROQ_API_KEY: "gsk" });
    const result = await transcribeVoice({
      bytes: VOICE, mimeType: "audio/ogg", fetchImpl: whisper("hello"),
      record: () => { void new Promise(() => {}); },
    });
    expect(result.ok).toBe(true);
  });

  it("no recorder: exactly the result it gave before this phase", async () => {
    withKeys({ GROQ_API_KEY: "gsk" });
    expect(await transcribeVoice({ bytes: VOICE, mimeType: "audio/ogg", fetchImpl: whisper("hello") }))
      .toEqual({ ok: true, text: "hello", provider: "groq" });
  });
});

/** A recording stand-in for the service client. */
function fakeDb(rows: Record<string, { id: string; slug: string }> = {
  "groq-stt": { id: "g-1", slug: "groq-stt" },
  "openai-stt": { id: "o-1", slug: "openai-stt" },
}) {
  const calls: Array<{ op: string; table: string; args: unknown }> = [];
  const db = {
    from(table: string) {
      return {
        select: () => ({ eq: (_c: string, v: string) => ({ maybeSingle: async () => {
          calls.push({ op: "select", table, args: v });
          return { data: rows[v] ?? null };
        } }) }),
        insert: async (args: unknown) => { calls.push({ op: "insert", table, args }); return { error: null }; },
      };
    },
    rpc: async (fn: string, args: unknown) => { calls.push({ op: "rpc", table: fn, args }); return { error: null }; },
  };
  return { db, calls };
}

const attempt = (provider: "groq" | "openai", failure: TranscribeAttempt["failure"], ms = 40): TranscribeAttempt =>
  ({ provider, model: "whisper", failure, ms });

describe("recordSttAttempts (shared by speech-transcribe and WhatsApp)", () => {
  it("records a success against the provider that answered", async () => {
    const { db, calls } = fakeDb();
    await recordSttAttempts(db, [], { provider: "groq", ms: 900 });
    expect(calls.filter((c) => c.table === "ph_logs").map((c) => c.args)).toEqual([expect.objectContaining({
      provider_id: "g-1", provider_slug: "groq-stt", job_type: "stt", status: "success", latency_ms: 900,
    })]);
  });

  it("records each real failure, then the success, and skips no_key", async () => {
    const { db, calls } = fakeDb();
    await recordSttAttempts(db, [
      attempt("groq", { reason: "no_key", provider: "groq" } as TranscribeAttempt["failure"]),
      attempt("groq", { reason: "rejected", provider: "groq", status: 500, detail: "upstream said no" }),
    ], { provider: "openai", ms: 700 });
    const logs = calls.filter((c) => c.table === "ph_logs").map((c) => c.args as Record<string, unknown>);
    expect(logs.map((l) => [l.provider_slug, l.status])).toEqual([["groq-stt", "failure"], ["openai-stt", "success"]]);
    expect(logs[0].error_message).toBe("upstream said no");
  });

  it("a missing row is skipped and a failing database is swallowed", async () => {
    const { db, calls } = fakeDb({});
    await recordSttAttempts(db, [], { provider: "groq", ms: 1 });
    expect(calls.map((c) => c.op)).toEqual(["select"]);
    const broken = { from() { throw new Error("down"); }, rpc() { throw new Error("down"); } };
    await expect(recordSttAttempts(broken, [], { provider: "groq", ms: 1 })).resolves.toBeUndefined();
  });

  it("maps to the slugs Phase 2C seeded", () => {
    expect(STT_PROVIDER_SLUG).toEqual({ groq: "groq-stt", openai: "openai-stt" });
  });
});

describe("the wiring", () => {
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
  const transcribeSrc = readFileSync("supabase/functions/_shared/whatsappTranscribe.ts", "utf8");

  it("the webhook records in the background with the service client", () => {
    expect(webhook).toContain('import { recordSttAttempts } from "../_shared/providerRecording.ts";');
    expect(webhook).toContain("record: (attempts, final) => EdgeRuntime.waitUntil(recordSttAttempts(db, attempts, final)),");
  });

  it("nothing that identifies the sender is handed to the recorder", () => {
    const line = webhook.slice(webhook.indexOf("record: (attempts, final) =>"), webhook.indexOf("record: (attempts, final) =>") + 120);
    expect(line).not.toMatch(/incoming|from|phone|text|body/i);
  });

  it("transcribeVoice calls the recorder once, without awaiting it, inside a try", () => {
    expect(transcribeSrc.match(/params\.record\?\.\(/g)).toHaveLength(1);
    expect(transcribeSrc).not.toMatch(/await params\.record/);
    const at = transcribeSrc.indexOf("params.record?.(");
    expect(transcribeSrc.lastIndexOf("try {", at)).toBeGreaterThan(transcribeSrc.indexOf("const heard = await transcribe("));
  });

  it("the provider chain itself is untouched", () => {
    expect(transcribeSrc).toContain("const heard = await transcribe({\n    bytes: params.bytes,\n    mimeType: params.mimeType,\n    fetchImpl: params.fetchImpl,\n  });".replace(/\n/g, transcribeSrc.includes("\r\n") ? "\r\n" : "\n"));
  });

  it("speech-transcribe records through the same shared function", () => {
    const fn = readFileSync("supabase/functions/speech-transcribe/index.ts", "utf8");
    expect(fn).toContain('import { recordSttAttempts, type RecordingDb } from "../_shared/providerRecording.ts";');
    expect(fn).not.toContain("async function recordSttAttempts");
  });
});
