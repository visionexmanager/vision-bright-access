// What somebody meant, and what the one backend promises.
//
// The parser is pure, so every sentence below is a real test rather than a
// mock. The function is driven by reading it: what matters about a booking
// route that cannot yet book is *that it refuses*, and that is a property of
// the source, not of a running server.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  looksLikeRideRequest,
  parseAccessibility,
  parseFlightNumber,
  parseMobilityIntent,
  parseOptimization,
  parsePassengerCount,
  parseProviderPreference,
  parseWhen,
  toUtcInstant,
} from "../../supabase/functions/_shared/mobilityIntent.ts";
import { missingFromIntent } from "../../supabase/functions/_shared/mobility.ts";

const fn = readFileSync("supabase/functions/mobility/index.ts", "utf8");

// ── Is this about a ride ────────────────────────────────────────────────────

describe("whether a message is asking for a car", () => {
  it("recognises it across the scripts this channel speaks", () => {
    for (const text of [
      "Book me a taxi from Beirut airport to Hamra",
      "I need a ride tomorrow at 8 AM",
      "get me an Uber",
      "احجزلي تاكسي من المطار",
      "بدي تكسي عالحمرا",
      "Мне нужно такси",
      "Bana bir taksi çağır",
      "택시 불러줘",
    ]) {
      expect(looksLikeRideRequest(text), text).toBe(true);
    }
  });

  it("leaves ordinary sentences alone", () => {
    for (const text of [
      "what is the weather like",
      "ما هي اخر الاخبار",
      "show me the news channels",
      "",
      null,
      undefined,
    ]) {
      expect(looksLikeRideRequest(text), String(text)).toBe(false);
    }
  });

  it("refuses prose long enough to be about something else", () => {
    expect(looksLikeRideRequest(`I once took a taxi ${"and then ".repeat(40)}`)).toBe(false);
  });
});

// ── Provider preference ─────────────────────────────────────────────────────

describe("a provider somebody named", () => {
  it("reads the name in either script", () => {
    expect(parseProviderPreference("get me an Uber")).toBe("uber");
    expect(parseProviderPreference("بدي أوبر")).toBe("uber");
    expect(parseProviderPreference("book a Bolt please")).toBe("bolt");
    expect(parseProviderPreference("كريم لو سمحت")).toBe("careem");
  });

  it("is null when they named nobody", () => {
    expect(parseProviderPreference("book me a taxi")).toBeNull();
  });

  it("does not find a provider inside an ordinary word", () => {
    // "grab" the verb, "bolt" the fastener. Whole-word matching is what keeps
    // "grab me a coffee" from becoming a ride request against Grab.
    expect(parseProviderPreference("uberly")).toBeNull();
    expect(parseProviderPreference("thunderbolt")).toBeNull();
  });
});

// ── What to optimise ────────────────────────────────────────────────────────

describe("what the rider asked to optimise", () => {
  it("hears cheapest and fastest", () => {
    expect(parseOptimization("find me the cheapest ride")).toBe("cheapest");
    expect(parseOptimization("أرخص تاكسي")).toBe("cheapest");
    expect(parseOptimization("I need the fastest one")).toBe("fastest");
    expect(parseOptimization("بسرعة")).toBe("fastest");
  });

  it("puts the vehicle before the price when a wheelchair is involved", () => {
    // Somebody who says "cheapest wheelchair taxi" needs the vehicle first:
    // the cheapest car they cannot get into is not an option at all.
    expect(parseOptimization("cheapest wheelchair accessible taxi")).toBe("most_accessible");
    expect(parseOptimization("تاكسي لكرسي متحرك")).toBe("most_accessible");
  });

  it("defaults to best value rather than to a guess", () => {
    expect(parseOptimization("book me a taxi")).toBe("best_value");
  });
});

// ── Passengers ──────────────────────────────────────────────────────────────

describe("how many people", () => {
  it("reads a count in digits or words", () => {
    expect(parsePassengerCount("a taxi for 3 passengers")).toBe(3);
    expect(parsePassengerCount("four people going to the airport")).toBe(4);
    expect(parsePassengerCount("تاكسي لـ 5 أشخاص")).toBe(5);
  });

  it("refuses a number no vehicle can hold", () => {
    expect(parsePassengerCount("40 people")).toBeNull();
    expect(parsePassengerCount("0 passengers")).toBeNull();
  });

  it("is null rather than one when nothing was said", () => {
    // The default belongs to the intent, not to the parser: a parser that
    // returns 1 for silence cannot be distinguished from one that read "1".
    expect(parsePassengerCount("book me a taxi")).toBeNull();
  });
});

