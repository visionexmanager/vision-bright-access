// Answering the messages that never needed a model.
//
// "hello", "thanks", "bye", "what can you do", "open the library". Before this
// existed every one of them was a provider round trip: a system prompt of several
// thousand tokens, a streamed answer, a metering row — to say "you're welcome".
// This is the layer that answers those, locally, and steps aside for everything
// else.
//
// ── It is a shortcut, not a brain ───────────────────────────────────────────
//
// A phrase catalogue does not understand language. It recognises a short list of
// things people say verbatim, in twenty languages, and refuses to guess beyond
// that. Anything it does not recognise returns `null`, and `null` means "carry
// on exactly as before" — the existing router, the existing model, the existing
// meter. So the worst a wrong miss costs is the call that was going to be made
// anyway, and there is no input for which this makes an answer worse than the
// model's.
//
// ── What it may and may not do ──────────────────────────────────────────────
//
//   - It answers only with the fixed public text in `localIntentCatalogue.ts`.
//     Never with a number, a price, a search result, availability or anything
//     about the person asking, so a reply is identical for every sender and
//     there is nothing to cache per user, or to leak between them.
//   - It never performs an action. "Open the library" returns a link to a public
//     page; the visitor follows it, under the site's own auth guards.
//   - It never grants access. It runs *after* the subscription gate and the rate
//     limits at both call sites, so a match cannot get anybody past either.
//   - Fuzzy matching is confined to the harmless social intents. A navigation
//     phrase must match exactly, and nothing here is destructive, financial or
//     account-changing, so there is no case where a typo can cause one.
//   - The whole message must be the phrase. "thanks, but how do I reset my
//     password" is a question, not a thank-you, and goes to the model.
//
// ── Bounds ──────────────────────────────────────────────────────────────────
//
// Input is cut at MAX_INPUT_CHARS before anything runs; the index is built once
// from static data; fuzzy comparison is a fixed-size scan with an early length
// filter. There is no cache, no network, no database and no unbounded loop.
//
// Pure: no `Deno`, no fetch. The call sites own logging and entitlement.

import {
  CATALOGUE_VERSION,
  HELP_LEAD,
  LOCALES,
  NAV_EXTRA,
  NAV_LABELS,
  NAV_PATHS,
  NAV_TARGETS,
  OPEN_VERBS,
  SOCIAL_PHRASES,
  SOCIAL_REPLIES,
  type Locale,
  type NavTarget,
  type SocialIntent,
} from "./localIntentCatalogue.ts";

export { CATALOGUE_VERSION, LOCALES };
export type { Locale, NavTarget, SocialIntent };

export const MAX_INPUT_CHARS = 200;
export const MAX_PHRASE_CHARS = 60;
export const MAX_PHRASE_TOKENS = 8;

/** Below this a match is not acted on. Exact is 1, a verb pattern 0.95, squeezed 0.9, fuzzy 0.8. */
export const MIN_ACT_CONFIDENCE = 0.8;
/** Navigation needs an exact phrase or an exact verb pattern; never a guess. */
export const MIN_NAV_CONFIDENCE = 0.95;

export type MatchMethod = "exact" | "pattern" | "squeezed" | "fuzzy";
export type IntentId = SocialIntent | `nav.${NavTarget}`;

export interface LocalIntentMatch {
  intent: IntentId;
  category: "social" | "navigation";
  /** The locale whose phrase matched — also the language the reply is written in. */
  locale: Locale;
  confidence: number;
  method: MatchMethod;
  params: { target?: NavTarget };
  catalogueVersion: string;
}

// ── Normalisation ───────────────────────────────────────────────────────────

const ARABIC_FOLDS: Array<[RegExp, string]> = [
  [/[ً-ٰٟـ]/g, ""], // tashkeel and tatweel
  [/[أإآٱ]/g, "ا"],
  [/ى/g, "ي"], // ى → ي
  [/ة/g, "ه"], // ة → ه
  [/ک/g, "ك"], // Persian kaf → Arabic kaf
  [/[یے]/g, "ي"], // Persian / Urdu yeh → Arabic yeh
  [/[ہھ]/g, "ه"], // Urdu heh forms → heh
];

/**
 * A comparison key, never shown to anybody. The same function runs over the
 * catalogue and over the input, so what it folds away is folded on both sides
 * and cannot cause a miss. ZWNJ/ZWJ become a space rather than vanishing: they
 * carry meaning in Persian and the Indic scripts, and a space is the one thing
 * both a careful and a careless typist produce.
 */
