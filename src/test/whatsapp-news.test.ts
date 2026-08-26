// Visionex News, over WhatsApp.
//
// The feed is the website's own `news_articles` rows, so what is tested here is
// everything between the table and the sender: which words open the section,
// what the list looks like, what a tapped headline returns, and what happens
// when the feed is empty, unreachable, or the article has gone.
//
// The webhook's own branches are asserted against its source — the only way to
// pin "this exists and is reached in this order" without a Meta account.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const news = await import("../../supabase/functions/_shared/whatsappNews.ts");
const interactive = await import("../../supabase/functions/_shared/whatsappInteractive.ts");
const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");
const languages = await import("../../supabase/functions/_shared/whatsappLanguages.ts");
const strings = await import("../../supabase/functions/_shared/whatsappStrings.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const LANGS = languages.SUPPORTED_LANGUAGES;

const ARTICLE = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Visionex opens its bazaar to new sellers",
  description: "Anyone with a verified account can now list a product.",
  category: "platform",
  published_at: "2026-08-24T09:00:00Z",
  translations: {
    ar: { title: "فيجنكس يفتح سوقه لبائعين جدد", description: "يمكن لأي حساب موثّق عرض منتج الآن." },
    tr: { title: "Visionex bazarını yeni satıcılara açıyor", description: "Doğrulanmış her hesap artık ürün ekleyebilir." },
  },
};

describe("the menu entry", () => {
  it("is enabled, and hangs where it always hung", () => {
    const node = catalog.nodeById("news");
    expect(node).not.toBeNull();
    expect(node?.enabled).toBe(true);
    expect(node?.parent).toBe(catalog.ROOT_ID);
    expect(node?.order).toBe(6);
    // No handler: it is a phrase leaf, so tapping the row and typing the word
    // reach the same parser.
    expect(node?.handler).toBeUndefined();
    expect(node?.phrase).toBeTruthy();
  });

  it("is named in all twenty languages, and its phrase opens the section", () => {
    const node = catalog.nodeById("news")!;
    for (const language of LANGS) {
      expect(node.title[language], `title.${language}`).toBeTruthy();
      expect(node.description[language], `description.${language}`).toBeTruthy();
    }
    for (const language of ["ar", "en"] as const) {
      expect(news.parseNewsRequest(catalog.localized(node.phrase!, language))).toBe(true);
    }
  });

  it("appears on the main menu a sender is actually shown", () => {
    const rows = catalog.offeredChildrenOf(catalog.ROOT_ID).map((child) => child.id);
    expect(rows).toContain("news");
  });
});

describe("asking for the news", () => {
  it("hears the word, in both parsed languages", () => {
    for (const asked of ["news", "the news", "latest news", "headlines", "News"]) {
      expect(news.parseNewsRequest(asked), asked).toBe(true);
    }
    for (const asked of ["الأخبار", "اخبار", "آخر الأخبار"]) {
      expect(news.parseNewsRequest(asked), asked).toBe(true);
    }
  });

  it("does not hijack a message that merely mentions news", () => {
    for (const asked of [
      "I saw the news about my order and I want to complain",
      "أخبار طلبي وين وصلت",
      "any news on my refund?",
      "",
      null,
    ]) {
      expect(news.parseNewsRequest(asked), String(asked)).toBe(false);
    }
  });
});

describe("the list", () => {
  it("carries the article id in the row, and a way back", () => {
    const message = interactive.newsMessage({
      articles: [{ id: ARTICLE.id, title: ARTICLE.title, description: ARTICLE.description }],
      language: "en",
    });
    expect(message.interactive.type).toBe("list");
    if (message.interactive.type !== "list") return;
    const rows = message.interactive.action.sections[0].rows;
    expect(rows[0].id).toBe(news.newsRowId(ARTICLE.id));
    expect(news.parseNewsSelection(rows[0].id)).toBe(ARTICLE.id);
    expect(rows.map((row) => row.id)).toContain(interactive.BACK_ID);
  });

  it("stays inside every limit Meta rejects a message for, in every language", () => {
    const long = {
      id: ARTICLE.id,
      title: "A headline far longer than any interactive row title Meta will accept without complaint",
      description: "A summary that runs well past the seventy-two characters a row description is allowed to carry.",
    };
    for (const language of LANGS) {
      const message = interactive.newsMessage({ articles: [long, long, long, long, long], language });
      if (message.interactive.type !== "list") continue;
      const action = message.interactive.action;
      expect([...action.button].length, `button/${language}`).toBeLessThanOrEqual(20);
      expect([...message.interactive.header.text].length, `header/${language}`).toBeLessThanOrEqual(60);
      const rows = action.sections[0].rows;
      expect(rows.length, `rows/${language}`).toBeLessThanOrEqual(10);
      for (const row of rows) {
        expect([...row.title].length, `rowTitle/${language}`).toBeLessThanOrEqual(24);
        if (row.description) {
          expect([...row.description].length, `rowDesc/${language}`).toBeLessThanOrEqual(72);
        }
      }
    }
  });

  it("has a text copy for a client that refuses the interactive one", () => {
    const message = interactive.newsMessage({
      articles: [{ id: ARTICLE.id, title: ARTICLE.title, description: "" }],
      language: "en",
    });
    expect(message.text).toContain(ARTICLE.title);
    expect(message.text).toContain(strings.say("newsHeading", "en"));
  });
});

