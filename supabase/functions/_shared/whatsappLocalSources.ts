// Where the local chat model gets facts it was not trained on.
//
// The model is a fixed file with a training cutoff. It never learns; what it can
// do is read. This module decides, from the question, which public sources are
// worth asking, asks them in parallel inside one short deadline, and returns a
// few labelled lines (`[Source, date] text`) for the prompt. The model reads its
// prompt at about 33 tokens a second, so the total is small and every line says
// where it came from and how old it is.
//
// ── Sources, and why each ───────────────────────────────────────────────────
//
//   Visionex News     the site's own published articles, in the sender's language
//                     (passed in by the webhook; this module has no database)
//   Wikipedia         the article intros that match the question's keywords
//   Wikidata          structured facts for a country or a person: capital, head of
//                     state, head of government, population. Exact where text
//                     search is only close.
//   Current events    Wikipedia's daily current-events page and "In the news"
//   Exchange rates    open.er-api.com, daily rates for ~160 currencies, including
//                     the Lebanese pound, which the ECB-based services lack
//   News feeds        publisher RSS headlines (DW, BBC, France 24, Al Jazeera,
//                     The Guardian, NPR), only the presets named in LOCAL_CHAT_FEEDS
//                     (`all` names every one). Off until switched on. Only the
//                     headline and its first sentence are used, always labelled
//                     with the publisher and date; nothing is stored. The owner
//                     authorised their use on 2026-11-05.
//   Earthquakes       USGS, the last day's magnitude 4.5+ events (public domain)
//   Crypto prices     CoinGecko keyless simple price for Bitcoin and Ethereum
//
// ── Privacy ─────────────────────────────────────────────────────────────────
//
// The same rule as `whatsappLocalReference.ts`: a message that carries an
// address, a link or a long number is never sent anywhere, and what leaves is at
// most eight keywords. Queries are never logged; the log carries counts only.
//
// A source that fails or is slow is dropped, never reported to the sender. The
// answer is then simply less informed, as it was before this module existed.
//
// Pure apart from the injected `fetch`; the Vitest suite runs under Node.

import { buildSearchQuery, fetchReference, REFERENCE_TIMEOUT_MS } from "./whatsappLocalReference.ts";
import type { EnvReader } from "./whatsappProcessor.ts";

/** One deadline for all sources together; they run in parallel. */
export const SOURCES_TIMEOUT_MS = REFERENCE_TIMEOUT_MS + 500;
export const MAX_SOURCES_CHARS = 500;
const USER_AGENT = "Visionex-Assistant/1.0 (+https://visionex.app)";

export interface NewsItem {
  title: string;
  description?: string;
  date?: string | null;
}

export type SourceName = "visionex-news" | "wikipedia" | "wikidata" | "current-events" | "exchange-rates" | "feeds" | "earthquakes" | "crypto";

export interface SourcesResult {
  /** Labelled lines for the prompt. */
  text: string;
  /** How many lines each source contributed. Counts only, never content. */
  used: Partial<Record<SourceName, number>>;
}

const denoEnv: EnvReader = (name) => {
  const deno = (globalThis as {
    Deno?: { env?: { get(key: string): string | undefined } };
  }).Deno;
  return deno?.env?.get(name);
};

// ── Reading the question ─────────────────────────────────────────────────────

const NEWS_WORDS = [
  "news", "headline", "breaking", "latest", "today", "tonight", "yesterday", "happening", "update",
  "situation", "developments", "what is going on", "what's going on",
  "أخبار", "خبر", "عاجل", "اليوم", "الآن", "حاليا", "حالياً", "ما الذي يحدث", "ماذا يحدث", "جديد", "آخر",
  "الوضع", "وضع ", "تطورات", "مستجدات", "ماذا حصل", "ماذا جرى",
  "actualité", "actualite", "nouvelles", "aujourd", "dernières", "dernieres",
  "noticias", "hoy", "últimas", "ultimas",
  "haber", "bugün", "son dakika",
];

/** True when the question asks about what is happening now. */
export const asksForNews = (question: string): boolean => {
  const text = (question ?? "").toLowerCase();
  return NEWS_WORDS.some((word) => text.includes(word));
};

