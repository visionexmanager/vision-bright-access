/**
 * What a traveller typed, checked against the rules the booking cores already
 * own, and turned into something the travel desk can act on.
 *
 * Two jobs, and they are separate on purpose:
 *
 * **Checking.** Every rule here that exists in `flights.ts`, `hotels.ts` or
 * `mobility.ts` is *called*, never restated — `isPlausibleDate`, `nightsBetween`,
 * `isUsableOccupancy`, `MAX_NIGHTS`. A second copy of a date rule in the UI is a
 * second answer to the same question, and the wrong one always ships. What is
 * genuinely new here — that an infant needs a lap to sit on, that nine seats is
 * one booking — is a form rule, lives here, and is tested here.
 *
 * **Summarising.** A request goes to a person, so it is written for a person, in
 * one fixed language. The traveller's own words are appended verbatim and never
 * reformatted. This is deliberately *not* localised: twenty translations of a
 * label only the travel desk reads would be twenty things to keep true, and the
 * desk reads one language.
 *
 * A city name is accepted where an airport code is expected. `airportCode`
 * refuses "Beirut", which is right for a supplier request and wrong for a form
 * a person fills in — the desk resolves it, and the day a supplier does the
 * resolving, the same text is what it gets.
 */

import {
  airportCode,
  isPlausibleDate,
  type CabinClass,
} from "../../../supabase/functions/_shared/flights.ts";
import {
  ADULTS_PER_ROOM_MAX,
  CHILD_AGE_MAX,
  MAX_NIGHTS,
  isCalendarDate,
  isUsableOccupancy,
  nightsBetween,
  type BoardBasis,
} from "../../../supabase/functions/_shared/hotels.ts";

/** The biggest party one booking is made for. Beyond it, the desk splits it. */
export const MAX_TRAVELLERS = 9;
/** Rooms in one request. More than this is a group booking, which is a call. */
export const MAX_ROOMS = 5;
/** Riders one vehicle is asked for. */
export const MAX_RIDERS = 8;

/**
 * One thing wrong with a form, named by the field it belongs to.
 *
 * `field` is what gets focus and what the message is tied to with
 * `aria-describedby`; `code` is an i18n key suffix. Both are plain strings so a
 * page can render a summary without knowing what a fare is.
 */
export interface TravelIssue {
  field: string;
  code: string;
}

const issue = (field: string, code: string): TravelIssue => ({ field, code });

const filled = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

const samePlace = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

// ── Flights ─────────────────────────────────────────────────────────────────

export interface FlightDraft {
  origin: string;
  destination: string;
  departDate: string;
  /** Empty for a one-way. */
  returnDate: string;
  adults: number;
  children: number;
  infants: number;
  cabin: CabinClass;
  notes: string;
}

export const EMPTY_FLIGHT_DRAFT: FlightDraft = Object.freeze({
  origin: "",
  destination: "",
  departDate: "",
  returnDate: "",
  adults: 1,
  children: 0,
  infants: 0,
  cabin: "economy" as CabinClass,
  notes: "",
});

export function flightIssues(draft: FlightDraft, nowMs: number = Date.now()): TravelIssue[] {
  const issues: TravelIssue[] = [];

  if (!filled(draft.origin)) issues.push(issue("origin", "originRequired"));
  if (!filled(draft.destination)) issues.push(issue("destination", "destinationRequired"));
  if (filled(draft.origin) && filled(draft.destination) && samePlace(draft.origin, draft.destination)) {
    issues.push(issue("destination", "samePlace"));
  }

  if (!filled(draft.departDate)) issues.push(issue("departDate", "departRequired"));
  else if (!isPlausibleDate(draft.departDate, nowMs)) issues.push(issue("departDate", "departPast"));

  if (filled(draft.returnDate)) {
    if (!isPlausibleDate(draft.returnDate, nowMs)) issues.push(issue("returnDate", "returnPast"));
    else if (filled(draft.departDate) && draft.returnDate < draft.departDate) {
      issues.push(issue("returnDate", "returnBeforeDepart"));
    }
  }

  // An infant travels on somebody's lap, so there has to be a lap.
  if (!Number.isInteger(draft.adults) || draft.adults < 1) issues.push(issue("adults", "adultsRequired"));
  if (draft.infants > draft.adults) issues.push(issue("infants", "infantsPerAdult"));

  const seats = draft.adults + draft.children + draft.infants;
  if (seats > MAX_TRAVELLERS) issues.push(issue("adults", "partyTooLarge"));

  return issues;
}

