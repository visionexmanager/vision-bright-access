import { describe, expect, it } from "vitest";
import {
  asksForEarthquakes,
  coinsIn,
  enabledFeeds,
  FEED_PRESETS,
  feedsFor,
  gatherSources,
  interleave,
} from "../../supabase/functions/_shared/whatsappLocalSources";

const NOW = () => new Date("2026-11-05T09:00:00Z");

const rss = (items: Array<[string, string]>) =>
  `<?xml version="1.0"?><rss><channel>${items.map(([t, d]) => `<item><title>${t}</title><pubDate>Thu, 5 Nov 2026 07:00:00 GMT</pubDate><description>${d}</description></item>`).join("")}</channel></rss>`;

/** Host to response; anything else is a 404. Records every URL asked. */
function network(routes: Record<string, () => Response>) {
  const calls: string[] = [];
  const impl = (async (input: string) => {
    const url = String(input);
    calls.push(url);
    const host = new URL(url).hostname;
    return routes[host] ? routes[host]() : new Response("nope", { status: 404 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const ALL = (n: string) => (n === "LOCAL_CHAT_FEEDS" ? "all" : undefined);

describe("feeds", () => {
  it("names every preset for `all`, and ignores unknown names", () => {
    expect(enabledFeeds(ALL)).toEqual(Object.keys(FEED_PRESETS));
    expect(enabledFeeds((n) => (n === "LOCAL_CHAT_FEEDS" ? "npr,bogus" : undefined))).toEqual(["npr"]);
    expect(Object.keys(FEED_PRESETS).length).toBeGreaterThanOrEqual(10);
    for (const preset of Object.values(FEED_PRESETS)) expect(preset.url.startsWith("https://")).toBe(true);
  });

  it("fetches the sender's language, else English, at most four", () => {
    const all = Object.keys(FEED_PRESETS);
    expect(feedsFor(all, "ar").every((k) => FEED_PRESETS[k].language === "ar")).toBe(true);
    expect(feedsFor(all, "ar").length).toBeGreaterThan(0);
    expect(feedsFor(all, "tr").every((k) => FEED_PRESETS[k].language === "en")).toBe(true);
    expect(feedsFor(all, "en")).toHaveLength(4);
  });

  it("takes headlines from different publishers rather than one publisher's first three", () => {
    const items = [
      { source: "A", n: 1 }, { source: "A", n: 2 }, { source: "A", n: 3 },
      { source: "B", n: 1 }, { source: "C", n: 1 },
    ];
    expect(interleave(items).slice(0, 3).map((i) => i.source)).toEqual(["A", "B", "C"]);
    expect(interleave(items)).toHaveLength(5);
  });

  it("reads Arabic feeds for an Arabic sender, and labels each line with its publisher", async () => {
    const { impl, calls } = network({
      "rss.dw.com": () => new Response(rss([["الحرس الثوري يعلن حرائق في ثلاث سفن", "تفاصيل أولى."]])),
      "feeds.bbci.co.uk": () => new Response(rss([["مفاوضات جديدة في مضيق هرمز", "ملخص."]])),
      "www.france24.com": () => new Response(rss([["تطورات مضيق هرمز اليوم", "ملخص آخر."]])),
      "www.aljazeera.net": () => new Response(rss([["ناقلات النفط في مضيق هرمز", "ملخص رابع."]])),
    });
    const out = await gatherSources({ question: "ما آخر أخبار مضيق هرمز", language: "ar", fetchImpl: impl, now: NOW, read: ALL });
    expect(out!.used.feeds).toBe(3);
    expect(out!.text).toMatch(/\[DW, 2026-11-05\]|\[BBC News Arabic, 2026-11-05\]|\[France 24 Arabic, 2026-11-05\]/);
    expect(calls.some((u) => u.includes("npr.org") || u.includes("theguardian"))).toBe(false);
  });

  it("limits the bytes it reads from a feed", async () => {
    const huge = rss([["Strait of Hormuz headline", "ok."]]) + "x".repeat(900_000);
    const { impl } = network({ "rss.dw.com": () => new Response(huge) });
    const out = await gatherSources({ question: "latest news Hormuz", language: "en", fetchImpl: impl, now: NOW, read: (n) => (n === "LOCAL_CHAT_FEEDS" ? "dw-en" : undefined) });
    expect(out!.text).toContain("Strait of Hormuz headline");
  });
});

describe("earthquakes", () => {
  const quakes = {
    features: [
      { properties: { mag: 5.1, place: "60 km W of Ancud, Chile", time: Date.parse("2026-11-04T22:00:00Z") } },
      { properties: { mag: 6.3, place: "Kermadec Islands region", time: Date.parse("2026-11-05T03:00:00Z") } },
      { properties: { mag: "x", place: "broken" } },
    ],
  };

  it("recognises the question in several languages", () => {
    for (const q of ["was there an earthquake today", "هل حدث زلزال اليوم", "y a-t-il eu un séisme", "hoy hubo un terremoto", "deprem oldu mu"]) {
      expect(asksForEarthquakes(q)).toBe(true);
    }
    expect(asksForEarthquakes("capital of Chile")).toBe(false);
  });

  it("lists the strongest first, drops malformed events, and asks nothing else", async () => {
    const { impl, calls } = network({ "earthquake.usgs.gov": () => new Response(JSON.stringify(quakes)) });
    const out = await gatherSources({ question: "was there an earthquake today", language: "en", fetchImpl: impl, now: NOW, read: () => undefined });
    expect(out!.text.split("\n")[0]).toBe("[USGS earthquakes, 2026-11-05] M6.3 — Kermadec Islands region");
    expect(out!.text).toContain("M5.1 — 60 km W of Ancud, Chile");
    expect(out!.text).not.toContain("broken");
    expect(out!.used).toEqual({ earthquakes: 2 });
    expect(calls.every((u) => u.includes("usgs.gov"))).toBe(true);
  });

  it("keeps only the place asked about", async () => {
    const { impl } = network({ "earthquake.usgs.gov": () => new Response(JSON.stringify(quakes)) });
    const out = await gatherSources({ question: "earthquake in chile", language: "en", fetchImpl: impl, now: NOW, read: () => undefined });
    expect(out!.text).toContain("Ancud, Chile");
    expect(out!.text).not.toContain("Kermadec");
  });
});

describe("crypto", () => {
  it("finds the coins named, in English and Arabic", () => {
    expect(coinsIn("bitcoin price")).toEqual(["bitcoin"]);
    expect(coinsIn("كم سعر البيتكوين والإيثيريوم")).toEqual(["bitcoin", "ethereum"]);
    expect(coinsIn("price of gold")).toEqual([]);
  });

  it("reads the price with its date, and nothing else is asked", async () => {
    const { impl, calls } = network({
      "api.coingecko.com": () => new Response(JSON.stringify({ bitcoin: { usd: 80312, last_updated_at: 1793871564 } })),
    });
    const out = await gatherSources({ question: "what is the bitcoin price now", language: "en", fetchImpl: impl, now: NOW, read: () => undefined });
    expect(out!.text).toBe("[CoinGecko] Bitcoin: 80312 USD (updated 2026-11-05)");
    expect(calls).toHaveLength(1);
  });

  it("is quiet when the service is rate-limited", async () => {
    const { impl } = network({ "api.coingecko.com": () => new Response("{}", { status: 429 }) });
    expect(await gatherSources({ question: "bitcoin price today", language: "en", fetchImpl: impl, now: NOW, read: () => undefined })).toBeNull();
  });
});
