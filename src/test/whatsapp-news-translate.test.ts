import { describe, expect, it } from "vitest";
import { parseTranslated, withTranslations } from "../../supabase/functions/_shared/whatsappNewsTranslate";
import type { NewsArticle } from "../../supabase/functions/_shared/whatsappNews";
import { parseDocConvertRequest } from "../../supabase/functions/_shared/whatsappDocConvert";

const article = (over: Partial<NewsArticle> = {}): NewsArticle => ({
  id: "a1", title: "Hello", description: "World news", category: "tech", publishedAt: null, translations: null, ...over,
});

describe("news translated into the sender's language", () => {
  it("parses a title and a description, and rejects a half answer", () => {
    expect(parseTranslated("مرحبا ||| أخبار العالم", true)).toEqual({ title: "مرحبا", description: "أخبار العالم" });
    expect(parseTranslated("مرحبا", true)).toBeNull();
  });

  it("fills a missing language and saves it", async () => {
    const saved: string[] = [];
    const provider = async () => ({ status: "answered", text: "مرحبا ||| أخبار", provider: "p", model: "m", ms: 1 }) as never;
    const out = await withTranslations({
      articles: [article()], language: "ar", languageName: "العربية", provider,
      save: async (id) => { saved.push(id); },
    });
    expect(out[0].translations?.ar?.description).toBe("أخبار");
    expect(saved).toEqual(["a1"]);
  });

  it("fills a description when only the title was translated", async () => {
    const provider = async () => ({ status: "answered", text: "عنوان ||| وصف", provider: "p", model: "m", ms: 1 }) as never;
    const out = await withTranslations({
      articles: [article({ translations: { ar: { title: "عنوان" } } })], language: "ar", languageName: "العربية", provider,
      save: async () => {},
    });
    expect(out[0].translations?.ar?.description).toBe("وصف");
  });

  it("leaves English and complete articles alone, and survives a failing provider", async () => {
    let calls = 0;
    const provider = async () => { calls++; throw new Error("x"); };
    const done = article({ translations: { ar: { title: "a", description: "b" } } });
    expect(await withTranslations({ articles: [done], language: "ar", languageName: "x", provider: provider as never, save: async () => {} })).toEqual([done]);
    expect(await withTranslations({ articles: [article()], language: "en", languageName: "x", provider: provider as never, save: async () => {} })).toHaveLength(1);
    const failed = await withTranslations({ articles: [article()], language: "ar", languageName: "x", provider: provider as never, save: async () => {} });
    expect(failed[0].translations).toBeNull();
    expect(calls).toBe(1);
  });
});

describe("a conversion asked for after the document was sent", () => {
  it("reads the Arabic follow-up as PDF to Word", () => {
    expect(parseDocConvertRequest({ text: "حوله الى word", source: "pdf" })).toEqual({ target: "docx", from: "pdf" });
    expect(parseDocConvertRequest({ text: "حوّله إلى وورد", source: "pdf" })).toEqual({ target: "docx", from: "pdf" });
  });
});

describe("the webhook hands the server's translator to the news path", () => {
  // It was imported and never passed, so with the paid providers down every
  // article reached an Arabic reader in English.
  it("passes `local` into withTranslations", async () => {
    const { readFileSync } = await import("node:fs");
    const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    const start = webhook.indexOf("const localizeNews");
    const body = webhook.slice(start, start + 900);
    expect(body).toContain("local: async (text, language)");
    expect(body).toContain("translateLocally({ text, language })");
  });
});
