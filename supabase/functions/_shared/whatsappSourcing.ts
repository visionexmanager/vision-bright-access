// When the bazaar has nothing, ask the catalogue.
//
// ── The gap this closes ─────────────────────────────────────────────────────
//
// `whatsappBazaar.ts` searches `bazaar_products` — listings that shops have put
// up for sale. Visionex also has `products`, the main catalogue, and a Commerce
// Agent that searches it properly: intent parsing, ranking, de-duplication,
// condition grouping and pricing. That agent has a `channel` field and has
// accepted `"whatsapp"` since the day it was written.
//
// Nothing ever passed it. A sender who asked for something no shop happened to
// list was told "nothing found" and given a URL, while the same question on the
// website reached a catalogue and an agent. That is the whole of this file: the
// dead end becomes a second question.
//
// ── What a sender is allowed to see ─────────────────────────────────────────
//
// Exactly what `sourcing/confidentiality.ts` decided, and nothing more. Supplier
// identity, source price and the margin breakdown live in `sourcing_results`,
// which is admin-read only, and never reach a customer on any channel. This
// module renders the customer-facing projection and does not widen it — the
// allow-list is over there, deliberately, so a field added later is invisible
// until somebody puts it on the list.
//
// `ref` (VX-…) is the one identifier that is meant to be shown: it is how a
// person says which one they want, and it names nothing about where it came
// from.
//
// Pure. No `Deno`, no fetch, no database client — the call itself is made by the
// webhook, where the clients already are, and everything here is testable with
// a literal.

import type { Language } from "./whatsappCatalog.ts";
import { say } from "./whatsappStrings.ts";

/** Where a sender goes to finish what they started here. */
export const CATALOGUE_URL = "https://visionex.app/products";

export type OfferCondition = "new" | "used" | "refurbished";

/** One catalogue offer, already stripped to what a customer may see. */
export interface SourcedOffer {
  ref: string;
  title: string;
  brand: string | null;
  condition: OfferCondition;
  priceUsd: number | null;
  /** Present when only a researched range is known, never alongside a price. */
  priceRangeUsd?: { min: number; max: number };
  currency: string;
  availability: string | null;
  /** Present only when the source's terms require naming it. */
  sourceName?: string;
}

/**
 * How many offers one message carries.
 *
 * The agent returns up to ten. Four is what a person can hold in their head
 * when it is being read aloud — and for a listener who cannot see the screen,
 * a list of ten is not a choice, it is a wall. The rest are a search away.
 */
export const MAX_OFFERS = 4;

const CONDITIONS: readonly OfferCondition[] = ["new", "used", "refurbished"];

const isCondition = (value: unknown): value is OfferCondition =>
  typeof value === "string" && (CONDITIONS as readonly string[]).includes(value);

/** A range is only a range when both ends are real numbers the right way round. */
const isRange = (value: unknown): value is { min: number; max: number } => {
  if (!value || typeof value !== "object") return false;
  const { min, max } = value as { min?: unknown; max?: unknown };
  return typeof min === "number" && typeof max === "number"
    && Number.isFinite(min) && Number.isFinite(max)
    && min >= 0 && max >= min;
};

/**
 * Read the agent's reply into something typed, dropping anything malformed.
 *
 * The response groups by condition. They are flattened in the order new → used
 * → refurbished, because a person who did not ask for a condition means a new
 * one, and the cheaper alternatives are worth showing underneath rather than
 * instead.
 */
export function readSourcedOffers(body: unknown): SourcedOffer[] {
  if (!body || typeof body !== "object") return [];
  const results = (body as { results?: unknown }).results;
  if (!results || typeof results !== "object") return [];

  const offers: SourcedOffer[] = [];
  for (const condition of CONDITIONS) {
    const list = (results as Record<string, unknown>)[condition];
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const offer = readOffer(row, condition);
      if (offer) offers.push(offer);
    }
  }
  return offers;
}

function readOffer(row: unknown, fallback: OfferCondition): SourcedOffer | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const ref = typeof record.ref === "string" ? record.ref.trim() : "";
  // An offer without a title cannot be described, and one without a reference
  // cannot be ordered. Either way there is nothing useful to say about it.
  if (!title || !ref) return null;

  const price = typeof record.priceUsd === "number" && Number.isFinite(record.priceUsd)
    ? record.priceUsd
    : null;

  return {
    ref,
    title,
    brand: typeof record.brand === "string" && record.brand ? record.brand : null,
    condition: isCondition(record.condition) ? record.condition : fallback,
    priceUsd: price,
    ...(price === null && isRange(record.priceRangeUsd) ? { priceRangeUsd: record.priceRangeUsd } : {}),
    currency: typeof record.currency === "string" && record.currency ? record.currency : "USD",
    availability: typeof record.availability === "string" ? record.availability : null,
    // Passed through exactly as the projection set it: present when the
    // source's terms require the credit, absent otherwise. Not a decision this
    // file gets to make.
    ...(typeof record.sourceName === "string" && record.sourceName
      ? { sourceName: record.sourceName }
      : {}),
  };
}

