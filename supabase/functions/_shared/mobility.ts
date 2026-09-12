// Visionex Mobility — the part that knows nothing about any provider.
//
// One interface, many providers. This module is the "one interface": the
// normalized trip, the states a trip may be in, the errors a rider may be told
// about, and the arithmetic that turns four providers' answers into one list a
// person can choose from.
//
// ── Why this is pure ────────────────────────────────────────────────────────
//
// No `Deno`, no fetch, no database client, no provider name. Everything here is
// a decision over data, which is what makes the whole ranking, expiry and
// state-transition surface testable without a credential, a network or a
// sandbox — and none of those three are available while a provider's approval
// is still outstanding.
//
// The provider-shaped half lives in `mobilityProviders.ts`, which imports this
// and never the other way round.

// ── What every booking shares ───────────────────────────────────────────────
//
// Money, the confirmation rule and the concurrent gather are not mobility
// concepts — they are booking concepts, and flights need the same three. They
// moved to `booking.ts` when the second domain arrived, and are re-exported
// here so nothing that already imported them from this module had to change.
//
// A second `Money` or a second confirmation rule would be one rule and one bug
// waiting for somebody to fix only the other.

export {
  formatMoney,
  isExplicitConfirmation,
  money,
  sameCurrency,
  type Money,
} from "./booking.ts";

import { isFresh, money, type Money } from "./booking.ts";

/** A fare a provider expressed as a range rather than a figure. */
export interface MoneyRange {
  min: Money;
  max: Money;
}

// ── Where ───────────────────────────────────────────────────────────────────

export interface MobilityLocation {
  latitude: number;
  longitude: number;
  /** What the rider called it. Kept because it is what they will recognise. */
  address?: string | null;
  formattedAddress?: string | null;
  placeId?: string | null;
  timezone?: string | null;
  country?: string | null;
  countryCode?: string | null;
  city?: string | null;
}

/**
 * Is this a location a provider can be asked about?
 *
 * Latitude and longitude inside their real ranges, and neither of them the
 * null island — `0, 0` is in the Gulf of Guinea and is almost always a parsing
 * failure that would otherwise be sent to a provider as a pickup point.
 */
export function isUsableLocation(value: unknown): value is MobilityLocation {
  if (!value || typeof value !== "object") return false;
  const place = value as MobilityLocation;
  const { latitude: lat, longitude: lon } = place;
  if (typeof lat !== "number" || typeof lon !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  return !(lat === 0 && lon === 0);
}

// ── What state a trip is in ─────────────────────────────────────────────────
//
// One vocabulary, which every provider's own words are translated into. The
// rider-facing layers branch on these and on nothing else: a page that switched
// on Uber's `processing` would go blank the day Bolt said `pending`.

export const MOBILITY_STATUSES = [
  "draft",
  "searching",
  "quoted",
  "awaiting_confirmation",
  "booking",
  "confirmed",
  "driver_searching",
  "driver_assigned",
  "driver_arriving",
  "driver_arrived",
  "in_progress",
  "completed",
  "cancelled",
  "provider_cancelled",
  "no_driver",
  "failed",
  "expired",
] as const;

export type MobilityStatus = (typeof MOBILITY_STATUSES)[number];

/** Nothing follows these. A trip that reached one is history. */
export const TERMINAL_STATUSES: ReadonlySet<MobilityStatus> = new Set([
  "completed",
  "cancelled",
  "provider_cancelled",
  "no_driver",
  "failed",
  "expired",
]);

/** A trip in one of these has a driver or is getting one: money is committed. */
export const LIVE_STATUSES: ReadonlySet<MobilityStatus> = new Set([
  "booking",
  "confirmed",
  "driver_searching",
  "driver_assigned",
  "driver_arriving",
  "driver_arrived",
  "in_progress",
]);

/**
 * What may follow what.
 *
 * Written out rather than inferred because the expensive mistakes are all
 * transitions: a `completed` trip that accepts `driver_assigned` from a late
 * webhook tells somebody a car is coming for a ride they already took, and a
 * `cancelled` trip that can return to `in_progress` is a fare nobody agreed to.
 *
 * Providers redeliver, and they redeliver out of order. This is what makes a
 * late event a no-op instead of a lie.
 */
const TRANSITIONS: Readonly<Record<MobilityStatus, readonly MobilityStatus[]>> = {
  draft: ["searching", "expired", "failed"],
  searching: ["quoted", "no_driver", "failed", "expired"],
  quoted: ["awaiting_confirmation", "searching", "expired", "failed"],
  awaiting_confirmation: ["booking", "quoted", "cancelled", "expired"],
  booking: ["confirmed", "driver_searching", "no_driver", "failed", "cancelled"],
  confirmed: ["driver_searching", "driver_assigned", "cancelled", "provider_cancelled", "failed"],
  driver_searching: ["driver_assigned", "no_driver", "cancelled", "provider_cancelled", "failed"],
  driver_assigned: ["driver_arriving", "driver_arrived", "in_progress", "cancelled", "provider_cancelled"],
  driver_arriving: ["driver_arrived", "in_progress", "cancelled", "provider_cancelled"],
  driver_arrived: ["in_progress", "cancelled", "provider_cancelled"],
  in_progress: ["completed", "provider_cancelled", "failed"],
  completed: [],
  cancelled: [],
  provider_cancelled: [],
  no_driver: [],
  failed: [],
  expired: [],
};

export const isMobilityStatus = (value: unknown): value is MobilityStatus =>
  typeof value === "string" && (MOBILITY_STATUSES as readonly string[]).includes(value);

/** Whether a trip may move from one status to another. Terminal means terminal. */
export function canTransition(from: MobilityStatus, to: MobilityStatus): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].includes(to);
}

