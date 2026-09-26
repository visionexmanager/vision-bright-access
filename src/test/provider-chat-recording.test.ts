// Phase 2K-4: recording chat and vision attempts in the provider registry.
//
// The two shared fallback loops in `aiProvider.ts` report every provider
// attempt — the one that failed and the one that answered — to a recorder the
// entry point installs. (Since the 2026-09-26 provider audit the loops may also
// move an unhealthy target later in its chain; that is pinned in
// provider-health-ordering.test.ts, and nothing here depends on it.) These tests drive the real loops with a fake
// `fetch` and a fake environment, so "the attempt was recorded" means the loop
// called the recorder, not that a string appears in a file.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type * as AiProviderModule from "../../supabase/functions/_shared/aiProvider.ts";
import type { ProviderAttempt } from "../../supabase/functions/_shared/aiProvider.ts";

const env: Record<string, string | undefined> = {};
vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });

let ai: typeof AiProviderModule;
let rec: typeof import("../../supabase/functions/_shared/providerRecording.ts");
let assistants: typeof import("../../supabase/functions/_shared/assistants.ts");

beforeAll(async () => {
  ai = await import("../../supabase/functions/_shared/aiProvider.ts");
  rec = await import("../../supabase/functions/_shared/providerRecording.ts");
  assistants = await import("../../supabase/functions/_shared/assistants.ts");
});

afterEach(() => {
  ai.setProviderAttemptRecorder(null);
  ai.resetProviderCooldowns();
  for (const k of Object.keys(env)) delete env[k];
  vi.unstubAllGlobals();
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
});

const SECRET = "sk-test-DO-NOT-RECORD-0000";
const PROMPT = "PRIVATE-PROMPT-my phone is 0000";
const SYSTEM = "PRIVATE-SYSTEM-prompt";
const ANSWER = "PRIVATE-ANSWER-text";
const IMAGE = "data:image/png;base64,UFJJVkFURS1JTUFHRQ==";

type Reply = { status: number; body?: string; stream?: ReadableStream<Uint8Array> } | Error;

/** A fetch that answers by host, in order, and remembers which hosts it was asked. */
function fakeFetch(replies: Record<string, Reply[]>) {
  const hosts: string[] = [];
  const fn = vi.fn(async (url: string) => {
    const host = new URL(url).host;
    hosts.push(host);
    const next = replies[host]?.shift();
    if (!next) throw new TypeError("fetch failed");
    if (next instanceof Error) throw next;
    if (next.stream) return new Response(next.stream, { status: next.status });
    return new Response(next.body ?? "", { status: next.status });
  });
  vi.stubGlobal("fetch", fn);
  return { hosts, fn };
}

const OPENAI = "api.openai.com";
const GROQ = "api.groq.com";
const MISTRAL = "api.mistral.ai";

const sse = (text: string) => new ReadableStream<Uint8Array>({
  start(c) {
    c.enqueue(new TextEncoder().encode(`data: {"choices":[{"delta":{"content":"${text}"}}]}\n\n`));
    c.close();
  },
});
const toolReply = (value: unknown) => JSON.stringify({
  choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(value) } }] } }],
});

function capture() {
  const attempts: ProviderAttempt[] = [];
  ai.setProviderAttemptRecorder((a) => attempts.push(a));
  return attempts;
}

function allKeys() {
  env.OPENAI_API_KEY = SECRET;
  env.GROQ_API_KEY = SECRET;
  env.MISTRAL_API_KEY = SECRET;
}

const chatParams = (targets: AiProviderModule.ProviderTarget[]) => ({
  targets,
  system: SYSTEM,
  messages: [{ role: "user" as const, content: PROMPT }],
});
const structuredParams = (targets: AiProviderModule.ProviderTarget[], image?: string) => ({
  targets,
  system: SYSTEM,
  userText: PROMPT,
  schema: { type: "object" },
  toolName: "answer",
  ...(image ? { image } : {}),
});

