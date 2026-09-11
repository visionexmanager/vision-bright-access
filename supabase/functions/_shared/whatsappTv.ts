// VisionTV, over WhatsApp.
//
// The sibling of `whatsappRadio.ts`, and deliberately built to the same shape:
// the two services are the same service with a picture, they are administered
// from the same tables, and a sender who has learned one should not have to
// learn the other.
//
// ── The stream URL is not ours to give ──────────────────────────────────────
//
// `tv_channels.stream_url` is hidden on purpose. The table's own policy says so
// in a comment — "Users see channel metadata but NEVER stream_url" — the read
// grant is to `authenticated` alone, and watching is subscription-gated. So
// this module reads `tv_channels_public`, the anon-safe view that excludes the
// column by construction, exactly as the radio reads `radio_stations_public`.
//
// The webhook holds a service-role client, which means row-level security is
// not what protects this: the *view* is. Selecting from it is the difference
// between a feature and an incident, and the suite asserts that the query in
// the webhook names the view rather than the table.
//
// ── What a chat window can honestly offer ───────────────────────────────────
//
// Not video. What it can do is the part that is hard on a television and easy
// here: find the channel. Search by name, by country, by language or by what
// the channel is about, then hand over the page that plays it — which is where
// the subscription check and the stream token already live.
//
// Every channel has an id in the view, and the site registers
// `/services/live-tv/watch/:channelId`, so unlike the radio this can link to
// the *channel* rather than to the section. A blind sender gets one tap to the
// thing they named instead of a list to re-navigate on a screen.
//
// Pure. No `Deno`, no fetch, no database client — the query is a few lines in
// the webhook, where the client already is.

import type { Language } from "./whatsappCatalog.ts";
import { say } from "./whatsappStrings.ts";

/** The section, for somebody who wants to browse rather than to name one. */
export const TV_URL = "https://visionex.app/services/live-tv";

/** Where one channel plays. The site registers this route per channel id. */
export const tvWatchUrl = (id: string): string => `${TV_URL}/watch/${id}`;

/** One channel, as the anon-safe view returns it. Never carries a stream. */
export interface TvChannel {
  id: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  language: string | null;
  country: string | null;
  quality: string | null;
  isFeatured: boolean;
}

/**
 * How many channels one message carries.
 *
 * Five, the same as the radio, and for the same reason: read aloud, five is
 * already a lot to hold. A narrower word — "news" rather than "television" —
 * is a better answer than a longer list for somebody navigating by ear.
 */
export const MAX_CHANNELS = 5;

/** Shortest word worth searching a channel name for. */
export const MIN_TERM_CHARS = 3;
export const MAX_TERMS = 3;

/**
 * Words that mean "television" rather than naming any of it.
 *
 * Stripped before searching, in both directions: «بدي أشوف تلفزيون» means the
 * channel list, and "تلفزيون" itself matches every channel with the word in its
 * description. What is left is the part worth searching for, and when nothing
 * is left the answer is the featured channels rather than an empty result.
 *
 * The Arabic function words are the reason this list exists at all: they are
 * short, extremely common, and a three-character floor does not exclude them.
 */
const NOISE = new Set([
  // English
  "tv", "television", "channel", "channels", "watch", "live", "stream", "see",
  // "show" is the lead-in — "show me the news channels" — far more often than
  // it is part of a channel's name. "shows", plural, is left searchable.
  "show", "some", "the", "a", "an", "to", "me", "i", "want", "please", "for", "and",
  // Arabic
  "تلفزيون", "التلفزيون", "تلفاز", "قناة", "قنوات", "القنوات", "شاهد", "مشاهدة",
  "اشوف", "أشوف", "شوف", "بث", "مباشر", "بدي", "أريد", "اريد", "من", "على",
  "في", "لي", "الى", "إلى", "مع", "عن",
]);

/** What a sender asked for. */
export interface TvRequest {
  /** Words to match against channel names and descriptions. May be empty. */
  terms: string[];
  /**
   * Whether the words clearly meant watching.
   *
   * A weak guess is handed back to the assistant rather than answered with
   * channels — "watch your step" is not a request for the television.
   */
  confident: boolean;
}

/**
 * The words that mean "television", across the scripts this channel speaks.
 *
 * Stems rather than whole words, because every one of these languages inflects
 * and this is a gate, not a parser: what follows it is a search that can return
 * nothing, and returning nothing is a recoverable answer.
 */
const TV_INTENT = [
  /\b(tv|television|channels?|live stream|watch)\b/i,
  /(تلفزيون|تلفاز|قنا|قنوات|بث مباشر|مشاهد)/,
  /(televizyon|televisi|télévision|televisión|televisao|televisão|телевид|телеканал|टीवी|টিভি|テレビ|텔레비전|电视|電視|تلویزیون|truyền hình|telewizja|televisie)/i,
];

