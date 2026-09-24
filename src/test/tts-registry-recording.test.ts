// Phase 2K-1: text-to-speech executions are recorded in the provider registry
// (`openai-tts` / `elevenlabs-tts`) at the shared `voice/tts.ts` seam — for
// text-to-speech, ai-voice-chat's spoken answer, library narration and WhatsApp
// voice replies. Recording only: which provider, voice and model are used, and
// the request each sends, are exactly what they were.
//
// No provider is ever called: `fetchImpl` and `read` are injected.

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { synthesize, synthesizeResponse, type TtsExecution } from "../../supabase/functions/_shared/voice/tts.ts";
import { recordTtsExecution, TTS_PROVIDER_SLUG } from "../../supabase/functions/_shared/providerRecording.ts";

const KEYS = (name: string) =>
  name === "OPENAI_API_KEY" ? "openai-key" : name === "ELEVENLABS_API_KEY" ? "eleven-key" : undefined;

function provider(status = 200, bytes = new Uint8Array([1, 2, 3])) {
  const calls: Array<{ url: string; body: unknown; headers: unknown }> = [];
  const fetchImpl = ((url: string, init: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)), headers: init.headers });
    return Promise.resolve(status === 200
      ? new Response(bytes, { status: 200 })
      : new Response(JSON.stringify({ error: { message: "quota exceeded for org" } }), { status }));
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const OPENAI = { text: "Hello there", provider: "openai" as const, model: "gpt-4o-mini-tts", voice: "coral", format: "mp3" as const, instructions: "warm", read: KEYS };
const ELEVEN = { text: "Marhaba", provider: "elevenlabs" as const, model: "tts-1", voice: "cloned-voice-id", format: "opus" as const, read: KEYS };

afterEach(() => vi.restoreAllMocks());

describe("synthesize reports one execution, only when it succeeded", () => {
  it("OpenAI: provider, the model sent, and how long it took — nothing else", async () => {
    const record = vi.fn();
    const p = provider();
    const result = await synthesize({ ...OPENAI, fetchImpl: p.fetchImpl, record });
    expect(result.outcome).toBe("audio");
    expect(record).toHaveBeenCalledTimes(1);
    const [execution] = record.mock.calls[0] as [TtsExecution];
    expect(Object.keys(execution).sort()).toEqual(["model", "ms", "provider"]);
    expect(execution).toMatchObject({ provider: "openai", model: "gpt-4o-mini-tts" });
    expect(execution.ms).toBeGreaterThanOrEqual(0);
  });

  it("ElevenLabs cloned voice: the model actually sent, not the placeholder", async () => {
    const record = vi.fn();
    const p = provider();
    await synthesize({ ...ELEVEN, fetchImpl: p.fetchImpl, record });
    expect((p.calls[0].body as { model_id: string }).model_id).toBe("eleven_multilingual_v2");
    expect(record.mock.calls[0][0]).toMatchObject({ provider: "elevenlabs", model: "eleven_multilingual_v2" });
  });

  it("an explicit ElevenLabs model is recorded as itself", async () => {
    const record = vi.fn();
    await synthesize({ ...ELEVEN, model: "eleven_turbo_v2_5", fetchImpl: provider().fetchImpl, record });
    expect(record.mock.calls[0][0]).toMatchObject({ model: "eleven_turbo_v2_5" });
  });

  it.each([
    ["rejected", () => provider(429).fetchImpl, KEYS, "Hello"],
    ["no key", () => provider().fetchImpl, () => undefined, "Hello"],
    ["empty audio", () => provider(200, new Uint8Array(0)).fetchImpl, KEYS, "Hello"],
    ["transport", () => (() => Promise.reject(new Error("socket"))) as unknown as typeof fetch, KEYS, "Hello"],
    ["no text", () => provider().fetchImpl, KEYS, "   "],
  ])("%s: nothing is recorded", async (_why, fetchImpl, read, text) => {
    const record = vi.fn();
    const result = await synthesize({ ...OPENAI, text, fetchImpl: fetchImpl(), read, record });
    expect(result.outcome).toBe("failed");
    expect(record).not.toHaveBeenCalled();
  });
});