describe("the streaming loop records every attempt", () => {
  it("records a successful first attempt with the provider and model it actually used", async () => {
    allKeys();
    fakeFetch({ [GROQ]: [{ status: 200, stream: sse(ANSWER) }] });
    const attempts = capture();

    const out = await ai.streamChatCompletionWithFallback(chatParams([{ provider: "groq", model: "openai/gpt-oss-20b" }]));
    await new Response(out.result).text(); // a stream's attempt settles when it ends

    expect(out.provider).toBe("groq");
    expect(attempts).toEqual([{
      kind: "chat", mode: "stream", provider: "groq", model: "openai/gpt-oss-20b",
      attempt: 1, success: true, ms: expect.any(Number),
    }]);
  });

  it("records a failed attempt and the fallback that answered as two separate attempts", async () => {
    allKeys();
    fakeFetch({ [MISTRAL]: [{ status: 503, body: "upstream overloaded" }], [OPENAI]: [{ status: 200, stream: sse(ANSWER) }] });
    const attempts = capture();

    const out = await ai.streamChatCompletionWithFallback(chatParams([
      { provider: "mistral", model: "mistral-small-latest" },
      { provider: "openai", model: "gpt-4.1" },
    ]));
    await new Response(out.result).text();

    expect(out).toMatchObject({ provider: "openai", model: "gpt-4.1" });
    expect(attempts.map(({ provider, model, attempt, success, error }) => ({ provider, model, attempt, success, error }))).toEqual([
      { provider: "mistral", model: "mistral-small-latest", attempt: 1, success: false, error: "http_5xx" },
      { provider: "openai", model: "gpt-4.1", attempt: 2, success: true, error: undefined },
    ]);
  });

  it("records every attempt when all of them fail, and still throws what it threw before", async () => {
    allKeys();
    fakeFetch({ [GROQ]: [{ status: 429 }], [OPENAI]: [{ status: 401, body: `invalid key ${SECRET}` }] });
    const attempts = capture();

    await expect(ai.streamChatCompletionWithFallback(chatParams([
      { provider: "groq", model: "g" },
      { provider: "openai", model: "o" },
    ]))).rejects.toMatchObject({ name: "ProviderError", status: 401 });

    expect(attempts.map((a) => [a.provider, a.success, a.error])).toEqual([
      ["groq", false, "http_429"],
      ["openai", false, "http_401"],
    ]);
  });

  it("a stream that is accepted and then breaks is recorded as a failure, once, when it breaks", async () => {
    // Until 2026-09-26 this was recorded as a success at acceptance, and a
    // later break was invisible. Now the attempt settles when the body ends.
    allKeys();
    const breaking = new ReadableStream<Uint8Array>({ pull(c) { c.error(new Error("connection reset")); } });
    fakeFetch({ [OPENAI]: [{ status: 200, stream: breaking }] });
    const attempts = capture();

    const out = await ai.streamChatCompletionWithFallback(chatParams([{ provider: "openai", model: "gpt-4.1" }]));
    expect(attempts).toHaveLength(0); // accepted is not delivered
    await expect(new Response(out.result).text()).rejects.toThrow();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ mode: "stream", success: false, error: "stream_interrupted" });
  });

  it("never records image data or classifies a stream as vision — the stream carries text only", async () => {
    allKeys();
    fakeFetch({ [OPENAI]: [{ status: 200, stream: sse(ANSWER) }] });
    const attempts = capture();
    const out = await ai.streamChatCompletionWithFallback(chatParams([{ provider: "openai", model: "gpt-4.1" }]));
    await new Response(out.result).text();
    expect(attempts[0].kind).toBe("chat");
  });
});

