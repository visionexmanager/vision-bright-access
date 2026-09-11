// Visionex Flights — the supplier seam.
//
// `flights.ts` knows what a journey is. This knows that there are several
// companies who might sell one, that they can do very different things, and
// that not one of them can be called until somebody has an account, a contract,
// or in most cases an IATA accreditation.
//
// ── The rule this file exists to enforce ────────────────────────────────────
//
// **No adapter may invent an endpoint.** Selling an air ticket is not like
// calling a weather API: a fabricated request against a GDS is at best a 401
// and at worst a malformed booking in a live reservation system. Where a
// supplier's API has not been read from its current official documentation,
// the row here says `not_researched` and the adapter has no methods at all.
//
// That is not caution for its own sake. A traveller who is told a seat is held
// when nothing was sent anywhere arrives at an airport without a ticket, and
// there is no recovery from that at 04:00 in a departures hall.
//
// ── Why a registry rather than a switch ─────────────────────────────────────
//
// Suppliers are switched on and off by row in `flight_suppliers`, per country
// and currency, without a deploy — an accreditation that lapses has to be
// switchable off by somebody who is not shipping a release. What lives in code
// is only the *shape*: what kind of thing each supplier is, and what it would
// take to make it callable.
//
// Pure. No `Deno`, no fetch, no database client.

import { gatherFrom } from "./booking.ts";
import {
  FlightError,
  type CabinClass,
  type FlightOffer,
  type FlightPassenger,
  type FlightSearch,
  type FlightStatus,
} from "./flights.ts";

// ── What a supplier is ──────────────────────────────────────────────────────

/**
 * The kind of company, which decides almost everything else about it.
 *
 * A GDS and a metasearch engine both "have flights"; only one of them can issue
 * a ticket, and the words are chosen so nobody can read the second as the
 * first.
 */
export type SupplierKind =
  /** Amadeus, Sabre, Travelport. Inventory and ticketing, accreditation-bound. */
  | "gds"
  /** Duffel, Kiwi, Travelfusion. One contract, many airlines behind it. */
  | "aggregator"
  /** One airline's own API. */
  | "airline_direct"
  /** Prices, and a link out. Cannot sell anything. */
  | "metasearch";

/**
 * How far an integration has actually got.
 *
 * `not_researched` is the honest default and the only status this session could
 * legitimately assign: the egress proxy blocked every supplier documentation
 * domain, so nothing here has been read first-hand. A row moves off it when a
 * person reads that supplier's current official documentation and records what
 * they found — not when an adapter looks finished.
 */
export type IntegrationStatus =
  | "not_researched"
  | "documented"
  | "sandbox"
  | "certification"
  | "live";

export interface SupplierCapability {
  slug: string;
  name: string;
  kind: SupplierKind;
  status: IntegrationStatus;
  /** Return offers for a search. */
  search: boolean;
  /** Create a booking — a PNR — which is not the same as paying for one. */
  book: boolean;
  /** Issue the ticket. Without this a booking is a reservation that lapses. */
  ticket: boolean;
  /** Hold a fare without paying, where the supplier offers it. */
  hold: boolean;
  cancel: boolean;
  refund: boolean;
  seatSelection: boolean;
  /**
   * Re-price a chosen offer immediately before payment.
   *
   * The single most important capability on this list. An air fare can move
   * between being shown and being charged, and a supplier that cannot confirm
   * the price at the moment of sale is one Visionex must re-quote against
   * before it takes any money.
   */
  reprice: boolean;
  /** True until an agreement or documented public access says otherwise. */
  accreditationRequired: boolean;
  /**
   * What this adapter needs in the environment before it can do anything.
   *
   * Named, never read here. The router checks presence so a supplier with no
   * credentials is skipped before a request is built, and so the names live
   * beside the adapter that wants them instead of in a README.
   */
  requiredSecrets: readonly string[];
  /** What a person must do for this to become usable. Empty when nothing. */
  approvalSteps: readonly string[];
  documentationUrl: string | null;
  /** When a person last read that documentation. Null means never. */
  lastVerified: string | null;
}

// ── The interface every adapter implements ──────────────────────────────────
//
// Every method optional, by design. A supplier that cannot issue a ticket does
// not implement `ticket`, and the router reads `capability.ticket` rather than
// probing for the method — which is what keeps "cannot" a fact about the
// supplier rather than an exception thrown from inside one.

export interface SearchRequest {
  search: FlightSearch;
  cabin: CabinClass;
  /** Abandon this supplier after this many milliseconds and keep the rest. */
  timeoutMs: number;
}

