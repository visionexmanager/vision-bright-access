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
  if (offer.priceUsd === null) return null;
  const amount = new Intl.NumberFormat(`${language}-u-nu-latn`, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(offer.priceUsd);
  return `${amount} ${offer.currency}`;
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