describe("the structured loop records every attempt, and tells chat from vision by the request", () => {
  it("an image-bearing request is recorded as vision", async () => {
    allKeys();
    fakeFetch({ [OPENAI]: [{ status: 200, body: toolReply({ ok: true }) }] });
    const attempts = capture();

    await ai.structuredCompletionWithFallback(structuredParams([{ provider: "openai", model: "gpt-4o-mini" }], IMAGE));

    expect(attempts).toEqual([{
      kind: "vision", mode: "structured", provider: "openai", model: "gpt-4o-mini",
      attempt: 1, success: true, ms: expect.any(Number),
    }]);
  });

  it("the same vision-capable chain carrying only text is recorded as chat", async () => {
    // whatsappUnderstand sends decoded text documents down VISION_TARGETS with
    // no image: the chain's name does not decide the kind, the request does.
    allKeys();
    fakeFetch({ [OPENAI]: [{ status: 200, body: toolReply({ ok: true }) }] });
    const attempts = capture();

    // (whatsappUnderstand imports an npm module, so its chain is read, not imported.)
    const understand = readFileSync("supabase/functions/_shared/whatsappUnderstand.ts", "utf8");
    expect(understand).toContain("export const DOCUMENT_TEXT_TARGETS: ProviderTarget[] = VISION_TARGETS;");
    const VISION_TARGETS = [...(/export const VISION_TARGETS[^=]*=\s*\[([\s\S]*?)\];/.exec(understand)?.[1] ?? "")
      .matchAll(/provider: "(\w+)", model: "([^"]+)"/g)].map((m) => ({ provider: m[1] as "openai", model: m[2] }));
    expect(VISION_TARGETS.length).toBeGreaterThan(0);
    await ai.structuredCompletionWithFallback(structuredParams(VISION_TARGETS));

    expect(attempts[0]).toMatchObject({ kind: "chat", provider: VISION_TARGETS[0].provider });
  });

  it("an unconfigured provider is recorded as not_configured, without the secret's name, then falls back", async () => {
    env.OPENAI_API_KEY = SECRET; // GEMINI_API_KEY unset
    fakeFetch({ [OPENAI]: [{ status: 200, body: toolReply({ ok: true }) }] });
    const attempts = capture();

    await ai.structuredCompletionWithFallback(structuredParams([
      { provider: "gemini", model: "gemini-flash-latest" },
      { provider: "openai", model: "gpt-4o" },
    ], IMAGE));

    expect(attempts.map((a) => [a.kind, a.provider, a.attempt, a.success, a.error])).toEqual([
      ["vision", "gemini", 1, false, "not_configured"],
      ["vision", "openai", 2, true, undefined],
    ]);
  });

  it("a malformed answer is invalid_response; a dropped connection is network", async () => {
    allKeys();
    fakeFetch({
      [GROQ]: [{ status: 200, body: JSON.stringify({ choices: [{ message: {} }] }) }],
      [MISTRAL]: [new TypeError("fetch failed")],
      [OPENAI]: [{ status: 200, body: toolReply({ ok: 1 }) }],
    });
    const attempts = capture();

    await ai.structuredCompletionWithFallback(structuredParams([
      { provider: "groq", model: "g" }, { provider: "mistral", model: "m" }, { provider: "openai", model: "o" },
    ]));

    expect(attempts.map((a) => a.error)).toEqual(["invalid_response", "network", undefined]);
    expect(attempts.map((a) => a.attempt)).toEqual([1, 2, 3]);
  });

  it("a single-provider call outside the loops records nothing (not in this phase's scope)", async () => {
    allKeys();
    fakeFetch({ [OPENAI]: [{ status: 200, body: toolReply({ ok: true }) }] });
    const attempts = capture();
    await ai.structuredCompletion({ ...structuredParams([]), provider: "openai", model: "gpt-4o-mini" });
    expect(attempts).toEqual([]);
  });
});

