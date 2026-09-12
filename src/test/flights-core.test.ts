// Visionex Flights — the core, driven without a supplier.
//
// The section that matters most is the time arithmetic. Beirut 08:00 → London
// 11:30 looks like three and a half hours and is five and a half; a flight can
// take four hours and land tomorrow, or eighteen and land the same afternoon.
// None of those are subtraction of the wall clocks, all of them are what a
// traveller reads off the screen, and every one is testable here without a
// credential, a supplier or a network.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CABINS,
  EMPTY_SEARCH,
  FLIGHT_COMMITTED,
  FLIGHT_ERRORS,
  FLIGHT_STATUSES,
  FLIGHT_TERMINAL,
  FlightError,
  airportCode,
  arrivalDayOffset,
  arrivalInstant,
  canTransitionFlight,
  departureInstant,
  formatDuration,
  isFlightStatus,
  isFresh,
  isPlausibleDate,
  layoverMinutes,
  layovers,
  localToInstant,
  missingFromSearch,
  missingPassengerFields,
  money,
  nextFlightStatus,
  offerMinutes,
  priceChanged,
  rankOffers,
  segmentMinutes,
  sliceMinutes,
  stopCount,
  ticketName,
  totalFor,
  type FlightOffer,
  type FlightSegment,
  type FlightStatus,
} from "../../supabase/functions/_shared/flights.ts";

import {
  SUPPLIERS,
  SUPPLIER_CAPABILITIES,
  canSellTickets,
  gatherOffers,
  isSupplierCallable,
  pendingSupplier,
  supplierBySlug,
  type FlightSupplier,
  type SearchRequest,
  type SupplierCapability,
} from "../../supabase/functions/_shared/flightsProviders.ts";

const core = readFileSync("supabase/functions/_shared/flights.ts", "utf8");
const seam = readFileSync("supabase/functions/_shared/flightsProviders.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261010000000_flights_core.sql", "utf8");

const airport = (code: string, timezone: string) => ({ code, timezone });

const segment = (over: Partial<FlightSegment> = {}): FlightSegment => ({
  marketingCarrier: "ME",
  flightNumber: "202",
  origin: airport("BEY", "Asia/Beirut"),
  destination: airport("LHR", "Europe/London"),
  departsLocal: "2026-10-12T08:00",
  arrivesLocal: "2026-10-12T11:30",
  ...over,
});

const NOW = Date.parse("2026-10-01T00:00:00Z");
const inMinutes = (n: number) => new Date(NOW + n * 60_000).toISOString();

const offer = (over: Partial<FlightOffer> = {}): FlightOffer => ({
  supplierSlug: "alpha",
  supplierName: "Alpha",
  offerId: "off_1",
  slices: [{ segments: [segment()] }],
  total: money(48000, "USD"),
  cabin: "economy",
  refundable: false,
  changeable: null,
  expiresAt: inMinutes(10),
  ...over,
});

// ── Airport codes ───────────────────────────────────────────────────────────

describe("an airport code", () => {
  it("is three letters, uppercased", () => {
    expect(airportCode("bey")).toBe("BEY");
    expect(airportCode(" LHR ")).toBe("LHR");
  });

  it("is not a city name or a country code", () => {
    for (const bad of ["BEIRUT", "BE", "B", "1234", "", null, undefined, "L H R"]) {
      expect(airportCode(bad), String(bad)).toBeNull();
    }
  });
});

// ── The time arithmetic ─────────────────────────────────────────────────────

