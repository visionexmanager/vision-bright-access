// The browser sends an Idempotency-Key with every request that may cost VX.
//
// The server side shipped first (#384): it scopes the key to the account and
// allows the header through CORS. These pin the client half — every call path
// to the four billed functions sends a key, a fresh one per attempt, in a form
// the server's own pattern accepts — and that nothing else gets one.

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn(async () => ({ data: new Blob(["x"]), error: null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { access_token: "user-token" } } }) },
    functions: { invoke },
  },
}));

const { callEdge } = await import("@/lib/api/edgeFunctions");
const { BILLED_FUNCTIONS, IDEMPOTENCY_HEADER, newIdempotencyKey } = await import("@/lib/api/idempotency");
const billing = await import("../../supabase/functions/_shared/vx/billing.ts");

const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
const sentHeaders = (call = 0) => (fetchMock.mock.calls[call] as unknown as [string, RequestInit])[1].headers as Record<string, string>;

beforeEach(() => {
  fetchMock.mockClear();
  invoke.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("the key itself", () => {
  it("is what the server accepts, and the server then uses it rather than a random one", () => {
    for (let i = 0; i < 20; i++) {
      const key = newIdempotencyKey();
      expect(key).toMatch(/^[A-Za-z0-9_-]{8,120}$/);
      const req = new Request("https://x", { headers: { [IDEMPOTENCY_HEADER]: key } });
      expect(billing.requestIdempotencyKey(req, "ai-chat", "user-a")).toBe(`ai-chat:user-a:${key}`);
    }
  });

  it("is different every time", () => {
    const keys = new Set(Array.from({ length: 200 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(200);
  });

  it("still works on a browser without crypto.randomUUID", () => {
    const original = crypto.randomUUID;
    try {
      Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
      const key = newIdempotencyKey();
      expect(key).toMatch(/^[0-9a-f]{32}$/);
      expect(newIdempotencyKey()).not.toBe(key);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });

  it("names exactly the four functions that bill VX", () => {
    expect([...BILLED_FUNCTIONS].sort()).toEqual(["ai-chat", "document-generate", "image-generate", "text-to-speech"]);
    // The same four the server wires to billedRequest.
    for (const fn of BILLED_FUNCTIONS) {
      expect(readFileSync(`supabase/functions/${fn}/index.ts`, "utf8"), fn).toMatch(/requestIdempotencyKey\(req, /);
    }
  });
});

describe("callEdge", () => {
  it("sends a fresh key on each call to a billed function", async () => {
    await callEdge({ fn: "image-generate", body: {}, auth: "user-jwt" });
    await callEdge({ fn: "image-generate", body: {}, auth: "user-jwt" });
    const [a, b] = [sentHeaders(0)[IDEMPOTENCY_HEADER], sentHeaders(1)[IDEMPOTENCY_HEADER]];
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,120}$/);
    expect(b).toMatch(/^[A-Za-z0-9_-]{8,120}$/);
    expect(a).not.toBe(b);
  });

  it("sends the caller's key when it re-sends the same attempt", async () => {
    await callEdge({ fn: "document-generate", body: {}, auth: "user-jwt", idempotencyKey: "attempt-0001" });
    await callEdge({ fn: "document-generate", body: {}, auth: "user-jwt", idempotencyKey: "attempt-0001" });
    expect(sentHeaders(0)[IDEMPOTENCY_HEADER]).toBe("attempt-0001");
    expect(sentHeaders(1)[IDEMPOTENCY_HEADER]).toBe("attempt-0001");
  });

  it("sends one on a streamed ai-chat call, signed in or not", async () => {
    await callEdge({ fn: "ai-chat", body: {}, auth: "anon", stream: true });
    await callEdge({ fn: "ai-chat", body: {}, auth: "user-jwt", stream: true });
    expect(sentHeaders(0)[IDEMPOTENCY_HEADER]).toBeTruthy();
    expect(sentHeaders(1)[IDEMPOTENCY_HEADER]).toBeTruthy();
  });

  it("sends none to a function that does not bill, whose CORS list may not allow it", async () => {
    await callEdge({ fn: "academy-chat", body: {}, auth: "user-jwt", stream: true });
    await callEdge({ fn: "analyze-meal", body: {}, auth: "user-jwt" });
    expect(sentHeaders(0)).not.toHaveProperty(IDEMPOTENCY_HEADER);
    expect(sentHeaders(1)).not.toHaveProperty(IDEMPOTENCY_HEADER);
  });
});

describe("the text-to-speech callers outside callEdge", () => {
  it("library read-aloud sends a fresh key per synthesis", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.example");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    fetchMock.mockImplementation(async () => new Response(new ArrayBuffer(4), { status: 200 }));
    const { fetchSpeechArrayBuffer } = await import("@/lib/library/textToSpeech");
    await fetchSpeechArrayBuffer("one");
    await fetchSpeechArrayBuffer("two");
    const [a, b] = [sentHeaders(0)[IDEMPOTENCY_HEADER], sentHeaders(1)[IDEMPOTENCY_HEADER]];
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,120}$/);
    expect(a).not.toBe(b);
    expect(sentHeaders(0).Authorization).toBe("Bearer user-token");
  });

  it("the kids voice tool sends a fresh key per synthesis", async () => {
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:x" }));
    const { textToSpeech } = await import("@/features/visionkids/services/studio/voiceTools");
    await textToSpeech("one");
    await textToSpeech("two");
    const calls = invoke.mock.calls as unknown as Array<[string, { headers: Record<string, string> }]>;
    expect(calls[0][0]).toBe("text-to-speech");
    const [a, b] = [calls[0][1].headers[IDEMPOTENCY_HEADER], calls[1][1].headers[IDEMPOTENCY_HEADER]];
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,120}$/);
    expect(a).not.toBe(b);
  });
});