export function normalize(input: unknown): string {
  if (typeof input !== "string") return "";
  let text = input.slice(0, MAX_INPUT_CHARS).normalize("NFKC").toLowerCase();
  for (const [pattern, replacement] of ARABIC_FOLDS) text = text.replace(pattern, replacement);
  text = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Latin / Cyrillic accents only; Indic vowel signs are not in this range
    .normalize("NFC")
    .replace(/[‌‍]/g, " ")
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

/** Collapses runs of one character ("hellooo" → "helo") so elongation matches. */
const squeeze = (text: string): string => text.replace(/(.)\1+/gu, "$1");

// ── The index, built once ───────────────────────────────────────────────────

interface Entry {
  intent: IntentId;
  category: "social" | "navigation";
  locale: Locale;
  target?: NavTarget;
  key: string;
}

interface Index {
  exact: Map<string, Entry[]>;
  squeezed: Map<string, Entry[]>;
  nav: Map<string, Entry[]>;
  social: Entry[];
}

let built: Index | null = null;

function push(map: Map<string, Entry[]>, key: string, entry: Entry) {
  const list = map.get(key);
  if (list) list.push(entry);
  else map.set(key, [entry]);
}

function buildIndex(): Index {
  const index: Index = { exact: new Map(), squeezed: new Map(), nav: new Map(), social: [] };
  for (const locale of LOCALES) {
    for (const intent of Object.keys(SOCIAL_PHRASES) as SocialIntent[]) {
      for (const phrase of SOCIAL_PHRASES[intent][locale]) {
        const key = normalize(phrase);
        if (!key) continue;
        const entry: Entry = { intent, category: "social", locale, key };
        push(index.exact, key, entry);
        push(index.squeezed, squeeze(key), entry);
        index.social.push(entry);
      }
    }
    NAV_TARGETS.forEach((target, position) => {
      const names = [NAV_LABELS[locale][position], ...(NAV_EXTRA[target]?.[locale] ?? [])];
      for (const name of names) {
        const key = normalize(name);
        if (!key) continue;
        const entry: Entry = { intent: `nav.${target}`, category: "navigation", locale, target, key };
        push(index.exact, key, entry);
        push(index.nav, key, entry);
      }
    });
  }
  return index;
}

/** Exposed for the tests that assert the catalogue has no ambiguous phrase. */
export function catalogueIndex(): Index {
  return (built ??= buildIndex());
}

// ── Matching ────────────────────────────────────────────────────────────────

const ARTICLES = new Set(["the", "el", "la", "los", "las", "le", "les", "l", "die", "der", "das", "den", "il", "lo", "i", "o", "os", "as", "het"]);
const NO_SPACE_SCRIPTS: ReadonlySet<Locale> = new Set(["zh", "ja"]);

/** The navigation target left once an "open"-style verb and an article are removed, or null. */
function stripOpenVerb(norm: string): string | null {
  for (const locale of LOCALES) {
    for (const verb of OPEN_VERBS[locale]) {
      const v = normalize(verb);
      if (!v) continue;
      const loose = NO_SPACE_SCRIPTS.has(locale);
      let rest: string | null = null;
      if (norm.startsWith(v) && (loose || norm[v.length] === " ")) rest = norm.slice(v.length).trim();
      else if (norm.endsWith(v) && (loose || norm[norm.length - v.length - 1] === " ")) rest = norm.slice(0, norm.length - v.length).trim();
      if (!rest) continue;
      const tokens = rest.split(" ");
      while (tokens.length > 1 && ARTICLES.has(tokens[0])) tokens.shift();
      return tokens.join(" ");
    }
  }
  return null;
}

/** Edit distance ≤ 1 (one insert, delete, substitution or adjacent swap), without a matrix. */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true; // substitution
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // swap
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
}

const FUZZY_SCRIPT = /^[\p{Script=Latin}\p{Script=Cyrillic}\s]+$/u;

function choose(entries: Entry[], preferred: string | null | undefined): Entry {
  return entries.find((e) => e.locale === preferred) ?? entries[0];
}

const distinct = (entries: Entry[]): number => new Set(entries.map((e) => e.intent)).size;

function toMatch(entry: Entry, confidence: number, method: MatchMethod): LocalIntentMatch {
  return {
    intent: entry.intent,
    category: entry.category,
    locale: entry.locale,
    confidence,
    method,
    params: entry.target ? { target: entry.target } : {},
    catalogueVersion: CATALOGUE_VERSION,
  };
}

/**
 * Recognise `text` as one of the catalogue's phrases, or return null.
 *
 * `preferredLocale` only breaks a tie between languages that spell a phrase the
 * same way ("hallo", "hola"); it never makes a non-matching phrase match.
 */
