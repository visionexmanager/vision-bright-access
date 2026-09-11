// Visionex Mobility — the core, driven without a provider.
//
// Every decision in `mobility.ts` and the seam in `mobilityProviders.ts` is a
// function over data, which is the whole point: a booking platform whose
// ranking, expiry, state machine and confirmation rules can only be exercised
// against a live provider is a platform nobody can test until after a signature
// — and these are exactly the rules that must not be wrong when money moves.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  EMPTY_INTENT,
  LIVE_STATUSES,
  MOBILITY_ERRORS,
  MOBILITY_STATUSES,
  MobilityError,
  TERMINAL_STATUSES,
  canTransition,
  comparablePrice,
  formatMoney,
  formatPickupTime,
  isExplicitConfirmation,
  isMobilityStatus,
  isUsableLocation,
  missingFromIntent,
  money,
  nextStatus,
  quoteIsFresh,
  rankQuotes,
  sameCurrency,
  type MobilityQuote,
  type MobilityStatus,
} from "../../supabase/functions/_shared/mobility.ts";

import {
  PROVIDERS,
  PROVIDER_CAPABILITIES,
  gatherQuotes,
  isCallable,
  providerBySlug,
  type MobilityProvider,
  type QuoteRequest,
} from "../../supabase/functions/_shared/mobilityProviders.ts";

const migration = readFileSync("supabase/migrations/20261009000000_mobility_core.sql", "utf8");

const NOW = Date.parse("2026-09-12T10:00:00Z");
const inMinutes = (n: number) => new Date(NOW + n * 60_000).toISOString();

const quote = (over: Partial<MobilityQuote> = {}): MobilityQuote => ({
  providerSlug: "alpha",
  providerName: "Alpha",
  productId: "p1",
  productName: "AlphaX",
  vehicleType: "standard",
  price: money(1800, "USD"),
  priceRange: null,
  surgeMultiplier: null,
  etaSeconds: 300,
  durationSeconds: 900,
  distanceMeters: 5000,
  capacity: 4,
  accessibility: [],
  bookingSupported: true,
  deeplink: null,
  expiresAt: inMinutes(5),
  ...over,
});

// ── Money ───────────────────────────────────────────────────────────────────

describe("a fare is minor units and a currency", () => {
  it("never carries a fraction into storage", () => {
    expect(money(1850.4, "usd")).toEqual({ amount: 1850, currency: "USD" });
    expect(money(1850.6, "USD").amount).toBe(1851);
  });

  it("knows two prices are only comparable inside one currency", () => {
    expect(sameCurrency(money(100, "USD"), money(100, "usd"))).toBe(true);
    expect(sameCurrency(money(100, "USD"), money(100, "EUR"))).toBe(false);
  });

  it("sorts on the bottom of a range, not a midpoint nobody quoted", () => {
    const banded = quote({
      price: null,
      priceRange: { min: money(1500, "USD"), max: money(1900, "USD") },
    });
    expect(comparablePrice(banded)).toEqual(money(1500, "USD"));
    expect(comparablePrice(quote({ price: null, priceRange: null }))).toBeNull();
  });

  it("shows a provider's own currency rather than converting it", () => {
    expect(formatMoney(money(1850, "USD"), "en-US")).toContain("18.50");
    expect(formatMoney(money(1720, "EUR"), "de-DE")).toContain("17,20");
    // An unknown currency must not throw on a page somebody is reading.
    expect(formatMoney(money(1000, "ZZZ"), "en")).toContain("ZZZ");
  });
});

// ── Location ────────────────────────────────────────────────────────────────

