// Visionex Hotels — the supplier seam.
//
// `hotels.ts` knows what a stay is. This knows that there are several companies
// who might sell one, that they are different kinds of company, and that none
// of them can be called until somebody has a contract.
//
// ── The rule this file exists to enforce ────────────────────────────────────
//
// **No adapter may invent an endpoint.** Where a supplier's API has not been
// read from its current official documentation, the row says `not_researched`
// and the adapter has no methods at all. The same rule the mobility and flights
// seams hold, for the same reason: a fabricated integration is worse than a
// missing one, because a missing one is a gap somebody can plan around.
//
// A guest told a room is held when nothing was sent anywhere arrives at a front
// desk at midnight, in a city they do not live in, and is told there is no
// reservation in that name.
//
// ── The capability that is specific to this domain ──────────────────────────
//
// `feeBreakdown`. A hotel quotes a nightly rate, adds tax, and then asks for a
// resort fee at the desk. A supplier that reports one number cannot tell you
// which part of it the guest will be asked for on arrival — so Visionex cannot
// show an honest all-in, and `canSellStays` refuses it. That is not a nicety:
// showing a total that excludes a mandatory fee is the single most common way
// this industry misleads people, and it is trivially avoidable by not doing it.
//
// Pure. No `Deno`, no fetch, no database client.

import { gatherFrom } from "./booking.ts";
import {
  HotelError,
  type HotelGuest,
  type HotelOffer,
  type HotelStatus,
  type StaySearch,
  type StayPrice,
} from "./hotels.ts";

// ── What a supplier is ──────────────────────────────────────────────────────

/**
 * The kind of company, which decides what it can be asked for.
 *
 * A bed bank and a metasearch engine both "have hotels"; only one of them can
 * confirm a reservation, and the words are chosen so nobody can read the second
 * as the first.
 */
export type SupplierKind =
  /** Hotelbeds and the like. Contracted inventory, sold wholesale. */
  | "bed_bank"
  /** Amadeus, Sabre. Hotel content alongside their air business. */
  | "gds"
  /** Expedia, Booking.com. Retail inventory behind one contract. */
  | "aggregator"
  /** One chain's own API. */
  | "chain_direct"
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
  /** Return offers for a stay. */
  search: boolean;
  /** Confirm a reservation. */
  book: boolean;
  cancel: boolean;
  /** Change dates or occupancy without cancelling and rebooking. */
  modify: boolean;
  /**
   * Confirm the rate still exists at the moment of sale.
   *
   * A supplier without it cannot be trusted with a card: the rate it quoted may
   * not be the rate it charges.
   */
  reprice: boolean;
  /**
   * Report what the desk will collect separately from what it takes now.
   *
   * Without it there is no honest all-in, and this is the domain where that
   * matters most. See the header.
   */
  feeBreakdown: boolean;
  /** True until a signed agreement or documented public access says otherwise. */
  contractRequired: boolean;
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
// Every method optional, by design. A supplier that cannot modify a booking
// does not implement `modify`, and the router reads `capability.modify` rather
// than probing for the method — which is what keeps "cannot" a fact about the
// supplier rather than an exception thrown from inside one.

export interface StaySearchRequest {
  search: StaySearch;
  /** ISO 4217, so a supplier that can quote in it does. */
  currency: string;
  /** Abandon this supplier after this many milliseconds and keep the rest. */
  timeoutMs: number;
}

export interface StayBookRequest {
  offer: HotelOffer;
  /** One entry per room, lead guest first within each. */
  guests: readonly HotelGuest[];
  contactEmail: string;
  contactPhone: string;
  /** The same key on a retry must never produce a second reservation. */
  idempotencyKey: string;
}

export interface StayBookResult {
  supplierBookingId: string;
  /** What the property itself calls it — what a guest reads out at the desk. */
  propertyConfirmationCode: string | null;
  status: HotelStatus;
  /** What the supplier says the stay costs now, which is checked against the offer. */
  price: StayPrice;
}

