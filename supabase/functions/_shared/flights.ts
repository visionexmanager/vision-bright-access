// Visionex Flights — the part that knows nothing about any supplier.
//
// The sibling of `mobility.ts`, built to the same shape on purpose: a
// normalized offer, the states a booking moves through, the errors a traveller
// is told about, and the arithmetic that turns several suppliers' answers into
// one list somebody can choose from. What it shares with mobility — money, the
// confirmation rule, the concurrent gather — it imports from `booking.ts`
// rather than owning a second copy.
//
// ── What makes flights different from a taxi ────────────────────────────────
//
// Four things, and each one is a section below.
//
// **Time.** A taxi's pickup is one place in one zone. A flight leaves at 08:00
// in one zone and lands at 11:30 in another, and the interesting numbers — how
// long it takes, how long the layover is, whether it lands the next day — are
// none of them subtraction of the wall clocks. Every segment therefore carries
// its own zone and every duration is computed from instants. This is the part
// of flight software that is most often wrong and it is entirely testable.
//
// **Expiry.** A ride quote lapses in minutes and re-quoting is free. An air
// fare lapses in minutes *and the seat may be gone*, so a fare is re-priced
// before money moves rather than trusted from a page somebody left open.
//
// **People.** A ride needs a phone number. A ticket needs a name exactly as it
// appears in a passport, a date of birth, and sometimes a document number.
// That is the most sensitive data this repository handles, and the rule is in
// `PASSENGER_FIELDS` below: minimise, never log, never leave the server.
//
// **Authority.** Nobody sells an air ticket without accreditation or a
// consolidator who has it. That is not a coding problem and this module does
// not pretend otherwise — see `docs/flights/providers.md`.
//
// Pure. No `Deno`, no fetch, no database client, no supplier name.

import { foldLatin, isFresh, localToInstant, money, type Money } from "./booking.ts";

export {
  formatMoney,
  isExplicitConfirmation,
  isFresh,
  localToInstant,
  money,
  sameCurrency,
  secondsUntilExpiry,
  type Money,
} from "./booking.ts";

// ── Airports ────────────────────────────────────────────────────────────────

/**
 * An IATA airport code, or null.
 *
 * Three letters, uppercased. Deliberately not validated against a list: the
 * list changes, a stale one would refuse a real airport, and the supplier will
 * reject an unknown code anyway with a better error than this could invent.
 * What this catches is the shape — "BEIRUT" and "BE" are not codes.
 */
export function airportCode(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(raw) ? raw : null;
}

export interface Airport {
  /** IATA code, the identifier every supplier agrees on. */
  code: string;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  countryCode?: string | null;
  /** IANA zone. Required for any duration to mean anything. */
  timezone: string;
  terminal?: string | null;
}

// ── A journey, as suppliers describe one ────────────────────────────────────

/**
 * One flight, gate to gate.
 *
 * Times are **local wall clock at their own airport**, which is how every
 * supplier and every boarding pass states them, plus the zone that makes them
 * an instant. Storing a UTC instant alone would be correct and unreadable: the
 * traveller needs to be told "departs 08:00", and 08:00 is a fact about Beirut,
 * not about UTC.
 */
export interface FlightSegment {
  marketingCarrier: string;
  operatingCarrier?: string | null;
  flightNumber: string;
  origin: Airport;
  destination: Airport;
  /** `YYYY-MM-DDTHH:mm`, local to `origin.timezone`. No offset, no `Z`. */
  departsLocal: string;
  /** `YYYY-MM-DDTHH:mm`, local to `destination.timezone`. */
  arrivesLocal: string;
  cabin?: CabinClass | null;
  aircraft?: string | null;
}

/** One direction of travel: a leg out, or a leg back, or one leg of many. */
export interface FlightSlice {
  segments: readonly FlightSegment[];
}

export const CABINS = ["economy", "premium_economy", "business", "first"] as const;
export type CabinClass = (typeof CABINS)[number];

export const PASSENGER_TYPES = ["adult", "child", "infant"] as const;
export type PassengerType = (typeof PASSENGER_TYPES)[number];

/**
 * What a supplier is offering, at a price, until a moment.
 *
 * `expiresAt` is not optional and never has been. An air fare is the shortest-
 * lived price in this codebase and the one where a stale figure costs the most.
 */
