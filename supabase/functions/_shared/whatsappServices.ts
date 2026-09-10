// The Visionex Service Center, over WhatsApp.
//
// Twenty-five phases of this channel built features *for* WhatsApp. This one
// builds none: everything it offers already exists on visionex.app and has for
// longer than the webhook has. What was missing was a door — thirty services a
// sender could reach by opening a browser and could not reach by asking.
//
// ── Why there is no second catalogue ────────────────────────────────────────
//
// `src/features/servicecenter/catalog.ts` is the single source of truth for
// every service, advisor, tool and experience Visionex sells, and the approved
// decision on the site side was to *index* it rather than copy it into a table.
// That decision already produced exactly what an edge function needs: an edge
// function cannot import from `src/`, so `scripts/generate-services-index.ts`
// snapshots the catalogue to `data/servicesCatalog.json`, and
// `src/test/services-index.test.ts` fails the moment the snapshot drifts.
//
// So this module reads that snapshot. Not a copy of it, not a WhatsApp-shaped
// re-listing of it — the same file the semantic search and the embedder read.
// A service added to the site's catalogue appears on this menu when the
// snapshot is regenerated, and a service that changes its price or its page
// changes here too, because there is nowhere else for it to be written down.
//
// ── What is in the sender's language and what is not ────────────────────────
//
// Two different things, and conflating them is how a menu ends up half
// translated. The *interface* — the headings, the hub names, the sentence that
// says how to book — is this channel's own words, lives in `whatsappStrings.ts`
// and exists in all twenty languages. The *services* — their titles and
// taglines — are content the site wrote, and the site wrote them in Arabic and
// English. A sender reading in Turkish gets Turkish scaffolding around an
// English service name, which is the same honest gap `whatsappNews.ts`
// documents for an untranslated article: visibly incomplete beats invisibly
// broken, and the alternative is machine-translating a product name.
//
// ── Search reads the field that was built for search ────────────────────────
//
// `text` on each record is the retrieval string the indexer assembles: title,
// tagline, keywords and intents, in both languages, concatenated. It exists so
// either language finds a service, which is precisely what a sender typing
// «بدي محامي» needs. Matching against it means this module ships no keyword
// list of its own to go stale.
//
// Pure and provider-free: no `Deno`, no fetch, no database. The JSON is a
// build artefact imported at module load, and every rule here is exercised by
// the Vitest suite directly.

import catalogue from "./data/servicesCatalog.json" with { type: "json" };
import type { Language } from "./whatsappCatalog.ts";
import { aliasesOf, nodeById } from "./whatsappCatalog.ts";
import { SUPPORTED_LANGUAGES } from "./whatsappLanguages.ts";
import { normaliseAlias } from "./whatsappRouter.ts";
import { say } from "./whatsappStrings.ts";

/** The site itself. Every service path in the snapshot is relative to it. */
export const SITE_ORIGIN = "https://visionex.app";

/** The Service Center's own page, for the sender who wants the whole list. */
export const SERVICES_URL = `${SITE_ORIGIN}/services`;

/**
 * One service, exactly as `IndexedService` writes it.
 *
 * Declared again here rather than imported because the two live on opposite
 * sides of a boundary an edge function cannot cross. The parity test asserts
 * the shapes agree, which is the only way they can be kept honest.
 */
export interface ServiceRecord {
  id: string;
  title_en: string;
  title_ar: string;
  tagline_en: string;
  tagline_ar: string;
  hub: string;
  kind: string;
  path: string;
  difficulty: string;
  vx: number | null;
  text: string;
}

/** Every service the site sells, in the order the catalogue declares them. */
export const SERVICES: readonly ServiceRecord[] = catalogue as ServiceRecord[];

/**
 * The six hubs, in the order the Service Center puts them in.
 *
 * Hard-coded rather than derived from the data, because "the order the rows
 * happen to appear in the JSON" is not an ordering decision anybody made, and a
 * menu that reshuffles itself when somebody inserts a service is a menu a blind
 * sender has to re-learn. A hub in the data that is not named here still
 * appears — at the end, rather than not at all.
 */
export const HUB_ORDER = [
  "personal-growth",
  "marketplace",
  "creative-studio",
  "business-lab",
  "tech-repair",
  "engineering",
] as const;

/** The UI string that names a hub, in the sender's language. */
const HUB_STRING: Readonly<Record<string, string>> = {
  "personal-growth": "hubPersonalGrowth",
  "marketplace": "hubMarketplace",
  "creative-studio": "hubCreativeStudio",
  "business-lab": "hubBusinessLab",
  "tech-repair": "hubTechRepair",
  "engineering": "hubEngineering",
};

/** An emoji per hub. Decoration only: every row reads correctly without it. */
const HUB_EMOJI: Readonly<Record<string, string>> = {
  "personal-growth": "🌱",
  "marketplace": "💼",
  "creative-studio": "🎨",
  "business-lab": "📈",
  "tech-repair": "🔧",
  "engineering": "⚙️",
};

