// Visionex Hotels — the core, driven without a supplier.
//
// Two sections carry the weight, and they are the two places a hotel booking
// goes wrong in ways nobody notices until somebody is standing in a lobby.
//
// **Nights.** A night is a calendar date, not a duration. Every test that
// crosses a daylight-saving change is here to prove that computing nights from
// instants — which is what every other date in this codebase does — is the
// wrong answer for this one.
//
// **The all-in price.** A rate of £90 with a £30 resort fee is dearer than one
// of £110 with none. A comparator that does not know this puts the trap first
// on every search, forever, and looks completely reasonable in review.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ADULTS_PER_ROOM_MAX,
  BOARD_BASIS,
  EMPTY_SEARCH,
  GUEST_FIELDS,
  HOTEL_COMMITTED,
  HOTEL_ERRORS,
  HOTEL_STATUSES,
  HOTEL_TERMINAL,
  HotelError,
  MAX_NIGHTS,
  addDays,
  ageAtCheckIn,
  allIn,
  atProperty,
  canTransitionHotel,
  cancelsFree,
  distanceKm,
  freeUntil,
  guestName,
  guestsIn,
  isBookableStay,
  isCalendarDate,
  isFresh,
  isHotelStatus,
  isUsableOccupancy,
  missingFromSearch,
  missingGuestFields,
  money,
  nextHotelStatus,
  nightsBetween,
  penaltyNow,
  perNight,
  prepaid,
  priceIsCoherent,
  priceMoved,
  rankOffers,
  searchSize,
  todayIn,
  type CancellationPolicy,
  type HotelOffer,
  type HotelStatus,
  type StayPrice,
} from "../../supabase/functions/_shared/hotels.ts";

import {
  SUPPLIERS,
  SUPPLIER_CAPABILITIES,
  canSellStays,
  gatherOffers,
  isSupplierCallable,
  pendingSupplier,
  supplierBySlug,
  type HotelSupplier,
  type StaySearchRequest,
  type SupplierCapability,
} from "../../supabase/functions/_shared/hotelsProviders.ts";

const core = readFileSync("supabase/functions/_shared/hotels.ts", "utf8");
const seam = readFileSync("supabase/functions/_shared/hotelsProviders.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261011000000_hotels_core.sql", "utf8");
// The prose promises this schema has no passport column, so an assertion about
// columns has to read the SQL and not the promise.
const migrationSql = migration.replace(/^\s*--.*$/gm, "");

const NOW = Date.parse("2026-09-12T10:00:00Z");
const inMinutes = (n: number) => new Date(NOW + n * 60_000).toISOString();

const price = (base: number, prepaidTax = 0, deskTax = 0, currency = "GBP"): StayPrice => ({
  base: money(base, currency),
  taxesPrepaid: money(prepaidTax, currency),
  taxesAtProperty: money(deskTax, currency),
});

const offer = (over: Partial<HotelOffer> = {}): HotelOffer => ({
  supplierSlug: "alpha",
  supplierName: "Alpha",
  offerId: "o1",
  property: {
    supplierSlug: "alpha",
    propertyId: "p1",
    name: "The Example",
    timezone: "Europe/London",
    countryCode: "GB",
    city: "London",
    latitude: 51.5074,
    longitude: -0.1278,
    starRating: 4,
    guestRating: 8.4,
    guestReviewCount: 1200,
    checkInFrom: "15:00",
    checkOutBy: "11:00",
    ...(over.property ?? {}),
  },
  roomName: "Double",
  roomCount: 1,
  occupancy: { adults: 2, childAges: [] },
  board: "breakfast",
  price: price(20_000),
  cancellation: { tiers: [], nonRefundable: false },
  roomsRemaining: null,
  expiresAt: inMinutes(30),
  ...over,
});

// ── Nights ──────────────────────────────────────────────────────────────────

describe("a night is a calendar date, not a duration", () => {
  it("counts the dates between check-in and check-out", () => {
    expect(nightsBetween("2026-10-03", "2026-10-06")).toBe(3);
    expect(nightsBetween("2026-10-03", "2026-10-04")).toBe(1);
  });

  it("is the same number across a spring-forward", () => {
    // London loses an hour on 29 March 2026. A stay computed from local
    // midnights as instants is 2 days 23 hours here — three nights that look
    // like two to anything dividing by 86,400,000.
    expect(nightsBetween("2026-03-28", "2026-03-31")).toBe(3);
  });

  it("is the same number across an autumn-back", () => {
    // And 25 hours in a day does not make a four-night week out of a three.
    expect(nightsBetween("2026-10-24", "2026-10-27")).toBe(3);
  });

  it("is the same number in the southern hemisphere, where the shifts reverse", () => {
    expect(nightsBetween("2026-10-03", "2026-10-06")).toBe(3);
    expect(nightsBetween("2026-04-04", "2026-04-07")).toBe(3);
  });

  it("counts a stay over a leap day", () => {
    expect(nightsBetween("2028-02-27", "2028-03-01")).toBe(3);
    expect(nightsBetween("2026-02-27", "2026-03-01")).toBe(2);
  });

  it("counts a stay over a year end", () => {
    expect(nightsBetween("2026-12-30", "2027-01-02")).toBe(3);
  });

  it("refuses a stay of no nights", () => {
    // Not a cheap stay. A mistake.
    expect(nightsBetween("2026-10-03", "2026-10-03")).toBeNull();
    expect(nightsBetween("2026-10-06", "2026-10-03")).toBeNull();
  });

  it("refuses what is not a date", () => {
    expect(nightsBetween("next tuesday", "2026-10-06")).toBeNull();
    expect(nightsBetween("2026-10-03", "")).toBeNull();
    expect(nightsBetween("2026-02-30", "2026-03-02")).toBeNull();
    expect(nightsBetween("2026-13-01", "2026-13-04")).toBeNull();
  });
});