const QUAKE_WORDS = ["earthquake", "quake", "tremor", "زلزال", "هزة أرضية", "هزه ارضية", "هزات", "séisme", "tremblement de terre", "terremoto", "sismo", "deprem"];
export const asksForEarthquakes = (question: string): boolean => {
  const text = (question ?? "").toLowerCase();
  return QUAKE_WORDS.some((word) => text.includes(word));
};

/** Coins the question names, as CoinGecko ids. Empty unless it names one. */
const COINS: ReadonlyArray<readonly [string, string]> = [
  ["bitcoin", "bitcoin"], ["btc", "bitcoin"], ["بيتكوين", "bitcoin"], ["بتكوين", "bitcoin"],
  ["ethereum", "ethereum"], ["إيثيريوم", "ethereum"], ["ايثيريوم", "ethereum"],
];
export function coinsIn(question: string): string[] {
  const text = (question ?? "").toLowerCase();
  const ids: string[] = [];
  for (const [name, id] of COINS) if (text.includes(name) && !ids.includes(id)) ids.push(id);
  return ids;
}

/** Currency names and codes, each to its ISO code. Qualified forms first so "ليرة تركية" wins over "ليرة". */
const CURRENCIES: ReadonlyArray<readonly [string, string]> = [
  ["ليرة لبنانية", "LBP"], ["lebanese pound", "LBP"], ["lbp", "LBP"],
  ["ليرة تركية", "TRY"], ["turkish lira", "TRY"], ["try", "TRY"],
  ["ليرة سورية", "SYP"], ["جنيه إسترليني", "GBP"], ["جنيه استرليني", "GBP"], ["pound sterling", "GBP"], ["gbp", "GBP"],
  ["جنيه مصري", "EGP"], ["egyptian pound", "EGP"], ["egp", "EGP"],
  ["ريال سعودي", "SAR"], ["saudi riyal", "SAR"], ["sar", "SAR"],
  ["ريال قطري", "QAR"], ["qar", "QAR"],
  ["درهم إماراتي", "AED"], ["درهم اماراتي", "AED"], ["dirham", "AED"], ["aed", "AED"],
  ["دينار كويتي", "KWD"], ["kwd", "KWD"], ["دينار أردني", "JOD"], ["دينار اردني", "JOD"], ["jod", "JOD"],
  ["دينار عراقي", "IQD"], ["iqd", "IQD"],
  ["دولار", "USD"], ["dollar", "USD"], ["usd", "USD"], ["dólar", "USD"],
  ["يورو", "EUR"], ["euro", "EUR"], ["eur", "EUR"],
  ["ين ياباني", "JPY"], ["yen", "JPY"], ["jpy", "JPY"], ["يوان", "CNY"], ["yuan", "CNY"], ["cny", "CNY"],
  ["روبل", "RUB"], ["ruble", "RUB"], ["rub", "RUB"], ["روبية", "INR"], ["inr", "INR"],
  ["ليرة", "LBP"], ["جنيه", "EGP"], ["ريال", "SAR"], ["درهم", "AED"],
];

const RATE_WORDS = [
  "rate", "price", "worth", "exchange", "convert", "cost", "how much",
  "سعر", "أسعار", "اسعار", "صرف", "كم يساوي", "كم سعر", "يساوي", "تحويل", "بكم",
  "taux", "cours", "change", "precio", "cambio", "kur", "fiyat",
];

/** The currencies a question mentions, in order, deduplicated. Empty unless it also asks about a rate. */
export function currenciesIn(question: string): string[] {
  const lower = (question ?? "").toLowerCase();
  if (!RATE_WORDS.some((word) => lower.includes(word))) return [];
  // "الدولار" and "بالليرة اللبنانية" name the same currencies as "دولار" and
  // "ليرة لبنانية": the article and one-letter prefixes are dropped.
  const text = lower.replace(/(^|[\s،,؟?])(?:وبال|بال|وال|فال|كال|لل|ال)/gu, "$1");
  const found: Array<{ at: number; code: string }> = [];
  let remaining = text;
  for (const [name, code] of CURRENCIES) {
    const at = remaining.indexOf(name);
    if (at < 0) continue;
    // Consumed, so "ليرة" does not match again inside "ليرة تركية".
    found.push({ at, code });
    remaining = remaining.slice(0, at) + " ".repeat(name.length) + remaining.slice(at + name.length);
  }
  const codes: string[] = [];
  for (const { code } of found.sort((a, b) => a.at - b.at)) if (!codes.includes(code)) codes.push(code);
  return codes;
}