export interface BookRequest {
  offer: FlightOffer;
  passengers: readonly FlightPassenger[];
  /** Contact for the airline, which is not necessarily a passenger. */
  contactEmail: string;
  contactPhone: string;
  /** The same key on a retry must never produce a second booking. */
  idempotencyKey: string;
}

export interface BookResult {
  supplierBookingId: string;
  /** The airline's own six-character locator, where the supplier returns one. */
  recordLocator: string | null;
  status: FlightStatus;
  ticketNumbers: readonly string[];
}

export interface FlightSupplier {
  readonly capability: SupplierCapability;
  search?(request: SearchRequest): Promise<FlightOffer[]>;
  /** The price now, for an offer shown a moment ago. */
  reprice?(offerId: string): Promise<FlightOffer>;
  book?(request: BookRequest): Promise<BookResult>;
  ticket?(supplierBookingId: string): Promise<BookResult>;
  cancel?(supplierBookingId: string): Promise<void>;
  getBooking?(supplierBookingId: string): Promise<BookResult>;
  /** Supplier words → Visionex words. Every adapter owns its own vocabulary. */
  mapStatus(supplierStatus: string): FlightStatus | null;
  healthCheck?(): Promise<boolean>;
}

/**
 * What a supplier that cannot do anything yet should be.
 *
 * Every supplier is one of these today, and that is the point: the registry is
 * a real list of honest rows rather than an empty table, and the day
 * accreditation lands the adapter gains a method instead of being written from
 * nothing.
 */
export function pendingSupplier(capability: SupplierCapability): FlightSupplier {
  return { capability, mapStatus: () => null };
}

/** Thrown when something asks a supplier for what it has already said it cannot do. */
export const needsAccreditation = (slug: string): FlightError =>
  new FlightError("SUPPLIER_REQUIRES_ACCREDITATION", { supplierSlug: slug });

// ── The registry ────────────────────────────────────────────────────────────
//
// Compiled-in capability records: what kind of thing each supplier is, and what
// it would take to switch it on. The *enablement* is not here — that is a row
// in `flight_suppliers`, because it changes without a deploy.
//
// Every `status` below is `not_researched`, every capability false, and every
// `lastVerified` null, for one reason: the session that wrote this file could
// not reach a single supplier's documentation — the egress proxy blocks
// `duffel.com` as it blocks `developer.uber.com` — and the instruction that
// matters more than completeness is that nothing may claim an API it has not
// read. `docs/flights/providers.md` records that as outstanding work rather
// than papering over it.
//
// The `approvalSteps` are the exception, and are stated at the level they are
// actually known: that these suppliers gate access behind an account and, for
// the GDSs, an accreditation. No endpoint, path, scope or request shape appears
// anywhere in this file.

const capability = (
  over: Partial<SupplierCapability> & { slug: string; name: string; kind: SupplierKind },
): SupplierCapability => ({
  status: "not_researched",
  search: false,
  book: false,
  ticket: false,
  hold: false,
  cancel: false,
  refund: false,
  seatSelection: false,
  reprice: false,
  accreditationRequired: true,
  requiredSecrets: [],
  approvalSteps: [],
  documentationUrl: null,
  lastVerified: null,
  ...over,
});

const GDS_STEPS = [
  "Obtain the travel-agency accreditation the supplier requires before it will issue a ticket.",
  "Sign the supplier agreement and have the Visionex application credentialed against it.",
  "Read the supplier's current official documentation and record the endpoints, scopes and request shapes here.",
  "Exercise search, re-price, booking, ticketing and cancellation in the supplier's test environment.",
  "Complete the supplier's certification before any production request.",
] as const;

const AGGREGATOR_STEPS = [
  "Open a supplier account and accept its terms.",
  "Read the supplier's current official documentation and record the endpoints, scopes and request shapes here.",
  "Exercise search, re-price, booking and cancellation in the supplier's test environment.",
  "Confirm what the contract permits before any production sale.",
] as const;