describe("what counts as a date", () => {
  it("accepts one and rejects the near-misses", () => {
    expect(isCalendarDate("2026-10-03")).toBe(true);
    expect(isCalendarDate("2026-2-3")).toBe(false);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2026-10-03T00:00:00Z")).toBe(false);
    expect(isCalendarDate(null)).toBe(false);
    expect(isCalendarDate("")).toBe(false);
  });

  it("moves a date forward and back without drifting", () => {
    expect(addDays("2026-10-03", 3)).toBe("2026-10-06");
    expect(addDays("2026-03-28", 3)).toBe("2026-03-31"); // across the shift
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("not a date", 1)).toBeNull();
  });
});

describe("today, where the property is", () => {
  it("is tomorrow in Auckland while it is still today in London", () => {
    const at = Date.parse("2026-09-12T22:00:00Z");
    expect(todayIn("Europe/London", at)).toBe("2026-09-12");
    expect(todayIn("Pacific/Auckland", at)).toBe("2026-09-13");
  });

  it("falls back to UTC for a zone nobody has heard of, rather than throwing", () => {
    expect(todayIn("Mars/Olympus", NOW)).toBe("2026-09-12");
  });
});

describe("whether a stay can be booked at all", () => {
  it("accepts today where the property is", () => {
    expect(isBookableStay("2026-09-12", "2026-09-14", "Europe/London", NOW)).toBe(true);
  });

  it("accepts a date that is already today at the property but yesterday at home", () => {
    // 23:00 in London on the 12th is 08:00 on the 13th in Tokyo. A guest
    // booking a Tokyo hotel for the 13th is booking for today, there.
    const late = Date.parse("2026-09-12T23:00:00Z");
    expect(isBookableStay("2026-09-13", "2026-09-15", "Asia/Tokyo", late)).toBe(true);
  });

  it("refuses a stay that has already begun", () => {
    expect(isBookableStay("2026-09-11", "2026-09-13", "Europe/London", NOW)).toBe(false);
  });

  it("refuses a stay longer than anybody meant to book", () => {
    const out = addDays("2026-09-12", MAX_NIGHTS + 1) as string;
    expect(isBookableStay("2026-09-12", out, "Europe/London", NOW)).toBe(false);
    expect(isBookableStay("2026-09-12", addDays("2026-09-12", MAX_NIGHTS) as string, "Europe/London", NOW)).toBe(true);
  });
});

// ── Who is staying ──────────────────────────────────────────────────────────

describe("a child's age is the age on arrival", () => {
  it("uses check-in, not the day of booking", () => {
    // Booked in September as an eleven-year-old, arrives in December as a
    // twelve-year-old — and a great many properties charge the difference.
    expect(ageAtCheckIn("2014-12-01", "2026-12-02")).toBe(12);
    expect(ageAtCheckIn("2014-12-01", "2026-11-30")).toBe(11);
  });

  it("handles a birthday on the day of arrival", () => {
    expect(ageAtCheckIn("2014-12-01", "2026-12-01")).toBe(12);
  });

  it("refuses what is not a date, and refuses the future", () => {
    expect(ageAtCheckIn("not a date", "2026-12-01")).toBeNull();
    expect(ageAtCheckIn("2030-01-01", "2026-12-01")).toBeNull();
  });
});

describe("an occupancy a supplier could be asked about", () => {
  it("counts heads, adults and children alike", () => {
    expect(guestsIn({ adults: 2, childAges: [4, 9] })).toBe(4);
    expect(guestsIn({ adults: 1, childAges: [] })).toBe(1);
  });

  it("needs at least one adult", () => {
    expect(isUsableOccupancy({ adults: 0, childAges: [8] })).toBe(false);
    expect(isUsableOccupancy({ adults: 1, childAges: [] })).toBe(true);
  });

  it("refuses a coachload in one room", () => {
    expect(isUsableOccupancy({ adults: ADULTS_PER_ROOM_MAX, childAges: [] })).toBe(true);
    expect(isUsableOccupancy({ adults: ADULTS_PER_ROOM_MAX + 1, childAges: [] })).toBe(false);
  });

  it("refuses an age that is not one", () => {
    expect(isUsableOccupancy({ adults: 2, childAges: [-1] })).toBe(false);
    expect(isUsableOccupancy({ adults: 2, childAges: [18] })).toBe(false);
    expect(isUsableOccupancy({ adults: 2, childAges: [4.5] })).toBe(false);
    expect(isUsableOccupancy({ adults: 2, childAges: [0] })).toBe(true);
  });
});

// ── The price ───────────────────────────────────────────────────────────────

