import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTEXT_WINDOW_MS,
  continuityDirective,
  continuityStart,
  isReplayable,
  lastChoices,
  looksLikeFollowUp,
  summaryIsFresh,
  type HistoryRow,
} from "../../supabase/functions/_shared/whatsappContinuity";
import { boundMessages, digestEarlier, MAX_EARLIER_CHARS } from "../../supabase/functions/ai-chat/limits";
import {
  CHAT_HISTORY_TTL_MS,
  chatHistoryKey,
  loadChatHistory,
  saveChatHistory,
} from "@/lib/ai/chatHistory";

const NOW = Date.parse("2026-10-24T12:00:00Z");
const out = (body: string, kind: string | null = "reply"): HistoryRow => ({ direction: "outbound", body, kind });
const inn = (body: string): HistoryRow => ({ direction: "inbound", body, kind: null });

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => { data[k] = v; },
    removeItem: (k: string) => { delete data[k]; },
  };
}

describe("WhatsApp continuity window", () => {
  it("never reaches back more than 24 hours", () => {
    expect(Date.parse(continuityStart(null, NOW))).toBe(NOW - CONTEXT_WINDOW_MS);
    expect(Date.parse(continuityStart("2026-01-01T00:00:00Z", NOW))).toBe(NOW - CONTEXT_WINDOW_MS);
  });

  it("lets 'new conversation' win when it is more recent", () => {
    const started = "2026-10-24T10:00:00Z";
    expect(continuityStart(started, NOW)).toBe(new Date(started).toISOString());
  });

  it("drops a summary older than the window", () => {
    expect(summaryIsFresh(new Date(NOW - 60_000).toISOString(), NOW)).toBe(true);
    expect(summaryIsFresh(new Date(NOW - CONTEXT_WINDOW_MS - 1).toISOString(), NOW)).toBe(false);
    expect(summaryIsFresh(null, NOW)).toBe(false);
  });

  it("replays answers and menus but not fixed welcome or handover copy", () => {
    expect(isReplayable(out("menu text", "unsupported"))).toBe(true);
    expect(isReplayable(out("hello", "welcome"))).toBe(false);
    expect(isReplayable(out("a person will help", "handover"))).toBe(false);
    expect(isReplayable(inn("hi"))).toBe(true);
    expect(isReplayable({ direction: "inbound", body: null, kind: null })).toBe(false);
  });
});

describe("WhatsApp reference resolution", () => {
  const list = "Books I found:\n1. Dune\n2. Emma\n3) Ulysses";

  it("restates the newest numbered list so 'the second one' has a target", () => {
    const rows = [out("1. Old\n2. Older"), inn("books"), out(list)];
    expect(lastChoices(rows)).toEqual(["1. Dune", "2. Emma", "3. Ulysses"]);
  });

  it("does not resurrect a list from long ago", () => {
    const rows = [out(list), inn("a"), out("plain"), inn("b"), out("plain"), inn("c"), out("plain")];
    expect(lastChoices(rows)).toEqual([]);
  });

  it("flags short follow-ups in several languages, not new topics", () => {
    for (const q of ["yes", "2", "the second one", "نعم", "الثاني", "كمل", "more please"]) {
      expect(looksLikeFollowUp(q), q).toBe(true);
    }
    expect(looksLikeFollowUp("What are the opening hours of the Beirut office on Fridays?")).toBe(false);
  });

  it("always carries the language rule, and the list only when there is one", () => {
    const plain = continuityDirective({ question: "tell me about plans please and prices", rows: [inn("x")] });
    expect(plain).toMatch(/dialect/);
    expect(plain).not.toMatch(/numbered options/);
    const withList = continuityDirective({ question: "2", rows: [out(list)] });
    expect(withList).toMatch(/2\. Emma/);
    expect(withList).toMatch(/short follow-up/);
  });
});

describe("website history", () => {
  it("keeps a digest of questions that fell out of the window instead of forgetting them", () => {
    const input = Array.from({ length: 50 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `turn ${i}` }));
    const bounded = boundMessages(input);
    if (!bounded.ok) throw new Error("expected ok");
    expect(bounded.messages.length).toBeLessThanOrEqual(40);
    expect(bounded.earlier).toContain("- turn 0");
    expect(bounded.earlier).not.toContain("turn 1\n"); // assistant turns are not digested
  });

  it("collapses whitespace in digested questions without eating letters", () => {
    expect(digestEarlier([{ role: "user", content: "show   me\nsessions" }])).toBe("- show me sessions");
  });

  it("bounds the digest", () => {
    const dropped = Array.from({ length: 200 }, () => ({ role: "user" as const, content: "x".repeat(300) }));
    expect(digestEarlier(dropped).length).toBeLessThanOrEqual(MAX_EARLIER_CHARS);
  });

  it("round-trips a chat within 24h, scoped per user", () => {
    const store = memoryStorage();
    const key = chatHistoryKey("user-a");
    saveChatHistory(key, [{ id: "1", role: "user", content: "hi" }, { id: "2", role: "assistant", content: "⚠️ failed" }], NOW, store);
    expect(loadChatHistory(key, NOW + 1000, store).map((m) => m.content)).toEqual(["hi"]);
    expect(loadChatHistory(chatHistoryKey("user-b"), NOW + 1000, store)).toEqual([]);
  });

  it("expires after 24h and removes the stored copy", () => {
    const store = memoryStorage();
    const key = chatHistoryKey(null);
    saveChatHistory(key, [{ id: "1", role: "user", content: "hi" }], NOW, store);
    expect(loadChatHistory(key, NOW + CHAT_HISTORY_TTL_MS + 1, store)).toEqual([]);
    expect(store.data[key]).toBeUndefined();
  });

  it("survives corrupt storage", () => {
    const store = memoryStorage({ k: "{not json" });
    expect(loadChatHistory("k", NOW, store)).toEqual([]);
  });
});

describe("wiring", () => {
  const webhook = readFileSync(resolve(__dirname, "../../supabase/functions/whatsapp-webhook/index.ts"), "utf8");
  const aiChat = readFileSync(resolve(__dirname, "../../supabase/functions/ai-chat/index.ts"), "utf8");

  it("the webhook clamps history, expires the summary and passes the directive", () => {
    expect(webhook).toContain("continuityStart(");
    expect(webhook).toContain("summaryIsFresh(");
    expect(webhook).toContain("continuityDirective({ question: questionText, rows: replayRows })");
    expect(webhook).not.toMatch(/row\.kind === null \|\| row\.kind === "reply"\)\s*\.reverse\(\)\s*\.map\(\(row\) => \(\{\s*role/);
  });

  it("ai-chat fences the digest as untrusted context", () => {
    expect(aiChat).toContain("untrustedContextBlock({ earlier_in_this_conversation: earlier || undefined })");
    expect(aiChat).toContain("CONTINUITY_RULES");
  });
});
