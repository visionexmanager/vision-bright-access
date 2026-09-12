/**
 * Visionex Travel — the rules a traveller meets before anything is sent.
 *
 * Two things are pinned here and they are different in kind.
 *
 * The first is that the form asks the *cores* rather than answering for itself.
 * Where a rule already exists in `flights.ts` or `hotels.ts` — a date that has
 * passed, thirty-one nights, a child who is nineteen — the test drives the form
 * to the boundary the core defines, so that moving `MAX_NIGHTS` moves this test
 * with it instead of leaving a second stale copy behind.
 *
 * The second is the honest state of the section. Every supplier in all three
 * registries is unresearched today, and the pages promise a person rather than a
 * price because of it. If somebody integrates one, `stage` moves on its own and
 * the assertions below say so in words — they are written to *fail loudly* at
 * that moment rather than to freeze the section in its opening position.
 */

import { describe, expect, it } from "vitest";

import {
  EMPTY_FLIGHT_DRAFT,
  EMPTY_RIDE_DRAFT,
  EMPTY_STAY_DRAFT,
  MAX_RIDERS,
  MAX_ROOMS,
  MAX_TRAVELLERS,
  SERVICE_TYPE,
  flightIssues,
  flightSummary,
  rideIssues,
  rideSummary,
  stayIssues,
  stayNights,
  staySummary,
  type FlightDraft,
  type RideDraft,
  type StayDraft,
} from "@/features/travel/requests";
import {
  TRAVEL_DOMAINS,
  domainReadiness,
  everythingIsConcierge,
  travelReadiness,
} from "@/features/travel/readiness";
import { MAX_NIGHTS } from "../../supabase/functions/_shared/hotels.ts";

/** A fixed "now" so every date assertion means the same thing in every run. */
const NOW = Date.parse("2026-09-12T09:00:00Z");

const flight = (over: Partial<FlightDraft> = {}): FlightDraft => ({
  ...EMPTY_FLIGHT_DRAFT,
  origin: "Beirut",
  destination: "London",
  departDate: "2026-10-03",
  ...over,
});

const stay = (over: Partial<StayDraft> = {}): StayDraft => ({
  ...EMPTY_STAY_DRAFT,
  destination: "Istanbul",
  checkIn: "2026-10-03",
  checkOut: "2026-10-06",
  ...over,
});

const ride = (over: Partial<RideDraft> = {}): RideDraft => ({
  ...EMPTY_RIDE_DRAFT,
  pickup: "Hamra",
  destination: "Beirut Airport",
  ...over,
});

const codes = (issues: ReadonlyArray<{ code: string }>): string[] => issues.map((i) => i.code);

describe("travel — flights", () => {
  it("accepts a filled request", () => {
    expect(flightIssues(flight(), NOW)).toEqual([]);
  });

  it("asks for the three things a search cannot happen without", () => {
    const issues = flightIssues(flight({ origin: "", destination: "", departDate: "" }), NOW);
    expect(codes(issues)).toEqual(["originRequired", "destinationRequired", "departRequired"]);
  });

  it("takes a city name where a supplier would need a code", () => {
    // The desk resolves "Beirut". Refusing it would refuse most travellers.
    expect(flightIssues(flight({ origin: "Beirut", destination: "Paris" }), NOW)).toEqual([]);
  });

  it("still reads a code when one is typed, and shows it to the desk", () => {
    expect(flightSummary(flight({ origin: "bey", destination: "LHR" }))).toContain("From: bey (BEY)");
    expect(flightSummary(flight({ origin: "bey", destination: "LHR" }))).toContain("To: LHR (LHR)");
  });

  it("does not put a bracketed code beside a city name", () => {
    expect(flightSummary(flight())).toContain("From: Beirut");
    expect(flightSummary(flight())).not.toContain("(BEI)");
  });

  it("refuses a journey that ends where it starts", () => {
    expect(codes(flightIssues(flight({ destination: "beirut" }), NOW))).toContain("samePlace");
  });

  it("refuses a departure that has already happened", () => {
    expect(codes(flightIssues(flight({ departDate: "2026-09-01" }), NOW))).toContain("departPast");
  });

  it("allows a departure today, because today is a day somebody flies", () => {
    expect(flightIssues(flight({ departDate: "2026-09-12" }), NOW)).toEqual([]);
  });

  it("refuses a return before the departure and accepts one on the same day", () => {
    expect(codes(flightIssues(flight({ returnDate: "2026-10-01" }), NOW))).toContain("returnBeforeDepart");
    expect(flightIssues(flight({ returnDate: "2026-10-03" }), NOW)).toEqual([]);
  });

  it("gives every infant a lap to sit on", () => {
    expect(codes(flightIssues(flight({ adults: 1, infants: 2 }), NOW))).toContain("infantsPerAdult");
    expect(flightIssues(flight({ adults: 2, infants: 2 }), NOW)).toEqual([]);
  });

  it("sends a party bigger than one booking to the desk as an error, not a booking", () => {
    const party = flight({ adults: MAX_TRAVELLERS, children: 1 });
    expect(codes(flightIssues(party, NOW))).toContain("partyTooLarge");
  });

  it("writes a one-way as a one-way rather than an empty field", () => {
    expect(flightSummary(flight())).toContain("Return: one way");
    expect(flightSummary(flight({ returnDate: "2026-10-20" }))).toContain("Return: 2026-10-20");
  });

  it("counts the party in words a person reads", () => {
    const summary = flightSummary(flight({ adults: 2, children: 1, infants: 1 }));
    expect(summary).toContain("Travellers: 2 adults, 1 child, 1 infant");
  });

  it("keeps the traveller own words verbatim and last", () => {
    const summary = flightSummary(flight({ notes: "  window seat, please  " }));
    expect(summary.endsWith("window seat, please")).toBe(true);
  });
});