// ── Plumbing ─────────────────────────────────────────────────────────────────

const flat = (value: unknown, max: number): string =>
  typeof value === "string"
    ? value.replace(/<[^>]*>/gu, "").replace(/&(amp|quot|#39|apos);/gu, (_m, e) => ({ amp: "&", quot: '"', "#39": "'", apos: "'" })[e as string] ?? "")
      .replace(/\s+/gu, " ").trim().slice(0, max)
    : "";

async function getText(fetchImpl: typeof fetch, url: string, signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetchImpl(url, { headers: { "user-agent": USER_AGENT }, signal });
    return response.ok ? await response.text() : null;
  } catch {
    // Never the error: it can quote the URL, and the URL carries the query.
    return null;
  }
}

async function getJson<T>(fetchImpl: typeof fetch, url: string, signal: AbortSignal): Promise<T | null> {
  const text = await getText(fetchImpl, url, signal);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const keywordsOf = (query: string | null): string[] => (query ? query.split(" ").filter(Boolean) : []);
const hasKeyword = (text: string, words: string[]): boolean => {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
};

// ── Exchange rates ───────────────────────────────────────────────────────────

/** One line per requested pair, e.g. `1 USD = 89500 LBP (daily rate, 2026-11-05)`. */
export async function fetchRates(codes: string[], fetchImpl: typeof fetch, signal: AbortSignal): Promise<string[]> {
  if (codes.length === 0) return [];
  const base = codes[0];
  const targets = codes.length > 1 ? codes.slice(1, 4) : [base === "USD" ? "LBP" : "USD"];
  const data = await getJson<{ result?: string; rates?: Record<string, number>; time_last_update_utc?: string }>(
    fetchImpl, `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, signal,
  );
  if (!data || data.result !== "success" || !data.rates) return [];
  const parsed = data.time_last_update_utc ? new Date(data.time_last_update_utc) : null;
  const day = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : "";
  const lines: string[] = [];
  for (const target of targets) {
    const rate = data.rates[target];
    if (typeof rate !== "number" || !Number.isFinite(rate)) continue;
    const shown = rate >= 100 ? Math.round(rate).toString() : Number(rate.toPrecision(5)).toString();
    lines.push(`1 ${base} = ${shown} ${target}${day ? ` (daily rate, ${day}; rates by ExchangeRate-API)` : ""}`);
  }
  return lines;
}

// ── Wikidata ─────────────────────────────────────────────────────────────────

const FACT_PROPERTIES: ReadonlyArray<readonly [string, string]> = [
  ["P36", "capital"], ["P35", "head of state"], ["P6", "head of government"], ["P1082", "population"],
];

interface Claim {
  rank?: string;
  mainsnak?: { datavalue?: { value?: unknown } };
  qualifiers?: Record<string, Array<{ datavalue?: { value?: { time?: string } } }>>;
}

/** The claims that are current: not deprecated, not ended, preferred first, newest start last-resort. */
function currentClaims(claims: Claim[] | undefined): Claim[] {
  const live = (claims ?? []).filter((c) => c.rank !== "deprecated" && !c.qualifiers?.P582);
  const preferred = live.filter((c) => c.rank === "preferred");
  return preferred.length > 0 ? preferred : live;
}

const itemId = (claim: Claim): string | null => {
  const value = claim.mainsnak?.datavalue?.value as { id?: string } | undefined;
  return typeof value?.id === "string" && /^Q\d+$/u.test(value.id) ? value.id : null;
};

/** Facts about the first matching entity, as `Lebanon — capital: Beirut; …`. */
export async function fetchWikidataFacts(
  query: string, language: string, fetchImpl: typeof fetch, signal: AbortSignal,
): Promise<string[]> {
  const lang = /^[a-z]{2}$/u.test(language) ? language : "en";
  const found = await getJson<{ search?: Array<{ id?: string; label?: string; description?: string }> }>(
    fetchImpl,
    `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: "wbsearchentities", search: query, language: lang, uselang: lang, limit: "1", format: "json" })}`,
    signal,
  );
  const top = found?.search?.[0];
  if (!top?.id || !/^Q\d+$/u.test(top.id)) return [];
  // The entity has to be about the question: a keyword in its label.
  if (!hasKeyword(top.label ?? "", keywordsOf(query))) return [];

  const entity = await getJson<{ entities?: Record<string, { claims?: Record<string, Claim[]> }> }>(
    fetchImpl,
    `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: "wbgetentities", ids: top.id, props: "claims", format: "json" })}`,
    signal,
  );
  const claims = entity?.entities?.[top.id]?.claims;
  if (!claims) return [];

  const wanted: Array<{ label: string; ids: string[]; plain?: string }> = [];
  for (const [property, label] of FACT_PROPERTIES) {
    const current = currentClaims(claims[property]);
    if (current.length === 0) continue;
    if (property === "P1082") {
      // The latest figure: the claim with the newest "point in time", else the last listed.
      const dated = current
        .map((c) => ({ c, t: c.qualifiers?.P585?.[0]?.datavalue?.value?.time ?? "" }))
        .sort((a, b) => a.t.localeCompare(b.t));
      const amount = (dated.at(-1)?.c.mainsnak?.datavalue?.value as { amount?: string } | undefined)?.amount;
      const year = dated.at(-1)?.t.match(/\d{4}/u)?.[0];
      if (amount) wanted.push({ label, ids: [], plain: `${Number(amount).toLocaleString("en-US")}${year ? ` (${year})` : ""}` });
      continue;
    }
    const ids = current.map(itemId).filter((id): id is string => id !== null).slice(0, 2);
    if (ids.length > 0) wanted.push({ label, ids });
  }
  if (wanted.length === 0) return [];

  const allIds = [...new Set(wanted.flatMap((w) => w.ids))];
  const names: Record<string, string> = {};
  if (allIds.length > 0) {
    const labels = await getJson<{ entities?: Record<string, { labels?: Record<string, { value?: string }> }> }>(
      fetchImpl,
      `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: "wbgetentities", ids: allIds.join("|"), props: "labels", languages: `${lang}|en`, format: "json" })}`,
      signal,
    );
    for (const id of allIds) {
      const l = labels?.entities?.[id]?.labels;
      const value = l?.[lang]?.value ?? l?.en?.value;
      if (value) names[id] = value;
    }
  }

  const parts = wanted
    .map((w) => `${w.label}: ${w.plain ?? w.ids.map((id) => names[id]).filter(Boolean).join(", ")}`)
    .filter((p) => !p.endsWith(": "));
  return parts.length > 0 ? [`${top.label}${top.description ? ` (${top.description})` : ""} — ${parts.join("; ")}`] : [];
}

// ── Wikipedia current events and "In the news" ───────────────────────────────

/** Wikitext bullet to plain text: links, bold, references and trailing source names removed. */
export function plainBullet(line: string): string {
  return line
    .replace(/^\*+\s*/u, "")
    .replace(/<!--.*?-->/gu, "")
    .replace(/<ref[^>]*>.*?<\/ref>/giu, "")
    .replace(/<[^>]+>/gu, "")
    .replace(/\[https?:[^\s\]]+\s+\(([^)]*)\)\]/gu, "") // [url (AFP)] source tags
    .replace(/\[https?:[^\s\]]+\s*([^\]]*)\]/gu, "$1")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/gu, "$1")
    .replace(/'{2,}/gu, "")
    .replace(/\{\{[^}]*\}\}/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

const bulletsOf = (wikitext: string): string[] =>
  wikitext.split("\n").filter((l) => /^\*[^*]/u.test(l)).map(plainBullet).filter((t) => t.length >= 30);

const monthName = (date: Date): string =>
  ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][date.getUTCMonth()];

/** Today's and yesterday's current-events bullets and "In the news", newest first. English Wikipedia only. */
export async function fetchCurrentEvents(now: Date, fetchImpl: typeof fetch, signal: AbortSignal): Promise<Array<{ text: string; date: string }>> {
  const days = [now, new Date(now.getTime() - 86_400_000)];
  const parse = async (page: string): Promise<string[]> => {
    const data = await getJson<{ parse?: { wikitext?: string } }>(
      fetchImpl,
      `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: "parse", page, prop: "wikitext", format: "json", formatversion: "2" })}`,
      signal,
    );
    return bulletsOf(data?.parse?.wikitext ?? "");
  };
  const [itn, ...daily] = await Promise.all([
    parse("Template:In_the_news"),
    ...days.map((d) => parse(`Portal:Current_events/${d.getUTCFullYear()}_${monthName(d)}_${d.getUTCDate()}`)),
  ]);
  const out: Array<{ text: string; date: string }> = [];
  const today = now.toISOString().slice(0, 10);
  for (const text of itn) out.push({ text, date: today });
  daily.forEach((bullets, i) => {
    const date = days[i].toISOString().slice(0, 10);
    for (const text of bullets) out.push({ text, date });
  });
  return out;
}

// ── News feeds ───────────────────────────────────────────────────────────────

/** Presets only; none is used unless LOCAL_CHAT_FEEDS names it. */
export const FEED_PRESETS: Readonly<Record<string, { name: string; url: string; language: string }>> = {
  "dw-en": { name: "DW", url: "https://rss.dw.com/xml/rss-en-top", language: "en" },
  "dw-ar": { name: "DW", url: "https://rss.dw.com/xml/rss-ar-all", language: "ar" },
  "bbc-world": { name: "BBC News", url: "https://feeds.bbci.co.uk/news/world/rss.xml", language: "en" },
  "bbc-ar": { name: "BBC News Arabic", url: "https://feeds.bbci.co.uk/arabic/rss.xml", language: "ar" },
  "aljazeera-en": { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", language: "en" },
  "aljazeera-ar": { name: "Al Jazeera Arabic", url: "https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdb19e8f8c6", language: "ar" },
  "france24-en": { name: "France 24", url: "https://www.france24.com/en/rss", language: "en" },
  "france24-ar": { name: "France 24 Arabic", url: "https://www.france24.com/ar/rss", language: "ar" },
  "guardian-world": { name: "The Guardian", url: "https://www.theguardian.com/world/rss", language: "en" },
  "npr": { name: "NPR", url: "https://feeds.npr.org/1001/rss.xml", language: "en" },
};

/** The feeds worth fetching for a sender: their language, else English; at most four. */
export function feedsFor(keys: string[], language: string): string[] {
  const own = keys.filter((k) => FEED_PRESETS[k].language === language);
  return (own.length > 0 ? own : keys.filter((k) => FEED_PRESETS[k].language === "en")).slice(0, 4);
}

/** The presets named by the switch, in order. Unknown names are ignored. */
export function enabledFeeds(read: EnvReader = denoEnv): string[] {
  const named = (read("LOCAL_CHAT_FEEDS") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (named.includes("all")) return Object.keys(FEED_PRESETS);
  return named.filter((s) => s in FEED_PRESETS);
}

/** Round-robin by publisher, so three headlines are three publishers rather than one publisher's first three. */
export function interleave<T extends { source: string }>(items: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(item.source, [...(groups.get(item.source) ?? []), item]);
  const out: T[] = [];
  for (let round = 0; out.length < items.length; round++) {
    let added = false;
    for (const group of groups.values()) if (round < group.length) { out.push(group[round]); added = true; }
    if (!added) break;
  }
  return out;
}

const tag = (xml: string, name: string): string => {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "iu"));
  return match ? match[1].replace(/^<!\[CDATA\[|\]\]>$/gu, "") : "";
};

/** Items of an RSS document: title, first sentence of the description, date. */
export function parseFeed(xml: string): Array<{ title: string; summary: string; date: string | null }> {
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/giu)].slice(0, 25).flatMap((m) => {
    const title = flat(tag(m[0], "title"), 160);
    if (!title) return [];
    const published = new Date(tag(m[0], "pubDate"));
    return [{
      title,
      summary: flat(tag(m[0], "description"), 150),
      date: Number.isNaN(published.getTime()) ? null : published.toISOString().slice(0, 10),
    }];
  });
}

// ── Earthquakes and crypto ───────────────────────────────────────────────────

/** The strongest events of the last day, `M6.1 — 40 km N of Place`. */
export async function fetchEarthquakes(fetchImpl: typeof fetch, signal: AbortSignal): Promise<Array<{ text: string; date: string }>> {
  const data = await getJson<{ features?: Array<{ properties?: { mag?: number; place?: string; time?: number } }> }>(
    fetchImpl, "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson", signal,
  );
  return (data?.features ?? [])
    .flatMap((f) => {
      const p = f.properties;
      if (!p || typeof p.mag !== "number" || typeof p.place !== "string" || typeof p.time !== "number") return [];
      return [{ mag: p.mag, place: flat(p.place, 80), date: new Date(p.time).toISOString().slice(0, 10) }];
    })
    .sort((a, b) => b.mag - a.mag)
    .slice(0, 6)
    .map((e) => ({ text: `M${e.mag.toFixed(1)} — ${e.place}`, date: e.date }));
}

/** One line per coin: `Bitcoin: 80312 USD (updated 2026-11-05)`. */
export async function fetchCrypto(ids: string[], fetchImpl: typeof fetch, signal: AbortSignal): Promise<string[]> {
  const wanted = ids.filter((id) => id === "bitcoin" || id === "ethereum");
  if (wanted.length === 0) return [];
  const data = await getJson<Record<string, { usd?: number; last_updated_at?: number }>>(
    fetchImpl, `https://api.coingecko.com/api/v3/simple/price?${new URLSearchParams({ ids: wanted.join(","), vs_currencies: "usd", include_last_updated_at: "true" })}`, signal,
  );
  return wanted.flatMap((id) => {
    const entry = data?.[id];
    if (!entry || typeof entry.usd !== "number" || !Number.isFinite(entry.usd)) return [];
    const day = typeof entry.last_updated_at === "number" ? new Date(entry.last_updated_at * 1000).toISOString().slice(0, 10) : "";
    return [`${id[0].toUpperCase()}${id.slice(1)}: ${entry.usd} USD${day ? ` (updated ${day})` : ""}`];
  });
}