/**
 * The hubs that actually have something in them, in presentation order.
 *
 * An empty hub is not offered. A row that opens a list with nothing on it is
 * worse than no row, and it is the sort of thing that appears the day somebody
 * removes the last service from a category.
 */
export function hubs(): string[] {
  const present = new Set(SERVICES.map((service) => service.hub));
  const known = HUB_ORDER.filter((hub) => present.has(hub));
  const rest = [...present].filter((hub) => !(HUB_ORDER as readonly string[]).includes(hub)).sort();
  return [...known, ...rest];
}

/** A hub's name, in the sender's language, with its icon in front. */
export function hubTitle(hub: string, language: Language): string {
  const key = HUB_STRING[hub];
  const name = key ? say(key as Parameters<typeof say>[0], language) : hub;
  const emoji = HUB_EMOJI[hub];
  return emoji ? `${emoji} ${name}` : name;
}

/** The services in one hub, in catalogue order. */
export function servicesInHub(hub: string): ServiceRecord[] {
  return SERVICES.filter((service) => service.hub === hub);
}

/** One service by its slug, or null. */
export function serviceById(slug: string): ServiceRecord | null {
  return SERVICES.find((service) => service.id === slug) ?? null;
}

/**
 * Rows on one page of a hub.
 *
 * Seven, because Meta allows ten rows in a list *in total* and the message that
 * carries them already spends two on Back and Main menu and one more on "show
 * me the rest". An eleventh row is not truncated — the whole message is
 * rejected — so the ceiling is arithmetic, not taste.
 */
export const SERVICE_PAGE_SIZE = 7;

export interface HubPage {
  hub: string;
  page: number;
  services: ServiceRecord[];
  /** Whether a further page exists, which is what puts a "more" row on this one. */
  hasMore: boolean;
}

/**
 * One page of a hub, clamped.
 *
 * A page number past the end returns the last page rather than an empty list:
 * the id came from a row this channel sent, but a redeployed snapshot can have
 * fewer services in it than the message the sender is still scrolling.
 */
export function hubPage(hub: string, page: number): HubPage {
  const all = servicesInHub(hub);
  const pages = Math.max(1, Math.ceil(all.length / SERVICE_PAGE_SIZE));
  const index = Number.isFinite(page) ? Math.min(Math.max(Math.trunc(page), 0), pages - 1) : 0;
  const start = index * SERVICE_PAGE_SIZE;
  return {
    hub,
    page: index,
    services: all.slice(start, start + SERVICE_PAGE_SIZE),
    hasMore: start + SERVICE_PAGE_SIZE < all.length,
  };
}

// ── Row ids ──────────────────────────────────────────────────────────────────
//
// Prefixed so the router can tell one of these from a catalog node id without
// having to know what a service is. The same shape `news.` and `language.` use.

export const HUB_ID_PREFIX = "svc.hub.";
export const SERVICE_ID_PREFIX = "svc.item.";

/** The row that opens a hub at a page. */
export const hubRowId = (hub: string, page = 0): string => `${HUB_ID_PREFIX}${hub}.${page}`;

/** The row that opens one service. */
export const serviceRowId = (slug: string): string => `${SERVICE_ID_PREFIX}${slug}`;

/** The hub and page inside a tapped row, or null for any other selection. */
export function parseHubSelection(id: string | null | undefined): { hub: string; page: number } | null {
  if (!id || !id.startsWith(HUB_ID_PREFIX)) return null;
  const rest = id.slice(HUB_ID_PREFIX.length);
  const cut = rest.lastIndexOf(".");
  if (cut <= 0) return null;
  const hub = rest.slice(0, cut).trim();
  const page = Number.parseInt(rest.slice(cut + 1), 10);
  if (!hub || !Number.isFinite(page) || page < 0) return null;
  return { hub, page };
}

/** The service slug inside a tapped row, or null for any other selection. */
export function parseServiceSelection(id: string | null | undefined): string | null {
  if (!id || !id.startsWith(SERVICE_ID_PREFIX)) return null;
  const slug = id.slice(SERVICE_ID_PREFIX.length).trim();
  return slug ? slug : null;
}

// ── The words that ask for this ──────────────────────────────────────────────

/** Longest a message can be and still be read as "open the services list". */
const SERVICES_MAX_CHARS = 40;

/**
 * Every word that names the directory, in every language, folded once.
 *
 * Read from the catalog node rather than kept here, for the reason
 * `whatsappNews.ts` gives: the node already declares its aliases so a
 * switched-off feature can be refused by name, and two hand-maintained lists of
 * the same twenty languages is one list going stale.
 */
const SERVICES_WORDS: ReadonlySet<string> = (() => {
  const node = nodeById("explore.services");
  const words = new Set<string>();
  if (!node) return words;
  for (const language of SUPPORTED_LANGUAGES) {
    for (const alias of aliasesOf(node, language)) words.add(normaliseAlias(alias));
  }
  words.delete("");
  return words;
})();