describe("what a recorded attempt may contain", () => {
  it("latency is a whole, non-negative number of milliseconds, capped", async () => {
    allKeys();
    fakeFetch({ [GROQ]: [{ status: 500 }], [OPENAI]: [{ status: 200, stream: sse(ANSWER) }] });
    const attempts = capture();
    await ai.streamChatCompletionWithFallback(chatParams([{ provider: "groq", model: "g" }, { provider: "openai", model: "o" }]));
    for (const a of attempts) {
      expect(Number.isInteger(a.ms)).toBe(true);
      expect(a.ms).toBeGreaterThanOrEqual(0);
      expect(a.ms).toBeLessThanOrEqual(ai.MAX_RECORDED_ATTEMPT_MS);
    }
  });

  it("no prompt, system prompt, answer, image, secret or provider error body ever reaches the recorder", async () => {
    allKeys();
    fakeFetch({
      [GROQ]: [{ status: 400, body: `bad request: ${PROMPT} ${SECRET}` }],
      [OPENAI]: [{ status: 200, body: toolReply({ answer: ANSWER }) }],
    });
    const attempts = capture();

    await ai.structuredCompletionWithFallback(structuredParams([{ provider: "groq", model: "g" }, { provider: "openai", model: "o" }], IMAGE));

    const recorded = JSON.stringify(attempts);
    for (const forbidden of [PROMPT, SYSTEM, ANSWER, IMAGE, "UFJJVkFURS1JTUFHRQ", SECRET, "bad request", "OPENAI_API_KEY"]) {
      expect(recorded).not.toContain(forbidden);
    }
    expect(Object.keys(attempts[0]).sort()).toEqual(["attempt", "error", "kind", "mode", "model", "ms", "provider", "success"]);
  });

  it("every error code comes from one closed list", async () => {
    const cases: unknown[] = [
      new ai.ProviderError(500, "GROQ_API_KEY is not configured"),
      new ai.ProviderError(401, "x"), new ai.ProviderError(418, "x"), new ai.ProviderError(502, "x"),
      new ai.ProviderError(500, "No structured response from AI"), new SyntaxError("x"),
      Object.assign(new Error("x"), { name: "TimeoutError" }), new TypeError("x"), "a string", null,
    ];
    for (const c of cases) expect(ai.ATTEMPT_ERROR_CODES).toContain(ai.attemptErrorCode(c));
    expect(ai.attemptErrorCode(new ai.ProviderError(418, "x"))).toBe("http_4xx");
    expect(ai.attemptErrorCode(Object.assign(new Error("x"), { name: "TimeoutError" }))).toBe("timeout");
  });
});

describe("recording can never fail the request", () => {
  it("a recorder that throws is ignored, on success and on fallback", async () => {
    allKeys();
    fakeFetch({ [GROQ]: [{ status: 503 }], [OPENAI]: [{ status: 200, stream: sse(ANSWER) }] });
    ai.setProviderAttemptRecorder(() => { throw new Error("registry down"); });

    const out = await ai.streamChatCompletionWithFallback(chatParams([{ provider: "groq", model: "g" }, { provider: "openai", model: "o" }]));
    expect(out.provider).toBe("openai");
    expect(await new Response(out.result).text()).toContain(ANSWER);
  });

  it("the registry write swallows a database that throws or rejects", async () => {
    const throwing = { from() { throw new Error("down"); }, rpc() { throw new Error("down"); } };
    const rejecting = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.reject(new Error("down")) }) }) }) };
    const a: ProviderAttempt = { kind: "chat", mode: "stream", provider: "openai", model: "m", attempt: 1, success: true, ms: 5 };
    await expect(rec.recordProviderAttempt(throwing, a)).resolves.toBeUndefined();
    await expect(rec.recordProviderAttempt(rejecting, a)).resolves.toBeUndefined();
  });

  it("with no recorder installed the loops behave as before", async () => {
    allKeys();
    fakeFetch({ [OPENAI]: [{ status: 200, stream: sse(ANSWER) }] });
    const out = await ai.streamChatCompletionWithFallback(chatParams([{ provider: "openai", model: "o" }]));
    expect(out.provider).toBe("openai");
  });
});

/** A database that remembers every write, for the registry side. */
function fakeDb() {
  const rows: Record<string, Record<string, unknown>[]> = { ph_logs: [], ph_failovers: [] };
  const rpcs: { fn: string; args: Record<string, unknown> }[] = [];
  const slugs: Record<string, string> = {
    "openai-chat": "id-oc", "groq-chat": "id-gc", "mistral-chat": "id-mc", "gemini-chat": "id-gec",
    "openai-vision": "id-ov", "gemini-vision": "id-gv",
  };
  const db = {
    from(table: string) {
      return {
        select: () => ({ eq: (_c: string, slug: string) => ({ maybeSingle: async () => ({ data: slugs[slug] ? { id: slugs[slug], slug } : null }) }) }),
        insert: async (row: Record<string, unknown>) => { (rows[table] ??= []).push(row); return { error: null }; },
      };
    },
    rpc: async (fn: string, args: Record<string, unknown>) => { rpcs.push({ fn, args }); return { error: null }; },
  };
  return { db, rows, rpcs };
}

