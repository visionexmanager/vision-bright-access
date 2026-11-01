import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ASSISTANTS } from "../../supabase/functions/_shared/assistants.ts";
import { THINKING_GUIDE } from "../../supabase/functions/_shared/thinkingGuide.ts";
import {
  FOLLOW_UP_CONTEXT_CHARS,
  FOLLOW_UP_MAX_CHARS,
  boundQuery,
  contextualQuery,
} from "../../supabase/functions/_shared/whatsappKnowledge.ts";

describe("every assistant is told how to think", () => {
  it("puts the same method in every registry assistant", () => {
    const all = Object.values(ASSISTANTS);
    expect(all.length).toBeGreaterThan(10);
    for (const assistant of all) expect(assistant.systemPrompt, assistant.id).toContain(THINKING_GUIDE);
  });

  it("puts it in the website chat too, and lists the new pages there", () => {
    const chat = readFileSync("supabase/functions/ai-chat/index.ts", "utf8");
    expect(chat).toContain("${THINKING_GUIDE}");
    for (const path of ["/travel", "/global-shopping", "/services/file-studio"]) expect(chat).toContain(`**${path}**`);
  });

  it("covers the ways a fluent model lets people down", () => {
    for (const rule of [
      "what the person is trying to get done",
      "Arabic written in Latin letters",
      "Use the whole conversation",
      "answer every one",
      "Lead with the answer",
      "check it",
      "Never invent a fact",
      "their language and dialect",
      "next step",
    ]) expect(THINKING_GUIDE, rule).toContain(rule);
  });

  it("stays short enough to send with every call", () => {
    expect(THINKING_GUIDE.length).toBeLessThan(3_200);
  });

  it("does not tell the model about its own channel's format", () => {
    expect(THINKING_GUIDE).not.toMatch(/markdown|WhatsApp|asterisk/i);
  });
});

describe("a follow-up is searched with the question before it", () => {
  it("joins a short message to the person's previous question", () => {
    expect(contextualQuery("and the price?", ["how do I order from Amazon", "ok"])).toBe("ok and the price?");
    expect(contextualQuery("and the price?", ["how do I order from Amazon"])).toBe("how do I order from Amazon and the price?");
  });

  it("uses the nearest earlier message that is not the same one", () => {
    expect(contextualQuery("price?", ["how do I convert a pdf", "price?"])).toBe("how do I convert a pdf price?");
  });

  it("leaves a full question alone, so changing the subject costs nothing", () => {
    const full = "what is the refund policy for a cancelled order please";
    expect(contextualQuery(full, ["how do I order"])).toBe(full);
    expect(contextualQuery("x".repeat(FOLLOW_UP_MAX_CHARS + 1), ["before"])).toHaveLength(FOLLOW_UP_MAX_CHARS + 1);
  });

  it("does nothing when there is nothing before it, or nothing in it", () => {
    expect(contextualQuery("and the price?", [])).toBe("and the price?");
    expect(contextualQuery("and the price?", ["", "  ", undefined])).toBe("and the price?");
    expect(contextualQuery("  ", ["before"])).toBe("");
    expect(contextualQuery(null, ["before"])).toBe("");
  });

  it("carries only the end of a long earlier message, and the result is still bounded", () => {
    const long = "a".repeat(1000);
    const q = contextualQuery("and then?", [long]);
    expect(q).toBe(`${"a".repeat(FOLLOW_UP_CONTEXT_CHARS)} and then?`);
    expect(boundQuery(q)).not.toBeNull();
  });

  it("works for Arabic, where a follow-up is often two words", () => {
    expect(contextualQuery("طيب والباقي؟", ["كيف أطلب من أمازون"])).toBe("كيف أطلب من أمازون طيب والباقي؟");
  });

  it("is what the WhatsApp assistant searches with", () => {
    const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    expect(webhook).toContain("contextualQuery(questionText,");
  });
});