describe("a duration is instants, never wall clocks", () => {
  it("reads Beirut to London as five and a half hours, not three and a half", () => {
    // The whole reason every segment carries its own zone. Subtracting the
    // strings gives 3h30; the flight is 5h30.
    expect(segmentMinutes(segment())).toBe(330);
  });

  it("reads a flight inside one zone correctly too", () => {
    const short = segment({
      origin: airport("BEY", "Asia/Beirut"),
      destination: airport("LCA", "Asia/Nicosia"),
      departsLocal: "2026-10-12T08:00",
      arrivesLocal: "2026-10-12T08:40",
    });
    expect(segmentMinutes(short)).toBe(40);
  });

  it("reads a westbound flight that lands before it left, locally", () => {
    // London 10:00 → New York 13:00 is eight hours, and the clock goes back.
    const west = segment({
      origin: airport("LHR", "Europe/London"),
      destination: airport("JFK", "America/New_York"),
      departsLocal: "2026-10-12T10:00",
      arrivesLocal: "2026-10-12T13:00",
    });
    expect(segmentMinutes(west)).toBe(480);
  });

  it("uses the offset in force on the day, not today's", () => {
    // Beirut and London shift together, so their gap is constant and a flight
    // between them is the same length in both seasons — which is why the pair
    // that proves this rule has to be one where only one side shifts.
    //
    // London is on BST in July and GMT in January; Dubai is UTC+4 all year. The
    // same wall-clock pair is therefore an hour longer in summer.
    const toDubai = (departsLocal: string, arrivesLocal: string) => segment({
      origin: airport("LHR", "Europe/London"),
      destination: airport("DXB", "Asia/Dubai"),
      departsLocal,
      arrivesLocal,
    });
    expect(segmentMinutes(toDubai("2026-07-12T08:00", "2026-07-12T18:00"))).toBe(420);
    expect(segmentMinutes(toDubai("2026-01-12T08:00", "2026-01-12T18:00"))).toBe(360);
  });

  it("refuses a time it cannot read rather than inventing one", () => {
    expect(segmentMinutes(segment({ departsLocal: "not a time" }))).toBeNull();
    expect(Number.isNaN(localToInstant("nonsense", "UTC"))).toBe(true);
    expect(Number.isNaN(localToInstant("", "UTC"))).toBe(true);
  });

  it("survives a zone it does not know", () => {
    const odd = segment({ origin: airport("XXX", "Mars/Olympus") });
    expect(() => segmentMinutes(odd)).not.toThrow();
  });

  it("refuses a segment that lands before it leaves", () => {
    const impossible = segment({ departsLocal: "2026-10-12T11:30", arrivesLocal: "2026-10-12T08:00" });
    expect(segmentMinutes(impossible)).toBeNull();
  });
});

describe("a layover", () => {
  const first = segment({
    destination: airport("IST", "Europe/Istanbul"),
    departsLocal: "2026-10-12T08:00",
    arrivesLocal: "2026-10-12T10:00",
  });
  const second = segment({
    origin: airport("IST", "Europe/Istanbul"),
    destination: airport("LHR", "Europe/London"),
    departsLocal: "2026-10-12T12:30",
    arrivesLocal: "2026-10-12T14:30",
  });

  it("is measured between two instants in the same airport", () => {
    expect(layoverMinutes(first, second)).toBe(150);
  });

  it("is reported for every stop, with the airport it happens in", () => {
    const stops = layovers({ segments: [first, second] });
    expect(stops).toHaveLength(1);
    expect(stops[0].airport.code).toBe("IST");
    expect(stops[0].minutes).toBe(150);
  });

  it("is empty for a non-stop", () => {
    expect(layovers({ segments: [segment()] })).toEqual([]);
  });

  it("refuses a negative one rather than repeating a supplier's mistake", () => {
    const impossible = segment({
      origin: airport("IST", "Europe/Istanbul"),
      departsLocal: "2026-10-12T09:00",
    });
    expect(layoverMinutes(first, impossible)).toBeNull();
  });
});