export function matchLocalIntent(text: unknown, preferredLocale?: string | null): LocalIntentMatch | null {
  const norm = normalize(text);
  if (!norm || norm.length > MAX_PHRASE_CHARS || norm.split(" ").length > MAX_PHRASE_TOKENS) return null;
  const index = catalogueIndex();

  const exact = index.exact.get(norm);
  if (exact) return distinct(exact) === 1 ? toMatch(choose(exact, preferredLocale), 1, "exact") : null;

  const bare = stripOpenVerb(norm);
  if (bare) {
    const nav = index.nav.get(bare);
    if (nav) return distinct(nav) === 1 ? toMatch(choose(nav, preferredLocale), 0.95, "pattern") : null;
  }

  const squeezed = index.squeezed.get(squeeze(norm));
  if (squeezed) return distinct(squeezed) === 1 ? toMatch(choose(squeezed, preferredLocale), 0.9, "squeezed") : null;

  if (norm.length >= 5 && norm.length <= 30 && FUZZY_SCRIPT.test(norm)) {
    const hits = index.social.filter((e) => e.key.length >= 5 && FUZZY_SCRIPT.test(e.key) && withinOneEdit(norm, e.key));
    if (hits.length > 0 && distinct(hits) === 1) return toMatch(choose(hits, preferredLocale), 0.8, "fuzzy");
  }
  return null;
}

// ── Replies ─────────────────────────────────────────────────────────────────

export interface ReplyOptions {
  /** "markdown" for the website chat, "plain" for WhatsApp (no link markup). */
  format?: "markdown" | "plain";
  /** Prepended to a page path. WhatsApp needs an absolute address; the website a relative one. */
  baseUrl?: string;
  /** False for voice, where a link is read aloud as noise. Navigation then is not answered. */
  links?: boolean;
}

function link(label: string, target: NavTarget, options: ReplyOptions): string {
  const url = `${options.baseUrl ?? ""}${NAV_PATHS[target]}`;
  return options.format === "plain" ? `${label}: ${url}` : `[${label}](${url})`;
}

/** The fixed reply for a match, or null when this channel cannot show it (voice + links). */
export function localReply(match: LocalIntentMatch, options: ReplyOptions = {}): string | null {
  const links = options.links !== false;
  const labels = NAV_LABELS[match.locale];
  switch (match.intent) {
    case "greeting":
    case "farewell":
    case "thanks":
      return SOCIAL_REPLIES[match.intent][match.locale];
    case "help": {
      if (!links) return HELP_LEAD[match.locale];
      const items = NAV_TARGETS.slice(0, 4).map((t) => link(labels[NAV_TARGETS.indexOf(t)], t, options));
      return options.format === "plain"
        ? `${HELP_LEAD[match.locale]}:\n${items.join("\n")}`
        : `${HELP_LEAD[match.locale]}: ${items.join(" · ")}`;
    }
    default: {
      if (!links || !match.params.target) return null;
      return link(labels[NAV_TARGETS.indexOf(match.params.target)], match.params.target, options);
    }
  }
}

export interface LocalAnswer {
  match: LocalIntentMatch;
  reply: string;
  /** Wall-clock milliseconds the local path took. */
  ms: number;
}

/**
 * The one entry point both channels call: a reply when the message is fully
 * satisfied locally, otherwise null. Applies the confidence floors, so a caller
 * cannot accidentally act on a weak match.
 */
export function answerLocally(text: unknown, options: ReplyOptions & { preferredLocale?: string | null } = {}): LocalAnswer | null {
  const started = performance.now();
  const match = matchLocalIntent(text, options.preferredLocale);
  if (!match) return null;
  const floor = match.category === "navigation" ? MIN_NAV_CONFIDENCE : MIN_ACT_CONFIDENCE;
  if (match.confidence < floor) return null;
  const reply = localReply(match, options);
  if (!reply) return null;
  return { match, reply, ms: Math.round((performance.now() - started) * 100) / 100 };
}

// ── Measurement ─────────────────────────────────────────────────────────────

/** A rough input-token count (4 characters per token). An estimate, and labelled as one. */
export const estimateTokens = (characters: number): number => Math.ceil(Math.max(0, characters) / 4);

/**
 * What a call site logs for each local answer. No message text, no identifier of
 * the sender: the intent, the language, the method and what was not spent.
 *
 * `est_avoided_input_tokens` is an estimate of the prompt that was not sent. It
 * is not billing: a saving is only confirmed by `ai_usage_events` showing fewer
 * rows, and the report that quotes this must say so.
 */
export function localIntentMetric(channel: "website" | "whatsapp", answer: LocalAnswer, promptCharacters: number) {
  return {
    event: "local_intent",
    channel,
    intent: answer.match.intent,
    locale: answer.match.locale,
    method: answer.match.method,
    confidence: answer.match.confidence,
    ms: answer.ms,
    est_avoided_input_tokens: estimateTokens(promptCharacters),
    provider_called: false,
    catalogue: answer.match.catalogueVersion,
  };
}