/**
 * The status a trip should hold after an event claiming `to` arrives.
 *
 * Returns the current status unchanged when the move is not allowed, so a
 * caller can write the result unconditionally and a late or duplicated webhook
 * costs a no-op rather than a branch nobody remembered to add.
 */
export const nextStatus = (from: MobilityStatus, to: MobilityStatus): MobilityStatus =>
  canTransition(from, to) ? to : from;

// ── What a rider is told when something goes wrong ──────────────────────────
//
// A closed set, because the alternative is a provider's own error body reaching
// a person — and those quote the request back, which for this feature means an
// address and a name.

export const MOBILITY_ERRORS = [
  "NO_DRIVERS_AVAILABLE",
  "PROVIDER_UNAVAILABLE",
  "LOCATION_INVALID",
  "DESTINATION_INVALID",
  "QUOTE_EXPIRED",
  "BOOKING_FAILED",
  "AUTHORIZATION_REQUIRED",
  "PAYMENT_REQUIRED",
  "PROVIDER_REQUIRES_APPROVAL",
  "SERVICE_UNAVAILABLE",
  "CANCELLATION_FAILED",
  "DUPLICATE_BOOKING",
] as const;

export type MobilityErrorCode = (typeof MOBILITY_ERRORS)[number];

/**
 * A failure with a code a caller can act on, and nothing a provider wrote.
 *
 * `providerSlug` is kept because operations needs to know who failed. The
 * provider's message is deliberately not a field: there is nowhere for it to go
 * that is not eventually a screen.
 */
export class MobilityError extends Error {
  readonly code: MobilityErrorCode;
  readonly providerSlug: string | null;
  /** Whether trying a different provider is a sensible response to this. */
  readonly failover: boolean;

  constructor(code: MobilityErrorCode, options: { providerSlug?: string | null } = {}) {
    super(code);
    this.name = "MobilityError";
    this.code = code;
    this.providerSlug = options.providerSlug ?? null;
    this.failover = FAILOVER_CODES.has(code);
  }
}

/**
 * The failures where asking somebody else is the right next move.
 *
 * Deliberately small. A rider whose card was declined is not helped by a second
 * provider declining it, and a destination that could not be resolved will not
 * resolve better elsewhere — those are answered, not retried.
 */
const FAILOVER_CODES: ReadonlySet<MobilityErrorCode> = new Set([
  "NO_DRIVERS_AVAILABLE",
  "PROVIDER_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
]);

// ── Quotes ──────────────────────────────────────────────────────────────────

export interface MobilityQuote {
  providerSlug: string;
  providerName: string;
  productId: string | null;
  productName: string | null;
  vehicleType: string | null;
  /** A figure where the provider gave one. */
  price: Money | null;
  /** A band where it gave one instead. Both may be present. */
  priceRange: MoneyRange | null;
  surgeMultiplier: number | null;
  /** Seconds until pickup. */
  etaSeconds: number | null;
  /** Seconds the ride itself is expected to take. */
  durationSeconds: number | null;
  distanceMeters: number | null;
  capacity: number | null;
  accessibility: readonly string[];
  /** Whether Visionex can actually book this, as opposed to linking out. */
  bookingSupported: boolean;
  deeplink: string | null;
  expiresAt: string;
}

/**
 * The price to sort on.
 *
 * The bottom of a range, not the middle: a rider choosing "cheapest" is
 * choosing the smallest number they might pay, and a midpoint invents a figure
 * the provider never quoted.
 */
export function comparablePrice(quote: MobilityQuote): Money | null {
  if (quote.price) return quote.price;
  return quote.priceRange ? quote.priceRange.min : null;
}

/** Whether a quote is still worth showing — and, before booking, still valid. */
export const quoteIsFresh = (quote: MobilityQuote, nowMs: number): boolean =>
  isFresh(quote.expiresAt, nowMs);

export type QuoteRanking = "cheapest" | "fastest" | "best_value" | "most_accessible";

