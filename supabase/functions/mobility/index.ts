// Visionex Mobility — one backend, two front doors.
//
// The web page and the WhatsApp assistant call this and nothing else. That is
// §44 of the specification and it is the reason this function exists at all: two
// implementations of "book a ride" would be two sets of providers, two sets of
// quotes, two histories and two places for a booking bug to live.
//
// ── Why one function and not nine ───────────────────────────────────────────
//
// The specification proposes `mobility-search`, `mobility-quotes`,
// `mobility-book`, `mobility-status`, `mobility-cancel`, `mobility-webhook`,
// `mobility-provider-health`, `mobility-oauth-start` and
// `mobility-oauth-callback`. This project deploys 97 Edge Functions and the
// ceiling is 100, past which a deploy fails with a billing error that reads
// like a bundling error. Nine more would break the deploy.
//
// So this is one function with an action router. The actions are the same, the
// shapes are the same, and the project keeps its headroom. MOBILITY_AUDIT.md
// records the departure and why it was made.
//
// ── What it will not do ─────────────────────────────────────────────────────
//
// It will not book a ride against a provider Visionex has not been approved
// for. Every adapter currently declares `shape: "none"`, so `book` answers
// `PROVIDER_REQUIRES_APPROVAL` — honestly, without a network call, and without
// a plausible-looking POST to a URL nobody has read the documentation for.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  MobilityError,
  isUsableLocation,
  quoteIsFresh,
  rankQuotes,
  type MobilityErrorCode,
  type MobilityLocation,
  type MobilityQuote,
  type QuoteRanking,
} from "../_shared/mobility.ts";
import {
  PROVIDERS,
  gatherQuotes,
  isCallable,
  providerBySlug,
  type QuoteRequest,
} from "../_shared/mobilityProviders.ts";

/** Abandon a provider after this and keep whoever answered. */
const PROVIDER_TIMEOUT_MS = 6_000;

/** How long a Visionex-side quote is offered for when a provider gives no TTL. */
const DEFAULT_QUOTE_TTL_MS = 5 * 60_000;

type Json = Record<string, unknown>;

const json = (body: Json, status: number, cors: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/**
 * The only error shape this function emits.
 *
 * A code from the closed set and nothing else. A provider's own message quotes
 * the request back, and for this feature the request is an address and a name.
 */
const fail = (code: MobilityErrorCode, status: number, cors: Record<string, string>): Response =>
  json({ error: code }, status, cors);

/** Read a location off the request body, or refuse it. */
function readLocation(value: unknown): MobilityLocation | null {
  return isUsableLocation(value) ? value : null;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return fail("SERVICE_UNAVAILABLE", 405, cors);

  try {
    // ── Who is asking ───────────────────────────────────────────────────
    //
    // Every action here is about one rider's own trips, so every action needs
    // a rider. The anon key plus the caller's Authorization header is what
    // makes `auth.uid()` real, and it is what makes the row-level policies on
    // `mobility_trips` mean something rather than being decoration around a
    // service-role client.
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const asUser = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return fail("AUTHORIZATION_REQUIRED", 401, cors);

    const body = (await req.json().catch(() => ({}))) as Json;
    const action = typeof body.action === "string" ? body.action : "";

    switch (action) {
      case "providers":
        return await listProviders(asUser, cors);
      case "quotes":
        return await getQuotes(asUser, user.id, body, cors);
      case "book":
        return await book(body, cors);
      case "status":
        return await tripStatus(asUser, body, cors);
      case "cancel":
        return await cancelTrip(asUser, body, cors);
      default:
        return fail("SERVICE_UNAVAILABLE", 400, cors);
    }
  } catch (error) {
    // The code, never the cause. A stack or a provider body reaching a client
    // is how an address ends up in somebody's browser console.
    const code = error instanceof MobilityError ? error.code : "SERVICE_UNAVAILABLE";
    console.error("[mobility] unhandled:", code);
    return fail(code, 500, cors);
  }
});

// ── Actions ─────────────────────────────────────────────────────────────────

/**
 * Which providers are switched on, and what they can do.
 *
 * Read from the public view, which carries no approval notes, no documentation
 * URL and no verification date — those are operations' business and a browser
 * has no use for them.
 */
async function listProviders(
  db: ReturnType<typeof createClient>,
  cors: Record<string, string>,
): Promise<Response> {
  const { data, error } = await db
    .from("mobility_providers_public")
    .select("slug, name, integration_status, quote_supported, booking_supported, deep_link_supported, countries, accessibility_options")
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("[mobility] provider list failed");
    return fail("SERVICE_UNAVAILABLE", 503, cors);
  }
  return json({ providers: data ?? [] }, 200, cors);
}

/**
 * Ask everybody who can answer, and return one ranked list.
 *
 * Concurrent with a deadline each, so one slow provider costs its own answer
 * and nobody else's. A provider that cannot be called at all is skipped before
 * a request is built — which is why an unapproved provider costs nothing here
 * rather than one timeout per search.
 */