describe("a location a provider can be sent", () => {
  it("accepts a real pair", () => {
    expect(isUsableLocation({ latitude: 33.888, longitude: 35.495 })).toBe(true);
  });

  it("refuses the null island, which is always a parsing failure", () => {
    expect(isUsableLocation({ latitude: 0, longitude: 0 })).toBe(false);
  });

  it("refuses anything outside the real ranges, or not a number at all", () => {
    for (const bad of [
      { latitude: 91, longitude: 0 },
      { latitude: 0, longitude: 181 },
      { latitude: Number.NaN, longitude: 10 },
      { latitude: "33.8", longitude: 35.4 },
      {},
      null,
      undefined,
      "Beirut",
    ]) {
      expect(isUsableLocation(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

// ── The state machine ───────────────────────────────────────────────────────

describe("a trip moves only where it may", () => {
  it("lets a booking run its ordinary course", () => {
    const course: MobilityStatus[] = [
      "draft", "searching", "quoted", "awaiting_confirmation", "booking",
      "confirmed", "driver_assigned", "driver_arriving", "driver_arrived",
      "in_progress", "completed",
    ];
    for (let i = 0; i < course.length - 1; i += 1) {
      expect(canTransition(course[i], course[i + 1]), `${course[i]} → ${course[i + 1]}`).toBe(true);
    }
  });

  it("makes every terminal status terminal", () => {
    for (const from of TERMINAL_STATUSES) {
      for (const to of MOBILITY_STATUSES) {
        expect(canTransition(from, to), `${from} → ${to}`).toBe(false);
      }
    }
  });

  it("ignores a late webhook rather than lying to the rider", () => {
    // A provider redelivering `driver_assigned` after the ride is over must not
    // tell somebody a car is coming for a trip they already took.
    expect(nextStatus("completed", "driver_assigned")).toBe("completed");
    expect(nextStatus("cancelled", "in_progress")).toBe("cancelled");
    // And a duplicate of the current status is not a transition either.
    expect(nextStatus("in_progress", "in_progress")).toBe("in_progress");
    // What is allowed still moves.
    expect(nextStatus("driver_arrived", "in_progress")).toBe("in_progress");
  });

  it("cannot skip from a search straight to a ride in progress", () => {
    expect(canTransition("searching", "in_progress")).toBe(false);
    expect(canTransition("quoted", "confirmed")).toBe(false);
  });

  it("agrees with the CHECK constraint the database enforces", () => {
    for (const status of MOBILITY_STATUSES) {
      expect(migration, status).toContain(`'${status}'`);
    }
  });

  it("knows which statuses mean money is committed", () => {
    for (const status of LIVE_STATUSES) {
      expect(TERMINAL_STATUSES.has(status), status).toBe(false);
    }
    expect(isMobilityStatus("in_progress")).toBe(true);
    expect(isMobilityStatus("processing")).toBe(false);
  });
});

// ── Errors ──────────────────────────────────────────────────────────────────

describe("what a rider is told", () => {
  it("only tries somebody else when somebody else could help", () => {
    expect(new MobilityError("NO_DRIVERS_AVAILABLE").failover).toBe(true);
    expect(new MobilityError("PROVIDER_UNAVAILABLE").failover).toBe(true);
    // A declined card and an unresolvable address fail the same way everywhere.
    expect(new MobilityError("PAYMENT_REQUIRED").failover).toBe(false);
    expect(new MobilityError("DESTINATION_INVALID").failover).toBe(false);
    expect(new MobilityError("DUPLICATE_BOOKING").failover).toBe(false);
  });

  it("carries a code and a provider, and nothing the provider wrote", () => {
    const error = new MobilityError("BOOKING_FAILED", { providerSlug: "alpha" });
    expect(error.code).toBe("BOOKING_FAILED");
    expect(error.providerSlug).toBe("alpha");
    // The message is the code. A provider's own body quotes the request back,
    // and the request contains an address and a name.
    expect(error.message).toBe("BOOKING_FAILED");
    expect(Object.keys(error)).not.toContain("providerMessage");
  });

  it("is a closed set", () => {
    expect(MOBILITY_ERRORS).toContain("PROVIDER_REQUIRES_APPROVAL");
    expect(new Set(MOBILITY_ERRORS).size).toBe(MOBILITY_ERRORS.length);
  });
});

// ── Ranking ─────────────────────────────────────────────────────────────────

describe("one list, ordered by what the rider asked for", () => {
  const cheapSlow = quote({ providerSlug: "cheap", price: money(1200, "USD"), etaSeconds: 900 });
  const dearFast = quote({ providerSlug: "fast", price: money(2400, "USD"), etaSeconds: 120 });
  const middling = quote({ providerSlug: "mid", price: money(1800, "USD"), etaSeconds: 300 });

  const order = (ranking: Parameters<typeof rankQuotes>[1], extra = {}) =>
    rankQuotes([middling, dearFast, cheapSlow], ranking, { nowMs: NOW, ...extra })
      .map((q) => q.providerSlug);

  it("puts the smallest number first for cheapest", () => {
    expect(order("cheapest")).toEqual(["cheap", "mid", "fast"]);
  });

  it("puts the shortest wait first for fastest", () => {
    expect(order("fastest")).toEqual(["fast", "mid", "cheap"]);
  });

  it("trades a minute against a minor unit for best value, and says so", () => {
    // cheap 1200+15=1215, mid 1800+5=1805, fast 2400+2=2402.
    expect(order("best_value")).toEqual(["cheap", "mid", "fast"]);
  });

  it("puts the most accommodating first for accessibility", () => {
    const wheelchair = quote({ providerSlug: "wav", accessibility: ["wheelchair", "assistance"] });
    const plain = quote({ providerSlug: "plain", accessibility: [] });
    expect(
      rankQuotes([plain, wheelchair], "most_accessible", { nowMs: NOW }).map((q) => q.providerSlug),
    ).toEqual(["wav", "plain"]);
  });

  it("hides nothing — every provider that answered appears", () => {
    const ranked = rankQuotes([middling, dearFast, cheapSlow], "cheapest", { nowMs: NOW });
    expect(ranked).toHaveLength(3);
  });

  it("sinks an expired quote rather than vanishing it", () => {
    const stale = quote({ providerSlug: "stale", price: money(100, "USD"), expiresAt: inMinutes(-1) });
    const ranked = rankQuotes([stale, middling], "cheapest", { nowMs: NOW });
    // Cheapest by price, but last, because it cannot be acted on.
    expect(ranked.map((q) => q.providerSlug)).toEqual(["mid", "stale"]);
    expect(ranked).toHaveLength(2);
  });

  it("does not compare across currencies", () => {
    const euros = quote({ providerSlug: "euro", price: money(900, "EUR") });
    const ranked = rankQuotes([euros, middling], "cheapest", { nowMs: NOW, currency: "USD" });
    // 900 EUR is the smaller number and still does not win: nothing here knows
    // a rate, and a stale rate silently reorders a list somebody is spending from.
    expect(ranked[0].providerSlug).toBe("mid");
  });

  it("honours a provider the rider named without hiding the others", () => {
    const ranked = rankQuotes([cheapSlow, dearFast], "cheapest", {
      nowMs: NOW,
      preferredProvider: "fast",
    });
    expect(ranked.map((q) => q.providerSlug)).toEqual(["fast", "cheap"]);
  });

  it("never mentions commission anywhere in the comparators", () => {
    const source = readFileSync("supabase/functions/_shared/mobility.ts", "utf8");
    const ranking = source.slice(source.indexOf("export function rankQuotes"));
    expect(ranking).not.toMatch(/commission|payout|margin|revenue/i);
  });

  it("is stable between two renders of the same list", () => {
    const twins = [quote({ providerSlug: "b" }), quote({ providerSlug: "a" })];
    expect(rankQuotes(twins, "cheapest", { nowMs: NOW }).map((q) => q.providerSlug))
      .toEqual(rankQuotes(twins, "cheapest", { nowMs: NOW }).map((q) => q.providerSlug));
  });
});

// ── Expiry ──────────────────────────────────────────────────────────────────

describe("a price nobody can be held to", () => {
  it("is fresh until it is not", () => {
    expect(quoteIsFresh(quote({ expiresAt: inMinutes(1) }), NOW)).toBe(true);
    expect(quoteIsFresh(quote({ expiresAt: inMinutes(-1) }), NOW)).toBe(false);
    expect(quoteIsFresh(quote({ expiresAt: "not a date" }), NOW)).toBe(false);
  });

  it("is required by the table, not merely by convention", () => {
    expect(migration).toMatch(/expires_at\s+timestamptz NOT NULL/);
  });
});

// ── Confirmation ────────────────────────────────────────────────────────────

describe("a booking spends money, so it needs a yes", () => {
  it("takes an unambiguous yes, in either language", () => {
    for (const yes of ["yes", "Yes.", "ok", "confirm", "book it", "go ahead", "نعم", "أكيد", "احجز", "تمام"]) {
      expect(isExplicitConfirmation(yes), yes).toBe(true);
    }
  });

  it("refuses a hedge, a question, and everything else", () => {
    for (const no of [
      "maybe", "I think so", "what are the options?", "how much again", "not yet",
      "no", "ربما", "شو الخيارات", "كم السعر",
      "", "   ", null, undefined,
      // A yes buried in a sentence is not a yes to this booking.
      "yes but can you check the other one first",
    ]) {
      expect(isExplicitConfirmation(no), JSON.stringify(no)).toBe(false);
    }
  });
});

// ── Intent ──────────────────────────────────────────────────────────────────

describe("what is still missing", () => {
  it("asks for a pickup before a destination", () => {
    expect(missingFromIntent(EMPTY_INTENT)).toEqual(["pickup", "destination"]);
  });

  it("asks for nothing once both are real", () => {
    expect(missingFromIntent({
      ...EMPTY_INTENT,
      pickup: { latitude: 33.8, longitude: 35.5 },
      destination: { latitude: 33.9, longitude: 35.6 },
    })).toEqual([]);
  });

  it("treats an unusable pair as missing rather than as an address", () => {
    expect(missingFromIntent({
      ...EMPTY_INTENT,
      pickup: { latitude: 0, longitude: 0 },
      destination: { latitude: 33.9, longitude: 35.6 },
    })).toEqual(["pickup"]);
  });

  it("defaults to one passenger and to best value", () => {
    expect(EMPTY_INTENT.passengerCount).toBe(1);
    expect(EMPTY_INTENT.optimization).toBe("best_value");
  });
});

// ── Time zones ──────────────────────────────────────────────────────────────

describe("a scheduled pickup is shown where the rider is standing", () => {
  it("does not turn 08:00 in New York into 08:00 UTC", () => {
    const utc = "2026-09-12T12:00:00Z";
    const newYork = formatPickupTime(utc, "America/New_York", "en-US");
    expect(newYork).toMatch(/8:00\s?AM/i);
    expect(formatPickupTime(utc, "UTC", "en-US")).toMatch(/12:00\s?PM/i);
  });

  it("survives a zone or a locale it does not know", () => {
    expect(formatPickupTime("2026-09-12T12:00:00Z", "Mars/Olympus", "en")).not.toBe("");
    expect(formatPickupTime("not a date", "UTC", "en")).toBe("");
  });
});

// ── The provider seam ───────────────────────────────────────────────────────

describe("no adapter may invent an endpoint", () => {
  it("ships every provider switched off and unproven", () => {
    for (const [slug, cap] of Object.entries(PROVIDER_CAPABILITIES)) {
      expect(cap.slug, slug).toBe(slug);
      expect(cap.book, `${slug}.book`).toBe(false);
      expect(cap.quote, `${slug}.quote`).toBe(false);
      expect(cap.shape, `${slug}.shape`).toBe("none");
    }
  });

  it("records Uber as requiring approval, with the steps to get it", () => {
    const uber = PROVIDER_CAPABILITIES.uber;
    expect(uber.partnerApprovalRequired).toBe(true);
    expect(uber.approvalSteps.length).toBeGreaterThan(0);
    expect(uber.requiredSecrets).toContain("UBER_CLIENT_SECRET");
  });

  it("never names a secret a browser could hold", () => {
    for (const cap of Object.values(PROVIDER_CAPABILITIES)) {
      for (const name of cap.requiredSecrets) {
        expect(name.startsWith("VITE_"), `${cap.slug}: ${name}`).toBe(false);
      }
    }
  });

  it("contains no provider URL that is not a documentation link", () => {
    const source = readFileSync("supabase/functions/_shared/mobilityProviders.ts", "utf8");
    const urls = source.match(/https?:\/\/[^\s"'`]+/g) ?? [];
    for (const url of urls) {
      expect(url, url).toMatch(/developer\.uber\.com\/docs/);
    }
  });

  it("answers an unapproved provider without calling anything", () => {
    const uber = providerBySlug("uber")!;
    expect(uber.getQuotes).toBeUndefined();
    expect(uber.book).toBeUndefined();
    expect(uber.mapStatus("processing")).toBeNull();
    expect(providerBySlug("nobody")).toBeNull();
  });
});

describe("whether a provider can be called at all", () => {
  const callable: MobilityProvider = {
    capability: { ...PROVIDER_CAPABILITIES.uber, shape: "quote_and_book", quote: true, book: true },
    mapStatus: () => null,
  };

  it("needs the capability, a real shape, and its secrets", () => {
    const secrets = {
      UBER_CLIENT_ID: "id",
      UBER_CLIENT_SECRET: "secret",
      UBER_REDIRECT_URI: "https://visionex.app/cb",
      UBER_ENVIRONMENT: "sandbox",
    };
    expect(isCallable(callable, "quote", secrets)).toBe(true);
    // One missing secret is enough to skip it before a request is built.
    expect(isCallable(callable, "quote", { ...secrets, UBER_CLIENT_SECRET: "" })).toBe(false);
    expect(isCallable(callable, "quote", { ...secrets, UBER_CLIENT_SECRET: undefined })).toBe(false);
    // An action it does not claim.
    expect(isCallable(callable, "cancel", secrets)).toBe(false);
    // And a provider still shaped "none" is never called whatever it claims.
    expect(isCallable(PROVIDERS.uber, "quote", secrets)).toBe(false);
  });
});

describe("asking several providers at once", () => {
  const request: QuoteRequest = {
    pickup: { latitude: 33.8, longitude: 35.5 },
    destination: { latitude: 33.9, longitude: 35.6 },
    passengerCount: 1,
    scheduledAt: null,
    accessibility: [],
    timeoutMs: 50,
  };

  const answering = (slug: string, quotes: MobilityQuote[]): MobilityProvider => ({
    capability: { ...PROVIDER_CAPABILITIES.uber, slug, shape: "quote_only", quote: true },
    mapStatus: () => null,
    getQuotes: () => Promise.resolve(quotes),
  });

  it("keeps whoever answered when one provider hangs", async () => {
    const hanging: MobilityProvider = {
      capability: { ...PROVIDER_CAPABILITIES.uber, slug: "slow", shape: "quote_only", quote: true },
      mapStatus: () => null,
      getQuotes: () => new Promise(() => {}),
    };
    const result = await gatherQuotes([answering("alpha", [quote()]), hanging], request);
    expect(result.quotes).toHaveLength(1);
    expect(result.failed).toEqual([{ slug: "slow", code: "PROVIDER_UNAVAILABLE" }]);
  });

  it("keeps whoever answered when one provider throws", async () => {
    const broken: MobilityProvider = {
      capability: { ...PROVIDER_CAPABILITIES.uber, slug: "broken", shape: "quote_only", quote: true },
      mapStatus: () => null,
      getQuotes: () => Promise.reject(new MobilityError("NO_DRIVERS_AVAILABLE", { providerSlug: "broken" })),
    };
    const result = await gatherQuotes([answering("alpha", [quote()]), broken], request);
    expect(result.quotes).toHaveLength(1);
    expect(result.failed).toEqual([{ slug: "broken", code: "NO_DRIVERS_AVAILABLE" }]);
  });

  it("reports a provider that cannot quote without pretending it failed", async () => {
    const result = await gatherQuotes([PROVIDERS.uber], request);
    expect(result.quotes).toEqual([]);
    expect(result.failed).toEqual([{ slug: "uber", code: "PROVIDER_REQUIRES_APPROVAL" }]);
  });

  it("returns an empty answer rather than throwing when nobody can help", async () => {
    const result = await gatherQuotes([], request);
    expect(result).toEqual({ quotes: [], failed: [] });
  });
});

// ── The database's own guarantees ───────────────────────────────────────────

describe("what the schema promises", () => {
  it("puts row-level security on every table it creates", () => {
    const tables = [...migration.matchAll(/CREATE TABLE IF NOT EXISTS public\.(mobility_\w+)/g)]
      .map((match) => match[1]);
    expect(tables.length).toBeGreaterThanOrEqual(8);
    for (const table of tables) {
      expect(migration, table).toContain(`ALTER TABLE public.${table}`);
      expect(migration, `${table} RLS`).toMatch(
        new RegExp(`ALTER TABLE public\\.${table}\\s+ENABLE ROW LEVEL SECURITY`),
      );
    }
  });

  it("gives the token table no policy at all", () => {
    // RLS on, no policy, service-role only. A "users read their own row" policy
    // here would hand a rider an OAuth token, which is not theirs to hold.
    expect(migration).toMatch(/ALTER TABLE public\.mobility_user_connections\s+ENABLE ROW LEVEL SECURITY/);
    expect(migration).not.toMatch(/CREATE POLICY[\s\S]{0,200}ON public\.mobility_user_connections/);
  });

  it("lets a rider read their own trips and never write them", () => {
    expect(migration).toContain("CREATE POLICY mobility_trips_own_read");
    expect(migration).toMatch(/mobility_trips_own_read[\s\S]{0,120}FOR SELECT/);
    expect(migration).not.toMatch(/ON public\.mobility_trips FOR (INSERT|UPDATE|ALL)/);
  });

  it("evaluates auth.uid() once rather than per row", () => {
    const policies = migration.match(/auth\.uid\(\)/g) ?? [];
    expect(policies.length).toBeGreaterThan(0);
    expect(migration).not.toMatch(/=\s*auth\.uid\(\)/);
    expect(migration).toMatch(/\(SELECT auth\.uid\(\)\)/);
  });

  it("stops one confirmed intent from becoming two rides", () => {
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS mobility_trips_idempotency_idx/);
  });

  it("makes a redelivered provider event a no-op", () => {
    expect(migration).toMatch(/UNIQUE \(provider_slug, provider_event_id\)/);
  });

  it("seeds every provider disabled", () => {
    expect(migration).toMatch(/enabled\s+boolean NOT NULL DEFAULT FALSE/);
    // The seed does not name `enabled` at all, so every row takes the FALSE
    // default. That is stronger than writing FALSE twelve times: a thirteenth
    // provider added to this list cannot arrive switched on by a typo.
    const seed = migration.slice(migration.indexOf("INSERT INTO public.mobility_providers"));
    const columns = seed.slice(seed.indexOf("("), seed.indexOf(")"));
    expect(columns).not.toContain("enabled");
    expect(columns).toContain("integration_status");
  });

  it("keeps commercial detail out of the view a browser reads", () => {
    const view = migration.slice(
      migration.indexOf("CREATE OR REPLACE VIEW public.mobility_providers_public"),
      migration.indexOf("GRANT SELECT ON public.mobility_providers_public"),
    );
    for (const hidden of ["approval_notes", "documentation_url", "last_verified_at", "enabled"]) {
      expect(view.includes(`${hidden},`) || view.includes(`${hidden}\n`), hidden).toBe(false);
    }
  });
});
