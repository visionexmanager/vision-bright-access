// The daily news bulletin: collected from RSS with no AI key, delivered over
// WhatsApp only when a subscriber asks for it, once a day.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const news = await import("../../supabase/functions/_shared/whatsappNews.ts");

const read = (path: string) => readFileSync(path, "utf8");
const webhook = read("supabase/functions/whatsapp-webhook/index.ts");
const workflow = read(".github/workflows/news-daily-cron.yml");
const migration = read("supabase/migrations/20261099000000_newsletter_whatsapp_channel.sql");

const article = (n: number, category = "technology") => ({
  id: `00000000-0000-0000-0000-00000000000${n}`,
  title: `Headline number ${n}`,
  description: `Summary ${n} `.repeat(30),
  category,
  publishedAt: "2026-10-30T07:00:00.000Z",
  translations: null,
  sourceUrl: `https://publisher.example/story-${n}`,
  sourceName: "publisher.example",
});

describe("dailyDigest", () => {
  it("carries each headline with the publisher's link, and nothing rewritten", () => {
    const text = news.dailyDigest({ articles: [article(1)], language: "en", heading: "*Today*", categories: [] });
    expect(text).toContain("*Today*");
    expect(text).toContain("1. Headline number 1");
    expect(text).toContain("https://publisher.example/story-1");
  });

  it("keeps only the sections the subscriber picked", () => {
    const text = news.dailyDigest({
      articles: [article(1, "technology"), article(2, "sports")],
      language: "en",
      heading: "h",
      categories: ["sports"],
    });
    expect(text).toContain("Headline number 2");
    expect(text).not.toContain("Headline number 1");
  });

  it("stays inside one WhatsApp message however many stories there are", () => {
    const many = Array.from({ length: 30 }, (_, i) => article(i % 9));
    const text = news.dailyDigest({ articles: many, language: "en", heading: "h", categories: [] });
    expect(text.length).toBeLessThanOrEqual(news.DIGEST_MAX_CHARS);
    expect(text.split("https://").length - 1).toBeLessThanOrEqual(news.DIGEST_MAX_ITEMS);
  });

  it("says nothing when no story matches, so the caller can fall back", () => {
    expect(news.dailyDigest({ articles: [article(1)], language: "en", heading: "h", categories: ["sports"] })).toBe("");
  });

  it("reads a subscriber's sections from their news- topics only", () => {
    expect(news.digestCategories(["products", "news-ai", "news-sports"])).toEqual(["ai", "sports"]);
    expect(news.digestCategories(null)).toEqual([]);
  });
});

describe("the WhatsApp gate", () => {
  it("claims the day's turn before sending, and hands it back if the send fails", () => {
    const start = webhook.indexOf("const deliverDailyDigest");
    const body = webhook.slice(start, webhook.indexOf("The VisionKids stories", start));
    expect(body).toContain('rpc("claim_whatsapp_news"');
    expect(body.indexOf("claim_whatsapp_news")).toBeLessThan(body.indexOf("await reply(text"));
    expect(body).toContain("release_whatsapp_news");
  });

  it("is tried before the ordinary headlines, and only for the news request", () => {
    const at = webhook.indexOf("if (await deliverDailyDigest()) continue;");
    expect(at).toBeGreaterThan(webhook.indexOf("const newsAsk ="));
    expect(at).toBeLessThan(webhook.indexOf("await showNews({ category: newsAsk.category })"));
  });

  it("is limited to one bulletin per number per day in the database", () => {
    expect(migration).toContain("wa_last_sent_date IS DISTINCT FROM v_today");
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.claim_whatsapp_news\(text\) FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.claim_whatsapp_news\(text\) TO service_role/);
    expect(migration).toMatch(/wa_phone ~ '\^\[0-9\]\{8,15\}\$'/);
  });
});

describe("the daily collection", () => {
  it("uses no AI provider and no key", () => {
    expect(workflow.toLowerCase()).not.toContain("api.openai.com");
    expect(workflow).not.toContain("OPENAI_API_KEY");
  });

  it("stores the publisher's link so the reader can reach the original", () => {
    expect(workflow).toContain("source_url: item.link");
  });
});