describe("what a stay actually costs", () => {
  it("separates what leaves the card from what the desk will ask for", () => {
    const p = price(20_000, 2_400, 3_000);
    expect(prepaid(p)).toEqual(money(22_400, "GBP"));
    expect(atProperty(p)).toEqual(money(3_000, "GBP"));
    expect(allIn(p)).toEqual(money(25_400, "GBP"));
  });

  it("shows a zero desk charge rather than hiding it", () => {
    expect(atProperty(price(20_000, 2_400, 0))).toEqual(money(0, "GBP"));
  });

  it("divides the all-in across the nights, not just the room rate", () => {
    expect(perNight(price(20_000, 2_000, 4_000), 2)).toEqual(money(13_000, "GBP"));
    expect(perNight(price(20_000), null)).toBeNull();
    expect(perNight(price(20_000), 0)).toBeNull();
  });

  it("notices a price whose parts are in different currencies", () => {
    expect(priceIsCoherent(price(20_000, 2_000, 1_000))).toBe(true);
    expect(
      priceIsCoherent({
        base: money(20_000, "GBP"),
        taxesPrepaid: money(2_000, "EUR"),
        taxesAtProperty: money(0, "GBP"),
      }),
    ).toBe(false);
  });
});

describe("a price that moved between being shown and being charged", () => {
  it("reports a rise", () => {
    expect(priceMoved(price(20_000), price(21_000))).toBe(true);
  });

  it("reports a fall, which the guest also did not agree to", () => {
    expect(priceMoved(price(20_000), price(19_000))).toBe(true);
  });

  it("reports a fee moved from the desk onto the card at the same total", () => {
    // Same all-in, different money leaving the account today. A guest who
    // budgeted for £200 now and £30 later is owed the chance to say yes again.
    expect(priceMoved(price(17_000, 0, 3_000), price(20_000, 0, 0))).toBe(true);
  });

  it("reports a currency change", () => {
    expect(priceMoved(price(20_000, 0, 0, "GBP"), price(20_000, 0, 0, "EUR"))).toBe(true);
  });

  it("says nothing moved when nothing moved", () => {
    expect(priceMoved(price(20_000, 2_000, 3_000), price(20_000, 2_000, 3_000))).toBe(false);
  });
});

// ── Cancellation ────────────────────────────────────────────────────────────

describe("what cancelling costs, read in the property's timezone", () => {
  const policy = (tiers: CancellationPolicy["tiers"], nonRefundable = false): CancellationPolicy =>
    ({ tiers, nonRefundable });

  const stay = price(30_000, 0, 0);

  it("costs nothing before the first deadline", () => {
    const p = policy([{ fromLocal: "2026-09-13T18:00", penalty: { kind: "percent", percent: 100 } }]);
    expect(penaltyNow(p, stay, 3, "Europe/London", NOW)).toEqual(money(0, "GBP"));
    expect(cancelsFree(p, stay, 3, "Europe/London", NOW)).toBe(true);
  });

  it("reads the deadline where the hotel is, not where the guest is", () => {
    // 18:00 on the 12th in Tokyo is 09:00 UTC — already past at 10:00 UTC. The
    // same wall clock in London is 17:00 UTC and has not arrived. A guest who
    // reads a Tokyo deadline in their own timezone cancels nine hours late.
    const p = policy([{ fromLocal: "2026-09-12T18:00", penalty: { kind: "percent", percent: 100 } }]);
    expect(penaltyNow(p, stay, 3, "Asia/Tokyo", NOW)).toEqual(money(30_000, "GBP"));
    expect(penaltyNow(p, stay, 3, "Europe/London", NOW)).toEqual(money(0, "GBP"));
  });

  it("takes the last deadline that has passed, not the first", () => {
    const p = policy([
      { fromLocal: "2026-09-01T00:00", penalty: { kind: "percent", percent: 25 } },
      { fromLocal: "2026-09-10T00:00", penalty: { kind: "percent", percent: 50 } },
      { fromLocal: "2026-09-20T00:00", penalty: { kind: "percent", percent: 100 } },
    ]);
    expect(penaltyNow(p, stay, 3, "Europe/London", NOW)).toEqual(money(15_000, "GBP"));
  });

  it("charges a number of nights as a share of the all-in", () => {
    const p = policy([{ fromLocal: "2026-09-01T00:00", penalty: { kind: "nights", nights: 1 } }]);
    expect(penaltyNow(p, price(30_000, 0, 6_000), 3, "Europe/London", NOW)).toEqual(money(12_000, "GBP"));
  });

  it("never charges more nights than the stay has", () => {
    const p = policy([{ fromLocal: "2026-09-01T00:00", penalty: { kind: "nights", nights: 5 } }]);
    expect(penaltyNow(p, stay, 2, "Europe/London", NOW)).toEqual(money(30_000, "GBP"));
  });

  it("charges everything for a non-refundable rate, whatever the tiers say", () => {
    const p = policy([{ fromLocal: "2099-01-01T00:00", penalty: { kind: "none" } }], true);
    expect(penaltyNow(p, stay, 3, "Europe/London", NOW)).toEqual(money(30_000, "GBP"));
    expect(cancelsFree(p, stay, 3, "Europe/London", NOW)).toBe(false);
  });

  it("costs nothing when no policy was stated", () => {
    // A penalty nobody was told about is not a penalty.
    expect(penaltyNow(policy([]), stay, 3, "Europe/London", NOW)).toEqual(money(0, "GBP"));
  });

  it("ignores a deadline it cannot read rather than charging for it", () => {
    const p = policy([{ fromLocal: "whenever", penalty: { kind: "percent", percent: 100 } }]);
    expect(penaltyNow(p, stay, 3, "Europe/London", NOW)).toEqual(money(0, "GBP"));
  });

  it("clamps a percentage that makes no sense", () => {
    expect(
      penaltyNow(policy([{ fromLocal: "2026-09-01T00:00", penalty: { kind: "percent", percent: 250 } }]), stay, 3, "Europe/London", NOW),
    ).toEqual(money(30_000, "GBP"));
  });
});