// ── Accessibility ───────────────────────────────────────────────────────────

describe("what the rider needs in the car", () => {
  it("hears each need, in either language", () => {
    expect(parseAccessibility("I need a wheelchair accessible vehicle")).toContain("wheelchair");
    expect(parseAccessibility("كرسي متحرك")).toContain("wheelchair");
    expect(parseAccessibility("I am blind and have a guide dog")).toContain("visually_impaired");
    expect(parseAccessibility("two suitcases")).toContain("luggage");
    expect(parseAccessibility("travelling with a child seat")).toContain("child_seat");
  });

  it("collects more than one", () => {
    const needs = parseAccessibility("wheelchair access and luggage space please");
    expect(needs).toContain("wheelchair");
    expect(needs).toContain("luggage");
  });

  it("finds none in an ordinary request", () => {
    expect(parseAccessibility("book me a taxi to Hamra")).toEqual([]);
  });
});

// ── When ────────────────────────────────────────────────────────────────────

describe("when they want it", () => {
  it("treats an unqualified request as now", () => {
    expect(parseWhen("book me a taxi")).toMatchObject({ immediate: true, hour: null, dayOffset: 0 });
    expect(parseWhen("I need a ride right now").immediate).toBe(true);
  });

  it("reads a clock time and a day", () => {
    expect(parseWhen("tomorrow at 8 AM")).toMatchObject({ hour: 8, minute: 0, dayOffset: 1, immediate: false });
    expect(parseWhen("at 6:30 pm")).toMatchObject({ hour: 18, minute: 30, dayOffset: 0 });
    expect(parseWhen("غدا الساعة 7")).toMatchObject({ hour: 7, dayOffset: 1 });
  });

  it("handles the two midnights that catch everybody", () => {
    expect(parseWhen("at 12 am").hour).toBe(0);
    expect(parseWhen("at 12 pm").hour).toBe(12);
  });

  it("refuses a time that is not one", () => {
    expect(parseWhen("at 47").hour).toBeNull();
    expect(parseWhen("at 9:77").hour).toBeNull();
  });
});

describe("a wall-clock time becomes the right instant", () => {
  // 2026-09-12 14:00 UTC is 10:00 in New York (EDT, UTC-4).
  const NOW = Date.parse("2026-09-12T14:00:00Z");

  it("does not bake this machine's zone into somebody else's morning", () => {
    const instant = toUtcInstant({ immediate: false, hour: 8, minute: 0, dayOffset: 1 }, "America/New_York", NOW);
    expect(instant).not.toBeNull();
    // 08:00 the next day in New York is 12:00Z, not 08:00Z.
    expect(instant).toBe("2026-09-13T12:00:00.000Z");
  });

  it("reads the same wall clock differently in a different zone", () => {
    const beirut = toUtcInstant({ immediate: false, hour: 8, minute: 0, dayOffset: 1 }, "Asia/Beirut", NOW);
    const newYork = toUtcInstant({ immediate: false, hour: 8, minute: 0, dayOffset: 1 }, "America/New_York", NOW);
    expect(beirut).not.toBe(newYork);
  });

  it("rolls a time that has already gone to the next day", () => {
    // "at 7" said at 10:00 New York time means tomorrow's seven.
    const instant = toUtcInstant({ immediate: false, hour: 7, minute: 0, dayOffset: 0 }, "America/New_York", NOW);
    expect(Date.parse(instant!)).toBeGreaterThan(NOW);
  });

  it("returns null when no time was said, rather than inventing one", () => {
    expect(toUtcInstant({ immediate: true, hour: null, minute: 0, dayOffset: 0 }, "UTC", NOW)).toBeNull();
  });

  it("survives a zone it does not know", () => {
    expect(() => toUtcInstant({ immediate: false, hour: 8, minute: 0, dayOffset: 0 }, "Mars/Olympus", NOW)).not.toThrow();
  });
});

// ── Flight numbers ──────────────────────────────────────────────────────────

describe("a flight number, for an airport pickup", () => {
  it("reads one when it is there", () => {
    expect(parseFlightNumber("picking up ME 202 from the airport")).toBe("ME202");
    expect(parseFlightNumber("flight BA117")).toBe("BA117");
  });

  it("does not read a time or an acknowledgement as a flight", () => {
    // The shape collides with ordinary words, and a wrong flight number on a
    // scheduled pickup is worse than none — it is what the timing comes from.
    for (const text of ["at 8", "ok 1 moment", "in 20 minutes", "book me a taxi"]) {
      expect(parseFlightNumber(text), text).toBeNull();
    }
  });
});