const partyLine = (adults: number, children: number, infants: number): string =>
  [
    `${adults} adult${adults === 1 ? "" : "s"}`,
    children > 0 ? `${children} child${children === 1 ? "" : "ren"}` : null,
    infants > 0 ? `${infants} infant${infants === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(", ");

const place = (value: string): string => {
  const code = airportCode(value);
  return code ? `${value.trim()} (${code})` : value.trim();
};

export function flightSummary(draft: FlightDraft): string {
  const lines = [
    "Flight request",
    `From: ${place(draft.origin)}`,
    `To: ${place(draft.destination)}`,
    `Depart: ${draft.departDate}`,
    `Return: ${filled(draft.returnDate) ? draft.returnDate : "one way"}`,
    `Travellers: ${partyLine(draft.adults, draft.children, draft.infants)}`,
    `Cabin: ${draft.cabin.replace(/_/g, " ")}`,
  ];
  if (filled(draft.notes)) lines.push("", "Traveller note:", draft.notes.trim());
  return lines.join("\n");
}

// ── Stays ───────────────────────────────────────────────────────────────────

export interface StayDraft {
  destination: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  /** One age per child, for the whole party. A property prices by age. */
  childAges: readonly number[];
  board: BoardBasis | "";
  freeCancellationOnly: boolean;
  notes: string;
}

export const EMPTY_STAY_DRAFT: StayDraft = Object.freeze({
  destination: "",
  checkIn: "",
  checkOut: "",
  rooms: 1,
  adults: 2,
  childAges: Object.freeze([]) as readonly number[],
  board: "" as const,
  freeCancellationOnly: false,
  notes: "",
});

export function stayIssues(draft: StayDraft, nowMs: number = Date.now()): TravelIssue[] {
  const issues: TravelIssue[] = [];

  if (!filled(draft.destination)) issues.push(issue("destination", "destinationRequired"));

  if (!filled(draft.checkIn)) issues.push(issue("checkIn", "checkInRequired"));
  else if (!isCalendarDate(draft.checkIn)) issues.push(issue("checkIn", "checkInInvalid"));
  else if (!isPlausibleDate(draft.checkIn, nowMs)) issues.push(issue("checkIn", "checkInPast"));

  if (!filled(draft.checkOut)) issues.push(issue("checkOut", "checkOutRequired"));
  else if (!isCalendarDate(draft.checkOut)) issues.push(issue("checkOut", "checkOutInvalid"));

  if (filled(draft.checkIn) && filled(draft.checkOut)) {
    const nights = nightsBetween(draft.checkIn, draft.checkOut);
    if (nights === null || nights < 1) issues.push(issue("checkOut", "checkOutAfterCheckIn"));
    else if (nights > MAX_NIGHTS) issues.push(issue("checkOut", "tooManyNights"));
  }

  if (!Number.isInteger(draft.rooms) || draft.rooms < 1) issues.push(issue("rooms", "roomsRequired"));
  else if (draft.rooms > MAX_ROOMS) issues.push(issue("rooms", "tooManyRooms"));

  // The core owns what a supplier will accept in one room; the form owns how
  // the party the guest typed is spread across the rooms they asked for.
  const perRoom = Math.ceil(Math.max(0, draft.adults) / Math.max(1, draft.rooms));
  if (!Number.isInteger(draft.adults) || draft.adults < 1) issues.push(issue("adults", "adultsRequired"));
  else if (perRoom > ADULTS_PER_ROOM_MAX) issues.push(issue("adults", "tooManyPerRoom"));

  if (!isUsableOccupancy({ adults: Math.max(1, perRoom), childAges: draft.childAges })) {
    if (draft.childAges.some((age) => !Number.isInteger(age) || age < 0 || age > CHILD_AGE_MAX)) {
      issues.push(issue("childAges", "childAgeRange"));
    }
  }

  return issues;
}

/** Nights, or null while the dates are not yet a stay. Used for live feedback. */
export const stayNights = (draft: StayDraft): number | null =>
  nightsBetween(draft.checkIn, draft.checkOut);

export function staySummary(draft: StayDraft): string {
  const nights = stayNights(draft);
  const children = draft.childAges.length;
  const lines = [
    "Hotel request",
    `Destination: ${draft.destination.trim()}`,
    `Check-in: ${draft.checkIn}`,
    `Check-out: ${draft.checkOut}${nights === null ? "" : ` (${nights} night${nights === 1 ? "" : "s"})`}`,
    `Rooms: ${draft.rooms}`,
    `Guests: ${draft.adults} adult${draft.adults === 1 ? "" : "s"}${
      children > 0
        ? `, ${children} child${children === 1 ? "" : "ren"} aged ${draft.childAges.join(", ")}`
        : ""
    }`,
    `Board: ${draft.board === "" ? "any" : draft.board.replace(/_/g, " ")}`,
    `Free cancellation only: ${draft.freeCancellationOnly ? "yes" : "no"}`,
  ];
  if (filled(draft.notes)) lines.push("", "Guest note:", draft.notes.trim());
  return lines.join("\n");
}

// ── Rides ───────────────────────────────────────────────────────────────────

export interface RideDraft {
  pickup: string;
  destination: string;
  /** `YYYY-MM-DD`, empty for as soon as possible. */
  date: string;
  /** `HH:MM` in the pick-up own clock, empty for as soon as possible. */
  time: string;
  passengers: number;
  wheelchairAccessible: boolean;
  notes: string;
}

export const EMPTY_RIDE_DRAFT: RideDraft = Object.freeze({
  pickup: "",
  destination: "",
  date: "",
  time: "",
  passengers: 1,
  wheelchairAccessible: false,
  notes: "",
});

export function rideIssues(draft: RideDraft, nowMs: number = Date.now()): TravelIssue[] {
  const issues: TravelIssue[] = [];

  if (!filled(draft.pickup)) issues.push(issue("pickup", "pickupRequired"));
  if (!filled(draft.destination)) issues.push(issue("destination", "destinationRequired"));
  if (filled(draft.pickup) && filled(draft.destination) && samePlace(draft.pickup, draft.destination)) {
    issues.push(issue("destination", "samePlace"));
  }

  if (filled(draft.date) && !isPlausibleDate(draft.date, nowMs)) issues.push(issue("date", "datePast"));
  // A time without a day is a time on no day at all.
  if (filled(draft.time) && !filled(draft.date)) issues.push(issue("date", "timeNeedsDate"));

  if (!Number.isInteger(draft.passengers) || draft.passengers < 1) {
    issues.push(issue("passengers", "passengersRequired"));
  } else if (draft.passengers > MAX_RIDERS) issues.push(issue("passengers", "tooManyRiders"));

  return issues;
}

export function rideSummary(draft: RideDraft): string {
  const when = filled(draft.date)
    ? `${draft.date}${filled(draft.time) ? ` ${draft.time}` : ""} (pick-up local time)`
    : "as soon as possible";
  const lines = [
    "Ride request",
    `Pick-up: ${draft.pickup.trim()}`,
    `Drop-off: ${draft.destination.trim()}`,
    `When: ${when}`,
    `Passengers: ${draft.passengers}`,
    `Wheelchair accessible vehicle: ${draft.wheelchairAccessible ? "required" : "not required"}`,
  ];
  if (filled(draft.notes)) lines.push("", "Rider note:", draft.notes.trim());
  return lines.join("\n");
}

// ── What the travel desk is asked for ───────────────────────────────────────

/**
 * `service_requests.service_type`, which is what the desk filters its queue by.
 *
 * The existing Travel Agency page writes "Travel Agency — <package>". These
 * keep the same first words so one filter still finds the lot.
 */
export const SERVICE_TYPE: Readonly<Record<"flights" | "stays" | "rides", string>> = Object.freeze({
  flights: "Travel Agency — Flight request",
  stays: "Travel Agency — Hotel request",
  rides: "Travel Agency — Ride request",
});