export interface FlightOffer {
  supplierSlug: string;
  supplierName: string;
  offerId: string;
  slices: readonly FlightSlice[];
  total: Money;
  /** What the fare is called where the supplier named it: "Light", "Flex". */
  fareBrand?: string | null;
  cabin: CabinClass;
  /** Checked bags included per passenger. Null means the supplier did not say. */
  checkedBags?: number | null;
  cabinBags?: number | null;
  refundable: boolean | null;
  changeable: boolean | null;
  /** Seats the supplier says are left at this price, where it says. */
  seatsRemaining?: number | null;
  expiresAt: string;
}

// ── Time, which is the whole difficulty ─────────────────────────────────────

/** When a segment leaves, as an instant. NaN when it cannot be read. */
export const departureInstant = (segment: FlightSegment): number =>
  localToInstant(segment.departsLocal, segment.origin.timezone);

/** When a segment lands, as an instant. */
export const arrivalInstant = (segment: FlightSegment): number =>
  localToInstant(segment.arrivesLocal, segment.destination.timezone);

/**
 * How long a segment is in the air, in minutes.
 *
 * Instant arithmetic, never wall-clock subtraction. Beirut 08:00 → Larnaca
 * 08:40 is a forty-minute flight in local terms and a forty-minute flight in
 * fact; Beirut 08:00 → London 11:30 looks like three and a half hours and is
 * five and a half. Only one of those two is computed correctly by subtracting
 * the strings, and it is not the one anybody would notice being wrong.
 */
export function segmentMinutes(segment: FlightSegment): number | null {
  const out = departureInstant(segment);
  const back = arrivalInstant(segment);
  if (!Number.isFinite(out) || !Number.isFinite(back)) return null;
  const minutes = Math.round((back - out) / 60_000);
  return minutes >= 0 ? minutes : null;
}

/**
 * How long somebody waits between two segments, in minutes.
 *
 * Null when either time is unreadable, and null when the next flight leaves
 * before this one lands — which is a supplier's data being wrong rather than a
 * negative layover, and showing "−40 minutes" would be repeating their mistake
 * to a traveller instead of noticing it.
 */
export function layoverMinutes(before: FlightSegment, after: FlightSegment): number | null {
  const lands = arrivalInstant(before);
  const leaves = departureInstant(after);
  if (!Number.isFinite(lands) || !Number.isFinite(leaves)) return null;
  const minutes = Math.round((leaves - lands) / 60_000);
  return minutes >= 0 ? minutes : null;
}

/** Every layover in a slice, in order. Empty for a non-stop. */
export function layovers(slice: FlightSlice): Array<{ airport: Airport; minutes: number | null }> {
  const out: Array<{ airport: Airport; minutes: number | null }> = [];
  for (let i = 0; i < slice.segments.length - 1; i += 1) {
    out.push({
      airport: slice.segments[i].destination,
      minutes: layoverMinutes(slice.segments[i], slice.segments[i + 1]),
    });
  }
  return out;
}

/**
 * Door to door, in minutes: flying plus waiting.
 *
 * Computed from the first departure and the last arrival rather than by summing
 * the parts, so a layover the supplier described inconsistently cannot make the
 * total disagree with the two times a traveller can see on their own ticket.
 */
export function sliceMinutes(slice: FlightSlice): number | null {
  const first = slice.segments[0];
  const last = slice.segments[slice.segments.length - 1];
  if (!first || !last) return null;
  const out = departureInstant(first);
  const back = arrivalInstant(last);
  if (!Number.isFinite(out) || !Number.isFinite(back)) return null;
  const minutes = Math.round((back - out) / 60_000);
  return minutes >= 0 ? minutes : null;
}

/** Stops in a slice: one segment is non-stop, two is one stop. */
export const stopCount = (slice: FlightSlice): number => Math.max(0, slice.segments.length - 1);

/**
 * How many calendar days later a slice lands — the "+1" on a departure board.
 *
 * Read from the local dates, not from the duration. A flight can take four
 * hours and still land tomorrow, and one can take eighteen and land the same
 * afternoon going west. Both are the same number to a traveller: which day they
 * have to be somewhere.
 */