describe("a whole journey", () => {
  const connecting = {
    segments: [
      segment({
        destination: airport("IST", "Europe/Istanbul"),
        departsLocal: "2026-10-12T08:00",
        arrivesLocal: "2026-10-12T10:00",
      }),
      segment({
        origin: airport("IST", "Europe/Istanbul"),
        destination: airport("LHR", "Europe/London"),
        departsLocal: "2026-10-12T12:30",
        arrivesLocal: "2026-10-12T14:30",
      }),
    ],
  };

  it("is measured door to door, not by summing the parts", () => {
    // 08:00 Beirut → 14:30 London. Six and a half hours of clock, plus the
    // two-hour offset: 8h30.
    expect(sliceMinutes(connecting)).toBe(510);
  });

  it("counts stops, not segments", () => {
    expect(stopCount({ segments: [segment()] })).toBe(0);
    expect(stopCount(connecting)).toBe(1);
  });

  it("knows which calendar day it lands on", () => {
    expect(arrivalDayOffset({ segments: [segment()] })).toBe(0);

    const overnight = {
      segments: [segment({
        destination: airport("SIN", "Asia/Singapore"),
        departsLocal: "2026-10-12T23:00",
        arrivesLocal: "2026-10-13T16:00",
      })],
    };
    expect(arrivalDayOffset(overnight)).toBe(1);
  });

  it("reads the day from the dates, not from the duration", () => {
    // Eighteen hours eastward, landing the same local afternoon going west.
    const long = {
      segments: [segment({
        origin: airport("SYD", "Australia/Sydney"),
        destination: airport("LAX", "America/Los_Angeles"),
        departsLocal: "2026-10-12T10:00",
        arrivesLocal: "2026-10-12T06:30",
      })],
    };
    expect(arrivalDayOffset(long)).toBe(0);
    expect(sliceMinutes(long)).toBeGreaterThan(600);
  });

  it("adds the slices for a return trip", () => {
    const round = offer({ slices: [{ segments: [segment()] }, { segments: [segment()] }] });
    expect(offerMinutes(round)).toBe(660);
  });

  it("is null when any part cannot be read", () => {
    expect(offerMinutes(offer({ slices: [{ segments: [segment({ arrivesLocal: "?" })] }] }))).toBeNull();
  });
});

describe("how a duration is written", () => {
  it("is hours and minutes, and drops what is zero", () => {
    expect(formatDuration(330)).toBe("5h 30m");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(45)).toBe("45m");
  });

  it("says nothing rather than something wrong", () => {
    expect(formatDuration(null)).toBe("");
    expect(formatDuration(-5)).toBe("");
    expect(formatDuration(Number.NaN)).toBe("");
  });
});

// ── The state machine ───────────────────────────────────────────────────────

describe("a booking moves only where it may", () => {
  it("runs the ordinary course from search to ticket", () => {
    const course: FlightStatus[] = [
      "draft", "searching", "offered", "awaiting_confirmation", "pricing",
      "payment_pending", "ticketing", "ticketed",
    ];
    for (let i = 0; i < course.length - 1; i += 1) {
      expect(canTransitionFlight(course[i], course[i + 1]), `${course[i]} → ${course[i + 1]}`).toBe(true);
    }
  });

  it("keeps re-pricing between confirmation and payment", () => {
    // The state that exists so a fare is confirmed to still exist before money
    // moves. Confirmation cannot reach payment without passing through it.
    expect(canTransitionFlight("awaiting_confirmation", "payment_pending")).toBe(false);
    expect(canTransitionFlight("awaiting_confirmation", "pricing")).toBe(true);
    // A price that moved goes back to being an offer, never straight to a charge.
    expect(canTransitionFlight("pricing", "offered")).toBe(true);
  });

  it("separates a failed payment from a failed ticket", () => {
    // One needs a retry. The other needs a refund, because the money was taken
    // and the airline then refused the fare.
    expect(canTransitionFlight("payment_pending", "payment_failed")).toBe(true);
    expect(canTransitionFlight("ticketing", "ticketing_failed")).toBe(true);
    expect(canTransitionFlight("payment_pending", "ticketing_failed")).toBe(false);
  });

  it("makes every terminal status terminal", () => {
    for (const from of FLIGHT_TERMINAL) {
      for (const to of FLIGHT_STATUSES) {
        expect(canTransitionFlight(from, to), `${from} → ${to}`).toBe(false);
      }
    }
  });

  it("ignores a late supplier event rather than lying", () => {
    expect(nextFlightStatus("ticketed", "ticketing")).toBe("ticketed");
    expect(nextFlightStatus("cancelled", "payment_pending")).toBe("cancelled");
    expect(nextFlightStatus("ticketing", "ticketing")).toBe("ticketing");
    expect(nextFlightStatus("ticketing", "ticketed")).toBe("ticketed");
  });

  it("knows where money is committed", () => {
    for (const status of FLIGHT_COMMITTED) {
      expect(isFlightStatus(status), status).toBe(true);
    }
    expect(FLIGHT_COMMITTED.has("offered")).toBe(false);
    expect(isFlightStatus("pending")).toBe(false);
  });
});

// ── Errors ──────────────────────────────────────────────────────────────────