const SUPPLIERS_IN_ORDER = [
  ["duffel", "Duffel", "aggregator", AGGREGATOR_STEPS, ["DUFFEL_API_KEY", "DUFFEL_ENVIRONMENT"]],
  ["amadeus", "Amadeus", "gds", GDS_STEPS, ["AMADEUS_CLIENT_ID", "AMADEUS_CLIENT_SECRET", "AMADEUS_ENVIRONMENT"]],
  ["sabre", "Sabre", "gds", GDS_STEPS, ["SABRE_CLIENT_ID", "SABRE_CLIENT_SECRET", "SABRE_ENVIRONMENT"]],
  ["travelport", "Travelport", "gds", GDS_STEPS, ["TRAVELPORT_CLIENT_ID", "TRAVELPORT_CLIENT_SECRET", "TRAVELPORT_ENVIRONMENT"]],
  ["kiwi", "Kiwi.com", "aggregator", AGGREGATOR_STEPS, ["KIWI_API_KEY", "KIWI_ENVIRONMENT"]],
  ["travelfusion", "Travelfusion", "aggregator", AGGREGATOR_STEPS, ["TRAVELFUSION_LOGIN_ID", "TRAVELFUSION_PASSWORD", "TRAVELFUSION_ENVIRONMENT"]],
] as const satisfies ReadonlyArray<
  readonly [string, string, SupplierKind, readonly string[], readonly string[]]
>;

export const SUPPLIER_CAPABILITIES: Readonly<Record<string, SupplierCapability>> = Object.freeze(
  Object.fromEntries(
    SUPPLIERS_IN_ORDER.map(([slug, name, kind, approvalSteps, requiredSecrets]) => [
      slug,
      capability({ slug, name, kind, approvalSteps, requiredSecrets }),
    ]),
  ),
);

export const SUPPLIERS: Readonly<Record<string, FlightSupplier>> = Object.freeze(
  Object.fromEntries(
    Object.entries(SUPPLIER_CAPABILITIES).map(([slug, cap]) => [slug, pendingSupplier(cap)]),
  ),
);

export const supplierBySlug = (slug: string): FlightSupplier | null => SUPPLIERS[slug] ?? null;

/**
 * Whether this supplier could be called at all right now.
 *
 * Four things have to be true, in the order they fail in: it has to declare it
 * can do the thing, it must have got past `not_researched`, it must not be
 * waiting on an accreditation it has not got, and its secrets have to be
 * present. A supplier failing any of them is skipped before a request is built,
 * which is why a half-configured supplier costs nothing rather than one timeout
 * per search.
 *
 * `accreditationRequired` is deliberately not something this function can wave
 * through: it is cleared on the capability record by whoever did the paperwork,
 * and until then the supplier is not callable no matter how many keys are set.
 */
export function isSupplierCallable(
  supplier: FlightSupplier,
  action: "search" | "reprice" | "book" | "ticket" | "cancel",
  secrets: Readonly<Record<string, string | undefined>>,
): boolean {
  const cap = supplier.capability;
  if (!cap[action]) return false;
  if (cap.status === "not_researched") return false;
  if (cap.accreditationRequired) return false;
  return cap.requiredSecrets.every((name) => {
    const value = secrets[name];
    return typeof value === "string" && value.length > 0;
  });
}

/**
 * Selling a ticket needs more than being callable.
 *
 * A supplier that can search and book but cannot issue the ticket leaves a
 * reservation that quietly lapses, and one that cannot re-price cannot be
 * trusted with a card: the fare it quoted may not be the fare it charges. Both
 * are checked here rather than discovered at the payment step.
 */
export const canSellTickets = (supplier: FlightSupplier): boolean =>
  supplier.capability.status === "live" &&
  supplier.capability.book &&
  supplier.capability.ticket &&
  supplier.capability.reprice;

/**
 * Ask every usable supplier at once and keep whoever answers in time.
 *
 * Per-supplier deadlines, not one shared budget — the failure this repository
 * has already been bitten by once, in the AI provider chain, where a single
 * budget let one hanging call starve every fallback behind it. `gatherFrom`
 * carries that rule; this only decides who gets asked.
 *
 * A supplier that declares no `search`, or has no method, contributes
 * `SUPPLIER_REQUIRES_ACCREDITATION` and costs no network call at all.
 */
export async function gatherOffers(
  suppliers: readonly FlightSupplier[],
  request: SearchRequest,
): Promise<{ offers: FlightOffer[]; failed: Array<{ slug: string; code: string }> }> {
  const askable = suppliers.filter((one) => typeof one.search === "function");
  const blocked = suppliers
    .filter((one) => typeof one.search !== "function")
    .map((one) => ({ slug: one.capability.slug, code: "SUPPLIER_REQUIRES_ACCREDITATION" }));

  const gathered = await gatherFrom<FlightOffer>(
    askable.map((one) => ({
      slug: one.capability.slug,
      run: () => (one.search as NonNullable<FlightSupplier["search"]>)(request),
    })),
    request.timeoutMs,
    (error) => (error instanceof FlightError ? error.code : "SUPPLIER_UNAVAILABLE"),
  );

  return { offers: gathered.results, failed: [...blocked, ...gathered.failed] };
}