export function arrivalDayOffset(slice: FlightSlice): number | null {
  const first = slice.segments[0];
  const last = slice.segments[slice.segments.length - 1];
  if (!first || !last) return null;
  const out = /^(\d{4}-\d{2}-\d{2})/.exec(first.departsLocal)?.[1];
  const back = /^(\d{4}-\d{2}-\d{2})/.exec(last.arrivesLocal)?.[1];
  if (!out || !back) return null;
  const days = Math.round((Date.parse(`${back}T00:00:00Z`) - Date.parse(`${out}T00:00:00Z`)) / 86_400_000);
  return Number.isFinite(days) ? days : null;
}

/** "5h 30m", or "45m". The one duration format this channel uses. */
export function formatDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

/** The whole offer, door to door, across every slice it contains. */
export function offerMinutes(offer: FlightOffer): number | null {
  const each = offer.slices.map(sliceMinutes);
  if (each.some((value) => value === null)) return null;
  return each.reduce((sum: number, value) => sum + (value as number), 0);
}

// ── The state a booking is in ───────────────────────────────────────────────
//
// Longer than a taxi's, because a ticket is issued rather than simply provided,
// and the gap between "paid" and "ticketed" is real: it is where a fare can be
// rejected by the airline after money has been taken.

export const FLIGHT_STATUSES = [
  "draft",
  "searching",
  "offered",
  "awaiting_confirmation",
  "pricing",
  "held",
  "payment_pending",
  "ticketing",
  "ticketed",
  "cancelled",
  "supplier_cancelled",
  "payment_failed",
  "ticketing_failed",
  "expired",
] as const;

export type FlightStatus = (typeof FLIGHT_STATUSES)[number];

/** Nothing follows these. */
export const FLIGHT_TERMINAL: ReadonlySet<FlightStatus> = new Set([
  "ticketed",
  "cancelled",
  "supplier_cancelled",
  "payment_failed",
  "ticketing_failed",
  "expired",
]);

/** Money has been taken or committed in one of these. */
export const FLIGHT_COMMITTED: ReadonlySet<FlightStatus> = new Set([
  "payment_pending",
  "ticketing",
  "ticketed",
]);

const FLIGHT_TRANSITIONS: Readonly<Record<FlightStatus, readonly FlightStatus[]>> = {
  draft: ["searching", "expired"],
  searching: ["offered", "expired", "ticketing_failed"],
  offered: ["awaiting_confirmation", "searching", "expired"],
  awaiting_confirmation: ["pricing", "offered", "cancelled", "expired"],
  // Re-pricing is its own state because it is where a fare is confirmed to
  // still exist. A price that moved here is shown again, never charged.
  pricing: ["held", "payment_pending", "offered", "expired", "cancelled"],
  held: ["payment_pending", "cancelled", "expired"],
  payment_pending: ["ticketing", "payment_failed", "cancelled"],
  // Paid but not yet ticketed. The airline can still refuse, and that is
  // `ticketing_failed` — a distinct state because it needs a refund, where
  // `payment_failed` does not.
  ticketing: ["ticketed", "ticketing_failed", "supplier_cancelled"],
  ticketed: [],
  cancelled: [],
  supplier_cancelled: [],
  payment_failed: [],
  ticketing_failed: [],
  expired: [],
};

export const isFlightStatus = (value: unknown): value is FlightStatus =>
  typeof value === "string" && (FLIGHT_STATUSES as readonly string[]).includes(value);

export function canTransitionFlight(from: FlightStatus, to: FlightStatus): boolean {
  if (from === to) return false;
  return FLIGHT_TRANSITIONS[from].includes(to);
}

/** The status after an event claiming `to`. Unchanged when the move is illegal. */
export const nextFlightStatus = (from: FlightStatus, to: FlightStatus): FlightStatus =>
  canTransitionFlight(from, to) ? to : from;

// ── What a traveller is told ────────────────────────────────────────────────