// ── The whole sentence ──────────────────────────────────────────────────────

describe("one sentence, read once", () => {
  it("reads the example from the specification", () => {
    const intent = parseMobilityIntent(
      "Get me the cheapest Uber tomorrow at 7 from the hotel to the airport",
    );
    expect(intent.providerPreference).toBe("uber");
    expect(intent.optimization).toBe("cheapest");
    // The two it must never invent.
    expect(intent.pickup).toBeNull();
    expect(intent.destination).toBeNull();
    expect(missingFromIntent(intent)).toEqual(["pickup", "destination"]);
  });

  it("never fills in a location from words alone", () => {
    // Resolving "the hotel" is the geocoder's job and it has a cache. A parser
    // that guessed coordinates would be a second source of truth for a place.
    const intent = parseMobilityIntent("taxi from Beirut airport to Hamra");
    expect(intent.pickup).toBeNull();
    expect(intent.destination).toBeNull();
  });

  it("defaults a silent request to one passenger and best value", () => {
    const intent = parseMobilityIntent("book me a taxi");
    expect(intent.passengerCount).toBe(1);
    expect(intent.optimization).toBe("best_value");
    expect(intent.accessibility).toEqual([]);
  });

  it("is empty for an empty message", () => {
    expect(parseMobilityIntent("").providerPreference).toBeNull();
    expect(parseMobilityIntent(null).passengerCount).toBe(1);
  });
});

// ── The one backend ─────────────────────────────────────────────────────────

describe("one function, not nine", () => {
  it("routes every action through a single entry point", () => {
    for (const action of ["providers", "quotes", "book", "status", "cancel"]) {
      expect(fn, action).toContain(`case "${action}":`);
    }
  });

  it("requires a rider for every action", () => {
    expect(fn).toContain('if (!user) return fail("AUTHORIZATION_REQUIRED", 401, cors);');
    // The user's own client, so the row-level policies apply rather than being
    // bypassed by a service-role key.
    expect(fn).toContain("SUPABASE_ANON_KEY");
    expect(fn).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("refuses to book against a provider Visionex is not approved for", () => {
    expect(fn).toContain('fail("PROVIDER_REQUIRES_APPROVAL", 501, cors)');
    expect(fn).toContain('isCallable(provider, "book"');
  });

  it("requires explicit confirmation and an idempotency key before booking", () => {
    expect(fn).toContain("body.confirmed !== true");
    expect(fn).toContain("idempotencyKey");
  });

  it("emits a code and never a provider's own words", () => {
    // Every response body in this function is `{ error: CODE }` or data.
    expect(fn).toContain("const fail = (code: MobilityErrorCode");
    expect(fn).not.toMatch(/error:\s*(e|err|error)\.message/);
    expect(fn).not.toMatch(/JSON\.stringify\(\s*error\s*\)/);
  });

  it("cannot tell a stranger whether a trip id exists", () => {
    // RLS makes "not yours" and "not there" the same row count, and this keeps
    // them the same answer — a 404 that distinguishes them is an id oracle.
    const status = fn.slice(fn.indexOf("async function tripStatus"), fn.indexOf("async function cancelTrip"));
    expect(status).toContain('fail("SERVICE_UNAVAILABLE", 404, cors)');
    expect(status).not.toMatch(/not your trip|forbidden|403/i);
  });

  it("gives every provider its own deadline", () => {
    expect(fn).toContain("PROVIDER_TIMEOUT_MS");
    expect(fn).toContain("timeoutMs: PROVIDER_TIMEOUT_MS");
  });

  it("stores a quote so booking re-reads the price rather than trusting a client", () => {
    expect(fn).toContain('.from("mobility_quotes")');
    expect(fn).toContain("expires_at:");
  });

  it("reads providers from the public view, not the registry table", () => {
    expect(fn).toContain('.from("mobility_providers_public")');
    expect(fn).not.toContain('.from("mobility_providers")');
  });

  it("holds no provider URL at all", () => {
    const urls = fn.match(/https?:\/\/[^\s"'`]+/g) ?? [];
    for (const url of urls) {
      expect(url, url).toMatch(/deno\.land/);
    }
  });
});