describe("reading the rows", () => {
  it("takes the article in the sender's language when it exists", () => {
    const [article] = news.readArticles([ARTICLE]);
    expect(news.articleText(article, "ar").title).toBe(ARTICLE.translations.ar.title);
    expect(news.articleText(article, "tr").description).toBe(ARTICLE.translations.tr.description);
  });

  it("falls back to the article's own words when it was never translated", () => {
    // A gap in the data, not a missing interface string: an article exists in
    // the languages the news pipeline translated it into and in no others.
    const [article] = news.readArticles([ARTICLE]);
    expect(news.articleText(article, "ja").title).toBe(ARTICLE.title);
    expect(news.articleText(article, "ja").description).toBe(ARTICLE.description);
  });

  it("survives a row that is not the shape it expected", () => {
    expect(news.readArticles(null)).toEqual([]);
    expect(news.readArticles("nonsense")).toEqual([]);
    expect(news.readArticles([null, 7, {}, { id: "x" }, { title: "no id" }])).toEqual([]);
    const [parsed] = news.readArticles([{ ...ARTICLE, description: null, translations: "broken" }]);
    expect(parsed.description).toBe("");
    expect(parsed.translations).toBeNull();
  });
});

describe("one article, as a message", () => {
  it("leads with the headline and ends with the canonical link", () => {
    const [article] = news.readArticles([ARTICLE]);
    const message = news.formatArticle({ article, language: "en" });
    expect(message).toContain(ARTICLE.title);
    expect(message).toContain(ARTICLE.description);
    expect(message).toContain(news.NEWS_URL);
    expect(message).toContain(news.formatNewsDate(ARTICLE.published_at, "en"));
    // The way back to the list, for somebody who cannot see the screen.
    expect(message).toContain(strings.say("newsBackHint", "en"));
  });

  it("links to the section, because the site registers no per-article route", () => {
    expect(news.NEWS_URL).toBe("https://visionex.app/news");
    const [article] = news.readArticles([ARTICLE]);
    expect(news.formatArticle({ article, language: "en" })).not.toContain(`${news.NEWS_URL}/`);
  });

  it("reads as a finished sentence in every language", () => {
    const [article] = news.readArticles([ARTICLE]);
    for (const language of LANGS) {
      const message = news.formatArticle({ article, language });
      expect(message.trim().length, language).toBeGreaterThan(0);
      expect(/\{[a-z]+\}/i.test(message), `${language}: ${message}`).toBe(false);
      expect(message, language).toContain(news.NEWS_URL);
    }
  });

  it("still says something when the article carries no date or summary", () => {
    const [bare] = news.readArticles([{ ...ARTICLE, description: "", published_at: null }]);
    const message = news.formatArticle({ article: bare, language: "en" });
    expect(message).toContain(ARTICLE.title);
    expect(message).not.toContain("Invalid Date");
  });
});

describe("every News sentence, in every language", () => {
  it("exists, keeps its link and leaves no template token", () => {
    const keys = [
      "newsHeading", "newsButton", "newsEmpty", "newsUnavailable",
      "newsStale", "newsLink", "newsBackHint",
    ] as const;
    for (const key of keys) {
      for (const language of LANGS) {
        const value = strings.UI_STRINGS[key][language];
        expect(value, `${key}.${language}`).toBeTruthy();
      }
      const withUrl = ["newsEmpty", "newsUnavailable", "newsLink"];
      if (!withUrl.includes(key)) continue;
      for (const language of LANGS) {
        expect(strings.say(key, language), `${key}.${language}`).toContain("{url}");
      }
    }
  });
});

describe("the webhook's part", () => {
  const block = webhook.slice(
    webhook.indexOf("const showNews = async"),
    webhook.indexOf("// ── Abuse control"),
  );

  it("reads the same rows the website reads, and no others", () => {
    expect(block).toContain('.from("news_articles")');
    expect(block).toContain('.eq("published", true)');
    expect(block).toContain(".neq(\"category\", NEWS_EXCLUDED_CATEGORY)");
    expect(block).toContain('.order("published_at", { ascending: false, nullsFirst: false })');
    expect(block).toContain(".limit(NEWS_LIST_SIZE)");
    // Nothing unpublished, and no column the public page does not already read.
    expect(block).not.toContain("published_by");
    expect(block).not.toContain('.eq("published", false)');
  });

  it("tells an empty feed apart from a broken one", () => {
    expect(block).toContain('say("newsEmpty"');
    expect(block).toContain('say("newsUnavailable"');
    expect(block).toContain("if (error)");
  });

  it("answers a tapped headline, and re-lists a stale one", () => {
    const selection = webhook.slice(
      webhook.indexOf("incoming.selection?.startsWith(NEWS_ID_PREFIX)"),
      webhook.indexOf("// ── A shared pin"),
    );
    expect(selection).toContain('.eq("published", true)');
    expect(selection).toContain("formatArticle(");
    expect(selection).toContain('say("newsStale"');
    expect(selection).toContain("showNews(");
  });

  it("respects the human handover and the feature flag", () => {
    expect(webhook).toContain("!humanOwnsThis && incoming.selection?.startsWith(NEWS_ID_PREFIX)");
    expect(webhook).toContain('parseNewsRequest(questionText) && featureOn("news")');
  });

  it("logs an outcome and never an article, a title or a link", () => {
    for (const line of block.split("\n")) {
      if (!/console\.(log|error|warn)|^\s*log\(/.test(line)) continue;
      const withoutText = line.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
      expect(withoutText, line.trim()).not.toMatch(/\b(article|title|description|url)\b/);
    }
    expect(block).toContain('log("news"');
  });

  it("builds no interactive payload of its own", () => {
    // The same rule every other list obeys: Meta's limits live in one file.
    expect(block).toContain("sendNewsList(");
    expect(block).not.toContain('type: "list"');
  });
});