describe("when free cancellation runs out", () => {
  it("is the earliest deadline that costs something", () => {
    const at = freeUntil(
      {
        tiers: [
          { fromLocal: "2026-09-20T18:00", penalty: { kind: "percent", percent: 100 } },
          { fromLocal: "2026-09-15T18:00", penalty: { kind: "percent", percent: 50 } },
          { fromLocal: "2026-09-10T18:00", penalty: { kind: "none" } },
        ],
        nonRefundable: false,
      },
      "Europe/London",
    );
    expect(at).toBe(Date.parse("2026-09-15T17:00:00Z")); // BST
  });

  it("never applied to a non-refundable rate", () => {
    expect(freeUntil({ tiers: [{ fromLocal: "2026-09-15T18:00", penalty: { kind: "percent", percent: 50 } }], nonRefundable: true }, "Europe/London")).toBeNull();
  });

  it("never ran out when nothing ever costs anything", () => {
    expect(freeUntil({ tiers: [], nonRefundable: false }, "Europe/London")).toBeNull();
  });
});

// ── Distance ────────────────────────────────────────────────────────────────

describe("how far a property is", () => {
  it("measures a short hop", () => {
    const km = distanceKm(
      { latitude: 51.5074, longitude: -0.1278 },
      { latitude: 51.5194, longitude: -0.1270 },
    );
    expect(km).toBeGreaterThan(1.2);
    expect(km).toBeLessThan(1.4);
  });

  it("measures a long one", () => {
    const km = distanceKm(
      { latitude: 51.5074, longitude: -0.1278 },
      { latitude: 35.6762, longitude: 139.6503 },
    );
    expect(km).toBeGreaterThan(9500);
    expect(km).toBeLessThan(9700);
  });

  it("is zero for the same point", () => {
    expect(distanceKm({ latitude: 10, longitude: 20 }, { latitude: 10, longitude: 20 })).toBeCloseTo(0, 6);
  });

  it("refuses to guess when a coordinate is missing", () => {
    // A property with no coordinates must not sort as though it were at the
    // centre of the search.
    expect(distanceKm({ latitude: null, longitude: 20 }, { latitude: 10, longitude: 20 })).toBeNull();
    expect(distanceKm({ latitude: 10, longitude: 20 }, { latitude: 10, longitude: null })).toBeNull();
    expect(distanceKm({ latitude: Number.NaN, longitude: 20 }, { latitude: 10, longitude: 20 })).toBeNull();
  });
});

// ── Ordering ────────────────────────────────────────────────────────────────

describe("one list, ordered by what the guest asked for", () => {
  const context = { nowMs: NOW, nights: 2 };

  it("orders cheapest on the all-in, so a resort fee cannot hide", () => {
    // £90 plus a £30 desk fee is £120. £110 with nothing to pay is £110.
    // A comparator reading the room rate, or what leaves the card today, puts
    // the trap first — and it would look entirely reasonable in review.
    const trap = offer({ offerId: "trap", price: price(9_000, 0, 3_000) });
    const honest = offer({ offerId: "honest", price: price(11_000, 0, 0) });
    expect(rankOffers([trap, honest], "cheapest", context).map((o) => o.offerId)).toEqual(["honest", "trap"]);
  });

  it("orders best rated by the guest score", () => {
    const good = offer({ offerId: "good", property: { ...offer().property, guestRating: 9.1 } });
    const fair = offer({ offerId: "fair", property: { ...offer().property, guestRating: 7.2 } });
    expect(rankOffers([fair, good], "best_rated", context).map((o) => o.offerId)).toEqual(["good", "fair"]);
  });

  it("puts an unrated property last rather than giving it an average", () => {
    const rated = offer({ offerId: "rated", property: { ...offer().property, guestRating: 6.0 } });
    const unrated = offer({ offerId: "unrated", property: { ...offer().property, guestRating: null } });
    expect(rankOffers([unrated, rated], "best_rated", context).map((o) => o.offerId)).toEqual(["rated", "unrated"]);
    expect(rankOffers([unrated, rated], "best_value", context).map((o) => o.offerId)).toEqual(["rated", "unrated"]);
  });

  it("orders nearest by distance from the centre of the search", () => {
    const near = offer({ offerId: "near", property: { ...offer().property, latitude: 51.5080, longitude: -0.1280 } });
    const far = offer({ offerId: "far", property: { ...offer().property, latitude: 51.6000, longitude: -0.1280 } });
    const ranked = rankOffers([far, near], "nearest", { ...context, centre: { latitude: 51.5074, longitude: -0.1278 } });
    expect(ranked.map((o) => o.offerId)).toEqual(["near", "far"]);
  });

  it("puts a property with no coordinates last when ordering by distance", () => {
    const placed = offer({ offerId: "placed" });
    const nowhere = offer({ offerId: "nowhere", property: { ...offer().property, latitude: null, longitude: null } });
    const ranked = rankOffers([nowhere, placed], "nearest", { ...context, centre: { latitude: 51.5074, longitude: -0.1278 } });
    expect(ranked.map((o) => o.offerId)).toEqual(["placed", "nowhere"]);
  });

  it("sinks an expired offer to the bottom of every ranking, and never drops it", () => {
    const live = offer({ offerId: "live", price: price(30_000) });
    const dead = offer({ offerId: "dead", price: price(1_000), expiresAt: inMinutes(-1) });
    for (const ranking of ["cheapest", "best_rated", "nearest", "best_value"] as const) {
      const ranked = rankOffers([dead, live], ranking, { ...context, centre: { latitude: 51.5, longitude: -0.12 } });
      expect(ranked.map((o) => o.offerId), ranking).toEqual(["live", "dead"]);
      expect(ranked, ranking).toHaveLength(2);
    }
  });

  it("does not modify the list it was given", () => {
    const list = [offer({ offerId: "b", price: price(2) }), offer({ offerId: "a", price: price(1) })];
    rankOffers(list, "cheapest", context);
    expect(list.map((o) => o.offerId)).toEqual(["b", "a"]);
  });

  it("returns an empty list for an empty list", () => {
    expect(rankOffers([], "cheapest", context)).toEqual([]);
  });
});