export const FLIGHT_ERRORS = [
  "NO_OFFERS_FOUND",
  "SUPPLIER_UNAVAILABLE",
  "ORIGIN_INVALID",
  "DESTINATION_INVALID",
  "DATE_INVALID",
  "OFFER_EXPIRED",
  "PRICE_CHANGED",
  "SEAT_NO_LONGER_AVAILABLE",
  "PASSENGER_DETAILS_INVALID",
  "PAYMENT_REQUIRED",
  "PAYMENT_FAILED",
  "TICKETING_FAILED",
  "BOOKING_FAILED",
  "AUTHORIZATION_REQUIRED",
  "SUPPLIER_REQUIRES_ACCREDITATION",
  "SERVICE_UNAVAILABLE",
  "CANCELLATION_FAILED",
  "DUPLICATE_BOOKING",
] as const;

export type FlightErrorCode = (typeof FLIGHT_ERRORS)[number];

/** Asking a different supplier is a sensible response to these, and only these. */
const FLIGHT_FAILOVER: ReadonlySet<FlightErrorCode> = new Set([
  "NO_OFFERS_FOUND",
  "SUPPLIER_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
]);

export class FlightError extends Error {
  readonly code: FlightErrorCode;
  readonly supplierSlug: string | null;
  readonly failover: boolean;

  constructor(code: FlightErrorCode, options: { supplierSlug?: string | null } = {}) {
    super(code);
    this.name = "FlightError";
    this.code = code;
    this.supplierSlug = options.supplierSlug ?? null;
    this.failover = FLIGHT_FAILOVER.has(code);
  }
}

// ── People ──────────────────────────────────────────────────────────────────

/**
 * Everything a ticket needs about a person, and nothing more.
 *
 * This list is a boundary, not a suggestion. A ticket needs a name as it
 * appears in a travel document, a date of birth for the fare type, and for some
 * itineraries a document number. Anything beyond it is not collected, because
 * the cheapest way to keep passport data safe is not to hold it.
 *
 * Where it may go: a service-role table and the supplier. Where it may not: a
 * log line, a browser, a WhatsApp message, an error body, an analytics event.
 */
export const PASSENGER_FIELDS = [
  "type",
  "givenName",
  "familyName",
  "dateOfBirth",
  "gender",
  "documentNumber",
  "documentExpiry",
  "documentNationality",
] as const;

export interface FlightPassenger {
  type: PassengerType;
  givenName: string;
  familyName: string;
  /** `YYYY-MM-DD`. Determines the fare type, and whether a child is an infant. */
  dateOfBirth: string;
  gender?: string | null;
  documentNumber?: string | null;
  documentExpiry?: string | null;
  documentNationality?: string | null;
}

/**
 * Whether a passenger can be ticketed, without saying which field failed.
 *
 * The caller asks for what is missing through `missingPassengerFields`, which
 * names fields rather than echoing values — an error that quotes a passport
 * number back has put it somewhere new.
 */
export function missingPassengerFields(passenger: Partial<FlightPassenger>): string[] {
  const missing: string[] = [];
  if (!passenger.givenName?.trim()) missing.push("givenName");
  if (!passenger.familyName?.trim()) missing.push("familyName");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(passenger.dateOfBirth ?? "")) missing.push("dateOfBirth");
  if (!passenger.type || !(PASSENGER_TYPES as readonly string[]).includes(passenger.type)) {
    missing.push("type");
  }
  return missing;
}

/**
 * A name for a boarding pass: uppercase Latin letters, spaces and hyphens.
 *
 * Airlines will not accept anything else, and a booking that fails at ticketing
 * because of an accent is a booking that took the money first. Diacritics are
 * folded rather than stripped, so «José» becomes JOSE and not JOS.
 */
