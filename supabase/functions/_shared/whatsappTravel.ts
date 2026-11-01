// Asking the desk for a flight, a room, a car or a product from a global store,
// from WhatsApp.
//
// ── What this is, and what it is not ────────────────────────────────────────
//
// Nothing here books anything. Every supplier in the flights, hotels and
// mobility registries is `not_researched`, and `/travel` on the website says so:
// it files a request to the travel desk. This is the same door for a sender who
// is already in WhatsApp — the request lands in `service_requests`, the queue
// the desk already works from, under the same `service_type` strings the web
// pages use, so one inbox serves both channels.
//
// No payment, no card number, no passport number is asked for or stored. The
// desk answers on the number the request came from.
//
// ── Why it is one message and not a questionnaire ───────────────────────────
//
// A sender on a screen reader answers one prompt, not seven. The prompt names
// what the desk needs; whatever comes back is filed verbatim. A request too
// short to be useful is asked for again rather than filed empty.
//
// ── Two routes, as on the website ───────────────────────────────────────────
//
// Like the assistive-products desk, the sender chooses: do it themselves on the
// official sites (the links are sent here, from the same directory the website
// shows), or have the Visionex team do it. Ordering a product from a store
// (Amazon, AliExpress, eBay and the rest) is the same shape, with a new/used
// question; those requests file under the "Global Shopping" service type.
//
// Pure: no Deno, no fetch, no client. The webhook owns the insert.

import { GLOBAL_STORES, TRAVEL_SITES } from "./deskDirectory.ts";

/** Same strings as `src/features/travel/requests.ts`; a test pins them together. */
export const TRAVEL_SERVICE_TYPE = Object.freeze({
  flights: "Travel Agency — Flight request",
  stays: "Travel Agency — Hotel request",
  cars: "Travel Agency — Car rental request",
} as const);

export type TravelDomain = keyof typeof TRAVEL_SERVICE_TYPE;

/** What a sender can ask the desk for: a trip, or a product from a store. */
export type DeskKind = TravelDomain | "shop";

export const SHOP_SERVICE_TYPE = "Global Shopping — Order for me";

export const TRAVEL_FEATURE = "services.travel";
export const SHOP_FEATURE = "services.shop";
export const TRAVEL_ROUTE_STEP = "desk_route";
export const TRAVEL_DETAILS_STEP = "travel_details";

export const featureFor = (kind: DeskKind): string => (kind === "shop" ? SHOP_FEATURE : TRAVEL_FEATURE);

/** A request shorter than this cannot name a place and a date. */
export const MIN_DETAIL_CHARS = 15;
/** A message at least this long that names a domain is an itinerary already. */
export const ITINERARY_CHARS = 45;
/** `service_requests.message` is free text; this keeps one request readable by the desk. */
export const MAX_DETAIL_CHARS = 1200;

const fold = (text: string): string =>
  text
    .normalize("NFKD")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

// Phrases, not single words: "flight" alone is a question about a delay, and
// "hotel" alone is a place somebody is standing in. Each needs the act of
// booking or the thing being bought.
const PATTERNS: ReadonlyArray<readonly [TravelDomain, RegExp]> = [
  [
    "flights",
    /(?:\b(?:book|reserve|buy|need|want|find)\b.{0,20}\b(?:flight|plane ticket|air ?ticket)s?\b|\b(?:flight|plane|air) tickets?\b|\bfly to\b|(?:حجز|احجز|ابغى|بدي|اريد|ابي).{0,12}(?:طيران|رحله جويه|تذكره طيران|تذاكر طيران|تذكره سفر)|تذاكر? (?:طيران|سفر))/u,
  ],
  [
    "stays",
    /(?:\b(?:book|reserve|need|want|find)\b.{0,20}\b(?:hotel|room|stay|apartment)s?\b|\bhotel booking\b|(?:حجز|احجز|ابغى|بدي|اريد|ابي).{0,12}(?:فندق|غرفه|شقه|اقامه))/u,
  ],
  [
    "cars",
    /(?:\b(?:rent|hire|book)\b.{0,12}\b(?:a |an )?(?:car|vehicle)\b|\bcar (?:rental|hire)\b|(?:تاجير|ايجار|استئجار|اجار|احجز|حجز|بدي|اريد).{0,10}(?:سياره|مركبه))/u,
  ],
];

/** Which kind of trip a message asks to arrange, or `null` when it asks for none. */
export function parseTravelDomain(text: string | null | undefined): TravelDomain | null {
  const folded = fold(text ?? "");
  if (!folded.trim()) return null;
  for (const [domain, pattern] of PATTERNS) if (pattern.test(folded)) return domain;
  return null;
}