/** Everything that is not a letter, a digit or a space. Keeps a filter safe. */
const stripPunctuation = (text: string): string =>
  text.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

/**
 * The words worth searching for.
 *
 * Punctuation-stripped first, which is what makes interpolating these into a
 * PostgREST filter safe later: a comma, a parenthesis or a quote cannot survive
 * it. The same guarantee `whatsappRadio.stationTerms` relies on, and the suite
 * asserts it here too rather than trusting the family resemblance.
 */
export function channelTerms(text: string): string[] {
  const cleaned = stripPunctuation(text ?? "").toLowerCase();
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const word of cleaned.split(" ")) {
    if ([...word].length < MIN_TERM_CHARS) continue;
    if (NOISE.has(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    terms.push(word);
    if (terms.length >= MAX_TERMS) break;
  }
  return terms;
}

/** Whether this message is asking to watch, and what for. */
export function parseTvRequest(text: string | null | undefined): TvRequest | null {
  const raw = (text ?? "").trim();
  if (!raw) return null;
  if (!TV_INTENT.some((pattern) => pattern.test(raw))) return null;
  return { terms: channelTerms(raw), confident: raw.length <= 120 };
}

/** Read the view's rows into something typed, dropping anything nameless. */
export function readChannels(rows: unknown): TvChannel[] {
  if (!Array.isArray(rows)) return [];
  const channels: TvChannel[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const nameAr = typeof record.name_ar === "string" ? record.name_ar.trim() : "";
    if (!id || (!name && !nameAr)) continue;
    const description = typeof record.description === "string" ? record.description.trim() : "";
    const descriptionAr = typeof record.description_ar === "string" ? record.description_ar.trim() : "";
    channels.push({
      id,
      name: name || nameAr,
      nameAr: nameAr || null,
      description: description || null,
      descriptionAr: descriptionAr || null,
      language: typeof record.language === "string" ? record.language : null,
      country: typeof record.country === "string" ? record.country : null,
      quality: typeof record.quality === "string" ? record.quality : null,
      isFeatured: record.is_featured === true,
    });
  }
  return channels;
}

/**
 * A stream URL must never appear in anything this module returns.
 *
 * Written as a function rather than left as a rule in a comment: the view is
 * what excludes the column, and this is what notices the day somebody switches
 * the query back to the table. It is cheap, it runs on rows that are already in
 * memory, and it fails closed by dropping the channel rather than by throwing
 * inside a reply builder.
 */
export const carriesStream = (row: unknown): boolean => {
  if (!row || typeof row !== "object") return false;
  return Object.keys(row as Record<string, unknown>).some((key) => /stream|m3u8|rtmp/i.test(key));
};

/**
 * The channel's name in the reader's language, where there is one.
 *
 * Only Arabic has a second name in this schema. Everybody else gets the name
 * the channel calls itself, which is what is written on it.
 */
export const channelName = (channel: TvChannel, language: Language): string =>
  language === "ar" && channel.nameAr ? channel.nameAr : channel.name;

/**
 * The message: what is on, and where to watch each one.
 *
 * A line per channel, and the link on the same line as the name rather than one
 * link at the bottom for all five. That costs a little length and buys the
 * thing this audience actually needs: the sender picks by hearing a name and
 * taps the link that was read out with it, instead of hearing five names, then
 * a single address, and having to work out which is which.
 */
export function formatChannels(params: {
  language: Language;
  channels: readonly TvChannel[];
}): string {
  const { language } = params;
  const channels = params.channels.slice(0, MAX_CHANNELS);
  if (channels.length === 0) return noChannelsNotice(language);

  const lines = channels.flatMap((channel) => {
    const details = [channel.country, channel.quality]
      .filter((part): part is string => Boolean(part));
    const suffix = details.length > 0 ? ` — ${details.join(" · ")}` : "";
    return [`• ${channelName(channel, language)}${suffix}`, `  ${tvWatchUrl(channel.id)}`];
  });

  return [
    say("tvHeading", language),
    "",
    ...lines,
    "",
    say("tvHint", language).replace("{url}", TV_URL),
  ].join("\n");
}

// ── Browsing ────────────────────────────────────────────────────────────────
//
// Somebody who taps *Watch TV* has no channel in mind. Asking them to name one
// is asking the wrong question, and the old answer — the five most featured
// channels in the whole world — was a shelf, not a menu. A category first,
// then the channels in it, then the one link.
//
// Categories are rows rather than words because the sender has not thought of
// a word yet. Search still works and is untouched: "tv bbc" skips all of this.

/** One category, as `tv_categories` returns it. Two languages; the rest fall back. */
export interface TvCategory {
  id: string;
  slug: string;
  name: string;
  nameAr: string | null;
}

/** Read the category rows into something typed, dropping anything nameless. */
export function readCategories(rows: unknown): TvCategory[] {
  if (!Array.isArray(rows)) return [];
  const categories: TvCategory[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : "";
    const slug = typeof record.slug === "string" ? record.slug.trim() : "";
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const nameAr = typeof record.name_ar === "string" ? record.name_ar.trim() : "";
    if (!id || !slug || (!name && !nameAr)) continue;
    categories.push({ id, slug, name: name || nameAr, nameAr: nameAr || null });
  }
  return categories;
}

/**
 * A category's name in the reader's language.
 *
 * `tv_categories` holds two columns, `name` and `name_ar`, so this channel's
 * other eighteen languages read the English one. That is the same bargain
 * `channelName` makes about channel names, and for the same reason: the names
 * are content the site owns, and inventing translations here would be a second
 * source of truth for them.
 */
export const categoryLabel = (category: TvCategory, language: Language): string =>
  language === "ar" ? (category.nameAr ?? category.name) : category.name;

// ── Row ids ──────────────────────────────────────────────────────────────────
//
// Prefixed so the router can tell one of these from a catalog node id. The
// shape `svc.hub.` and `svc.item.` use, for the same two-level reason.

export const TV_CATEGORY_ID_PREFIX = "tv.cat.";
export const TV_CHANNEL_ID_PREFIX = "tv.ch.";

/** The row that opens a category at a page. */
export const tvCategoryRowId = (slug: string, page = 0): string =>
  `${TV_CATEGORY_ID_PREFIX}${slug}.${page}`;

/** The row that opens one channel. */
export const tvChannelRowId = (id: string): string => `${TV_CHANNEL_ID_PREFIX}${id}`;

/** The category and page inside a tapped row, or null for any other selection. */
export function parseTvCategorySelection(
  id: string | null | undefined,
): { category: string; page: number } | null {
  if (!id || !id.startsWith(TV_CATEGORY_ID_PREFIX)) return null;
  const rest = id.slice(TV_CATEGORY_ID_PREFIX.length);
  const cut = rest.lastIndexOf(".");
  if (cut <= 0) return null;
  const category = rest.slice(0, cut).trim();
  const page = Number.parseInt(rest.slice(cut + 1), 10);
  if (!category || !Number.isFinite(page) || page < 0) return null;
  return { category, page };
}

/** The channel id inside a tapped row, or null for any other selection. */
export function parseTvChannelSelection(id: string | null | undefined): string | null {
  if (!id || !id.startsWith(TV_CHANNEL_ID_PREFIX)) return null;
  const channel = id.slice(TV_CHANNEL_ID_PREFIX.length).trim();
  return channel ? channel : null;
}

/**
 * How many channels fit on one page.
 *
 * Seven, because Meta allows ten rows in a list and three are spoken for: a
 * "more" row, and the two control rows every list carries. The Service Center
 * landed on the same number for the same arithmetic.
 */
export const TV_PAGE_SIZE = 7;

export interface TvChannelPage {
  page: number;
  channels: TvChannel[];
  /** Whether a further page exists, which is what puts a "more" row on this one. */
  hasMore: boolean;
}

/** One page of channels, with the page number clamped into range. */
export function channelPage(channels: readonly TvChannel[], page: number): TvChannelPage {
  const pages = Math.max(1, Math.ceil(channels.length / TV_PAGE_SIZE));
  const index = Number.isFinite(page) ? Math.min(Math.max(Math.trunc(page), 0), pages - 1) : 0;
  const start = index * TV_PAGE_SIZE;
  return {
    page: index,
    channels: [...channels].slice(start, start + TV_PAGE_SIZE),
    hasMore: start + TV_PAGE_SIZE < channels.length,
  };
}

/**
 * One channel, chosen from a list: what it is, and where it plays.
 *
 * The watch page, never a stream. `tv_channels_public` does not carry a stream
 * URL and `carriesStream` refuses a row that somehow does — this is the third
 * place that rule holds, and the reason it holds here is that a link a sender
 * can forward is a link that leaves the token behind.
 */
export function formatChannel(params: { channel: TvChannel; language: Language }): string {
  const { channel, language } = params;
  const description = language === "ar"
    ? (channel.descriptionAr ?? channel.description)
    : channel.description;
  const details = [channel.country, channel.quality]
    .filter((part): part is string => Boolean(part));

  return [
    `*${channelName(channel, language)}*`,
    ...(details.length > 0 ? [details.join(" · ")] : []),
    ...(description ? ["", description] : []),
    "",
    tvWatchUrl(channel.id),
  ].join("\n");
}

/** Nothing matched. Says so, and says where everything is. */
export const noChannelsNotice = (language: Language): string =>
  say("tvNone", language).replace("{url}", TV_URL);

/** The channel list could not be read. Distinct from "nothing matched". */
export const tvUnavailableNotice = (language: Language): string =>
  say("tvUnavailable", language).replace("{url}", TV_URL);