describe("what a traveller is told", () => {
  it("only tries another supplier when another could help", () => {
    expect(new FlightError("NO_OFFERS_FOUND").failover).toBe(true);
    expect(new FlightError("SUPPLIER_UNAVAILABLE").failover).toBe(true);
    // A rejected card and an invalid passport fail the same way everywhere.
    expect(new FlightError("PAYMENT_FAILED").failover).toBe(false);
    expect(new FlightError("PASSENGER_DETAILS_INVALID").failover).toBe(false);
    expect(new FlightError("SUPPLIER_REQUIRES_ACCREDITATION").failover).toBe(false);
  });

  it("carries a code and a supplier, and nothing the supplier wrote", () => {
    const error = new FlightError("TICKETING_FAILED", { supplierSlug: "alpha" });
    expect(error.message).toBe("TICKETING_FAILED");
    expect(error.supplierSlug).toBe("alpha");
  });

  it("is a closed set that names the accreditation case", () => {
    expect(FLIGHT_ERRORS).toContain("SUPPLIER_REQUIRES_ACCREDITATION");
    expect(new Set(FLIGHT_ERRORS).size).toBe(FLIGHT_ERRORS.length);
  });
});

// ── Passengers ──────────────────────────────────────────────────────────────

describe("what a ticket needs about a person", () => {
  it("names what is missing without echoing what is there", () => {
    expect(missingPassengerFields({})).toContain("givenName");
    expect(missingPassengerFields({ givenName: "Sara" })).toContain("familyName");
    expect(missingPassengerFields({ dateOfBirth: "12/03/1990" })).toContain("dateOfBirth");
    expect(missingPassengerFields({
      type: "adult",
      givenName: "Sara",
      familyName: "Haddad",
      dateOfBirth: "1990-03-12",
    })).toEqual([]);
  });

  it("never returns a value, only a field name", () => {
    const missing = missingPassengerFields({ givenName: "   ", documentNumber: "X1234567" });
    expect(missing.join(" ")).not.toContain("X1234567");
  });

  it("folds a name into what an airline will accept", () => {
    expect(ticketName("José")).toBe("JOSE");
    expect(ticketName("Müller-Schmidt")).toBe("MULLER-SCHMIDT");
    expect(ticketName("  سارة  ")).toBe("");
    expect(ticketName("o'brien")).toBe("OBRIEN");
  });

  it("declares the boundary in one place", () => {
    // The list is the rule: anything not on it is not collected, because the
    // cheapest way to keep passport data safe is not to hold it.
    expect(core).toContain("export const PASSENGER_FIELDS");
    expect(core).toMatch(/never a log line|not a log line|never.*log/i);
  });
});

// ── The search ──────────────────────────────────────────────────────────────

describe("what is still missing", () => {
  it("asks for an origin before a destination before a date", () => {
    expect(missingFromSearch(EMPTY_SEARCH)).toEqual(["origin", "destination", "departDate"]);
  });

  it("asks for nothing once all three are real", () => {
    expect(missingFromSearch({
      ...EMPTY_SEARCH,
      origin: "BEY",
      destination: "LHR",
      departDate: "2099-01-01",
    })).toEqual([]);
  });

  it("treats a city name as a missing airport", () => {
    expect(missingFromSearch({ ...EMPTY_SEARCH, origin: "Beirut" })).toContain("origin");
  });

  it("refuses a date in the past, with a day of grace for the other side of the world", () => {
    const now = Date.parse("2026-10-12T12:00:00Z");
    expect(isPlausibleDate("2026-10-13", now)).toBe(true);
    expect(isPlausibleDate("2026-10-12", now)).toBe(true);
    expect(isPlausibleDate("2026-10-11", now)).toBe(true);
    expect(isPlausibleDate("2026-10-01", now)).toBe(false);
    expect(isPlausibleDate("12/10/2026", now)).toBe(false);
    expect(isPlausibleDate(null, now)).toBe(false);
  });

  it("defaults to one adult in economy", () => {
    expect(EMPTY_SEARCH.adults).toBe(1);
    expect(EMPTY_SEARCH.cabin).toBe("economy");
    expect(CABINS).toContain("business");
  });
});

// ── Ranking ─────────────────────────────────────────────────────────────────

