import { describe, expect, it } from "vitest";
import {
  LOCAL_TRANSLATE_LANGUAGES,
  localTranslateEnabled,
  readTranslatePayload,
  translateLocally,
} from "../../supabase/functions/_shared/whatsappLocalTranslate";
import { translateArticle } from "../../supabase/functions/_shared/whatsappNewsTranslate";
import { TRANSLATE_LANGUAGES, checkTranslateRequest, readTranslateAnswer } from "../../services/media-processor/src/translate.mjs";

const config = { url: "https://example.test/internal/media", token: "t" };
const on = (name: string) => (name === "LOCAL_TRANSLATE" ? "on" : undefined);
const reply = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

describe("the server's own translator", () => {
  it("lists the same twenty languages on both sides", () => {
    expect([...LOCAL_TRANSLATE_LANGUAGES].sort()).toEqual([...TRANSLATE_LANGUAGES].sort());
    expect(LOCAL_TRANSLATE_LANGUAGES).toHaveLength(20);
  });

  it("is off unless the switch is exactly on", async () => {
    expect(localTranslateEnabled(() => "yes")).toBe(false);
    expect(await translateLocally({ text: "hi", language: "ar", config, read: () => undefined }))
      .toEqual({ ok: false, reason: "disabled" });
  });

  it("declines what it cannot translate before sending anything", async () => {
    let called = false;
    const fetchImpl = (async () => { called = true; return new Response("{}"); }) as typeof fetch;
    expect(await translateLocally({ text: "hi", language: "xx", config, read: on, fetchImpl }))
      .toEqual({ ok: false, reason: "language_unsupported" });
    expect(await translateLocally({ text: "a".repeat(6001), language: "ar", config, read: on, fetchImpl }))
      .toEqual({ ok: false, reason: "too_long" });
    expect(await translateLocally({ text: "hi", language: "ar", config: null, read: on, fetchImpl }))
      .toEqual({ ok: false, reason: "not_configured" });
    expect(called).toBe(false);
  });

  it("reads a good answer, cleans it, and maps busy and errors", async () => {
    const ok = await translateLocally({
      text: "Hello", language: "ar", config, read: on,
      fetchImpl: reply(200, { ok: true, text: "‮مرحبا", ms: 5 }) as never,
    });
    expect(ok).toEqual({ ok: true, text: "مرحبا", ms: 5 });
    expect(await translateLocally({ text: "Hello", language: "ar", config, read: on, fetchImpl: reply(503, {}) as never }))
      .toEqual({ ok: false, reason: "busy" });
    expect(readTranslatePayload({ ok: false, reason: "not_configured" })).toEqual({ ok: false, reason: "error" });
    expect(readTranslatePayload({ ok: true, text: "." })).toEqual({ ok: false, reason: "unreadable" });
  });
});

describe("the processor's side", () => {
  it("refuses empty, long and unsupported requests", () => {
    expect(checkTranslateRequest({ text: " ", target: "ar" })).toEqual({ ok: false, reason: "empty" });
    expect(checkTranslateRequest({ text: "x".repeat(6001), target: "ar" })).toEqual({ ok: false, reason: "too_long" });
    expect(checkTranslateRequest({ text: "hello", target: "xx" })).toEqual({ ok: false, reason: "unsupported_language" });
    expect(checkTranslateRequest({ text: "hello", target: "ar" })).toEqual({ ok: true, text: "hello", target: "ar" });
    expect(readTranslateAnswer({ ok: true, text: "مرحبا" })).toBe("مرحبا");
    expect(readTranslateAnswer({ ok: false })).toBeNull();
  });
});

describe("a news article through the local translator first", () => {
  const article = { id: "1", title: "Hello", description: "World news", category: "x", publishedAt: null, translations: null };
  const neverAsked = (async () => { throw new Error("provider asked"); }) as never;

  it("uses the server's answer and skips the provider chain", async () => {
    const result = await translateArticle(article, "ar", "العربية", neverAsked, async () => "مرحبا\nأخبار العالم");
    expect(result).toEqual({ title: "مرحبا", description: "أخبار العالم" });
  });

  it("falls back to the chain when the server is off, busy, or answers badly", async () => {
    const chain = (async () => ({ status: "answered", text: "عنوان ||| وصف", provider: "p", model: "m", ms: 1 })) as never;
    for (const local of [async () => null, async () => "عنوان فقط", async () => { throw new Error("x"); }]) {
      expect(await translateArticle(article, "ar", "العربية", chain, local)).toEqual({ title: "عنوان", description: "وصف" });
    }
  });
});