describe("the registry side: one attempt, one ph_logs row, against the right row", () => {
  it("writes one ph_logs row and one metric per attempt, and no failover row", async () => {
    const { db, rows, rpcs } = fakeDb();
    await rec.recordProviderAttempt(db, { kind: "chat", mode: "stream", provider: "mistral", model: "mistral-small-latest", attempt: 1, success: false, ms: 812, error: "http_5xx" });
    await rec.recordProviderAttempt(db, { kind: "chat", mode: "stream", provider: "openai", model: "gpt-4.1", attempt: 2, success: true, ms: 640 });

    expect(rows.ph_logs).toHaveLength(2);
    expect(rows.ph_failovers).toHaveLength(0);
    expect(rpcs.map((r) => r.fn)).toEqual(["ph_record_metric", "ph_record_metric"]);
    expect(rows.ph_logs[0]).toMatchObject({
      provider_id: "id-mc", provider_slug: "mistral-chat", job_type: "chat", status: "failure",
      latency_ms: 812, error_message: "http_5xx", failover_to: null,
      request_meta: { model: "mistral-small-latest", attempt: 1, mode: "stream" },
    });
    expect(rows.ph_logs[1]).toMatchObject({ provider_slug: "openai-chat", status: "success", request_meta: { model: "gpt-4.1", attempt: 2 } });
    // Exactly these fields, and exactly these three in request_meta — nothing
    // else about the request can ride along.
    for (const row of rows.ph_logs) {
      expect(Object.keys(row).sort()).toEqual(["action", "cost_usd", "error_message", "failover_to", "job_type", "latency_ms",
        "provider_id", "provider_slug", "request_meta", "status"]);
      expect(Object.keys(row.request_meta as object).sort()).toEqual(["attempt", "mode", "model"]);
    }
  });

  it("vision attempts land on the vision rows with job_type vision", async () => {
    const { db, rows } = fakeDb();
    await rec.recordProviderAttempt(db, { kind: "vision", mode: "structured", provider: "gemini", model: "gemini-flash-latest", attempt: 1, success: false, ms: 3, error: "not_configured" });
    expect(rows.ph_logs[0]).toMatchObject({ provider_slug: "gemini-vision", job_type: "vision" });
  });

  it("a provider with no row for that kind records nothing rather than borrowing another row", async () => {
    const { db, rows, rpcs } = fakeDb();
    await rec.recordProviderAttempt(db, { kind: "chat", mode: "stream", provider: "anthropic", model: "c", attempt: 1, success: true, ms: 1 });
    await rec.recordProviderAttempt(db, { kind: "vision", mode: "structured", provider: "groq", model: "g", attempt: 1, success: true, ms: 1 });
    expect(rows.ph_logs).toEqual([]);
    expect(rpcs).toEqual([]);
  });

  it("the chat and vision slugs are their own identities, never an existing type's row", () => {
    const mine = [...Object.values(rec.CHAT_PROVIDER_SLUG), ...Object.values(rec.VISION_PROVIDER_SLUG)];
    const existing = [...Object.values(rec.TTS_PROVIDER_SLUG), ...Object.values(rec.STT_PROVIDER_SLUG),
      ...Object.values(rec.MEDIA_PROVIDER_SLUG), ...Object.values(rec.VIDEO_PROVIDER_SLUG)];
    expect(new Set(mine).size).toBe(mine.length);
    for (const s of mine) expect(existing).not.toContain(s);
    expect(rec.CHAT_PROVIDER_SLUG).toEqual({ openai: "openai-chat", groq: "groq-chat", mistral: "mistral-chat", gemini: "gemini-chat" });
    expect(rec.VISION_PROVIDER_SLUG).toEqual({ openai: "openai-vision", gemini: "gemini-vision" });
  });
});