// ── The state machine ───────────────────────────────────────────────────────

describe("a booking moves only where it may", () => {
  it("walks the ordinary path", () => {
    const path: HotelStatus[] = [
      "draft", "searching", "offered", "awaiting_confirmation",
      "pricing", "payment_pending", "confirmed", "checked_in", "completed",
    ];
    for (let i = 0; i + 1 < path.length; i += 1) {
      expect(canTransitionHotel(path[i], path[i + 1]), `${path[i]} → ${path[i + 1]}`).toBe(true);
    }
  });

  it("sends a rate that moved back to be shown again, never charged", () => {
    expect(canTransitionHotel("pricing", "offered")).toBe(true);
    expect(canTransitionHotel("offered", "payment_pending")).toBe(false);
    expect(canTransitionHotel("awaiting_confirmation", "payment_pending")).toBe(false);
  });

  it("tells a no-show from a cancellation", () => {
    // Different money. A vocabulary that cannot tell them apart cannot refund.
    expect(canTransitionHotel("confirmed", "no_show")).toBe(true);
    expect(canTransitionHotel("confirmed", "cancelled")).toBe(true);
    expect(HOTEL_TERMINAL.has("no_show")).toBe(true);
    expect(HOTEL_TERMINAL.has("cancelled")).toBe(true);
  });

  it("lets nothing follow a terminal state", () => {
    for (const status of HOTEL_TERMINAL) {
      for (const to of HOTEL_STATUSES) {
        expect(canTransitionHotel(status, to), `${status} → ${to}`).toBe(false);
      }
    }
  });

  it("treats a late or duplicated webhook as a no-op rather than a resurrection", () => {
    expect(nextHotelStatus("cancelled", "confirmed")).toBe("cancelled");
    expect(nextHotelStatus("completed", "checked_in")).toBe("completed");
    expect(nextHotelStatus("confirmed", "checked_in")).toBe("checked_in");
  });

  it("knows which states mean a room is being held and somebody is owed money", () => {
    expect([...HOTEL_COMMITTED].every(isHotelStatus)).toBe(true);
    expect(HOTEL_COMMITTED.has("offered")).toBe(false);
    expect(HOTEL_COMMITTED.has("confirmed")).toBe(true);
  });

  it("recognises its own statuses and nothing else", () => {
    expect(isHotelStatus("confirmed")).toBe(true);
    expect(isHotelStatus("CONFIRMED")).toBe(false);
    expect(isHotelStatus("booked")).toBe(false);
    expect(isHotelStatus(null)).toBe(false);
  });

  it("gives every status a transition list, so none is unreachable by omission", () => {
    for (const status of HOTEL_STATUSES) {
      expect(() => canTransitionHotel(status, "cancelled"), status).not.toThrow();
    }
  });
});

// ── Errors ──────────────────────────────────────────────────────────────────

describe("what a guest is told", () => {
  it("fails over to another supplier only where that could help", () => {
    expect(new HotelError("NO_AVAILABILITY").failover).toBe(true);
    expect(new HotelError("SUPPLIER_UNAVAILABLE").failover).toBe(true);
    // Asking a second supplier to take a card that was declined is not a plan.
    expect(new HotelError("PAYMENT_FAILED").failover).toBe(false);
    expect(new HotelError("GUEST_DETAILS_INVALID").failover).toBe(false);
    expect(new HotelError("DUPLICATE_BOOKING").failover).toBe(false);
  });

  it("carries the supplier it came from, and survives being thrown", () => {
    const error = new HotelError("NO_AVAILABILITY", { supplierSlug: "alpha" });
    expect(error).toBeInstanceOf(Error);
    expect(error.supplierSlug).toBe("alpha");
    expect(error.message).toBe("NO_AVAILABILITY");
  });

  it("has a distinct code for a cancellation the policy does not allow", () => {
    // Not the same as a cancellation that failed. One is a rule, the other a
    // fault, and a guest is owed the difference.
    expect(HOTEL_ERRORS).toContain("CANCELLATION_NOT_PERMITTED");
    expect(HOTEL_ERRORS).toContain("CANCELLATION_FAILED");
  });
});