export interface HotelSupplier {
  readonly capability: SupplierCapability;
  search?(request: StaySearchRequest): Promise<HotelOffer[]>;
  /** The price now, for an offer shown a moment ago. */
  reprice?(offerId: string): Promise<HotelOffer>;
  book?(request: StayBookRequest): Promise<StayBookResult>;
  cancel?(supplierBookingId: string): Promise<void>;
  getBooking?(supplierBookingId: string): Promise<StayBookResult>;
  /** Supplier words → Visionex words. Every adapter owns its own vocabulary. */
  mapStatus(supplierStatus: string): HotelStatus | null;
  healthCheck?(): Promise<boolean>;
}

/**
 * What a supplier that cannot do anything yet should be.
 *
 * Every supplier is one of these today, and that is the point: the registry is
 * a real list of honest rows rather than an empty table, and the day a contract
 * lands the adapter gains a method instead of being written from nothing.
 */
export function pendingSupplier(capability: SupplierCapability): HotelSupplier {
  return { capability, mapStatus: () => null };
}

/** Thrown when something asks a supplier for what it has already said it cannot do. */
export const needsContract = (slug: string): HotelError =>
  new HotelError("SUPPLIER_REQUIRES_CONTRACT", { supplierSlug: slug });

// ── The registry ────────────────────────────────────────────────────────────
//
// Compiled-in capability records: what kind of thing each supplier is, and what
// it would take to switch it on. The *enablement* is not here — that is a row
// in `hotel_suppliers`, because it changes without a deploy.
//
// Every `status` below is `not_researched`, every capability false, and every
// `lastVerified` null, for one reason: the session that wrote this file could
// not reach a single supplier's documentation — the egress proxy blocks them as
// it blocked `duffel.com` and `developer.uber.com` — and the instruction that
// matters more than completeness is that nothing may claim an API it has not
// read. `docs/hotels/providers.md` records that as outstanding work.
//
// The `approvalSteps` are the exception, and are stated at the level actually
// known: that these suppliers gate access behind an account and a contract. No
// endpoint, path, scope or request shape appears anywhere in this file.

const capability = (
  over: Partial<SupplierCapability> & { slug: string; name: string; kind: SupplierKind },
): SupplierCapability => ({
  status: "not_researched",
  search: false,
  book: false,
  cancel: false,
  modify: false,
  reprice: false,
  feeBreakdown: false,
  contractRequired: true,
  requiredSecrets: [],
  approvalSteps: [],
  documentationUrl: null,
  lastVerified: null,
  ...over,
});

const CONTRACT_STEPS = [
  "Open a supplier account and agree commercial terms — wholesale inventory is sold under contract, not by signup.",
  "Read the supplier's current official documentation and record the endpoints, scopes and request shapes here.",
  "Confirm the supplier reports desk-collected fees separately; without that there is no honest all-in price.",
  "Exercise search, re-price, booking and cancellation in the supplier's test environment.",
  "Confirm what the contract permits — display, rate parity and cancellation terms — before any production sale.",
] as const;

const SUPPLIERS_IN_ORDER = [
  ["hotelbeds", "Hotelbeds", "bed_bank", ["HOTELBEDS_API_KEY", "HOTELBEDS_SECRET", "HOTELBEDS_ENVIRONMENT"]],
  ["amadeus", "Amadeus", "gds", ["AMADEUS_CLIENT_ID", "AMADEUS_CLIENT_SECRET", "AMADEUS_ENVIRONMENT"]],
  ["sabre", "Sabre", "gds", ["SABRE_CLIENT_ID", "SABRE_CLIENT_SECRET", "SABRE_ENVIRONMENT"]],
  ["expedia", "Expedia", "aggregator", ["EXPEDIA_API_KEY", "EXPEDIA_SHARED_SECRET", "EXPEDIA_ENVIRONMENT"]],
  ["booking", "Booking.com", "aggregator", ["BOOKING_AFFILIATE_ID", "BOOKING_API_KEY", "BOOKING_ENVIRONMENT"]],
  ["travelgate", "TravelgateX", "aggregator", ["TRAVELGATE_API_KEY", "TRAVELGATE_ENVIRONMENT"]],
] as const satisfies ReadonlyArray<readonly [string, string, SupplierKind, readonly string[]]>;