/** The condition, in the reader's language. */
export function conditionLabel(condition: OfferCondition, language: Language): string {
  if (condition === "used") return say("condUsed", language);
  if (condition === "refurbished") return say("condRefurbished", language);
  return say("condNew", language);
}

/**
 * Price as a person reads it.
 *
 * Latin digits everywhere, including in Arabic: prices are copied, compared and
 * read back to a shopkeeper, and the rest of this assistant already writes them
 * this way. `null` means the agent had no price, which is said rather than
 * rendered as zero.
 */
export function formatOfferPrice(offer: SourcedOffer, language: Language): string | null {
  const digits = new Intl.NumberFormat(`${language}-u-nu-latn`, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  if (offer.priceUsd !== null) return `${digits.format(offer.priceUsd)} ${offer.currency}`;

  // A range is what is known about reference equipment, and knowing that a
  // braille display costs 500 to 2500 is worth far more to a listener than
  // being told the price is unavailable.
  if (offer.priceRangeUsd) {
    return `${digits.format(offer.priceRangeUsd.min)}–${digits.format(offer.priceRangeUsd.max)} ${offer.currency}`;
  }
  return null;
}

/**
 * The message: what was found, and how to ask for one.
 *
 * One line per offer, and the reference last on the line — a screen reader
 * reaches the name and the price before the code, which is the order somebody
 * decides in.
 */
export function formatSourcedOffers(params: {
  language: Language;
  offers: readonly SourcedOffer[];
}): string {
  const { language } = params;
  const offers = params.offers.slice(0, MAX_OFFERS);
  if (offers.length === 0) return sourcingNoneNotice(language);

  const lines = offers.map((offer) => {
    const price = formatOfferPrice(offer, language);
    const parts = [
      offer.brand ? `${offer.brand} — ${offer.title}` : offer.title,
      price,
      conditionLabel(offer.condition, language),
      offer.sourceName ?? null,
    ].filter((part): part is string => Boolean(part));
    return `• ${parts.join(" · ")}\n  ${offer.ref}`;
  });

  return [
    say("sourcingHeading", language),
    "",
    ...lines,
    "",
    say("sourcingHint", language),
  ].join("\n");
}

/** Nothing in the bazaar and nothing in the catalogue. Says where to look. */
export const sourcingNoneNotice = (language: Language): string =>
  say("sourcingNone", language).replace("{url}", CATALOGUE_URL);

/** The agent could not be reached. Distinct from "there is nothing". */
export const sourcingUnavailableNotice = (language: Language): string =>
  say("sourcingUnavailable", language).replace("{url}", CATALOGUE_URL);

/**
 * The big stores, searched for the words the sender used.
 *
 * None of them offers a product search without a paid or approved API key
 * (Amazon PA-API, eBay Browse, AliExpress Open Platform — adapters for all
 * three already exist and switch on when their keys are set). A search link is
 * what is honest to send without one: it lands on that store's real, current
 * results for the item, in the sender's own browser.
 */
export const STORE_SEARCHES: Array<{ name: string; url: (q: string) => string }> = [
  { name: "Amazon", url: (q) => `https://www.amazon.com/s?k=${q}` },
  { name: "AliExpress", url: (q) => `https://www.aliexpress.com/wholesale?SearchText=${q}` },
  { name: "eBay", url: (q) => `https://www.ebay.com/sch/i.html?_nkw=${q}` },
  { name: "Noon", url: (q) => `https://www.noon.com/uae-en/search/?q=${q}` },
  { name: "Google Shopping", url: (q) => `https://www.google.com/search?tbm=shop&q=${q}` },
];

export function storeSearchLinks(item: string, language: Language): string {
  const query = item.replace(/\s+/g, " ").trim().slice(0, 100);
  const encoded = encodeURIComponent(query);
  return [
    say("storesHeading", language).replace("{query}", query),
    "",
    ...STORE_SEARCHES.map((store) => `• ${store.name}: ${store.url(encoded)}`),
    "",
    say("storesHint", language),
  ].join("\n");
}

/**
 * For the assistant, when neither the bazaar nor the catalogue has the item.
 *
 * A bare "not found" left somebody who asked for a product with nothing to do.
 * The assistant answers about the item instead — and because no Visionex
 * listing exists, it may give a typical market price, as an estimate, which
 * the general rule against quoting bazaar prices from memory would otherwise
 * forbid. It never claims stock and never names a supplier: the owner sources
 * items through the team, so the way forward it offers is that request.
 */
export function productNotFoundDirective(item: string): string {
  const named = item.replace(/["\n]/g, " ").trim().slice(0, 120);
  return [
    `The sender is looking for this product: "${named}".`,
    "Visionex has no listing for it in the bazaar or the catalogue right now; this was just checked.",
    "Do not answer only that it was not found. Briefly say what the item is and what to look for when buying it, and give a typical market price range if you reliably know one, clearly marked as an approximate estimate, not a Visionex price.",
    "Never claim Visionex has it in stock and never write links yourself: the sender has just been sent search links for the big stores, so do not repeat them.",
    "End by saying the Visionex team can try to source it for them: they only need to write «بدي أحكي مع موظف» (in Arabic) or \"I want to speak to a person\" and describe what they need.",
  ].join(" ");
}
