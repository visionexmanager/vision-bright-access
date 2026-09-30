/**
 * Public news feeds (RSS), keyless: NASA, United Nations News and the World
 * Health Organization. Each publishes an official RSS feed for exactly this
 * — readers and aggregators — so this reads the feed and never the site.
 *
 * What comes out is a headline, a short excerpt, a date and a link to the
 * publisher's own page. The full text is never copied: the reader follows the
 * link. A link that does not point at the publisher's own domain is dropped, so
 * a feed cannot send a reader somewhere else.
 */

import { clean, cleanOrNull, getText, httpsUrl, makeItem } from "../http.ts";
import type { ContentProvider, ExternalContentItem, ProviderContext } from "../types.ts";

interface FeedDef {
  id: string;
  name: string;
  /** Domains a story link may point at. */
  hosts: readonly string[];
  language: string;
  url: string;
}

/** United Nations News publishes a feed in each of the six UN languages. */
const UN_LANGUAGES = new Set(["en", "ar", "es", "fr", "ru", "zh"]);

const NASA: FeedDef = { id: "nasa", name: "NASA", hosts: ["nasa.gov"], language: "en", url: "https://www.nasa.gov/feed/" };
const WHO: FeedDef = { id: "who", name: "World Health Organization", hosts: ["who.int"], language: "en", url: "https://www.who.int/rss-feeds/news-english.xml" };
const unNews = (language: string): FeedDef => ({
  id: `un-${language}`, name: "UN News", hosts: ["un.org"], language,
  url: `https://news.un.org/feed/subscribe/${language}/news/all/rss.xml`,
});

/** The feeds asked for a reader's language: their UN News feed when there is one, plus the English feeds. */
export function feedsFor(language: string): FeedDef[] {
  const lang = language.toLowerCase().slice(0, 2);
  return [unNews(UN_LANGUAGES.has(lang) ? lang : "en"), NASA, WHO];
}

const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#0?39;/g, "'").replace(/&amp;/g, "&");
const tag = (xml: string, name: string): string =>
  decode(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`))?.[1] ?? "").trim();

/** djb2, hex: a short stable id for a story link. */
function shortHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

const onHost = (url: string, hosts: readonly string[]): boolean => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return hosts.some((h) => host === h || host.endsWith(`.${h}`));
  } catch { return false; }
};

/** Stories in an RSS 2.0 feed. Pure: no clock, no network. */
export function parseFeed(xml: string, feed: FeedDef): ExternalContentItem[] {
  return (xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? []).flatMap((item) => {
    const link = httpsUrl(tag(item, "link"));
    const title = clean(tag(item, "title"), 250);
    if (!link || !title || !onHost(link, feed.hosts)) return [];
    const published = new Date(tag(item, "pubDate"));
    const thumb = httpsUrl(item.match(/<media:(?:thumbnail|content)\b[^>]*\burl="([^"]+)"/)?.[1] ?? item.match(/<enclosure\b[^>]*\burl="([^"]+)"[^>]*type="image\//)?.[1]);
    return [makeItem(feed.name, {
      provider: "open_feeds",
      providerItemId: `${feed.id}-${shortHash(link)}`,
      title,
      description: cleanOrNull(tag(item, "description"), 320),
      contentType: "article",
      thumbnailUrl: thumb && onHost(thumb, [...feed.hosts, "unmultimedia.org", "who.int"]) ? thumb : null,
      externalUrl: link,
      creator: cleanOrNull(tag(item, "dc:creator"), 80),
      publisher: feed.name,
      language: feed.language,
      attribution: feed.name,
      publishedAt: Number.isNaN(published.getTime()) ? null : published.toISOString().slice(0, 10),
    })];
  });
}

/** Every term of the query must appear in the headline or the excerpt. Unicode-aware, so Arabic and Chinese work. */
export function matchesQuery(item: ExternalContentItem, query: string): boolean {
  const terms = query.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2);
  if (terms.length === 0) return false;
  const haystack = `${item.title} ${item.description ?? ""}`.toLocaleLowerCase();
  return terms.every((t) => haystack.includes(t));
}

const FEED_TTL_MS = 10 * 60 * 1000;
const feedCache = new Map<string, { at: number; items: ExternalContentItem[] }>();

async function readFeed(ctx: ProviderContext, feed: FeedDef): Promise<ExternalContentItem[]> {
  const hit = feedCache.get(feed.url);
  if (hit && Date.now() - hit.at < FEED_TTL_MS) return hit.items;
  const items = parseFeed(await getText(ctx, feed.url, { headers: { Accept: "application/rss+xml, application/xml;q=0.9" } }), feed);
  feedCache.set(feed.url, { at: Date.now(), items });
  return items;
}

export const openFeeds: ContentProvider = {
  id: "open_feeds",
  name: "News feeds (NASA, UN News, WHO)",
  homepage: "https://news.un.org",
  docs: "https://news.un.org/en/rss",
  categories: ["news"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: false, embed: false, download: false },
  licenseNote: "Headlines, short excerpts and links from each publisher's own RSS feed. The story is read on the publisher's site; nothing is republished.",
  rateLimit: "Each feed is fetched at most once every ten minutes per server instance.",
  healthQuery: "health",
  async search(params, ctx) {
    const lists = await Promise.allSettled(feedsFor(params.language).map((f) => readFeed(ctx, f)));
    const all = lists.flatMap((l) => (l.status === "fulfilled" ? l.value : []));
    // A search with every feed down is a failure, not an empty answer.
    if (all.length === 0 && lists.every((l) => l.status === "rejected")) throw (lists[0] as PromiseRejectedResult).reason;
    const start = (params.page - 1) * params.limit;
    return all
      .filter((item) => matchesQuery(item, params.query))
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .slice(start, start + params.limit);
  },
};