describe("one list, ordered by what the traveller asked for", () => {
  const cheapSlow = offer({
    offerId: "cheap",
    total: money(30000, "USD"),
    slices: [{ segments: [
      segment({ destination: airport("IST", "Europe/Istanbul"), arrivesLocal: "2026-10-12T10:00" }),
      segment({ origin: airport("IST", "Europe/Istanbul"), departsLocal: "2026-10-12T18:00", arrivesLocal: "2026-10-12T20:00" }),
    ] }],
  });
  const dearFast = offer({ offerId: "fast", total: money(72000, "USD") });
  const middling = offer({ offerId: "mid", total: money(48000, "USD") });

  const order = (ranking: Parameters<typeof rankOffers>[1], extra = {}) =>
    rankOffers([middling, dearFast, cheapSlow], ranking, { nowMs: NOW, ...extra }).map((o) => o.offerId);

  it("puts the smallest fare first for cheapest", () => {
    expect(order("cheapest")).toEqual(["cheap", "mid", "fast"]);
  });

  it("puts the shortest journey first for fastest", () => {
    expect(order("fastest")[0]).not.toBe("cheap");
  });

  it("puts the non-stop first for fewest stops", () => {
    expect(order("fewest_stops")[2]).toBe("cheap");
  });

  it("hides nothing", () => {
    expect(rankOffers([middling, dearFast, cheapSlow], "cheapest", { nowMs: NOW })).toHaveLength(3);
  });

  it("sinks an expired fare rather than vanishing it", () => {
    const stale = offer({ offerId: "stale", total: money(100, "USD"), expiresAt: inMinutes(-1) });
    const ranked = rankOffers([stale, middling], "cheapest", { nowMs: NOW });
    expect(ranked.map((o) => o.offerId)).toEqual(["mid", "stale"]);
  });

  it("does not compare across currencies", () => {
    const euros = offer({ offerId: "euro", total: money(20000, "EUR") });
    const ranked = rankOffers([euros, middling], "cheapest", { nowMs: NOW, currency: "USD" });
    expect(ranked[0].offerId).toBe("mid");
  });

  it("never mentions commission in any comparator", () => {
    const ranking = core.slice(core.indexOf("export function rankOffers"));
    expect(ranking).not.toMatch(/commission|payout|margin|revenue/i);
  });

  it("is stable between two renders of the same list", () => {
    const twins = [offer({ offerId: "b" }), offer({ offerId: "a" })];
    expect(rankOffers(twins, "cheapest", { nowMs: NOW }).map((o) => o.offerId))
      .toEqual(rankOffers(twins, "cheapest", { nowMs: NOW }).map((o) => o.offerId));
  });
});

// ── Money and expiry ────────────────────────────────────────────────────────

describe("a fare that moved between being shown and being charged", () => {
  it("is a change however small, and in either direction", () => {
    expect(priceChanged(money(48000, "USD"), money(48000, "USD"))).toBe(false);
    expect(priceChanged(money(48000, "USD"), money(48001, "USD"))).toBe(true);
    expect(priceChanged(money(48000, "USD"), money(47000, "USD"))).toBe(true);
    // A currency swap is a different price even at the same number.
    expect(priceChanged(money(48000, "USD"), money(48000, "EUR"))).toBe(true);
  });

  it("multiplies for passengers in the offer's own currency", () => {
    expect(totalFor(offer(), 3)).toEqual({ amount: 144000, currency: "USD" });
    expect(totalFor(offer(), 0)).toEqual({ amount: 48000, currency: "USD" });
  });

  it("lapses, and the check is the shared one", () => {
    expect(isFresh(inMinutes(1), NOW)).toBe(true);
    expect(isFresh(inMinutes(-1), NOW)).toBe(false);
    expect(isFresh("not a date", NOW)).toBe(false);
  });
});

// ── What this module is not allowed to be ───────────────────────────────────

