// Proposals written for today, and products looked for in the big stores.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildContentWriterSystem,
  CONTENT_ANGLES,
  timelinessContext,
  upcomingOccasions,
} from "../../supabase/functions/_shared/content/writerPrompt.ts";
import { staleYears } from "../../supabase/functions/_shared/content/proposalRules.ts";
import { STORE_SEARCHES, storeSearchLinks } from "../../supabase/functions/_shared/whatsappSourcing.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";

const engine = readFileSync("supabase/functions/_shared/contentEngine.ts", "utf8");
const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

describe("a proposal knows what day it is", () => {
  const now = new Date("2026-09-17T09:00:00Z");

  it("states today's date and year, and forbids past years", () => {
    const { today } = timelinessContext(now, "en", 0);
    expect(today).toContain("17 September 2026");
    expect(today).toContain("The current year is 2026");
    expect(today).toMatch(/never mention a year before 2026/i);
  });

  it("names the occasions coming up, and none that have passed", () => {
    const en = upcomingOccasions(now, "en");
    expect(en).toContain("World Sight Day (2026-10-08)");
    expect(en).toContain("White Cane Safety Day (2026-10-15)");
    expect(en.join(" ")).not.toContain("World Braille Day");
    expect(upcomingOccasions(new Date("2026-12-20T00:00:00Z"), "en").join(" ")).toContain("World Braille Day (2027-01-04)");
  });

  it("rotates the angle and puts timing, angle and platform format in the prompt", () => {
    const angles = new Set([0, 1, 2, 3, 4, 5, 6].map((seed) => timelinessContext(now, "ar", seed).angle));
    expect(angles.size).toBe(CONTENT_ANGLES.length);
    const system = buildContentWriterSystem({
      section: "academy_courses", contentType: "reel", platform: "instagram",
      sources: "- [x] course", today: "Today is X.", angle: "a practical tip", correction: "Fix 2023.",
    }, "ar");
    expect(system).toContain("TIMING — Today is X.");
    expect(system).toContain("Angle for this post: a practical tip");
    expect(system).toContain("Instagram:");
    expect(system).toContain("CORRECTION — Fix 2023.");
  });

  it("catches a past year the records do not contain", () => {
    expect(staleYears("أطلقنا الدورة في 2023", "", 2026)).toEqual([2023]);
    expect(staleYears("founded in 2019", "Visionex founded in 2019", 2026)).toEqual([]);
    expect(staleYears("see you in 2026 and 2027", "", 2026)).toEqual([]);
    expect(staleYears("call 12023 or 20230", "", 2026)).toEqual([]);
  });

  it("retries a dated draft once, then refuses it", () => {
    expect(engine).toContain("for (let attempt = 0; attempt < 2; attempt++)");
    expect(engine).toContain('return { ok: false, error: "stale_date"');
    expect(engine).toContain("params.correction =");
    expect(engine).toContain("today: timing.today");
  });
});

describe("a product nobody lists", () => {
  it("is looked for in the big stores, with the words encoded", () => {
    const text = storeSearchLinks("سماعة بلوتوث & case", "ar");
    for (const store of STORE_SEARCHES) expect(text).toContain(store.name);
    expect(text).toContain(encodeURIComponent("سماعة بلوتوث & case"));
    for (const line of text.split("\n").filter((l) => l.startsWith("• "))) expect(line).not.toContain("& case");
    expect(text).toContain("بدي أحكي مع موظف");
  });

  it("is a finished sentence in every language", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const text = storeSearchLinks("headphones", language);
      expect(text, language).not.toMatch(/\{[a-z]+\}/i);
      expect(text, language).toContain("headphones");
    }
  });

  it("is sent when the bazaar and the catalogue come back empty", () => {
    expect(webhook).toContain("await reply(storeSearchLinks(productNotFound, answerLanguage)");
    expect(webhook.indexOf("productNotFound = bazaarRequest.terms.join")).toBeLessThan(
      webhook.indexOf("await reply(storeSearchLinks(productNotFound"),
    );
  });
});
