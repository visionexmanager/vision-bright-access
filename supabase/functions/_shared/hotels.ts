// Visionex Hotels — what a stay is, independent of who sells it.
//
// The third booking domain, and the one whose difficulty is least like the
// others. Flights are hard because a duration is not the difference of two wall
// clocks. Hotels are hard for the opposite reason: **a night is not a duration
// at all.**
//
// ── The two things this module exists to get right ──────────────────────────
//
// **A night is a calendar date.** 3 October to 6 October is three nights in
// every timezone on earth and across every daylight-saving change. Compute it
// from instants and a spring-forward makes it 2.958, which rounds to three
// today and to two the day somebody changes a rounding mode. `nightsBetween`
// counts dates, and the comment there explains why this is the one place in
// the codebase where midnight-UTC arithmetic is the correct answer rather than
// the lazy one.
//
// **The price is the all-in price.** A hotel quotes a nightly rate, adds tax,
// and then asks for a "resort fee" at the desk. Ranking on the nightly rate, or
// on what leaves the card today, puts the property with the hidden fee above
// the one without it — and the guest discovers the difference at checkout, in a
// lobby, with luggage. `allIn` is prepaid plus payable-at-property, it is what
// `rankStays` orders on, and there is a test that a cheaper-looking rate with a
// fee loses to a dearer-looking one without.
//
// ── What is deliberately not here ───────────────────────────────────────────
//
// **A travel document.** A flight needs a passport; a night in a hotel usually
// does not, and a field that exists gets filled in. `GUEST_FIELDS` is a name
// and a way to reach somebody, and `hotel_guests` has no passport column to
// leave empty.
//
// Pure. No `Deno`, no fetch, no database client, no supplier name.

import {
  foldLatin,
  isFresh,
  localToInstant,
  money,
  type Money,
} from "./booking.ts";

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

