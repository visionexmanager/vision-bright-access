import { describe, expect, it } from "vitest";
import { findServices, normalise, tokenise } from "./navigatorEngine";
import { INTENTS } from "./hubs";

const slugs = (query: Parameters<typeof findServices>[0], limit?: number) =>
  findServices(query, limit).map((m) => m.entry.slug);

describe("normalise", () => {
  it("folds case and punctuation", () => {
    expect(normalise("Solar Energy!")).toBe("solar energy");
  });

  it("normalises Arabic orthography so spelling variants still match", () => {
    expect(normalise("طاقةٌ")).toBe("طاقه");
    expect(normalise("أحمد")).toBe("احمد");
    expect(normalise("مصطفى")).toBe("مصطفي");
  });
});

describe("tokenise", () => {
  it("drops single-character noise and function words", () => {
    expect(tokenise("a laptop is broken")).toEqual(["laptop", "broken"]);
  });

  it("drops Arabic function words that would otherwise match as substrings", () => {
    // "لا" appears inside "الألواح" (panels) and many other unrelated words.
    expect(tokenise("اللابتوب لا يعمل")).not.toContain("لا");
    expect(tokenise("اللابتوب لا يعمل")).toContain("اللابتوب");
  });
});

describe("findServices", () => {
  it("returns nothing for an empty query", () => {
    expect(findServices({})).toEqual([]);
  });

  it("returns nothing when the text matches nothing in the catalog", () => {
    expect(findServices({ text: "zzzzqqq" })).toEqual([]);
  });

  it("finds the repair experiences from a plain-English complaint", () => {
    const result = slugs({ text: "my laptop is not working" });
    expect(result).toContain("laptop-repair");
  });

  it("finds the repair experiences from the same complaint in Arabic", () => {
    const result = slugs({ text: "اللابتوب لا يعمل" });
    expect(result).toContain("laptop-repair");
  });

  it("matches Arabic text even with attached prefixes", () => {
    // "والشبكة" — conjunction + article glued to the keyword.
    const result = slugs({ text: "والشبكة" });
    expect(result).toContain("network-noc");
  });

  it("does not flood the results with unrelated entries for a natural sentence", () => {
    // Regression: short Arabic function words used to match as substrings
    // inside unrelated words, scoring half the catalog as a "direct match".
    const result = slugs({ text: "اللابتوب لا يعمل" });
    expect(result[0]).toBe("laptop-repair");
    expect(result.length).toBeLessThanOrEqual(2);
    expect(result).not.toContain("solar-energy");
    expect(result).not.toContain("ai-media-studio");
    expect(result).not.toContain("barber-salon");
  });

  it("keeps English sentences focused too", () => {
    const result = slugs({ text: "I want to open a perfume business" });
    expect(result[0]).toBe("perfume-lab");
    expect(result).not.toContain("network-noc");
  });

  it("ranks an intent match above an incidental keyword match", () => {
    const [top] = findServices({ intent: "fix-a-device" });
    expect(top.entry.intents).toContain("fix-a-device");
    expect(top.reasons).toContain("intent");
  });

  it("returns results for every intent chip so no chip dead-ends", () => {
    for (const intent of INTENTS) {
      expect(findServices({ intent: intent.id }).length, intent.id).toBeGreaterThan(0);
    }
  });

  it("prefers entries at the requested experience level", () => {
    const starters = findServices({ intent: "start-a-business", level: "starter" }, 3);
    expect(starters.some((m) => m.entry.difficulty === "starter")).toBe(true);
  });

  it("pushes already-completed entries below fresh suggestions", () => {
    const before = slugs({ intent: "fix-a-device" });
    const top = before[0];
    const after = slugs({ intent: "fix-a-device", completedSlugs: [top] }, 50);
    expect(after[0]).not.toBe(top);
    // Demoted, not removed — a visitor can still choose to repeat it.
    expect(after).toContain(top);
    expect(after.indexOf(top)).toBeGreaterThan(0);
  });

  it("explains every recommendation", () => {
    for (const match of findServices({ text: "solar" })) {
      expect(match.reasons.length, match.entry.slug).toBeGreaterThan(0);
    }
  });

  it("respects the limit", () => {
    expect(findServices({ intent: "start-a-business" }, 3).length).toBe(3);
  });

  it("is deterministic for the same query", () => {
    const a = slugs({ intent: "learn-a-skill", text: "english" });
    const b = slugs({ intent: "learn-a-skill", text: "english" });
    expect(a).toEqual(b);
  });

  it("combines intent and text to sharpen the ranking", () => {
    const [top] = findServices({ intent: "start-a-business", text: "perfume" });
    expect(top.entry.slug).toBe("perfume-lab");
  });
});
