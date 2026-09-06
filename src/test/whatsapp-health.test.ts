// ─── Emergency care, and the doctor on the corner ───────────────────────────
//
// The map already knew where the hospitals were: `services.nearby` has had
// `hospital`, `clinic` and `pharmacy` since it shipped, it reads OpenStreetMap
// without a key, and tapping a result sends the pin. What is new is the request
// that must not be answered like the others, and one category that was missing.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const health = await import("../../supabase/functions/_shared/whatsappHealth.ts");
const location = await import("../../supabase/functions/_shared/whatsappLocation.ts");
const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");
const strings = await import("../../supabase/functions/_shared/whatsappStrings.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const geo = readFileSync("supabase/functions/_shared/whatsappGeo.ts", "utf8");

describe("asking for emergency care", () => {
  it("hears it in a sentence, not only as a keyword", () => {
    // Somebody in trouble types a sentence. The other geography parsers match
    // whole messages, and that rule would have missed every one of these.
    for (
      const text of [
        "طوارئ",
        "الطوارئ",
        "بدي طوارئ",
        "اسعاف بسرعة",
        "أحتاج إسعاف",
        "emergency",
        "I need an ambulance",
        "urgent care please",
      ]
    ) {
      expect(health.asksForEmergencyCare(text), text).toBe(true);
    }
  });

  it("does not hijack a sentence that merely contains the word", () => {
    // A false positive costs somebody a list they did not want. It should still
    // not fire on a conversation about something else entirely — which is what
    // the length cap buys, rather than a narrower word list.
    for (
      const text of [
        "the emergency exit at the cinema was blocked all evening and nobody said anything",
        "ما هو رقم الطوارئ في المستشفى الذي زرته الأسبوع الماضي مع أخي وابن عمي",
        "",
        "   ",
      ]
    ) {
      expect(health.asksForEmergencyCare(text), text).toBe(false);
    }
  });

  it("refuses a message too long to be somebody asking for help now", () => {
    expect(health.asksForEmergencyCare(`emergency ${"x".repeat(80)}`)).toBe(false);
    expect(health.EMERGENCY_MAX_CHARS).toBe(60);
  });

  it("asks the map for hospitals and nothing else", () => {
    // A pharmacy is not an emergency room and a clinic may be shut. Mixing the
    // three costs somebody time they are least able to spend.
    expect(health.EMERGENCY_CATEGORY).toBe("hospital");
    expect(location.NEARBY_CATEGORIES).toHaveProperty(health.EMERGENCY_CATEGORY);
  });
});

describe("what the emergency answer says", () => {
  it("names the call before the list, in every language", () => {
    // Above the names because somebody reading this aloud to a person in
    // trouble should reach it first, and somebody listening should not have to
    // sit through five hospitals to be told to make a call instead.
    const branch = webhook.slice(webhook.indexOf("const emergency = !humanOwnsThis"));
    const callFirst = branch.indexOf('say("emergencyCallFirst"');
    const list = branch.indexOf("sendChoices(list");
    expect(callFirst).toBeGreaterThan(0);
    expect(callFirst).toBeLessThan(list);
  });

  it("prints no emergency telephone number anywhere", () => {
    // 199 countries, and a wrong number given in the minute somebody needs the
    // right one is the worst failure this system could produce. The sentence
    // names the thing to do; the digits are not invented.
    for (const language of ["ar", "en", "fr", "hi", "zh"] as const) {
      for (const key of ["emergencyCallFirst", "emergencyNeedsLocation"] as const) {
        const sentence = strings.say(key, language);
        expect(sentence, `${key}/${language}`).not.toMatch(/\b(112|911|999|997|998|123|122|193)\b/);
        expect(sentence.trim().length, `${key}/${language}`).toBeGreaterThan(0);
      }
    }
  });

  it("answers a missing pin with urgency rather than the ordinary request", () => {
    const branch = webhook.slice(webhook.indexOf("const emergency = !humanOwnsThis"));
    expect(branch).toContain('emergency ? say("emergencyNeedsLocation", answerLanguage) : locationNeededNotice');
  });

  it("says the call sentence even when the map is unreachable", () => {
    // Sent before the lookup. The map can be slow or down, and the one sentence
    // that might matter more than the list must not be the thing that fails to
    // arrive.
    const branch = webhook.slice(webhook.indexOf("const emergency = !humanOwnsThis"));
    const callFirst = branch.indexOf('say("emergencyCallFirst"');
    const lookup = branch.indexOf("fetchNearby(");
    expect(callFirst).toBeLessThan(lookup);
  });
});

describe("the doctor on the corner", () => {
  it("is a category the map is actually asked for", () => {
    // `amenity=doctors` is OpenStreetMap's tag for a practice rather than a
    // hospital. Adding the label without adding the tag would have produced a
    // category that always came back empty.
    expect(location.NEARBY_CATEGORIES).toHaveProperty("doctors");
    expect(geo).toMatch(/"doctors"/);
    const amenities = /const AMENITIES = \[([\s\S]*?)\];/.exec(geo)?.[1] ?? "";
    expect(amenities).toContain('"doctors"');
  });

  it("is named in every language, and reachable by typing that name", () => {
    for (const language of ["ar", "en", "tr", "fr", "ur"] as const) {
      const label = strings.say("catDoctors", language);
      expect(label.trim(), language).not.toBe("");
      expect(location.parseNearbyCategory(label, language), `${label}/${language}`).toBe("doctors");
    }
  });
});

describe("the row in the menu", () => {
  it("exists, is switched on, and needs a location", () => {
    const node = catalog.nodeById("health.emergency")!;
    expect(node.enabled).toBe(true);
    expect(node.parent).toBe("health");
    expect(node.requires).toContain("location");
    expect(node.accepts).toContain("location");
  });

  it("sits at the top level, inside the ten rows Meta allows", () => {
    const top = catalog.offeredChildrenOf(catalog.ROOT_ID).map((n) => n.id);
    expect(top).toContain("health");
    expect(top.length).toBeLessThanOrEqual(catalog.LIST_LIMITS.rows);
    // Health before Support and Settings: the rows people need are above the
    // rows every interface puts at the bottom.
    expect(top.indexOf("health")).toBeLessThan(top.indexOf("support"));
  });
});