describe("synthesizeResponse (the streamed path)", () => {
  it("reports once the provider answered, and leaves the body for the caller", async () => {
    const record = vi.fn();
    const call = await synthesizeResponse({ ...OPENAI, fetchImpl: provider().fetchImpl, record });
    expect(call.outcome).toBe("response");
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toMatchObject({ provider: "openai", model: "gpt-4o-mini-tts" });
    if (call.outcome === "response") expect([...new Uint8Array(await call.response.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it("does not report a rejected call", async () => {
    const record = vi.fn();
    await synthesizeResponse({ ...OPENAI, fetchImpl: provider(500).fetchImpl, record });
    expect(record).not.toHaveBeenCalled();
  });
});

describe("recording never changes the speech", () => {
  it("the provider receives exactly the same request with or without a recorder", async () => {
    for (const req of [OPENAI, ELEVEN]) {
      const plain = provider();
      const recorded = provider();
      await synthesize({ ...req, fetchImpl: plain.fetchImpl });
      await synthesize({ ...req, fetchImpl: recorded.fetchImpl, record: vi.fn() });
      expect(recorded.calls).toEqual(plain.calls);
    }
  });

  it("a recorder that throws leaves a successful result untouched", async () => {
    const result = await synthesize({ ...OPENAI, fetchImpl: provider().fetchImpl, record: () => { throw new Error("registry down"); } });
    expect(result).toMatchObject({ outcome: "audio", provider: "openai", model: "gpt-4o-mini-tts", voice: "coral" });
  });

  it("is not awaited: a recorder that never settles does not hold the audio", async () => {
    const result = await synthesize({ ...OPENAI, fetchImpl: provider().fetchImpl, record: () => { void new Promise(() => {}); } });
    expect(result.outcome).toBe("audio");
  });

  it("no recorder: exactly the result it gave before this phase", async () => {
    const result = await synthesize({ ...ELEVEN, fetchImpl: provider().fetchImpl });
    expect(result).toEqual({ outcome: "audio", bytes: new Uint8Array([1, 2, 3]), mimeType: "audio/mpeg", provider: "elevenlabs", model: "tts-1", voice: "cloned-voice-id" });
  });
});

/** A recording stand-in for the service client. */
function fakeDb(rows: Record<string, { id: string; slug: string }> = {
  "openai-tts": { id: "t-1", slug: "openai-tts" },
  "elevenlabs-tts": { id: "t-2", slug: "elevenlabs-tts" },
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

describe("recordTtsExecution writes a success against the existing tts rows", () => {
  it("maps each provider to the row Phase 2C seeded", () => {
    // mistral-tts added by 20261047000000, for voices cloned with Voxtral.
    expect(TTS_PROVIDER_SLUG).toEqual({ openai: "openai-tts", elevenlabs: "elevenlabs-tts", mistral: "mistral-tts" });
  });

  it("OpenAI: a metric and a log row, with the model and nothing else", async () => {
    const { db, calls } = fakeDb();
    await recordTtsExecution(db, { provider: "openai", model: "gpt-4o-mini-tts", ms: 812 });
    expect(calls).toEqual([
      { op: "select", table: "ph_providers", args: "openai-tts" },
      { op: "rpc", table: "ph_record_metric", args: { p_provider_id: "t-1", p_success: true, p_latency_ms: 812, p_cost_usd: 0 } },
      { op: "insert", table: "ph_logs", args: {
        provider_id: "t-1", provider_slug: "openai-tts", job_type: "tts", action: "generation", status: "success",
        latency_ms: 812, cost_usd: null, error_message: null, failover_to: null, request_meta: { model: "gpt-4o-mini-tts" },
      } },
    ]);
  });

  it("ElevenLabs goes to its own row", async () => {
    const { db, calls } = fakeDb();
    await recordTtsExecution(db, { provider: "elevenlabs", model: "eleven_multilingual_v2", ms: 5 });
    expect(calls[0]).toEqual({ op: "select", table: "ph_providers", args: "elevenlabs-tts" });
  });

  it("a missing row records nothing, and a failing database never escapes", async () => {
    const { db, calls } = fakeDb({});
    await recordTtsExecution(db, { provider: "openai", model: "tts-1", ms: 1 });
    expect(calls.map((c) => c.op)).toEqual(["select"]);
    const broken = { from() { throw new Error("down"); }, rpc() { throw new Error("down"); } };
    await expect(recordTtsExecution(broken, { provider: "openai", model: "tts-1", ms: 1 })).resolves.toBeUndefined();
  });

  it("other recorders' log rows are unchanged — no request_meta unless one was given", async () => {
    const { recordProviderOutcome } = await import("../../supabase/functions/_shared/providerRecording.ts");
    const { db, calls } = fakeDb({ "openai-image": { id: "i-1", slug: "openai-image" } });
    await recordProviderOutcome(db, "openai-image", "image", { success: true, ms: 3 });
    expect(calls.find((c) => c.table === "ph_logs")?.args).not.toHaveProperty("request_meta");
  });
});

describe("the wiring", () => {
  const read = (p: string) => readFileSync(p, "utf8");
  const code = (p: string) => read(p).replace(/\/\/.*$/gm, "");

  for (const fn of ["text-to-speech", "ai-voice-chat"]) {
    it(`${fn} records in the background through the shared helper`, () => {
      expect(code(`supabase/functions/${fn}/index.ts`)).toContain("record: (execution) => recordTtsInBackground(execution),");
    });
  }

  it("library narration records with the service client it already holds", () => {
    const src = code("supabase/functions/library-generate-narration/index.ts");
    expect(src).toContain("record: (execution) => recordTtsInBackground(execution, db),");
    expect(src).toMatch(/synthesizeSegment\(segment, voice, instructions, speed, serviceClient\)/);
  });

  it("WhatsApp voice replies record through the webhook's own client", () => {
    const reply = code("supabase/functions/_shared/whatsappVoiceReply.ts");
    expect(reply).toMatch(/record: params\.record,/);
    const webhook = code("supabase/functions/whatsapp-webhook/index.ts");
    expect(webhook.match(/ops: \{ synthesise: \(text, spoken\) => synthesiseSpeech\(\{ text, spoken, record: \(execution\) => recordTtsInBackground\(execution, db\) \}\) \}/g)).toHaveLength(2);
  });

  it("speech-generate is not wired in — it already records itself, and must not record twice", () => {
    expect(code("supabase/functions/speech-generate/index.ts")).not.toContain("recordTtsInBackground");
  });

  it("the recorder is handed nothing but the execution — no text, audio or voice id", () => {
    const tts = code("supabase/functions/_shared/voice/tts.ts");
    const start = tts.indexOf("function reportExecution(");
    const report = tts.slice(start, tts.indexOf("\n}", start));
    expect(report).toMatch(/request\.record\(\{ provider: request\.provider, model: providerModel\(request\), ms: Date\.now\(\) - started \}\)/);
    expect(report).not.toMatch(/request\.text|bytes|request\.voice/);
  });

  it("the background helper never awaits on the request path and swallows failure", () => {
    const helper = code("supabase/functions/_shared/ttsRecorder.ts");
    expect(helper).toMatch(/EdgeRuntime\?\.waitUntil\(/);
    expect(helper).toMatch(/\.catch\(\(\) => undefined\)/);
    expect(helper).toMatch(/\): void \{/);
  });
});