// ── Guests ──────────────────────────────────────────────────────────────────

describe("what a property needs about a person", () => {
  it("needs a name and nothing more to hold a room", () => {
    expect([...GUEST_FIELDS]).toEqual(["givenName", "familyName"]);
    expect(missingGuestFields({ givenName: "Layla", familyName: "Haddad" })).toEqual([]);
  });

  it("asks for no travel document at all", () => {
    // A flight needs a passport. A night in a hotel does not, and a field that
    // exists gets filled in.
    for (const word of ["passport", "documentNumber", "nationality", "dateOfBirth"]) {
      expect([...GUEST_FIELDS] as string[], word).not.toContain(word);
    }
    expect(core.toLowerCase()).not.toContain("passportnumber");
  });

  it("names what is missing, in the order somebody would ask", () => {
    expect(missingGuestFields({})).toEqual(["givenName", "familyName"]);
    expect(missingGuestFields({ givenName: "  " })).toEqual(["givenName", "familyName"]);
  });

  it("folds accents rather than dropping the letter", () => {
    expect(guestName("José")).toBe("JOSE");
    expect(guestName("Müller")).toBe("MULLER");
  });

  it("keeps the apostrophe an airline would refuse", () => {
    // A boarding pass will not print it. A folio is perfectly happy with it.
    expect(guestName("O'Brien")).toBe("O'BRIEN");
    expect(guestName("Anne-Marie")).toBe("ANNE-MARIE");
  });

  it("collapses the whitespace somebody pasted in", () => {
    expect(guestName("  layla   haddad ")).toBe("LAYLA HADDAD");
  });
});

// ── The search ──────────────────────────────────────────────────────────────

describe("what is still missing", () => {
  it("says all of it when nothing has been given", () => {
    expect(missingFromSearch({ ...EMPTY_SEARCH })).toEqual(["destination", "checkIn", "checkOut"]);
  });

  it("says nothing when a search is complete", () => {
    expect(
      missingFromSearch({
        ...EMPTY_SEARCH,
        destination: "London",
        checkIn: "2026-10-03",
        checkOut: "2026-10-06",
      }),
    ).toEqual([]);
  });

  it("treats a date that is not a date as missing", () => {
    expect(
      missingFromSearch({ ...EMPTY_SEARCH, destination: "London", checkIn: "soon", checkOut: "2026-10-06" }),
    ).toContain("checkIn");
  });

  it("treats an impossible occupancy as missing", () => {
    expect(
      missingFromSearch({
        ...EMPTY_SEARCH,
        destination: "London",
        checkIn: "2026-10-03",
        checkOut: "2026-10-06",
        rooms: [{ adults: 0, childAges: [] }],
      }),
    ).toEqual(["occupancy"]);
    expect(
      missingFromSearch({ ...EMPTY_SEARCH, destination: "L", checkIn: "2026-10-03", checkOut: "2026-10-06", rooms: [] }),
    ).toEqual(["occupancy"]);
  });

  it("counts the rooms and the heads in them", () => {
    expect(
      searchSize({ ...EMPTY_SEARCH, rooms: [{ adults: 2, childAges: [4] }, { adults: 1, childAges: [] }] }),
    ).toEqual({ rooms: 2, guests: 4 });
  });

  it("defaults to two adults in one room, and cannot be mutated into something else", () => {
    expect(EMPTY_SEARCH.rooms).toHaveLength(1);
    expect(EMPTY_SEARCH.rooms[0].adults).toBe(2);
    expect(Object.isFrozen(EMPTY_SEARCH)).toBe(true);
  });
});

describe("a rate that expires", () => {
  it("is live until it is not", () => {
    expect(isFresh(inMinutes(1), NOW)).toBe(true);
    expect(isFresh(inMinutes(-1), NOW)).toBe(false);
    expect(isFresh("not a date", NOW)).toBe(false);
  });
});

describe("the vocabulary", () => {
  it("names the board bases a property actually sells", () => {
    expect([...BOARD_BASIS]).toEqual(["room_only", "breakfast", "half_board", "full_board", "all_inclusive"]);
  });
});

// ── What this module is not allowed to be ───────────────────────────────────