// ── Dates, which are not instants ───────────────────────────────────────────

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Whether this is a calendar date this module will work with. */
export function isCalendarDate(value: string | null | undefined): boolean {
  const text = (value ?? "").trim();
  const match = DATE.exec(text);
  if (!match) return false;
  // Round-tripping rejects 2026-02-30 and 2026-13-01, which the regex allows.
  const parsed = new Date(`${text}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

/** A calendar date as its midnight-UTC instant. NaN when it is not one. */
const dateOrdinal = (value: string): number =>
  isCalendarDate(value) ? Date.parse(`${value.trim()}T00:00:00Z`) / 86_400_000 : Number.NaN;

/**
 * How many nights a stay is.
 *
 * Counts dates, and this is the one place in this codebase where reading a date
 * as midnight UTC is right rather than lazy — precisely *because* a date is not
 * an instant. "3 October" is a page in a calendar, not a moment; it has no
 * timezone, so giving it one and then subtracting is inventing a problem.
 *
 * A stay across a spring-forward computed from local midnights is 2 days and 23
 * hours, which is three nights and looks like two. A guest is billed for the
 * dates on the folio, and so is this.
 *
 * Null when either date is unreadable or check-out is not after check-in. A
 * zero-night stay is not a cheap stay, it is a mistake.
 */
export function nightsBetween(checkIn: string, checkOut: string): number | null {
  const start = dateOrdinal(checkIn);
  const end = dateOrdinal(checkOut);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const nights = Math.round(end - start);
  return nights > 0 ? nights : null;
}

/** The calendar date `days` after this one. Null when the input is not a date. */
export function addDays(date: string, days: number): string | null {
  const ordinal = dateOrdinal(date);
  if (!Number.isFinite(ordinal)) return null;
  return new Date((ordinal + Math.trunc(days)) * 86_400_000).toISOString().slice(0, 10);
}

/** Today's date where the property is, which is not always today where you are. */
export function todayIn(timezone: string, nowMs: number): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(nowMs));
  } catch {
    return new Date(nowMs).toISOString().slice(0, 10);
  }
}

/** The longest stay this will search for. Beyond it is a typo, not a holiday. */
export const MAX_NIGHTS = 30;

/**
 * Whether these two dates are a stay somebody could actually book.
 *
 * Check-in in the *property's* today or later, because a guest in Beirut
 * booking a hotel in Tokyo at 23:00 is booking for a date that has already
 * begun there — and refusing it because it is yesterday in their own timezone
 * is a bug they cannot work around.
 */
export function isBookableStay(
  checkIn: string,
  checkOut: string,
  timezone: string,
  nowMs: number,
): boolean {
  const nights = nightsBetween(checkIn, checkOut);
  if (nights === null || nights > MAX_NIGHTS) return false;
  return dateOrdinal(checkIn) >= dateOrdinal(todayIn(timezone, nowMs));
}

// ── Who is staying ──────────────────────────────────────────────────────────

/**
 * One room's occupancy.
 *
 * Children are ages, never a count. A property prices a four-year-old and an
 * eleven-year-old differently, will sometimes not take one of them at all, and
 * always wants to know before the guest arrives rather than after.
 */
export interface Occupancy {
  adults: number;
  /** Each child's age, in years. Empty for none. */
  childAges: readonly number[];
}

export const ADULTS_PER_ROOM_MAX = 8;
export const CHILD_AGE_MAX = 17;

/**
 * A child's age on the night they arrive, not the day they were booked.
 *
 * A twelfth birthday between booking and check-in moves a child onto an adult
 * rate at a great many properties. Sending the age at booking is how a family
 * arrives to a bill that is not the one they agreed to, so the age that travels
 * to a supplier is this one.
 *
 * Null when either date is unreadable.
 */
export function ageAtCheckIn(birthDate: string, checkIn: string): number | null {
  if (!isCalendarDate(birthDate) || !isCalendarDate(checkIn)) return null;
  const [by, bm, bd] = birthDate.trim().split("-").map(Number);
  const [cy, cm, cd] = checkIn.trim().split("-").map(Number);
  let age = cy - by;
  if (cm < bm || (cm === bm && cd < bd)) age -= 1;
  return age >= 0 ? age : null;
}

export const guestsIn = (occupancy: Occupancy): number =>
  Math.max(0, occupancy.adults) + occupancy.childAges.length;

/** Whether an occupancy is one a supplier could be asked about. */
export function isUsableOccupancy(occupancy: Occupancy): boolean {
  if (!Number.isInteger(occupancy.adults) || occupancy.adults < 1) return false;
  if (occupancy.adults > ADULTS_PER_ROOM_MAX) return false;
  return occupancy.childAges.every(
    (age) => Number.isInteger(age) && age >= 0 && age <= CHILD_AGE_MAX,
  );
}

// ── What is being sold ──────────────────────────────────────────────────────

export const BOARD_BASIS = [
  "room_only",
  "breakfast",
  "half_board",
  "full_board",
  "all_inclusive",
] as const;
export type BoardBasis = (typeof BOARD_BASIS)[number];

export interface HotelProperty {
  supplierSlug: string;
  propertyId: string;
  name: string;
  /** IANA. Every local time on this stay is read in it. */
  timezone: string;
  countryCode: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  /** Out of five, as the supplier states it. Null when it does not. */
  starRating: number | null;
  /** Guest score and how many guests it is drawn from. Both or neither. */
  guestRating: number | null;
  guestReviewCount: number | null;
  /** Property-local wall clocks, "15:00" / "11:00". Null when unstated. */
  checkInFrom: string | null;
  checkOutBy: string | null;
}

// ── Money, which is the other half of the difficulty ────────────────────────

/**
 * What a stay costs, split by who collects it and when.
 *
 * Three numbers because a hotel bill has three and collapsing them loses the
 * one that surprises people. `prepaid` leaves the card now; `atProperty` is
 * collected at the desk — resort fees, city tax, parking; `allIn` is their sum
 * and the only number two offers may be compared on.
 */
export interface StayPrice {
  /** The room, before tax and before anything collected at the desk. */
  base: Money;
  /** Tax and fees taken now, with the room. */
  taxesPrepaid: Money;
  /** Mandatory charges the property collects on arrival or departure. */
  taxesAtProperty: Money;
}

const add = (a: Money, b: Money): Money => money(a.amount + b.amount, a.currency);

/** What leaves the card at booking. */
export const prepaid = (price: StayPrice): Money => add(price.base, price.taxesPrepaid);

/** What the desk will ask for. Zero is a number worth showing, not hiding. */
export const atProperty = (price: StayPrice): Money => money(price.taxesAtProperty.amount, price.base.currency);

/**
 * Everything the stay costs.
 *
 * The number that ranks, the number that is shown large, and the number a guest
 * is entitled to have been told before they arrived.
 */
export const allIn = (price: StayPrice): Money =>
  money(price.base.amount + price.taxesPrepaid.amount + price.taxesAtProperty.amount, price.base.currency);

/** The all-in cost of one night, for "from £120 a night". Null if nights is unknown. */
export function perNight(price: StayPrice, nights: number | null): Money | null {
  if (nights === null || nights <= 0) return null;
  return money(Math.round(allIn(price).amount / nights), price.base.currency);
}

/** Whether every part of a price is in one currency. A mixed one is a bug upstream. */
export const priceIsCoherent = (price: StayPrice): boolean =>
  price.base.currency === price.taxesPrepaid.currency &&
  price.base.currency === price.taxesAtProperty.currency;

// ── Cancellation, which is a deadline in somebody else's timezone ───────────

export type CancellationPenalty =
  | { kind: "none" }
  | { kind: "amount"; amount: Money }
  | { kind: "nights"; nights: number }
  | { kind: "percent"; percent: number };

export interface CancellationTier {
  /**
   * Property-local wall clock, "2026-10-03T18:00". From this moment the
   * penalty applies.
   *
   * Local, because "free until 18:00 on the 3rd" means six in the evening where
   * the hotel is. A guest in a different zone who reads it as their own 18:00
   * cancels four hours late and pays for it.
   */
  fromLocal: string;
  penalty: CancellationPenalty;
}

/** Tiers in the order they take effect. Before the first one, cancelling is free. */
export interface CancellationPolicy {
  tiers: readonly CancellationTier[];
  /** A rate sold as non-refundable. Charged in full from the moment it is bought. */
  nonRefundable: boolean;
}

/**
 * What cancelling right now would cost.
 *
 * Reads every deadline in the property's zone, takes the last one that has
 * passed, and resolves it against the stay's own money. A policy with no tiers
 * and no non-refundable flag is free to cancel, which is what "no policy
 * stated" has to mean: a penalty nobody was told about is not a penalty.
 */
export function penaltyNow(
  policy: CancellationPolicy,
  price: StayPrice,
  nights: number | null,
  timezone: string,
  nowMs: number,
): Money {
  const currency = price.base.currency;
  const total = allIn(price);
  if (policy.nonRefundable) return total;

  let applicable: CancellationPenalty = { kind: "none" };
  let latest = Number.NEGATIVE_INFINITY;
  for (const tier of policy.tiers) {
    const at = localToInstant(tier.fromLocal, timezone);
    if (!Number.isFinite(at) || at > nowMs) continue;
    if (at >= latest) {
      latest = at;
      applicable = tier.penalty;
    }
  }

  switch (applicable.kind) {
    case "none":
      return money(0, currency);
    case "amount":
      // A supplier's own figure, in a currency this stay is not priced in, is
      // not something to convert. Returned as stated so the caller shows it
      // rather than silently turning it into a wrong number.
      return applicable.amount;
    case "percent":
      return money((total.amount * Math.max(0, Math.min(100, applicable.percent))) / 100, currency);
    case "nights": {
      if (nights === null || nights <= 0) return total;
      const charged = Math.min(Math.max(0, applicable.nights), nights);
      return money(Math.round((total.amount / nights) * charged), currency);
    }
  }
}

/** Whether cancelling right now costs nothing. */
export const cancelsFree = (
  policy: CancellationPolicy,
  price: StayPrice,
  nights: number | null,
  timezone: string,
  nowMs: number,
): boolean => penaltyNow(policy, price, nights, timezone, nowMs).amount === 0;

/**
 * When free cancellation runs out, as an instant. Null when it never applied.
 *
 * The earliest tier that costs anything. Shown as a countdown, which is the
 * only form of this a guest reliably reads correctly.
 */
export function freeUntil(
  policy: CancellationPolicy,
  timezone: string,
): number | null {
  if (policy.nonRefundable) return null;
  let earliest: number | null = null;
  for (const tier of policy.tiers) {
    if (tier.penalty.kind === "none") continue;
    const at = localToInstant(tier.fromLocal, timezone);
    if (!Number.isFinite(at)) continue;
    if (earliest === null || at < earliest) earliest = at;
  }
  return earliest;
}

// ── An offer ────────────────────────────────────────────────────────────────

export interface HotelOffer {
  supplierSlug: string;
  supplierName: string;
  offerId: string;
  property: HotelProperty;
  roomName: string;
  /** How many of this room. Occupancy is per room, not per booking. */
  roomCount: number;
  occupancy: Occupancy;
  board: BoardBasis;
  price: StayPrice;
  cancellation: CancellationPolicy;
  /** Rooms the supplier says are left at this rate, where it says. */
  roomsRemaining: number | null;
  /** Never optional. A rate with no expiry is one nobody can be held to. */
  expiresAt: string;
}

// ── Where it is ─────────────────────────────────────────────────────────────

const EARTH_KM = 6371;
const rad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Kilometres between two points, great-circle.
 *
 * For "1.2 km from the station", and for ordering by `nearest`. Null when
 * either point is missing, because a hotel with no coordinates must not sort as
 * though it were at the centre of the search.
 */
export function distanceKm(
  from: { latitude: number | null; longitude: number | null },
  to: { latitude: number | null; longitude: number | null },
): number | null {
  const { latitude: lat1, longitude: lon1 } = from;
  const { latitude: lat2, longitude: lon2 } = to;
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return null;
  if (![lat1, lon1, lat2, lon2].every((n) => Number.isFinite(n))) return null;

  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_KM * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

// ── Ordering ────────────────────────────────────────────────────────────────

export type StayRanking = "cheapest" | "best_rated" | "nearest" | "best_value";

/**
 * One list, in the order the guest asked for.
 *
 * Three properties hold across every ranking, and each is a test:
 *
 * **Cheapest means all-in.** A rate of £90 with a £30 resort fee is dearer than
 * one of £110 with none, and orders below it. Sorting on what leaves the card
 * today would put the trap first, every time, on every search.
 *
 * **Expired offers sink, they do not vanish.** A guest who was shown a price is
 * told it lapsed, not left wondering where it went.
 *
 * **No currency conversion and no commission term.** Mixed currencies are
 * grouped by the caller; the order is what the guest's own preference produces,
 * and nothing else is added to it.
 */
export function rankOffers(
  offers: readonly HotelOffer[],
  ranking: StayRanking,
  context: { nowMs: number; nights: number | null; centre?: { latitude: number | null; longitude: number | null } },
): HotelOffer[] {
  const { nowMs, nights, centre } = context;

  const near = (offer: HotelOffer): number => {
    if (!centre) return Number.POSITIVE_INFINITY;
    const km = distanceKm(centre, offer.property);
    return km ?? Number.POSITIVE_INFINITY;
  };

  const rated = (offer: HotelOffer): number => offer.property.guestRating ?? -1;

  const value = (offer: HotelOffer): number => {
    // Price per rating point, per night. A hotel with no rating cannot be
    // ranked on value and goes last rather than being given an average.
    const score = offer.property.guestRating;
    if (score === null || score <= 0) return Number.POSITIVE_INFINITY;
    const night = perNight(offer.price, nights);
    if (night === null) return Number.POSITIVE_INFINITY;
    return night.amount / score;
  };

  return [...offers].sort((a, b) => {
    const aFresh = isFresh(a.expiresAt, nowMs);
    const bFresh = isFresh(b.expiresAt, nowMs);
    if (aFresh !== bFresh) return aFresh ? -1 : 1;

    switch (ranking) {
      case "cheapest":
        return allIn(a.price).amount - allIn(b.price).amount;
      case "nearest":
        return near(a) - near(b);
      case "best_rated":
        return rated(b) - rated(a);
      case "best_value":
        return value(a) - value(b);
    }
  });
}

/** Whether a fare moved between being shown and being charged. Either direction. */
export function priceMoved(agreed: StayPrice, repriced: StayPrice): boolean {
  return (
    allIn(agreed).amount !== allIn(repriced).amount ||
    allIn(agreed).currency !== allIn(repriced).currency ||
    prepaid(agreed).amount !== prepaid(repriced).amount
  );
}

// ── Where a booking can be ──────────────────────────────────────────────────

export const HOTEL_STATUSES = [
  "draft",
  "searching",
  "offered",
  "awaiting_confirmation",
  "pricing",
  "payment_pending",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
  "payment_failed",
  "booking_failed",
  "expired",
] as const;

export type HotelStatus = (typeof HOTEL_STATUSES)[number];

/** Nothing follows these. */
export const HOTEL_TERMINAL: ReadonlySet<HotelStatus> = new Set([
  "completed",
  "cancelled",
  "no_show",
  "payment_failed",
  "booking_failed",
  "expired",
]);

/** A room is held for the guest in one of these, and somebody is owed money. */
export const HOTEL_COMMITTED: ReadonlySet<HotelStatus> = new Set([
  "payment_pending",
  "confirmed",
  "checked_in",
]);

const HOTEL_TRANSITIONS: Readonly<Record<HotelStatus, readonly HotelStatus[]>> = {
  draft: ["searching", "expired"],
  searching: ["offered", "expired", "booking_failed"],
  offered: ["awaiting_confirmation", "searching", "expired"],
  awaiting_confirmation: ["pricing", "offered", "cancelled", "expired"],
  // Re-pricing is its own state here for the same reason it is for flights: it
  // is where the rate is confirmed to still exist at the price the guest said
  // yes to. A rate that moved is shown again, never charged.
  pricing: ["payment_pending", "offered", "cancelled", "expired"],
  payment_pending: ["confirmed", "payment_failed", "cancelled"],
  // A confirmed booking can still end three ways, and `no_show` is one of them.
  // It is not a cancellation — it usually costs the guest the first night — and
  // a vocabulary that cannot tell them apart cannot refund correctly.
  confirmed: ["checked_in", "cancelled", "no_show"],
  checked_in: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
  payment_failed: [],
  booking_failed: [],
  expired: [],
};

export const isHotelStatus = (value: unknown): value is HotelStatus =>
  typeof value === "string" && (HOTEL_STATUSES as readonly string[]).includes(value);

export function canTransitionHotel(from: HotelStatus, to: HotelStatus): boolean {
  return (HOTEL_TRANSITIONS[from] ?? []).includes(to);
}

/** The move, or the state it was already in. A refused move never throws. */
export const nextHotelStatus = (from: HotelStatus, to: HotelStatus): HotelStatus =>
  canTransitionHotel(from, to) ? to : from;

// ── What a guest is told ────────────────────────────────────────────────────

export const HOTEL_ERRORS = [
  "NO_AVAILABILITY",
  "SUPPLIER_UNAVAILABLE",
  "DESTINATION_INVALID",
  "DATES_INVALID",
  "OCCUPANCY_INVALID",
  "STAY_TOO_LONG",
  "OFFER_EXPIRED",
  "PRICE_CHANGED",
  "ROOM_NO_LONGER_AVAILABLE",
  "GUEST_DETAILS_INVALID",
  "PAYMENT_REQUIRED",
  "PAYMENT_FAILED",
  "BOOKING_FAILED",
  "AUTHORIZATION_REQUIRED",
  "SUPPLIER_REQUIRES_CONTRACT",
  "SERVICE_UNAVAILABLE",
  "CANCELLATION_FAILED",
  "CANCELLATION_NOT_PERMITTED",
  "DUPLICATE_BOOKING",
] as const;

export type HotelErrorCode = (typeof HOTEL_ERRORS)[number];

/** Asking a different supplier is a sensible response to these, and only these. */
const HOTEL_FAILOVER: ReadonlySet<HotelErrorCode> = new Set([
  "NO_AVAILABILITY",
  "SUPPLIER_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
]);

export class HotelError extends Error {
  readonly code: HotelErrorCode;
  readonly supplierSlug: string | null;
  readonly failover: boolean;

  constructor(code: HotelErrorCode, options: { supplierSlug?: string | null } = {}) {
    super(code);
    this.name = "HotelError";
    this.code = code;
    this.supplierSlug = options.supplierSlug ?? null;
    this.failover = HOTEL_FAILOVER.has(code);
  }
}

// ── Who is checking in ──────────────────────────────────────────────────────

/**
 * The collection boundary, and it is shorter than the flights one on purpose.
 *
 * A property needs a name to put on the room and a way to reach the booker.
 * It does not need a passport to hold a room, so there is no passport field
 * here and no passport column in the schema — a field that exists gets filled
 * in, and data nobody collected cannot leak.
 *
 * Where a jurisdiction genuinely requires a document at check-in, the property
 * takes it at the desk. That is their legal obligation and their record, not
 * Visionex's to hold a copy of.
 */
export const GUEST_FIELDS = [
  "givenName",
  "familyName",
] as const;

export interface HotelGuest {
  givenName: string;
  familyName: string;
  /** Only for the lead guest, so the property can reach somebody. */
  email?: string | null;
  phone?: string | null;
  /** What they asked for. Never a promise — properties honour these or do not. */
  specialRequests?: string | null;
}

export function missingGuestFields(guest: Partial<HotelGuest>): string[] {
  return GUEST_FIELDS.filter((field) => {
    const value = guest[field];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

/** A name as a property will print it: folded, uppercase, Latin letters. */
export function guestName(value: string): string {
  return foldLatin(value)
    .replace(/[^A-Za-z \-']/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

// ── What was asked for ──────────────────────────────────────────────────────

export interface StaySearch {
  /** Free text as the guest typed it. Resolving it is the supplier's job. */
  destination: string | null;
  checkIn: string | null;
  checkOut: string | null;
  rooms: readonly Occupancy[];
  board: BoardBasis | null;
  freeCancellationOnly: boolean;
  minStarRating: number | null;
}

export const EMPTY_SEARCH: StaySearch = Object.freeze({
  destination: null,
  checkIn: null,
  checkOut: null,
  rooms: Object.freeze([{ adults: 2, childAges: Object.freeze([]) as readonly number[] }]),
  board: null,
  freeCancellationOnly: false,
  minStarRating: null,
});

/**
 * What still has to be asked before anybody can be searched.
 *
 * In the order a conversation would ask them, because this drives one: a guest
 * told "destination, dates and occupancy are missing" answers one of the three.
 */
export function missingFromSearch(
  search: StaySearch,
): Array<"destination" | "checkIn" | "checkOut" | "occupancy"> {
  const missing: Array<"destination" | "checkIn" | "checkOut" | "occupancy"> = [];
  if (!search.destination || !search.destination.trim()) missing.push("destination");
  if (!search.checkIn || !isCalendarDate(search.checkIn)) missing.push("checkIn");
  if (!search.checkOut || !isCalendarDate(search.checkOut)) missing.push("checkOut");
  if (search.rooms.length === 0 || !search.rooms.every(isUsableOccupancy)) missing.push("occupancy");
  return missing;
}

/** Total rooms and heads a search is for, for "2 rooms, 4 guests". */
export function searchSize(search: StaySearch): { rooms: number; guests: number } {
  return {
    rooms: search.rooms.length,
    guests: search.rooms.reduce((sum, room) => sum + guestsIn(room), 0),
  };
}