export const isTravelDomain = (value: unknown): value is TravelDomain =>
  value === "flights" || value === "stays" || value === "cars";

export const isDeskKind = (value: unknown): value is DeskKind => value === "shop" || isTravelDomain(value);

const STORE_NAMES =
  "amazon|alibaba|aliexpress|taobao|shein|temu|ebay|walmart|etsy|noon|jumia|mercado ?libre|flipkart|rakuten|trendyol";
const STORE_NAMES_AR = "امازون|علي بابا|عليبابا|علي اكسبرس|عليكسبرس|شي ?ان|شيين|تيمو|ايباي|والمارت|نون|جوميا|تاوباو";

const SHOP_PATTERN = new RegExp(
  String.raw`(?:\b(?:order|buy|get|purchase|import|shop)\b.{0,40}\b(?:${STORE_NAMES}|online store|global store)s?\b` +
    String.raw`|\b(?:${STORE_NAMES})\b.{0,30}\b(?:order|buy|purchase)\b` +
    String.raw`|(?:اطلب|اشتري|شراء|طلب|استيراد|بدي|اريد|ابغى|ابي).{0,25}(?:${STORE_NAMES_AR}|${STORE_NAMES}|متجر عالمي|متاجر عالميه))`,
  "u",
);

/** Whether the sender wants a product ordered from a global online store. */
export const parseShopIntent = (text: string | null | undefined): boolean => SHOP_PATTERN.test(fold(text ?? ""));

/** A trip or a store order, or `null` when the message asks for neither. */
export function parseDeskKind(text: string | null | undefined): DeskKind | null {
  return parseTravelDomain(text) ?? (parseShopIntent(text) ? "shop" : null);
}

export type DeskRoute = "direct" | "staff";

const ARABIC_INDIC = /[٠-٩]/g;

/** "1" or "2", or the words for them; `null` for anything else so the question is asked again. */
export function parseRouteChoice(text: string | null | undefined): DeskRoute | null {
  const value = fold(text ?? "")
    .replace(ARABIC_INDIC, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();
  if (!value) return null;
  if (value === "1" || /\b(direct|myself|yourself|on my own)\b|بنفسي|مباشر|بنفسك|لحالي/u.test(value)) return "direct";
  if (value === "2" || /\b(team|staff|desk|agent|employee)\b|موظف|فريق|مكتب|انتم|منكم/u.test(value)) return "staff";
  return null;
}

/** The official sites for a kind, one per line, ready to follow a heading. */
export function directLinks(kind: DeskKind): string {
  const rows =
    kind === "shop" ? GLOBAL_STORES : TRAVEL_SITES.filter((site) => site.kinds.includes(kind));
  return rows.map((row) => `${row.name}: ${row.url}`).join("\n");
}

/** True when the opening message already carries the itinerary. */
export const looksLikeItinerary = (text: string | null | undefined): boolean =>
  (text ?? "").trim().length >= ITINERARY_CHARS;

/** The details, trimmed and capped; `null` when too short to act on. */
export function readDetails(text: string | null | undefined): string | null {
  const value = (text ?? "").replace(/\s+/g, " ").trim();
  if (value.length < MIN_DETAIL_CHARS) return null;
  return value.slice(0, MAX_DETAIL_CHARS);
}

/** Placeholder for a sender who never gave an address; `.invalid` is reserved and can never route. */
export const NO_EMAIL = "no-email@whatsapp.invalid";

export interface TravelRequestRow {
  user_id: null;
  full_name: string;
  email: string;
  phone: string;
  service_type: string;
  message: string;
  status: "pending";
}

/**
 * The `service_requests` row for one request.
 *
 * `user_id` is null on purpose: a WhatsApp number is bound to an account only
 * by an emailed code, and a request must not need one. The desk reads the phone.
 */
export function buildTravelRequest(params: {
  domain: DeskKind;
  details: string;
  phone: string;
  name?: string | null;
  email?: string | null;
}): TravelRequestRow {
  return {
    user_id: null,
    full_name: params.name?.trim() || "WhatsApp",
    email: params.email?.trim() || NO_EMAIL,
    phone: params.phone,
    service_type: params.domain === "shop" ? SHOP_SERVICE_TYPE : TRAVEL_SERVICE_TYPE[params.domain],
    message: `[WhatsApp] ${params.details}`,
    status: "pending",
  };
}
