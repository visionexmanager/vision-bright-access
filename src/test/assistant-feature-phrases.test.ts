import { describe, expect, it } from "vitest";

import { SERVICE_FEE_PERCENT } from "@/features/sourcing/requests";
import { canConvertDocument } from "../../services/media-processor/src/docconvert.mjs";
import { FAQ_PATHS, FAQ_PHRASES, FAQ_REPLIES } from "../../supabase/functions/_shared/localFaqCatalogue.ts";
import {
  LOCALES,
  NAV_EXTRA,
  NAV_LABELS,
  NAV_PATHS,
  NAV_TARGETS,
} from "../../supabase/functions/_shared/localIntentCatalogue.ts";
import { answerLocally } from "../../supabase/functions/_shared/localIntents.ts";

const NEW_TARGETS = ["travel", "shopping", "files"] as const;
const BRANDS = ["amazon", "aliexpress", "alibaba", "shein", "temu", "ebay"];

describe("the assistant knows the travel, store and file features, in every language", () => {
  for (const locale of LOCALES) {
    it(`${locale}: the page names and their other names open the right page`, () => {
      for (const target of NEW_TARGETS) {
        const label = NAV_LABELS[locale][NAV_TARGETS.indexOf(target)];
        const names = [label, ...(NAV_EXTRA[target]?.[locale] ?? [])];
        expect(names.length, `${locale}/${target}`).toBeGreaterThan(1);
        for (const name of names) {
          const answer = answerLocally(name, { preferredLocale: locale });
          expect(answer, `${locale}: ${name}`).not.toBeNull();
          expect(answer!.match.intent, `${locale}: ${name}`).toBe(`nav.${target}`);
        }
      }
    });

    it(`${locale}: a store's own name opens the global stores page`, () => {
      for (const brand of BRANDS) {
        const answer = answerLocally(brand, { preferredLocale: locale });
        expect(answer?.match.intent, `${locale}: ${brand}`).toBe("nav.shopping");
        expect(answer!.match.locale, `${locale}: ${brand}`).toBe(locale);
      }
    });
  }

  it("sends travel to /travel, stores to /global-shopping and files to File Studio", () => {
    expect(NAV_PATHS.travel).toBe("/travel");
    expect(NAV_PATHS.shopping).toBe("/global-shopping");
    expect(NAV_PATHS.files).toBe("/services/file-studio");
    expect(FAQ_PATHS.travel).toBe(NAV_PATHS.travel);
    expect(FAQ_PATHS.stores).toBe(NAV_PATHS.shopping);
    expect(FAQ_PATHS.files).toBe(NAV_PATHS.files);
  });

  it("states the service fee the desk actually charges, in every language", () => {
    for (const locale of LOCALES) expect(FAQ_REPLIES.stores[locale], locale).toContain(`${SERVICE_FEE_PERCENT}`);
  });

  it("never promises an automatic booking or charge for travel", () => {
    expect(FAQ_REPLIES.travel.en).toMatch(/Nothing is booked or charged automatically/);
    for (const locale of LOCALES) expect(FAQ_REPLIES.travel[locale].length, locale).toBeGreaterThan(80);
  });

  it("names a conversion the document engine really makes", () => {
    expect(FAQ_REPLIES.files.en).toContain("PDF to Word");
    expect(canConvertDocument("pdf", "docx")).toBe(true);
    expect(FAQ_REPLIES.files.en).toContain("Word, Excel and PowerPoint to PDF");
    for (const from of ["docx", "xlsx", "pptx"]) expect(canConvertDocument(from, "pdf")).toBe(true);
  });

  it("answers a question with a link on the website and a plain address on WhatsApp", () => {
    const web = answerLocally("can you convert files", { preferredLocale: "en", format: "markdown" })!;
    expect(web.reply).toContain("](/services/file-studio)");
    const wa = answerLocally("can you order from amazon", { preferredLocale: "en", format: "plain", baseUrl: "https://visionex.app" })!;
    expect(wa.reply).toContain("https://visionex.app/global-shopping");
    const voice = answerLocally("can you book flights", { preferredLocale: "en", links: false })!;
    expect(voice.reply).toBe(FAQ_REPLIES.travel.en);
  });

  it("has several questions per feature in every language", () => {
    for (const intent of ["travel", "stores", "files"] as const) {
      for (const locale of LOCALES) expect(FAQ_PHRASES[intent][locale].length, `${intent}/${locale}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("the model is told the same facts", () => {
  it("names the three pages and the fee, and forbids claiming a booking", async () => {
    const { readFileSync } = await import("node:fs");
    const prompt = readFileSync("supabase/functions/_shared/assistants.ts", "utf8");
    for (const path of ["/travel", "/global-shopping", "/services/file-studio"]) expect(prompt).toContain(`https://visionex.app${path}`);
    expect(prompt).toContain(`service fee ${SERVICE_FEE_PERCENT}%`);
    expect(prompt).toMatch(/Never say a flight, room, car or product has been booked or ordered/);
  });
});