describe("the rules this module holds", () => {
  it("names no supplier and holds no URL", () => {
    expect(core.match(/https?:\/\//g)).toBeNull();
    for (const supplier of ["duffel", "amadeus", "sabre", "travelport", "kiwi"]) {
      expect(core.toLowerCase(), supplier).not.toContain(supplier);
    }
  });

  it("reuses the shared booking primitives rather than copying them", () => {
    expect(core).toContain('from "./booking.ts"');
    // A second Money or a second confirmation rule would be one rule and one
    // bug waiting for somebody to fix only the other.
    expect(core).not.toContain("export function isExplicitConfirmation");
    expect(core).not.toMatch(/export interface Money\b/);
  });

  it("is pure — no Deno, no fetch, no database client", () => {
    expect(core).not.toMatch(/\bDeno\./);
    expect(core).not.toMatch(/\bfetch\(/);
    expect(core).not.toContain("createClient");
  });
});

// ── The supplier seam ───────────────────────────────────────────────────────
//
// Every assertion below is about one thing: that a supplier nobody has read the
// documentation for, signed a contract with, or set a key for cannot be called,
// and cannot be made callable by accident. A traveller told a seat is held when
// nothing was sent anywhere arrives at an airport without a ticket.

describe("what a supplier is allowed to claim", () => {
  it("registers every seeded supplier and nothing else", () => {
    expect(Object.keys(SUPPLIER_CAPABILITIES).sort()).toEqual(
      ["amadeus", "duffel", "kiwi", "sabre", "travelfusion", "travelport"],
    );
    for (const [slug, cap] of Object.entries(SUPPLIER_CAPABILITIES)) {
      expect(cap.slug, slug).toBe(slug);
    }
  });

  it("claims no API anybody has read", () => {
    for (const cap of Object.values(SUPPLIER_CAPABILITIES)) {
      expect(cap.status, cap.slug).toBe("not_researched");
      expect(cap.lastVerified, cap.slug).toBeNull();
      for (const action of ["search", "book", "ticket", "hold", "cancel", "refund", "reprice", "seatSelection"] as const) {
        expect(cap[action], `${cap.slug}.${action}`).toBe(false);
      }
    }
  });

  it("still says what it would take to switch each one on", () => {
    for (const cap of Object.values(SUPPLIER_CAPABILITIES)) {
      expect(cap.accreditationRequired, cap.slug).toBe(true);
      expect(cap.approvalSteps.length, cap.slug).toBeGreaterThan(0);
      expect(cap.requiredSecrets.length, cap.slug).toBeGreaterThan(0);
    }
  });

  it("never carries a secret value, only a name", () => {
    for (const cap of Object.values(SUPPLIER_CAPABILITIES)) {
      for (const name of cap.requiredSecrets) {
        expect(name, cap.slug).toMatch(/^[A-Z][A-Z0-9_]+$/);
      }
    }
  });

  it("gives every pending supplier no methods at all", () => {
    for (const supplier of Object.values(SUPPLIERS)) {
      for (const method of ["search", "reprice", "book", "ticket", "cancel", "getBooking"] as const) {
        expect(supplier[method], `${supplier.capability.slug}.${method}`).toBeUndefined();
      }
      // A status it has never seen maps to nothing rather than to a guess.
      expect(supplier.mapStatus("CONFIRMED")).toBeNull();
    }
  });

  it("is frozen, so nothing can switch a supplier on at runtime", () => {
    expect(Object.isFrozen(SUPPLIER_CAPABILITIES)).toBe(true);
    expect(Object.isFrozen(SUPPLIERS)).toBe(true);
  });

  it("answers for a slug that is not there", () => {
    expect(supplierBySlug("duffel")).not.toBeNull();
    expect(supplierBySlug("not-a-supplier")).toBeNull();
    expect(supplierBySlug("")).toBeNull();
  });
});

describe("whether a supplier may be called", () => {
  const usable = (over: Partial<SupplierCapability> = {}): FlightSupplier =>
    pendingSupplier({
      ...SUPPLIER_CAPABILITIES.duffel,
      status: "live",
      search: true,
      accreditationRequired: false,
      requiredSecrets: ["DUFFEL_API_KEY"],
      ...over,
    });

  const keys = { DUFFEL_API_KEY: "present" };

  it("calls one that can do the thing, is live, is cleared, and has its keys", () => {
    expect(isSupplierCallable(usable(), "search", keys)).toBe(true);
  });

  it("refuses one that never said it could do the thing", () => {
    expect(isSupplierCallable(usable(), "book", keys)).toBe(false);
  });

  it("refuses one nobody has read the documentation for", () => {
    expect(isSupplierCallable(usable({ status: "not_researched" }), "search", keys)).toBe(false);
  });

  it("refuses one still waiting on an accreditation, however many keys are set", () => {
    expect(isSupplierCallable(usable({ accreditationRequired: true }), "search", keys)).toBe(false);
  });

  it("refuses one whose secrets are missing or empty", () => {
    expect(isSupplierCallable(usable(), "search", {})).toBe(false);
    expect(isSupplierCallable(usable(), "search", { DUFFEL_API_KEY: "" })).toBe(false);
  });

  it("refuses every seeded supplier today, with every key in the world set", () => {
    const everything = Object.fromEntries(
      Object.values(SUPPLIER_CAPABILITIES).flatMap((c) => c.requiredSecrets.map((n) => [n, "x"])),
    );
    for (const supplier of Object.values(SUPPLIERS)) {
      for (const action of ["search", "reprice", "book", "ticket", "cancel"] as const) {
        expect(isSupplierCallable(supplier, action, everything), `${supplier.capability.slug}.${action}`).toBe(false);
      }
    }
  });

  it("will not let a supplier sell a ticket it cannot issue or re-price", () => {
    const whole = { status: "live" as const, book: true, ticket: true, reprice: true, accreditationRequired: false };
    expect(canSellTickets(usable(whole))).toBe(true);
    // Books but cannot issue: a reservation that quietly lapses.
    expect(canSellTickets(usable({ ...whole, ticket: false }))).toBe(false);
    // Cannot re-price: the fare shown may not be the fare charged.
    expect(canSellTickets(usable({ ...whole, reprice: false }))).toBe(false);
    // Not live yet.
    expect(canSellTickets(usable({ ...whole, status: "sandbox" }))).toBe(false);
    expect(Object.values(SUPPLIERS).some(canSellTickets)).toBe(false);
  });
});

describe("asking several suppliers at once", () => {
  const offerFrom = (slug: string): FlightOffer => ({ ...offer(), supplierSlug: slug, offerId: `${slug}-1` });

  const answering = (slug: string, run: () => Promise<FlightOffer[]>): FlightSupplier => ({
    capability: { ...SUPPLIER_CAPABILITIES.duffel, slug },
    search: run,
    mapStatus: () => null,
  });

  const request: SearchRequest = { search: EMPTY_SEARCH, cabin: "economy", timeoutMs: 50 };

  it("keeps every answer that arrives in time", async () => {
    const { offers, failed } = await gatherOffers(
      [answering("a", async () => [offerFrom("a")]), answering("b", async () => [offerFrom("b")])],
      request,
    );
    expect(offers.map((o) => o.supplierSlug).sort()).toEqual(["a", "b"]);
    expect(failed).toEqual([]);
  });

  it("does not let one slow supplier cost the others their answer", async () => {
    const slow = answering("slow", () => new Promise<FlightOffer[]>(() => {}));
    const started = Date.now();
    const { offers, failed } = await gatherOffers([slow, answering("fast", async () => [offerFrom("fast")])], request);
    expect(offers.map((o) => o.supplierSlug)).toEqual(["fast"]);
    expect(failed).toEqual([{ slug: "slow", code: "SUPPLIER_UNAVAILABLE" }]);
    // Concurrent, not one deadline after another.
    expect(Date.now() - started).toBeLessThan(400);
  });

  it("keeps a supplier's own error code rather than flattening it", async () => {
    const { failed } = await gatherOffers(
      [answering("x", async () => { throw new FlightError("NO_OFFERS_FOUND", { supplierSlug: "x" }); })],
      request,
    );
    expect(failed).toEqual([{ slug: "x", code: "NO_OFFERS_FOUND" }]);
  });

  it("costs no network call for a supplier that has no search at all", async () => {
    const { offers, failed } = await gatherOffers(Object.values(SUPPLIERS), request);
    expect(offers).toEqual([]);
    expect(failed).toHaveLength(Object.keys(SUPPLIERS).length);
    for (const one of failed) expect(one.code).toBe("SUPPLIER_REQUIRES_ACCREDITATION");
  });

  it("returns an empty answer rather than throwing when asked nobody", async () => {
    await expect(gatherOffers([], request)).resolves.toEqual({ offers: [], failed: [] });
  });
});

describe("the rules the supplier seam holds", () => {
  it("holds no endpoint, path or request shape", () => {
    expect(seam.match(/https?:\/\//g)).toBeNull();
    expect(seam).not.toMatch(/["'`]\/v\d/);
    expect(seam).not.toMatch(/\bfetch\(/);
    expect(seam).not.toMatch(/\bDeno\./);
  });

  it("holds no credential value", () => {
    expect(seam).not.toMatch(/(api[_-]?key|client[_-]?secret|password|token)\s*[:=]\s*["'][^"']+["']/i);
  });

  it("reuses the shared concurrent gather rather than writing a second one", () => {
    expect(seam).toContain('from "./booking.ts"');
    expect(seam).not.toContain("setTimeout");
  });
});

// ── The migration ───────────────────────────────────────────────────────────
//
// Executed twice under PGlite before it was committed, because `db push` must
// not be the first thing that parses a migration. What is asserted here is the
// part a re-run cannot prove: that the shape somebody edits next week is still
// the shape that was reasoned about.

describe("what the database allows", () => {
  it("turns row-level security on for every table it creates", () => {
    const tables = [...migration.matchAll(/CREATE TABLE IF NOT EXISTS public\.(flight_\w+)/g)].map((m) => m[1]);
    expect(tables.length).toBe(7);
    for (const table of tables) {
      expect(migration, table).toMatch(
        new RegExp(`ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY`),
      );
    }
  });

  it("gives travel documents no policy at all, so only the service role sees them", () => {
    // A passport number, a date of birth and a nationality on one row. There is
    // no query a browser should be able to run against that table, so there is
    // no policy — RLS on with none is a closed door, not an oversight.
    expect(migration).toMatch(/ALTER TABLE public\.flight_passengers\s+ENABLE ROW LEVEL SECURITY/);
    expect(migration).not.toMatch(/CREATE POLICY[\s\S]{0,200}ON public\.flight_passengers/);
    expect(migration).not.toMatch(/CREATE POLICY[\s\S]{0,200}ON public\.flight_webhook_events/);
  });

  it("lets a traveller read their own bookings and write none of them", () => {
    for (const table of ["flight_searches", "flight_offers", "flight_bookings", "flight_booking_events"]) {
      expect(migration, table).toMatch(new RegExp(`CREATE POLICY ${table}_own_read`));
      // A status is the supplier's word. A client that could set it could mark
      // an unpaid booking ticketed.
      expect(migration, table).not.toMatch(
        new RegExp(`ON public\\.${table} FOR (INSERT|UPDATE|DELETE|ALL)`),
      );
    }
  });

  it("wraps auth.uid() so the planner evaluates it once per query", () => {
    expect(migration).toMatch(/\(SELECT auth\.uid\(\)\)/);
    expect(migration).not.toMatch(/=\s*auth\.uid\(\)/);
  });

  it("makes a retry unable to buy a second ticket", () => {
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS flight_bookings_idempotency_idx/);
    // And a supplier that delivers the same webhook twice changes nothing.
    expect(migration).toMatch(/UNIQUE \(supplier_slug, supplier_event_id\)/);
  });

  it("seeds every supplier switched off, and cannot seed one switched on", () => {
    expect(migration).toMatch(/enabled\s+boolean NOT NULL DEFAULT FALSE/);
    const seed = migration.slice(migration.indexOf("INSERT INTO public.flight_suppliers"));
    // `enabled` is absent from the column list, so a seventh supplier added
    // here cannot arrive live through a typo.
    expect(seed.slice(0, seed.indexOf("VALUES"))).not.toContain("enabled");
    expect(seed).not.toContain("'live'");
    for (const slug of Object.keys(SUPPLIER_CAPABILITIES)) {
      expect(seed, slug).toContain(`'${slug}'`);
    }
  });

  it("shows a client only what a supplier is, never how to reach one", () => {
    const view = migration.slice(
      migration.indexOf("CREATE OR REPLACE VIEW public.flight_suppliers_public"),
      migration.indexOf("GRANT SELECT ON public.flight_suppliers_public"),
    );
    expect(view).toContain("WHERE enabled = TRUE");
    for (const column of ["credential", "secret", "api_key", "config", "notes"]) {
      expect(view, column).not.toContain(column);
    }
  });

  it("stores every status the code can produce", () => {
    for (const status of FLIGHT_STATUSES) expect(migration, status).toContain(`'${status}'`);
  });
});