/**
 * One list, ordered by what the rider said they wanted.
 *
 * Three rules hold whatever the ranking is, and all three are here rather than
 * in a caller because they are promises rather than preferences:
 *
 *   - Nothing is hidden. A provider that answered appears, even last.
 *   - No provider is favoured. There is no commission term in any comparator,
 *     and adding one would have to survive this file's tests.
 *   - Expired quotes fall to the bottom rather than disappearing, so a slow
 *     reader sees why their choice went stale instead of watching it vanish.
 *
 * Currencies are not converted. Quotes in the request's own currency sort
 * first as a group; the rest keep their order behind them, which is honest
 * about the fact that nothing here can compare them.
 */
export function rankQuotes(
  quotes: readonly MobilityQuote[],
  ranking: QuoteRanking,
  options: { nowMs: number; currency?: string | null; preferredProvider?: string | null } = { nowMs: Date.now() },
): MobilityQuote[] {
  const { nowMs, currency, preferredProvider } = options;

  const score = (quote: MobilityQuote): number => {
    const price = comparablePrice(quote);
    switch (ranking) {
      case "cheapest":
        return price ? price.amount : Number.POSITIVE_INFINITY;
      case "fastest":
        return quote.etaSeconds ?? Number.POSITIVE_INFINITY;
      case "most_accessible":
        // More accommodations first, so this one sorts ascending like the rest.
        return -quote.accessibility.length;
      case "best_value": {
        // Money and minutes are not the same unit, so this is a stated trade
        // rather than a discovered one: a minute of waiting is worth one minor
        // unit of fare. It is written here, in one place, so it can be argued
        // with — which is better than an implicit ordering nobody can see.
        if (!price) return Number.POSITIVE_INFINITY;
        return price.amount + Math.round((quote.etaSeconds ?? 0) / 60);
      }
    }
  };

  const rank = (quote: MobilityQuote): [number, number, number, number] => [
    // 1. A quote you can still act on comes before one you cannot.
    quoteIsFresh(quote, nowMs) ? 0 : 1,
    // 2. Then the currency the rider asked in, because the rest cannot be
    //    compared with it and pretending otherwise is the bug.
    !currency || comparablePrice(quote)?.currency === currency.toUpperCase() ? 0 : 1,
    // 3. Then a provider they named, if they named one.
    preferredProvider && quote.providerSlug === preferredProvider ? 0 : 1,
    // 4. Then what they actually asked to optimise.
    score(quote),
  ];

  return [...quotes].sort((a, b) => {
    const left = rank(a);
    const right = rank(b);
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) return left[i] - right[i];
    }
    // A stable, meaningless tiebreak beats an unstable one: two identical
    // quotes should not swap places between two renders of the same list.
    return a.providerSlug.localeCompare(b.providerSlug);
  });
}

// ── The request a rider made ────────────────────────────────────────────────

export interface MobilityIntent {
  pickup: MobilityLocation | null;
  destination: MobilityLocation | null;
  /** UTC instant. A scheduled ride is stored in UTC and shown in pickup time. */
  scheduledAt: string | null;
  passengerCount: number;
  vehicleType: string | null;
  providerPreference: string | null;
  optimization: QuoteRanking;
  accessibility: readonly string[];
  stops: readonly MobilityLocation[];
  flightNumber: string | null;
}

export const EMPTY_INTENT: MobilityIntent = {
  pickup: null,
  destination: null,
  scheduledAt: null,
  passengerCount: 1,
  vehicleType: null,
  providerPreference: null,
  optimization: "best_value",
  accessibility: [],
  stops: [],
  flightNumber: null,
};

/**
 * What is still missing before anybody can be asked for a price.
 *
 * Returned in the order it should be asked for, so the assistant asks one
 * question at a time and asks the one that unblocks the most — a destination is
 * useless without a pickup, and a time is useless without both.
 */
export function missingFromIntent(intent: MobilityIntent): Array<"pickup" | "destination"> {
  const missing: Array<"pickup" | "destination"> = [];
  if (!intent.pickup || !isUsableLocation(intent.pickup)) missing.push("pickup");
  if (!intent.destination || !isUsableLocation(intent.destination)) missing.push("destination");
  return missing;
}

// ── Time ────────────────────────────────────────────────────────────────────

/**
 * A scheduled pickup, written in the time the rider is standing in.
 *
 * Stored in UTC, shown in the pickup's zone. `2026-09-12 08:00` in New York is
 * not `08:00Z`, and a ride that arrives five hours late is the kind of bug that
 * only shows up for somebody in another country.
 */
export function formatPickupTime(
  isoUtc: string,
  timezone: string | null | undefined,
  locale: string,
): string {
  const when = new Date(isoUtc);
  if (Number.isNaN(when.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone || "UTC",
    }).format(when);
  } catch {
    // An unknown zone or locale must not take a booking down with it.
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(when);
  }
}