/**
 * Whether this message is asking for the services list.
 *
 * Whole-message against a short cap, never a substring hunt: "your delivery
 * service lost my parcel" is a support message, and answering it with a
 * directory would be the assistant talking over somebody.
 */
export function parseServicesRequest(text: string | null | undefined): boolean {
  const value = normaliseAlias(text ?? "");
  if (!value || value.length > SERVICES_MAX_CHARS) return false;
  return SERVICES_WORDS.has(value);
}

// ── Search ───────────────────────────────────────────────────────────────────

/** Most matches worth showing at once. Three leaves room for the way back. */
export const SERVICE_MATCH_LIMIT = 3;

/** Words too common to carry a match on their own, in the two search languages. */
const STOP_WORDS: ReadonlySet<string> = new Set([
  "a",
  "an",
  "the",
  "and",
  "for",
  "with",
  "i",
  "me",
  "my",
  "want",
  "need",
  "looking",
  "help",
  "please",
  "service",
  "services",
  "بدي",
  "بدنا",
  "اريد",
  "احتاج",
  "لو",
  "سمحت",
  "في",
  "من",
  "على",
  "خدمة",
  "خدمات",
]);

/**
 * The services that match what somebody typed, best first.
 *
 * Token overlap against the record's own retrieval string, which already holds
 * the title, the tagline, the keywords and the intents in both languages. A
 * token has to appear as a *word* — «طب» must not match «مطبخ» — so each is
 * tested against word boundaries the way the Arabic and Latin scripts both
 * respect: the surrounding character must not be a letter.
 *
 * Ties break on catalogue order rather than on nothing, so the same query
 * always produces the same list. A search that reorders itself between two
 * identical questions is a search somebody cannot describe to support.
 */
export function searchServices(query: string | null | undefined, limit = SERVICE_MATCH_LIMIT): ServiceRecord[] {
  const folded = normaliseAlias(query ?? "");
  if (!folded) return [];

  const tokens = folded
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  if (tokens.length === 0) return [];

  const scored = SERVICES.map((service, order) => {
    const haystack = normaliseAlias(service.text);
    let score = 0;
    for (const token of tokens) if (containsWord(haystack, token)) score += 1;
    return { service, score, order };
  }).filter((row) => row.score > 0);

  scored.sort((a, b) => (b.score - a.score) || (a.order - b.order));
  return scored.slice(0, Math.max(limit, 0)).map((row) => row.service);
}

/**
 * Whether a folded haystack contains a token as a whole word.
 *
 * Written by hand rather than with `\b`, which is defined on ASCII word
 * characters and so treats every Arabic letter as a boundary — under `\b` the
 * token «طب» matches inside «مطبخ», which is the bug this exists to avoid.
 */
function containsWord(haystack: string, token: string): boolean {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(token, from);
    if (at < 0) return false;
    const before = at === 0 ? "" : haystack[at - 1];
    const after = haystack[at + token.length] ?? "";
    if (!isLetter(before) && !isLetter(after)) return true;
    from = at + 1;
  }
}

const isLetter = (character: string): boolean => character !== "" && /\p{L}|\p{N}/u.test(character);

// ── Wording ──────────────────────────────────────────────────────────────────

/**
 * A service's own words, in the sender's language or in English.
 *
 * Arabic and English are what the site wrote. Everything else falls back to
 * English rather than to an empty row — see the note at the top of the file.
 */
export function serviceText(service: ServiceRecord, language: Language): { title: string; tagline: string } {
  const arabic = language === "ar";
  return {
    title: (arabic ? service.title_ar : service.title_en) || service.title_en,
    tagline: (arabic ? service.tagline_ar : service.tagline_en) || service.tagline_en,
  };
}

/** The page this service lives on, absolute, so it is tappable in a chat. */
export const serviceUrl = (service: ServiceRecord): string =>
  service.path.startsWith("http") ? service.path : `${SITE_ORIGIN}${service.path}`;

/**
 * One service, as the message a sender receives after tapping its row.
 *
 * Title, the line the site pitches it with, what a session costs when it costs
 * anything, the page, and how to reach a person — which is how these are booked
 * on the site too. Deliberately short: this is a directory in a chat window,
 * not a sales page, and the page is one tap away.
 */
export function formatService(params: { service: ServiceRecord; language: Language }): string {
  const { service, language } = params;
  const { title, tagline } = serviceText(service, language);

  const lines = [`✨ *${title}*`];
  if (tagline) {
    lines.push("");
    lines.push(tagline);
  }
  if (typeof service.vx === "number" && service.vx > 0) {
    lines.push("");
    lines.push(say("serviceCost", language).replace("{vx}", String(service.vx)));
  }
  lines.push("");
  lines.push(say("serviceLink", language).replace("{url}", serviceUrl(service)));
  lines.push(say("serviceBookHint", language));
  return lines.join("\n");
}