async function getQuotes(
  db: ReturnType<typeof createClient>,
  userId: string,
  body: Json,
  cors: Record<string, string>,
): Promise<Response> {
  const pickup = readLocation(body.pickup);
  if (!pickup) return fail("LOCATION_INVALID", 400, cors);
  const destination = readLocation(body.destination);
  if (!destination) return fail("DESTINATION_INVALID", 400, cors);

  const request: QuoteRequest = {
    pickup,
    destination,
    passengerCount: Number.isFinite(body.passengerCount) ? Number(body.passengerCount) : 1,
    scheduledAt: typeof body.scheduledAt === "string" ? body.scheduledAt : null,
    accessibility: Array.isArray(body.accessibility) ? body.accessibility.map(String) : [],
    timeoutMs: PROVIDER_TIMEOUT_MS,
  };

  // Enabled in the database, and callable in code. Both, because the flag says
  // operations want it and the capability says it would actually work.
  const { data: enabled } = await db
    .from("mobility_providers_public")
    .select("slug")
    .eq("quote_supported", true);

  const secrets = Deno.env.toObject();
  const candidates = (enabled ?? [])
    .map((row) => providerBySlug(String(row.slug)))
    .filter((provider): provider is NonNullable<typeof provider> => provider !== null)
    .filter((provider) => isCallable(provider, "quote", secrets));

  const { quotes, failed } = await gatherQuotes(candidates, request);

  const ranking = (typeof body.ranking === "string" ? body.ranking : "best_value") as QuoteRanking;
  const ranked = rankQuotes(quotes, ranking, {
    nowMs: Date.now(),
    currency: typeof body.currency === "string" ? body.currency : null,
    preferredProvider: typeof body.providerPreference === "string" ? body.providerPreference : null,
  });

  // Persisted so `book` can re-read the price it is about to charge against,
  // rather than trusting a figure a client hands back.
  const searchId = crypto.randomUUID();
  if (ranked.length > 0) {
    await db.from("mobility_quotes").insert(ranked.map((quote) => ({
      user_id: userId,
      search_id: searchId,
      provider_slug: quote.providerSlug,
      product_id: quote.productId,
      product_name: quote.productName,
      vehicle_type: quote.vehicleType,
      price_amount: quote.price?.amount ?? null,
      price_currency: quote.price?.currency ?? null,
      eta_s: quote.etaSeconds,
      duration_s: quote.durationSeconds,
      distance_m: quote.distanceMeters,
      capacity: quote.capacity,
      accessibility: quote.accessibility,
      booking_supported: quote.bookingSupported,
      deeplink: quote.deeplink,
      expires_at: quote.expiresAt || new Date(Date.now() + DEFAULT_QUOTE_TTL_MS).toISOString(),
    })));
  }

  return json({ searchId, quotes: ranked, unavailable: failed }, 200, cors);
}

/**
 * Book one.
 *
 * Nothing here is reachable today: every adapter declares `shape: "none"`, so
 * the guard below answers before a provider is touched. The path is written
 * because the guard is the point — a booking route that did not check would be
 * a booking route somebody could accidentally make work against a provider
 * Visionex has no agreement with.
 *
 * When an adapter does become real, three things must be true before this
 * changes: its documentation has been read, its capability record says `book`,
 * and its secrets are set. `isCallable` is all three.
 */
function book(body: Json, cors: Record<string, string>): Promise<Response> {
  const slug = typeof body.providerSlug === "string" ? body.providerSlug : "";
  const provider = providerBySlug(slug);
  if (!provider) return Promise.resolve(fail("PROVIDER_UNAVAILABLE", 400, cors));

  // Confirmation is the caller's to obtain and this function's to require. A
  // request without it is a bug in the caller, not a rider changing their mind.
  if (body.confirmed !== true) {
    return Promise.resolve(fail("BOOKING_FAILED", 400, cors));
  }

  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!idempotencyKey) return Promise.resolve(fail("BOOKING_FAILED", 400, cors));

  if (!isCallable(provider, "book", Deno.env.toObject())) {
    // The honest answer, and the one every provider gives today.
    return Promise.resolve(fail("PROVIDER_REQUIRES_APPROVAL", 501, cors));
  }

  // Unreachable until an adapter is real. Left as a refusal rather than as a
  // half-written call: a booking path that looks finished is how a fabricated
  // integration ships.
  return Promise.resolve(fail("PROVIDER_REQUIRES_APPROVAL", 501, cors));
}

/** Where one trip stands. Read through the rider's own policy, never around it. */
async function tripStatus(
  db: ReturnType<typeof createClient>,
  body: Json,
  cors: Record<string, string>,
): Promise<Response> {
  const tripId = typeof body.tripId === "string" ? body.tripId : "";
  if (!tripId) return fail("SERVICE_UNAVAILABLE", 400, cors);

  const { data, error } = await db
    .from("mobility_trips")
    .select("id, status, provider_slug, pickup, destination, scheduled_at, pickup_timezone, price_amount, price_currency, driver, vehicle, created_at")
    .eq("id", tripId)
    .maybeSingle();

  // RLS means "not yours" and "not there" are the same answer, which is the
  // right answer: a 404 that distinguishes them is a trip-id oracle.
  if (error || !data) return fail("SERVICE_UNAVAILABLE", 404, cors);
  return json({ trip: data }, 200, cors);
}

/** Cancel one, where the provider allows it. */
async function cancelTrip(
  db: ReturnType<typeof createClient>,
  body: Json,
  cors: Record<string, string>,
): Promise<Response> {
  const tripId = typeof body.tripId === "string" ? body.tripId : "";
  if (!tripId) return fail("SERVICE_UNAVAILABLE", 400, cors);

  const { data: trip } = await db
    .from("mobility_trips")
    .select("id, provider_slug, provider_trip_id, status")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return fail("SERVICE_UNAVAILABLE", 404, cors);

  const provider = providerBySlug(String(trip.provider_slug));
  if (!provider || !isCallable(provider, "cancel", Deno.env.toObject())) {
    return fail("CANCELLATION_FAILED", 501, cors);
  }
  return fail("CANCELLATION_FAILED", 501, cors);
}

// Re-exported for the tests, which drive the pure parts directly.
export { PROVIDER_TIMEOUT_MS, DEFAULT_QUOTE_TTL_MS, PROVIDERS, quoteIsFresh };
export type { MobilityQuote };