export function ticketName(value: string): string {
  return foldLatin(value)
    .toUpperCase()
    .replace(/[^A-Z\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── What a traveller asked for ──────────────────────────────────────────────

export interface FlightSearch {
  origin: string | null;
  destination: string | null;
  /** `YYYY-MM-DD`, local to the origin. */
  departDate: string | null;
  returnDate: string | null;
  adults: number;
  children: number;
  infants: number;
  cabin: CabinClass;
  /** Carrier codes the traveller named, if any. A preference, never a filter. */
  preferredCarriers: readonly string[];
  maxStops: number | null;
  ranking: FlightRanking;
}

export const EMPTY_SEARCH: FlightSearch = {
  origin: null,
  destination: null,
  departDate: null,
  returnDate: null,
  adults: 1,
  children: 0,
  infants: 0,
  cabin: "economy",
  preferredCarriers: [],
  maxStops: null,
  ranking: "best_value",
};

/**
 * What is still missing, in the order it should be asked for.
 *
 * A destination is useless without an origin and a date is useless without
 * both, so the assistant asks one question at a time and asks the one that
 * unblocks the most.
 */
export function missingFromSearch(search: FlightSearch): Array<"origin" | "destination" | "departDate"> {
  const missing: Array<"origin" | "destination" | "departDate"> = [];
  if (!airportCode(search.origin)) missing.push("origin");
  if (!airportCode(search.destination)) missing.push("destination");
  if (!isPlausibleDate(search.departDate)) missing.push("departDate");
  return missing;
}

/**
 * A date that is a date, and is not in the past.
 *
 * Compared as calendar days rather than as instants, because a date *is* a day:
 * `2026-10-11` parsed as midnight UTC is already twelve hours old by noon on
 * the 11th, and refusing it would refuse somebody booking a flight for this
 * afternoon. Yesterday-UTC is allowed for the same reason in the other
 * direction — the date somebody is standing in is still yesterday for a
 * traveller thirteen zones away.
 */
export function isPlausibleDate(value: string | null | undefined, nowMs = Date.now()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return false;
  const at = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(at)) return false;
  const day = Math.floor(at / 86_400_000);
  const today = Math.floor(nowMs / 86_400_000);
  return day >= today - 1;
}

// ── Ranking ─────────────────────────────────────────────────────────────────

export type FlightRanking = "cheapest" | "fastest" | "fewest_stops" | "best_value";

/**
 * One list, ordered by what the traveller asked for.
 *
 * The same three promises the ride ranking makes, for the same reasons:
 *
 *   - Nothing is hidden. A supplier that answered appears, even last.
 *   - No supplier is favoured. There is no commission term in any comparator.
 *   - Expired offers fall to the bottom rather than disappearing, so a slow
 *     reader sees why their choice went stale instead of watching it vanish.
 *
 * Currencies are not converted, for the reason `sameCurrency` gives.
 */
export function rankOffers(
  offers: readonly FlightOffer[],
  ranking: FlightRanking,
  options: { nowMs: number; currency?: string | null } = { nowMs: Date.now() },
): FlightOffer[] {
  const { nowMs, currency } = options;

  const score = (offer: FlightOffer): number => {
    switch (ranking) {
      case "cheapest":
        return offer.total.amount;
      case "fastest":
        return offerMinutes(offer) ?? Number.POSITIVE_INFINITY;
      case "fewest_stops":
        return offer.slices.reduce((sum, slice) => sum + stopCount(slice), 0);
      case "best_value": {
        // A stated trade rather than a discovered one: an hour of travelling is
        // worth one major unit of fare. Written here, in one place, so it can
        // be argued with — which is better than an ordering nobody can see.
        const minutes = offerMinutes(offer);
        if (minutes === null) return Number.POSITIVE_INFINITY;
        return offer.total.amount + Math.round(minutes / 60) * 100;
      }
    }
  };

  const rank = (offer: FlightOffer): [number, number, number] => [
    isFresh(offer.expiresAt, nowMs) ? 0 : 1,
    !currency || offer.total.currency === currency.toUpperCase() ? 0 : 1,
    score(offer),
  ];

  return [...offers].sort((a, b) => {
    const left = rank(a);
    const right = rank(b);
    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) return left[i] - right[i];
    }
    // Stable, so two renders of one list do not swap two identical offers.
    return a.offerId.localeCompare(b.offerId);
  });
}

/**
 * Whether a re-priced offer may be charged without asking again.
 *
 * **No.** Any increase is shown before money moves, however small — a fare that
 * went up by one unit is still a different price from the one somebody agreed
 * to. A decrease is also surfaced, because a traveller who was quoted more and
 * charged less should be told rather than left to find it on a statement.
 */
export function priceChanged(agreed: Money, repriced: Money): boolean {
  return agreed.currency !== repriced.currency || agreed.amount !== repriced.amount;
}

/** A total for several passengers, in the offer's own currency. */
export const totalFor = (offer: FlightOffer, passengers: number): Money =>
  money(offer.total.amount * Math.max(1, passengers), offer.total.currency);