describe("provider order is exactly what it was", () => {
  it("every registered assistant's chain is tried in its own order, unchanged by recording", async () => {
    allKeys();
    env.GEMINI_API_KEY = undefined;
    for (const a of Object.values(assistants.ASSISTANTS)) {
      ai.resetProviderCooldowns(); // each assistant starts from a healthy isolate
      vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
      const attempts = capture();
      await ai.streamChatCompletionWithFallback(chatParams(a.targets)).catch(() => undefined);
      expect(attempts.map((x) => `${x.provider}/${x.model}`), a.id).toEqual(a.targets.map((t) => `${t.provider}/${t.model}`));
    }
  });

  it("the per-assistant quality policy is exactly the one in place before recording", () => {
    // Pinned as it stood on main at 6372d6d3. Recording must not move a single
    // assistant between chains, or change a chain's order or models.
    const O = "openai/gpt-4.1", G = "gemini/gemini-flash-latest", Q = "groq/openai/gpt-oss-20b", M = "mistral/ministral-14b-latest";
    const chain = (id: string) => assistants.assistantTargets(id).map((t) => `${t.provider}/${t.model}`);
    const OPENAI_FIRST = ["legal-advisor", "medical-support", "psychology", "empathy-oasis", "skin-care", "hair-care",
      "finance-advisor", "ivx-tutor", "ivx-project-grader", "whatsapp-support"];
    const MISTRAL_FIRST = ["social-guide", "digital-marketing", "global-studio", "content-guide", "message-assistant",
      "media-companion", "voice-room-assistant"];
    const GEMINI_FIRST = ["travel-agency", "educational-empire", "music-conservatory", "tech-consulting",
      "professional-training", "simulation-mentor"];
    for (const id of OPENAI_FIRST) expect(chain(id), id).toEqual([O, G, M, Q]);
    for (const id of MISTRAL_FIRST) expect(chain(id), id).toEqual([M, G, Q, O]);
    for (const id of GEMINI_FIRST) expect(chain(id), id).toEqual([G, Q, M, O]);
    const pinned = new Set([...OPENAI_FIRST, ...MISTRAL_FIRST, ...GEMINI_FIRST]);
    for (const a of Object.values(assistants.ASSISTANTS)) {
      if (!pinned.has(a.id)) expect(a.targets.map((t) => `${t.provider}/${t.model}`), a.id).toEqual([Q, G, M, O]);
      else expect(a.targets.map((t) => `${t.provider}/${t.model}`), a.id).toEqual(chain(a.id));
    }
  });

  it("WhatsApp still leads with OpenAI", () => {
    expect(assistants.assistantTargets("whatsapp-support")[0].provider).toBe("openai");
  });

  it("the loops never choose from the registry: they only defer to it through an injected, synchronous hook", () => {
    // Since the 2026-09-26 audit the registry may move a target later in its
    // chain (provider-health-ordering.test.ts). It still may not pick a model,
    // and aiProvider.ts still has no database or router dependency.
    const src = readFileSync("supabase/functions/_shared/aiProvider.ts", "utf8");
    expect(src).not.toMatch(/resolveProvider|rankProviders|getProvider|providerRouter|from "\.\/providerSelection|createClient|\.from\("ph_providers"\)/);
  });
});

describe("migration: the chat and vision types and their rows", () => {
  const FILE = "20261042000000_ph_providers_chat_vision_types.sql";
  const sql = existsSync(`supabase/migrations/${FILE}`) ? readFileSync(`supabase/migrations/${FILE}`, "utf8") : "";
  const code = sql.replace(/--.*$/gm, "");

  it("widens the type CHECK by exactly chat and vision, keeping every existing type", () => {
    expect(code).toContain("ALTER TABLE public.ph_providers DROP CONSTRAINT IF EXISTS ph_providers_type_check;");
    expect(code).toMatch(/ADD CONSTRAINT ph_providers_type_check\s+CHECK \(type IN \('tts', 'voice_cloning', 'text_to_video', 'stt', 'image', 'chat', 'vision'\)\);/);
  });

  it("seeds exactly the rows the recorded loops can reach, idempotently", () => {
    const seeded = [...code.matchAll(/\('[^']+',\s*'([a-z0-9-]+)',\s*'([a-z_]+)',\s*'([a-z]+)'/g)].map((m) => `${m[1]}:${m[2]}:${m[3]}`);
    expect(seeded).toEqual([
      "openai-chat:chat:active", "groq-chat:chat:active", "mistral-chat:chat:active", "gemini-chat:chat:inactive",
      "openai-vision:vision:active", "gemini-vision:vision:inactive",
    ]);
    expect(code).toMatch(/ON CONFLICT \(slug\) DO NOTHING;/);
    expect(code).not.toMatch(/anthropic-chat/);
  });

  it("changes no other table, policy, grant, metric or retention", () => {
    expect(code).not.toMatch(/ph_metrics|ph_logs|ph_provider_audit|metrics_retention_hours|POLICY|GRANT|REVOKE|cron\./i);
    expect(code).not.toMatch(/\bUPDATE\b|\bDELETE\b/);
  });

  it("comes after the retention migration, with a unique version", () => {
    const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
    expect(files.indexOf(FILE)).toBeGreaterThan(files.indexOf("20261041000000_provider_registry_retention.sql"));
    expect(files.filter((f) => f.startsWith("20261042000000_"))).toHaveLength(1);
  });
});

describe("wiring: exactly the entry points that reach the loops install the recorder", () => {
  const ENTRY = ["ai-chat", "ai-generate", "ai-voice-chat", "analyze-image", "kids-course-generate",
    "meta-messaging-webhook", "whatsapp-webhook", "owner-control", "social-publish"];

  it("each installs it once, at start-up", () => {
    for (const fn of ENTRY) {
      const src = readFileSync(`supabase/functions/${fn}/index.ts`, "utf8");
      expect(src, fn).toContain('import { installChatAttemptRecording } from "../_shared/chatRecorder.ts";');
      expect(src.match(/^installChatAttemptRecording\(\);\r?$/gm), fn).toHaveLength(1);
    }
  });

  it("no single-provider or direct-provider function installs it in this phase", () => {
    const installed = readdirSync("supabase/functions", { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
      .filter((d) => { try { return readFileSync(`supabase/functions/${d.name}/index.ts`, "utf8").includes("installChatAttemptRecording"); } catch { return false; } })
      .map((d) => d.name).sort();
    expect(installed).toEqual([...ENTRY].sort());
  });
});

describe("admin Provider Hub names every type", () => {
  const types = readFileSync("src/lib/types/provider-hub.ts", "utf8");
  const ALL = ["tts", "voice_cloning", "text_to_video", "stt", "image", "chat", "vision"];

  it("the type union, labels and icons cover every type the database accepts", () => {
    const union = /export type ProviderType\s*=([^;]+);/.exec(types)?.[1] ?? "";
    expect([...union.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]).sort()).toEqual([...ALL].sort());
    for (const map of ["PROVIDER_TYPE_LABELS", "PROVIDER_TYPE_ICONS"]) {
      const body = new RegExp(`${map}[^=]*=\\s*\\{([^}]*)\\}`).exec(types)?.[1] ?? "";
      const entries = [...body.matchAll(/^\s*([a-z_]+):\s*"([^"]+)"/gm)];
      expect(entries.map((m) => m[1]).sort(), map).toEqual([...ALL].sort());
      for (const m of entries) expect(m[2].trim().length, `${map}.${m[1]}`).toBeGreaterThan(0);
    }
  });

  it("the card's icon is decorative; the visible type label is the text a screen reader gets", () => {
    const card = readFileSync("src/pages/services/ai-media-studio/components/provider-hub/ProviderCard.tsx", "utf8");
    expect(card).toMatch(/<span aria-hidden="true" className="text-2xl leading-none mt-0\.5">\s*\{PROVIDER_TYPE_ICONS\[provider\.type\]\}/);
    expect(card).toContain("{PROVIDER_TYPE_LABELS[provider.type]}");
  });

  it("the health dashboard's traffic groups list every type, not a hard-coded three", () => {
    const dash = readFileSync("src/pages/services/ai-media-studio/components/provider-hub/ProviderHealthDashboard.tsx", "utf8");
    expect(dash).not.toContain('(["tts", "voice_cloning", "text_to_video"] as const)');
    expect(dash).toContain("(Object.keys(PROVIDER_TYPE_LABELS) as ProviderType[])");
  });
});
