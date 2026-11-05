import { describe, expect, it } from "vitest";
import {
  chatLocally,
  localChatEnabled,
  readChatPayload,
  withLocalChat,
} from "../../supabase/functions/_shared/whatsappLocalChat";
import {
  MAX_HISTORY_CHARS,
  MAX_SYSTEM_CHARS,
  MAX_TURNS,
  checkChatRequest,
  chatRequestBody,
  readChatAnswer,
} from "../../services/media-processor/src/chat.mjs";

const config = { url: "https://example.test/internal/media", token: "t" };
const on = (name: string) => (name === "LOCAL_CHAT" ? "on" : undefined);
const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const request = { system: "rules", messages: [{ role: "user" as const, content: "hello there" }], maxTokens: 700 };

describe("the server's own chat model, edge side", () => {
  it("is off unless the switch is exactly on, and then changes nothing", async () => {
    expect(localChatEnabled(() => "yes")).toBe(false);
    const primary = async () => ({ text: "paid", provider: "p", model: "m" });
    expect(withLocalChat(primary, { read: () => undefined })).toBe(primary);
    expect(await chatLocally({ request, config, read: () => undefined })).toEqual({ ok: false, reason: "disabled" });
  });

  it("never calls the server when the paid chain answered", async () => {
    let called = false;
    const fetchImpl = (async () => { called = true; return new Response("{}"); }) as typeof fetch;
    const provider = withLocalChat(async () => ({ text: "paid", provider: "p", model: "m" }), { read: on, fetchImpl, config });
    expect(await provider(request)).toEqual({ text: "paid", provider: "p", model: "m" });
    expect(called).toBe(false);
  });

  it("answers locally when the chain throws or returns nothing", async () => {
    const fetchImpl = reply(200, { ok: true, text: "مرحبا‮ بك", ms: 4000 });
    const thrown = withLocalChat(async () => { throw Object.assign(new Error("down"), { status: 500 }); }, { read: on, fetchImpl, config });
    expect(await thrown(request)).toEqual({ text: "مرحبا بك", provider: "local", model: "qwen3-4b" });
    const empty = withLocalChat(async () => ({ text: "  ", provider: "p", model: "m" }), { read: on, fetchImpl, config });
    expect((await empty(request)).provider).toBe("local");
  });

  it("keeps the chain's own failure when the local model cannot answer either", async () => {
    const boom = Object.assign(new Error("down"), { status: 502 });
    const failing = withLocalChat(async () => { throw boom; }, { read: on, fetchImpl: reply(503, { ok: false, reason: "busy" }), config });
    await expect(failing(request)).rejects.toBe(boom);
    const emptyChain = withLocalChat(async () => ({ text: "", provider: "p", model: "m" }), { read: on, fetchImpl: reply(200, { ok: false }), config });
    expect((await emptyChain(request)).text).toBe("");
  });

  it("maps busy, errors and unreadable payloads without leaking a message", async () => {
    expect(await chatLocally({ request, config, read: on, fetchImpl: reply(503, {}) })).toEqual({ ok: false, reason: "busy" });
    expect(await chatLocally({ request, config, read: on, fetchImpl: reply(500, {}) })).toEqual({ ok: false, reason: "error" });
    expect(await chatLocally({ request, config: null, read: on })).toEqual({ ok: false, reason: "not_configured" });
    expect(readChatPayload("nope")).toEqual({ ok: false, reason: "bad_response" });
    expect(readChatPayload({ ok: true, text: "..", ms: 1 })).toEqual({ ok: false, reason: "unreadable" });
    expect(readChatPayload({ ok: false, reason: "busy" })).toEqual({ ok: false, reason: "busy" });
  });

  it("sends the token and a capped answer length", async () => {
    let seen: { auth: string | null; body: { max_tokens: number } } | null = null;
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      seen = { auth: (init.headers as Record<string, string>).authorization, body: JSON.parse(String(init.body)) };
      return new Response(JSON.stringify({ ok: true, text: "fine answer", ms: 1 }));
    }) as unknown as typeof fetch;
    await chatLocally({ request, config, read: on, fetchImpl });
    expect(seen!.auth).toBe("Bearer t");
    expect(seen!.body.max_tokens).toBe(200);
  });
});

describe("the server's own chat model, service side", () => {
  it("bounds the system part and keeps the newest turns that fit", () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `turn ${i} ` + "x".repeat(900) }));
    messages.push({ role: "user", content: "last question" });
    const checked = checkChatRequest({ system: "s".repeat(10_000), messages });
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(checked.system.length).toBe(MAX_SYSTEM_CHARS);
    expect(checked.messages.length).toBeLessThanOrEqual(MAX_TURNS);
    expect(checked.messages.reduce((n: number, m: { content: string }) => n + m.content.length, 0)).toBeLessThanOrEqual(MAX_HISTORY_CHARS + 13);
    expect(checked.messages.at(-1)).toEqual({ role: "user", content: "last question" });
  });

  it("refuses what it cannot answer", () => {
    expect(checkChatRequest(null)).toEqual({ ok: false, reason: "bad_request" });
    expect(checkChatRequest({ system: "s", messages: [] })).toEqual({ ok: false, reason: "bad_request" });
    expect(checkChatRequest({ system: "s", messages: [{ role: "system", content: "x" }] })).toEqual({ ok: false, reason: "bad_request" });
    expect(checkChatRequest({ system: "s", messages: [{ role: "assistant", content: "x" }] })).toEqual({ ok: false, reason: "bad_request" });
  });

  it("switches thinking off and strips any reasoning from the answer", () => {
    const checked = checkChatRequest({ system: "s", messages: [{ role: "user", content: "hi" }], max_tokens: 99999 });
    if (!checked.ok) throw new Error("expected ok");
    expect(checked.maxTokens).toBe(200);
    expect(chatRequestBody(checked).chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(readChatAnswer({ choices: [{ message: { content: "<think>hidden</think>Paris." } }] })).toBe("Paris.");
    expect(readChatAnswer({ choices: [{ message: { content: "<think>only</think>" } }] })).toBeNull();
    expect(readChatAnswer({})).toBeNull();
  });
});
