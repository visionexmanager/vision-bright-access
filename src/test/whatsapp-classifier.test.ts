// Phase B1 — labelling a message without paying a model to read it.
//
// The interesting assertions here are not the ones where it gets the answer
// right. They are the ones where it *declines* to answer: a tie, a language it
// does not cover, a grievance that is only nearly a grievance. Deferring costs
// a provider call that was being made anyway, so the classifier is allowed to
// be shy — and these tests are what keep it shy rather than confident-and-wrong.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { Category } from "../../supabase/functions/_shared/whatsappTriage.ts";

const classifier = await import("../../supabase/functions/_shared/whatsappClassifier.ts");
const triage = await import("../../supabase/functions/_shared/whatsappTriage.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

const label = (text: string): Category | null => classifier.localCategory({ text }).category;

// ── 1. The cases it should settle without a provider ─────────────────────────

describe("labels the clear cases locally", () => {
  const clear: Array<[string, Category]> = [
    // English
    ["I was charged twice for my subscription, I need a refund", "billing"],
    ["where is my order, the tracking says nothing", "order"],
    ["I forgot my password and cannot log in", "account"],
    ["the app is not working, it shows an error every time", "technical"],
    ["do you have olive oil in stock in the shop", "bazaar"],
    ["thank you so much, great work on the app", "feedback"],

    // Arabic — the language this channel actually receives
    ["خصمتوا مني مرتين وبدي استرجاع الفلوس", "billing"],
    ["وين طلبي؟ صار له اسبوع وما وصل", "order"],
    ["نسيت كلمة السر وما بقدر ادخل على حسابي", "account"],
    ["التطبيق ما بيشتغل وبيطلع خطأ", "technical"],
    ["عندكم زيت زيتون بالمتجر؟", "bazaar"],
    ["شكرا جزيلا، عمل رائع", "feedback"],
  ];

  for (const [text, expected] of clear) {
    it(`${expected}: ${text.slice(0, 42)}…`, () => {
      expect(label(text)).toBe(expected);
    });
  }

  it("only ever returns a category the triage module knows", () => {
    for (const [text] of clear) {
      const got = label(text);
      expect(got === null || triage.isCategory(got), String(got)).toBe(true);
    }
  });
});

// ── 2. The cases it must NOT settle ──────────────────────────────────────────

describe("defers instead of guessing", () => {
  it("defers on a greeting, which is about nothing", () => {
    for (const text of ["hello", "مرحبا", "hi there", "السلام عليكم"]) {
      expect(label(text), text).toBeNull();
    }
  });

  it("defers on a genuinely ambiguous message", () => {
    // Payment words and order words in equal measure: a coin flip is worse
    // than asking the model.
    const verdict = classifier.classifyLocally({
      text: "I paid for my order and the payment shows but the delivery never arrived",
    });
    expect(verdict.category).not.toBeNull();          // it has an opinion
    expect(classifier.localCategory({
      text: "I paid for my order and the payment shows but the delivery never arrived",
    }).category, "but not a confident one").toBeNull();
  });

  it("defers on a language the lexicons do not cover", () => {
    // Japanese, Korean, Bengali, Vietnamese: no coverage, so no guess. This is
    // the design working, not a gap — the model answers exactly as it does now.
    for (const text of [
      "注文はどこにありますか",
      "제 주문은 어디에 있나요",
      "আমার অর্ডার কোথায়",
      "đơn hàng của tôi ở đâu",
    ]) {
      expect(label(text), text).toBeNull();
    }
  });

  it("defers on an empty or trivial message", () => {
    for (const text of ["", "  ", "?", "ok", "\n\n"]) {
      expect(label(text), JSON.stringify(text)).toBeNull();
    }
  });

  it("never throws, on anything", () => {
    for (const text of [
      "x".repeat(200_000),
      String.fromCharCode(0).repeat(100),
      "\uD800",
      "'; DROP TABLE whatsapp_messages; --",
      "😀".repeat(2_000),
    ]) {
      expect(() => classifier.localCategory({ text })).not.toThrow();
      expect(() => classifier.classifyLocally({ text })).not.toThrow();
    }
    expect(() => classifier.localCategory({ text: null as unknown as string })).not.toThrow();
  });
});

// ── 3. The one label that escalates ──────────────────────────────────────────

describe("complaint is held to a higher bar", () => {
  it("requires more confidence than any other label", () => {
    expect(classifier.COMPLAINT_CONFIDENCE_FLOOR)
      .toBeGreaterThan(classifier.LOCAL_CONFIDENCE_FLOOR);
  });

  it("labels a real grievance", () => {
    expect(label("this is unacceptable, the third time I contact you and nobody replied")).toBe("complaint");
    expect(label("غير مقبول، للمرة الثالثة بتواصل معكم وما حدا رد")).toBe("complaint");
  });

  it("does NOT label an unhappy technical question as a complaint", () => {
    // The distinction that matters: a message can mention a problem, and be
    // annoyed about it, without being a grievance. Labelling it `complaint`
    // puts a routine question into a human queue for nothing.
    const annoyed = "the app is not working again and it is really slow";
    expect(label(annoyed)).not.toBe("complaint");
    expect(label(annoyed)).toBe("technical");
  });

  it("MUTATION: one mild word scores high, and is still refused", () => {
    // This is the bug the test found. "disappointed" alone has no runner-up,
    // so the margin is perfect and the confidence comes out at 0.75 — above
    // even the stricter complaint floor. A confidence built from one word is
    // confident about very little, and it would have escalated a routine
    // message to a person.
    const weak = "disappointed";
    const scored = classifier.classifyLocally({ text: weak });
    expect(scored.category).toBe("complaint");
    expect(scored.confidence).toBeGreaterThan(classifier.COMPLAINT_CONFIDENCE_FLOOR);
    expect(scored.signals).toBe(1);
    expect(scored.peak).toBeLessThan(4);

    // The floor alone would have let it through. The rule is what stops it.
    expect(classifier.localCategory({ text: weak }).category).toBeNull();
  });

  it("accepts a grievance said outright, or said twice", () => {
    // One whole phrase is enough…
    const outright = classifier.classifyLocally({ text: "this is unacceptable" });
    expect(outright.peak).toBe(4);
    expect(classifier.localCategory({ text: "this is unacceptable" }).category).toBe("complaint");
    // …and so are two milder words together.
    const twice = classifier.localCategory({ text: "very bad and rude, I want to complain" });
    expect(twice.category).toBe("complaint");
  });

  it("keeps escalation behaviour identical for the labels it produces", () => {
    // The classifier changes who produced the label, never what the label
    // means. `shouldEscalate` is untouched and still decides.
    expect(triage.shouldEscalate({ category: "complaint", consecutiveDeclines: 0, text: "x" })).toBe("complaint");
    expect(triage.shouldEscalate({ category: "billing", consecutiveDeclines: 0, text: "x" })).toBeNull();
    expect(triage.shouldEscalate({ category: null, consecutiveDeclines: 0, text: "x" })).toBeNull();
  });

  it("leaves the sensitive-word escalation working regardless of label", () => {
    // The severe cases never depended on the category and still do not.
    expect(triage.shouldEscalate({ category: "general", consecutiveDeclines: 0, text: "my card was charged twice" })).toBe("sensitive");
    expect(triage.shouldEscalate({ category: null, consecutiveDeclines: 0, text: "حسابي اخترق" })).toBe("sensitive");
  });
});

// ── 4. Arabic is matched the way the router matches Arabic ───────────────────

describe("Arabic folding", () => {
  it("matches through the diacritics an Arabic keyboard adds", () => {
    expect(label("خَصَمتوا مني مرتين وبدي استرجاع")).toBe("billing");
  });

  it("matches through alef and ya variants", () => {
    expect(label("أين طلبى؟ ما وصل")).toBe(label("اين طلبي؟ ما وصل"));
  });

  it("uses content words, not short function words", () => {
    // The hazard with Arabic substring matching is a two-letter particle
    // appearing inside unrelated sentences. Every Arabic term in the lexicon
    // is a content word, so an ordinary sentence with no topic scores nothing.
    expect(label("كيف حالك اليوم يا صديقي")).toBeNull();
    expect(label("ما رأيك بالطقس في عمان")).toBeNull();
  });
});

// ── 5. Wired into production, local-first with the model behind it ───────────

describe("the webhook asks locally first", () => {
  it("tries the local classifier before the provider", () => {
    // Against the provider call, not the `CLASSIFY_TARGETS` declaration near
    // the top of the file — the declaration says nothing about ordering.
    const local = webhook.indexOf("localCategory({ text: questionText })");
    const remote = webhook.indexOf("targets: CLASSIFY_TARGETS");
    expect(local).toBeGreaterThan(0);
    expect(remote).toBeGreaterThan(0);
    expect(local).toBeLessThan(remote);
  });

  it("still calls the model when the local answer was not confident", () => {
    // The guarantee that quality cannot regress: the fallback is intact.
    expect(webhook).toContain("CLASSIFY_TARGETS");
    expect(webhook).toContain("structuredCompletionWithFallback");
    expect(webhook).toContain("withDeadline");
  });

  it("keeps quickCategory ahead of everything, as the cheapest answer", () => {
    expect(webhook.indexOf("quickCategory(")).toBeLessThan(webhook.indexOf("localCategory("));
  });

  it("logs a label and a count, never the message", () => {
    const line = webhook.slice(webhook.indexOf('log("classified"'), webhook.indexOf('log("classified"') + 260);
    expect(line).toContain("category");
    expect(line).not.toContain("questionText");
    expect(line).not.toContain("incoming.from");
  });
});