describe("travel — stays", () => {
  it("accepts a filled request", () => {
    expect(stayIssues(stay(), NOW)).toEqual([]);
  });

  it("counts nights as calendar dates, which is what a night is", () => {
    expect(stayNights(stay())).toBe(3);
    expect(staySummary(stay())).toContain("(3 nights)");
  });

  it("refuses a check-out that is not after the check-in", () => {
    expect(codes(stayIssues(stay({ checkOut: "2026-10-03" }), NOW))).toContain("checkOutAfterCheckIn");
    expect(codes(stayIssues(stay({ checkOut: "2026-10-01" }), NOW))).toContain("checkOutAfterCheckIn");
  });

  it("stops at the length of stay the core allows, and not one night earlier", () => {
    const atLimit = stay({ checkIn: "2026-10-03", checkOut: "2026-11-02" });
    expect(stayNights(atLimit)).toBe(MAX_NIGHTS);
    expect(stayIssues(atLimit, NOW)).toEqual([]);

    const overLimit = stay({ checkIn: "2026-10-03", checkOut: "2026-11-03" });
    expect(codes(stayIssues(overLimit, NOW))).toContain("tooManyNights");
  });

  it("refuses a check-in that has passed", () => {
    expect(codes(stayIssues(stay({ checkIn: "2026-09-01", checkOut: "2026-09-05" }), NOW))).toContain(
      "checkInPast",
    );
  });

  it("refuses a date that is not a date", () => {
    expect(codes(stayIssues(stay({ checkIn: "03/10/2026" }), NOW))).toContain("checkInInvalid");
  });

  it("spreads the party across the rooms asked for before judging it", () => {
    // Ten adults in one room is refused; the same ten in two rooms is not.
    expect(codes(stayIssues(stay({ adults: 10, rooms: 1 }), NOW))).toContain("tooManyPerRoom");
    expect(stayIssues(stay({ adults: 10, rooms: 2 }), NOW)).toEqual([]);
  });

  it("sends a group booking to a person", () => {
    expect(codes(stayIssues(stay({ rooms: MAX_ROOMS + 1 }), NOW))).toContain("tooManyRooms");
  });

  it("takes a child as an age, and refuses one who is not a child", () => {
    expect(stayIssues(stay({ childAges: [4, 11] }), NOW)).toEqual([]);
    expect(codes(stayIssues(stay({ childAges: [19] }), NOW))).toContain("childAgeRange");
  });

  it("tells the desk each child age, because a property prices by age", () => {
    expect(staySummary(stay({ childAges: [4, 11] }))).toContain("2 children aged 4, 11");
  });

  it("states the cancellation preference either way rather than only when set", () => {
    expect(staySummary(stay())).toContain("Free cancellation only: no");
    expect(staySummary(stay({ freeCancellationOnly: true }))).toContain("Free cancellation only: yes");
  });
});

describe("travel — rides", () => {
  it("accepts a request with nothing but two places", () => {
    expect(rideIssues(ride(), NOW)).toEqual([]);
    expect(rideSummary(ride())).toContain("When: as soon as possible");
  });

  it("refuses a ride to where it starts", () => {
    expect(codes(rideIssues(ride({ destination: "hamra" }), NOW))).toContain("samePlace");
  });

  it("refuses a time with no day attached to it", () => {
    expect(codes(rideIssues(ride({ time: "08:30" }), NOW))).toContain("timeNeedsDate");
    expect(rideIssues(ride({ date: "2026-09-20", time: "08:30" }), NOW)).toEqual([]);
  });

  it("says whose clock a scheduled pick-up is on", () => {
    const summary = rideSummary(ride({ date: "2026-09-20", time: "08:30" }));
    expect(summary).toContain("2026-09-20 08:30 (pick-up local time)");
  });

  it("refuses more riders than a vehicle holds", () => {
    expect(codes(rideIssues(ride({ passengers: MAX_RIDERS + 1 }), NOW))).toContain("tooManyRiders");
  });

  it("carries an access requirement rather than burying it in a note", () => {
    expect(rideSummary(ride({ wheelchairAccessible: true }))).toContain(
      "Wheelchair accessible vehicle: required",
    );
  });
});

describe("travel — what the section honestly is today", () => {
  it("names three domains and answers for each of them", () => {
    expect(TRAVEL_DOMAINS).toEqual(["flights", "stays", "rides"]);
    expect(travelReadiness().map((r) => r.domain)).toEqual(["flights", "stays", "rides"]);
  });

  it("reads a real registry rather than an empty one", () => {
    for (const readiness of travelReadiness()) {
      expect(readiness.suppliers).toBeGreaterThan(0);
    }
  });

  it("sells nothing, because no supplier has been researched", () => {
    // This is the state `docs/flights/providers.md` describes and the reason the
    // pages offer a person. When somebody integrates a supplier this fails, and
    // the fix is to update the page copy — not to relax the assertion.
    for (const domain of TRAVEL_DOMAINS) {
      const readiness = domainReadiness(domain);
      expect(readiness.researched).toBe(0);
      expect(readiness.sellable).toBe(false);
      expect(readiness.stage).toBe("concierge");
    }
    expect(everythingIsConcierge()).toBe(true);
  });

  it("files every request under the queue the travel desk already watches", () => {
    for (const value of Object.values(SERVICE_TYPE)) {
      expect(value.startsWith("Travel Agency — ")).toBe(true);
    }
    expect(new Set(Object.values(SERVICE_TYPE)).size).toBe(3);
  });
});