// ── Putting it together ──────────────────────────────────────────────────────

export interface GatherParams {
  question: string;
  language?: string;
  fetchImpl?: typeof fetch;
  read?: EnvReader;
  now?: () => Date;
  /** The site's own articles, newest first, in the sender's language. Supplied by the webhook. */
  visionexNews?: () => Promise<NewsItem[]>;
  timeoutMs?: number;
}

/**
 * Ask every source that fits the question, in parallel, inside one deadline.
 *
 * Null when the message must not be searched, or nothing relevant came back.
 * Never throws.
 */
export async function gatherSources(params: GatherParams): Promise<SourcesResult | null> {
  const read = params.read ?? denoEnv;
  const query = buildSearchQuery(params.question);
  // A message with personal data is not sent anywhere. Rates need no query, but
  // the same message rule applies: no query means no lookups at all.
  if (!query) return null;

  const fetchImpl = params.fetchImpl ?? fetch;
  const language = (params.language ?? "en").toLowerCase().slice(0, 2);
  const now = (params.now ?? (() => new Date()))();
  const words = keywordsOf(query);
  const codes = currenciesIn(params.question);
  const quakes = asksForEarthquakes(params.question);
  const coins = coinsIn(params.question);
  // "Today" in "was there an earthquake today" is not a request for the headlines:
  // a question that names a specific kind of fact is answered by that source alone.
  const news = asksForNews(params.question) && !quakes && codes.length === 0 && coins.length === 0;
  const feeds = news ? feedsFor(enabledFeeds(read), language) : [];

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), params.timeoutMs ?? SOURCES_TIMEOUT_MS);
  const settle = async <T,>(work: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await work;
    } catch {
      return fallback;
    }
  };

  try {
    const [site, rates, facts, wiki, events, feedItems, quakeItems, prices] = await Promise.all([
      news && params.visionexNews ? settle(params.visionexNews(), [] as NewsItem[]) : Promise.resolve([] as NewsItem[]),
      codes.length > 0 ? settle(fetchRates(codes, fetchImpl, controller.signal), [] as string[]) : Promise.resolve([] as string[]),
      !news && codes.length === 0 && !quakes && coins.length === 0 ? settle(fetchWikidataFacts(query, language, fetchImpl, controller.signal), [] as string[]) : Promise.resolve([] as string[]),
      codes.length === 0 && !quakes && coins.length === 0 ? settle(fetchReference({ question: params.question, language, fetchImpl, timeoutMs: params.timeoutMs ?? SOURCES_TIMEOUT_MS }), null) : Promise.resolve(null),
      news ? settle(fetchCurrentEvents(now, fetchImpl, controller.signal), [] as Array<{ text: string; date: string }>) : Promise.resolve([] as Array<{ text: string; date: string }>),
      Promise.all(feeds.map(async (key) => {
        const preset = FEED_PRESETS[key];
        // The first 200 KB holds the newest items and bounds what is read.
        const xml = (await getText(fetchImpl, preset.url, controller.signal))?.slice(0, 200_000);
        return xml ? parseFeed(xml).map((item) => ({ ...item, source: preset.name, language: preset.language })) : [];
      })).then((lists) => lists.flat()).catch(() => []),
      quakes ? settle(fetchEarthquakes(fetchImpl, controller.signal), [] as Array<{ text: string; date: string }>) : Promise.resolve([] as Array<{ text: string; date: string }>),
      coins.length > 0 ? settle(fetchCrypto(coins, fetchImpl, controller.signal), [] as string[]) : Promise.resolve([] as string[]),
    ]);

    // When the question names a topic beyond the news words, keep only matching
    // items; when it is just "what's the news", take the newest.
    const topicWords = words.filter((w) => !NEWS_WORDS.some((n) => n.toLowerCase() === w));
    const pick = <T,>(items: T[], textOf: (item: T) => string, limit: number): T[] => {
      const matching = topicWords.length > 0 ? items.filter((item) => hasKeyword(textOf(item), topicWords)) : items;
      return matching.slice(0, limit);
    };

    const lines: Array<{ source: SourceName; text: string }> = [];
    for (const item of pick(site, (i) => `${i.title} ${i.description ?? ""}`, 3)) {
      lines.push({ source: "visionex-news", text: `[Visionex News${item.date ? `, ${item.date.slice(0, 10)}` : ""}] ${flat(item.title, 140)}${item.description ? ` — ${flat(item.description, 140)}` : ""}` });
    }
    const sameLanguage = feedItems.filter((i) => i.language === language);
    for (const item of pick(interleave(sameLanguage.length > 0 ? sameLanguage : feedItems), (i) => `${i.title} ${i.summary}`, 3)) {
      lines.push({ source: "feeds", text: `[${item.source}${item.date ? `, ${item.date}` : ""}] ${item.title}${item.summary ? ` — ${item.summary}` : ""}` });
    }
    for (const item of pick(events, (i) => i.text, 3)) {
      lines.push({ source: "current-events", text: `[Wikipedia current events, ${item.date}] ${flat(item.text, 220)}` });
    }
    // The place asked about, if any: the words that are not the word "earthquake" itself.
    const placeWords = topicWords.filter((w) => !QUAKE_WORDS.some((q) => q.includes(w) || w.includes(q)));
    const quakeMatches = placeWords.length > 0 ? quakeItems.filter((i) => hasKeyword(i.text, placeWords)) : quakeItems;
    for (const item of quakeMatches.slice(0, 3)) lines.push({ source: "earthquakes", text: `[USGS earthquakes, ${item.date}] ${item.text}` });
    for (const text of prices) lines.push({ source: "crypto", text: `[CoinGecko] ${text}` });
    for (const text of rates) lines.push({ source: "exchange-rates", text: `[Exchange rate] ${text}` });
    for (const text of facts) lines.push({ source: "wikidata", text: `[Wikidata] ${text}` });
    if (wiki) for (const passage of wiki.text.split("\n").slice(0, 2)) lines.push({ source: "wikipedia", text: `[Wikipedia] ${passage}` });

    // The budget, in order of priority: lines are whole or absent, never cut mid-sentence.
    const kept: string[] = [];
    const used: Partial<Record<SourceName, number>> = {};
    let total = 0;
    for (const line of lines) {
      if (total + line.text.length + 1 > MAX_SOURCES_CHARS) continue;
      kept.push(line.text);
      total += line.text.length + 1;
      used[line.source] = (used[line.source] ?? 0) + 1;
    }
    return kept.length > 0 ? { text: kept.join("\n"), used } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(deadline);
  }
}