describe("the rules this module holds", () => {
  it("names no supplier and holds no URL", () => {
    expect(core.match(/https?:\/\//g)).toBeNull();
    for (const supplier of ["booking.com", "expedia", "hotelbeds", "agoda", "amadeus"]) {
      expect(core.toLowerCase(), supplier).not.toContain(supplier);
    }
  });

  it("reuses the shared booking primitives rather than copying them", () => {
    expect(core).toContain('from "./booking.ts"');
    expect(core).not.toContain("export function isExplicitConfirmation");
    expect(core).not.toMatch(/export interface Money\b/);
    expect(core).not.toContain("export function localToInstant");
  });

  it("is pure — no Deno, no fetch, no database client", () => {
    expect(core).not.toMatch(/\bDeno\./);
    expect(core).not.toMatch(/\bfetch\(/);
    expect(core).not.toContain("createClient");
  });
});

// ── The supplier seam ───────────────────────────────────────────────────────

describe("what a supplier is allowed to claim", () => {
  it("registers every seeded supplier and nothing else", () => {
    expect(Object.keys(SUPPLIER_CAPABILITIES).sort()).toEqual(
      ["amadeus", "booking", "expedia", "hotelbeds", "sabre", "travelgate"],
    );
    for (const [slug, cap] of Object.entries(SUPPLIER_CAPABILITIES)) {
      expect(cap.slug, slug).toBe(slug);
    }
  });

  it("claims no API anybody has read", () => {
    for (const cap of Object.values(SUPPLIER_CAPABILITIES)) {
      expect(cap.status, cap.slug).toBe("not_researched");
      expect(cap.lastVerified, cap.slug).toBeNull();
      for (const action of ["search", "book", "cancel", "modify", "reprice", "feeBreakdown"] as const) {
        expect(cap[action], `${cap.slug}.${action}`).toBe(false);
      }
    }
  });

  it("still says what it would take to switch each one on", () => {
    for (const cap of Object.values(SUPPLIER_CAPABILITIES)) {
      expect(cap.contractRequired, cap.slug).toBe(true);
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
      for (const method of ["search", "reprice", "book", "cancel", "getBooking"] as const) {
        expect(supplier[method], `${supplier.capability.slug}.${method}`).toBeUndefined();
      }
      expect(supplier.mapStatus("CONFIRMED")).toBeNull();
    }
  });

  it("is frozen, so nothing can switch a supplier on at runtime", () => {
    expect(Object.isFrozen(SUPPLIER_CAPABILITIES)).toBe(true);
    expect(Object.isFrozen(SUPPLIERS)).toBe(true);
  });

  it("answers for a slug that is not there", () => {
    expect(supplierBySlug("hotelbeds")).not.toBeNull();
    expect(supplierBySlug("not-a-supplier")).toBeNull();
    expect(supplierBySlug("")).toBeNull();
  });
});

describe("whether a supplier may be called", () => {
  const usable = (over: Partial<SupplierCapability> = {}): HotelSupplier =>
    pendingSupplier({
      ...SUPPLIER_CAPABILITIES.hotelbeds,
      status: "live",
      search: true,
      contractRequired: false,
      requiredSecrets: ["HOTELBEDS_API_KEY"],
      ...over,
    });

  const keys = { HOTELBEDS_API_KEY: "present" };

  it("calls one that can do the thing, is live, is contracted, and has its keys", () => {
    expect(isSupplierCallable(usable(), "search", keys)).toBe(true);
  });

  it("refuses one that never said it could do the thing", () => {
    expect(isSupplierCallable(usable(), "book", keys)).toBe(false);
  });

  it("refuses one nobody has read the documentation for", () => {
    expect(isSupplierCallable(usable({ status: "not_researched" }), "search", keys)).toBe(false);
  });

  it("refuses one still waiting on a contract, however many keys are set", () => {
    expect(isSupplierCallable(usable({ contractRequired: true }), "search", keys)).toBe(false);
  });

  it("refuses one whose secrets are missing or empty", () => {
    expect(isSupplierCallable(usable(), "search", {})).toBe(false);
    expect(isSupplierCallable(usable(), "search", { HOTELBEDS_API_KEY: "" })).toBe(false);
  });

  it("refuses every seeded supplier today, with every key in the world set", () => {
    const everything = Object.fromEntries(
      Object.values(SUPPLIER_CAPABILITIES).flatMap((c) => c.requiredSecrets.map((n) => [n, "x"])),
    );
    for (const supplier of Object.values(SUPPLIERS)) {
      for (const action of ["search", "reprice", "book", "cancel", "modify"] as const) {
        expect(isSupplierCallable(supplier, action, everything), `${supplier.capability.slug}.${action}`).toBe(false);
      }
    }
  });

  it("will not let a supplier sell a stay whose fees it cannot break out", () => {
    const whole = { status: "live" as const, book: true, reprice: true, feeBreakdown: true, contractRequired: false };
    expect(canSellStays(usable(whole))).toBe(true);
    // One number, so nobody can be told what the desk will ask for. This is the
    // industry's most common way of misleading people and it is avoidable by
    // refusing to sell through a supplier that cannot answer the question.
    expect(canSellStays(usable({ ...whole, feeBreakdown: false }))).toBe(false);
    // Cannot re-price: the rate shown may not be the rate charged.
    expect(canSellStays(usable({ ...whole, reprice: false }))).toBe(false);
    expect(canSellStays(usable({ ...whole, status: "sandbox" }))).toBe(false);
    expect(Object.values(SUPPLIERS).some(canSellStays)).toBe(false);
  });
});

describe("asking several suppliers at once", () => {
  const offerFrom = (slug: string): HotelOffer => ({ ...offer(), supplierSlug: slug, offerId: `${slug}-1` });

  const answering = (slug: string, run: () => Promise<HotelOffer[]>): HotelSupplier => ({
    capability: { ...SUPPLIER_CAPABILITIES.hotelbeds, slug },
    search: run,
    mapStatus: () => null,
  });

  const request: StaySearchRequest = { search: EMPTY_SEARCH, currency: "GBP", timeoutMs: 50 };

  it("keeps every answer that arrives in time", async () => {
    const { offers, failed } = await gatherOffers(
      [answering("a", async () => [offerFrom("a")]), answering("b", async () => [offerFrom("b")])],
      request,
    );
    expect(offers.map((o) => o.supplierSlug).sort()).toEqual(["a", "b"]);
    expect(failed).toEqual([]);
  });

  it("does not let one slow supplier cost the others their answer", async () => {
    const slow = answering("slow", () => new Promise<HotelOffer[]>(() => {}));
    const started = Date.now();
    const { offers, failed } = await gatherOffers([slow, answering("fast", async () => [offerFrom("fast")])], request);
    expect(offers.map((o) => o.supplierSlug)).toEqual(["fast"]);
    expect(failed).toEqual([{ slug: "slow", code: "SUPPLIER_UNAVAILABLE" }]);
    expect(Date.now() - started).toBeLessThan(400);
  });

  it("keeps a supplier's own error code rather than flattening it", async () => {
    const { failed } = await gatherOffers(
      [answering("x", async () => { throw new HotelError("NO_AVAILABILITY", { supplierSlug: "x" }); })],
      request,
    );
    expect(failed).toEqual([{ slug: "x", code: "NO_AVAILABILITY" }]);
  });

  it("costs no network call for a supplier that has no search at all", async () => {
    const { offers, failed } = await gatherOffers(Object.values(SUPPLIERS), request);
    expect(offers).toEqual([]);
    expect(failed).toHaveLength(Object.keys(SUPPLIERS).length);
    for (const one of failed) expect(one.code).toBe("SUPPLIER_REQUIRES_CONTRACT");
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
    const tables = [...migration.matchAll(/CREATE TABLE IF NOT EXISTS public\.(hotel_\w+)/g)].map((m) => m[1]);
    expect(tables.length).toBe(7);
    for (const table of tables) {
      expect(migration, table).toMatch(
        new RegExp(`ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY`),
      );
    }
  });

  it("gives the guest list no policy at all, so only the service role sees it", () => {
    // Not a travel document — a hotel needs none. Worse in a different way: a
    // guest list joined to a booking says who was in a named building on a
    // named night.
    expect(migration).toMatch(/ALTER TABLE public\.hotel_guests\s+ENABLE ROW LEVEL SECURITY/);
    expect(migration).not.toMatch(/CREATE POLICY[\s\S]{0,200}ON public\.hotel_guests/);
    expect(migration).not.toMatch(/CREATE POLICY[\s\S]{0,200}ON public\.hotel_webhook_events/);
  });

  it("has no column for a document a hotel does not need", () => {
    for (const column of ["passport", "nationality", "date_of_birth", "document_number"]) {
      expect(migrationSql.toLowerCase(), column).not.toContain(column);
    }
  });

  it("lets a guest read their own bookings and write none of them", () => {
    for (const table of ["hotel_searches", "hotel_offers", "hotel_bookings", "hotel_booking_events"]) {
      expect(migration, table).toMatch(new RegExp(`CREATE POLICY ${table}_own_read`));
      expect(migration, table).not.toMatch(
        new RegExp(`ON public\\.${table} FOR (INSERT|UPDATE|DELETE|ALL)`),
      );
    }
  });

  it("wraps auth.uid() so the planner evaluates it once per query", () => {
    expect(migration).toMatch(/\(SELECT auth\.uid\(\)\)/);
    expect(migration).not.toMatch(/=\s*auth\.uid\(\)/);
  });

  it("stores a night as a date, because a night is a date", () => {
    expect(migration).toMatch(/check_in\s+date NOT NULL/);
    expect(migration).toMatch(/check_out\s+date NOT NULL/);
    // And refuses a stay of no nights at the database, not only in code.
    expect(migration).toMatch(/CHECK \(check_out > check_in\)/);
  });

  it("generates the all-in total rather than trusting a caller to add it up", () => {
    // So that a query ordering by price cannot accidentally order by the room
    // rate and put the property with the hidden desk fee first.
    const generated = migration.match(
      /all_in_amount\s+bigint GENERATED ALWAYS AS\s*\(base_amount \+ taxes_prepaid_amount \+ taxes_at_property_amount\) STORED/g,
    );
    expect(generated).toHaveLength(2); // offers and bookings
  });

  it("makes a retry unable to book a second room", () => {
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS hotel_bookings_idempotency_idx/);
    expect(migration).toMatch(/UNIQUE \(supplier_slug, supplier_event_id\)/);
  });

  it("seeds every supplier switched off, and cannot seed one switched on", () => {
    expect(migration).toMatch(/enabled\s+boolean NOT NULL DEFAULT FALSE/);
    const seed = migration.slice(migration.indexOf("INSERT INTO public.hotel_suppliers"));
    expect(seed.slice(0, seed.indexOf("VALUES"))).not.toContain("enabled");
    expect(seed).not.toContain("'live'");
    for (const slug of Object.keys(SUPPLIER_CAPABILITIES)) {
      expect(seed, slug).toContain(`'${slug}'`);
    }
  });

  it("shows a client only what a supplier is, never how to reach one", () => {
    const view = migration.slice(
      migration.indexOf("CREATE OR REPLACE VIEW public.hotel_suppliers_public"),
      migration.indexOf("GRANT SELECT ON public.hotel_suppliers_public"),
    );
    expect(view).toContain("WHERE enabled = TRUE");
    for (const column of ["credential", "secret", "api_key", "notes", "last_verified"]) {
      expect(view, column).not.toContain(column);
    }
  });

  it("stores every status the code can produce", () => {
    for (const status of HOTEL_STATUSES) expect(migration, status).toContain(`'${status}'`);
  });

  it("stores every board basis the code can produce", () => {
    for (const board of BOARD_BASIS) expect(migration, board).toContain(`'${board}'`);
  });
});