export const SUPPLIER_CAPABILITIES: Readonly<Record<string, SupplierCapability>> = Object.freeze(
  Object.fromEntries(
    SUPPLIERS_IN_ORDER.map(([slug, name, kind, requiredSecrets]) => [
      slug,
      capability({ slug, name, kind, requiredSecrets, approvalSteps: CONTRACT_STEPS }),
    ]),
  ),
);

export const SUPPLIERS: Readonly<Record<string, HotelSupplier>> = Object.freeze(
  Object.fromEntries(
    Object.entries(SUPPLIER_CAPABILITIES).map(([slug, cap]) => [slug, pendingSupplier(cap)]),
  ),
);

export const supplierBySlug = (slug: string): HotelSupplier | null => SUPPLIERS[slug] ?? null;

/**
 * Whether this supplier could be called at all right now.
 *
 * Four things have to be true, in the order they fail in: it has to declare it
 * can do the thing, it must have got past `not_researched`, it must not be
 * waiting on a contract, and its secrets have to be present. A supplier failing
 * any of them is skipped before a request is built, which is why a
 * half-configured supplier costs nothing rather than one timeout per search.
 *
 * `contractRequired` is deliberately not something this function can wave
 * through: it is cleared on the capability record by whoever did the paperwork,
 * and until then the supplier is not callable no matter how many keys are set.
 */
export function isSupplierCallable(
  supplier: HotelSupplier,
  action: "search" | "reprice" | "book" | "cancel" | "modify",
  secrets: Readonly<Record<string, string | undefined>>,
): boolean {
  const cap = supplier.capability;
  if (!cap[action]) return false;
  if (cap.status === "not_researched") return false;
  if (cap.contractRequired) return false;
  return cap.requiredSecrets.every((name) => {
    const value = secrets[name];
    return typeof value === "string" && value.length > 0;
  });
}

/**
 * Selling a stay needs more than being callable.
 *
 * A supplier that cannot re-price cannot be trusted with a card, and one that
 * cannot break out desk-collected fees cannot be shown an honest total. Both
 * are checked here rather than discovered at the payment step — or, worse, by a
 * guest at a checkout desk being handed a bill nobody warned them about.
 */
export const canSellStays = (supplier: HotelSupplier): boolean =>
  supplier.capability.status === "live" &&
  supplier.capability.book &&
  supplier.capability.reprice &&
  supplier.capability.feeBreakdown;

/**
 * Ask every usable supplier at once and keep whoever answers in time.
 *
 * Per-supplier deadlines, not one shared budget — the failure this repository
 * has already been bitten by once, in the AI provider chain, where a single
 * budget let one hanging call starve every fallback behind it. `gatherFrom`
 * carries that rule; this only decides who gets asked.
 *
 * A supplier that declares no `search`, or has no method, contributes
 * `SUPPLIER_REQUIRES_CONTRACT` and costs no network call at all.
 */
export async function gatherOffers(
  suppliers: readonly HotelSupplier[],
  request: StaySearchRequest,
): Promise<{ offers: HotelOffer[]; failed: Array<{ slug: string; code: string }> }> {
  const askable = suppliers.filter((one) => typeof one.search === "function");
  const blocked = suppliers
    .filter((one) => typeof one.search !== "function")
    .map((one) => ({ slug: one.capability.slug, code: "SUPPLIER_REQUIRES_CONTRACT" }));

  const gathered = await gatherFrom<HotelOffer>(
    askable.map((one) => ({
      slug: one.capability.slug,
      run: () => (one.search as NonNullable<HotelSupplier["search"]>)(request),
    })),
    request.timeoutMs,
    (error) => (error instanceof HotelError ? error.code : "SUPPLIER_UNAVAILABLE"),
  );

  return { offers: gathered.results, failed: [...blocked, ...gathered.failed] };
}
