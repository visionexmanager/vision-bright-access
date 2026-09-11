// Visionex Mobility — the provider seam.
//
// `mobility.ts` knows what a trip is. This knows that there are several
// companies who might drive one, that they can do different things, and that
// most of them cannot be called at all until somebody signs something.
//
// ── The rule this file exists to enforce ────────────────────────────────────
//
// **No adapter may invent an endpoint.** If a provider's booking API requires
// partner approval, the adapter says so and returns `PROVIDER_REQUIRES_APPROVAL`
// — it does not POST to a URL that looks plausible. A fabricated integration is
// worse than a missing one: a missing one is a gap somebody can plan around,
// and a fabricated one is a rider standing on a pavement waiting for a car that
// was never requested.
//
// So every adapter here declares a `capability` and the router reads it before
// it calls anything. An adapter that declares `quote: false` is never asked for
// a quote, which means the honest answer costs no network call and no timeout.
//
// ── Why a registry rather than a switch ─────────────────────────────────────
//
// Providers are turned on and off by row, per country, without a deploy. A
// `switch (provider)` in the router would put that decision in code, and the
// decision is operational: a provider whose approval lapses has to be
// switchable off on a Sunday by somebody who is not shipping a release.

import {
  MobilityError,
  type MobilityLocation,
  type MobilityQuote,
  type MobilityStatus,
} from "./mobility.ts";

// ── What a provider can actually do ─────────────────────────────────────────

/**
 * The shape of an integration, which is not the same as a list of features.
 *
 * A provider is one of these as a whole, and the words are chosen so that
 * nobody can read "deeplink" as "we book rides with them".
 */
export type IntegrationShape =
  /** Nothing has been established. The honest default. */
  | "none"
  /** Prices only. Booking happens somewhere else. */
  | "quote_only"
  /** A link that opens their app with the trip filled in. No booking here. */
  | "deeplink_only"
  /** Prices and a booking, but no live tracking afterwards. */
  | "quote_and_book"
  /** Quote, book, track, cancel — the whole ride. */
  | "full_lifecycle"
  /** Several providers behind one contract. */
  | "aggregator";

export interface ProviderCapability {
  slug: string;
  name: string;
  shape: IntegrationShape;
  quote: boolean;
  book: boolean;
  track: boolean;
  cancel: boolean;
  deeplink: boolean;
  oauth: boolean;
  sandbox: boolean;
  /** True until a signed agreement or documented public access says otherwise. */
  partnerApprovalRequired: boolean;
  /**
   * The environment variables this adapter needs before it can do anything.
   *
   * Named, never read here. The router checks presence so a provider with no
   * credentials is skipped silently instead of failing per request, and so the
   * names live next to the adapter that wants them rather than in a README.
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
// Optional by design. A provider that cannot book does not implement `book`,
// and the router reads `capability.book` rather than probing for the method —
// which is what keeps "unsupported" a fact about the provider rather than an
// exception thrown from inside one.

export interface QuoteRequest {
  pickup: MobilityLocation;
  destination: MobilityLocation;
  passengerCount: number;
  scheduledAt: string | null;
  accessibility: readonly string[];
  /** Abandon this provider after this many milliseconds and keep the rest. */
  timeoutMs: number;
}

export interface BookingRequest extends QuoteRequest {
  quote: MobilityQuote;
  /** The same key on a retry must never produce a second ride. */
  idempotencyKey: string;
  userRef: string;
}

export interface BookingResult {
  providerTripId: string;
  status: MobilityStatus;
  raw: Readonly<Record<string, unknown>>;
}

export interface MobilityProvider {
  readonly capability: ProviderCapability;
  getQuotes?(request: QuoteRequest): Promise<MobilityQuote[]>;
  book?(request: BookingRequest): Promise<BookingResult>;
  getTrip?(providerTripId: string): Promise<{ status: MobilityStatus; raw: Record<string, unknown> }>;
  cancel?(providerTripId: string): Promise<void>;
  /** A link into the provider's own app, built from the trip. Never a fake one. */
  createDeepLink?(request: QuoteRequest): string | null;
  /** Provider words → Visionex words. Every adapter owns its own vocabulary. */
  mapStatus(providerStatus: string): MobilityStatus | null;
  healthCheck?(): Promise<boolean>;
}

/**
 * What an adapter that cannot do anything yet should be.
 *
 * Most providers are here on day one, and that is the point: the registry is a
 * real list with honest rows rather than an empty table, and the day approval
 * lands the adapter gains a method instead of being written from nothing.
 */
export function pendingProvider(capability: ProviderCapability): MobilityProvider {
  return {
    capability,
    mapStatus: () => null,
  };
}

/** Thrown when something asks a provider for what it has already said it cannot do. */
export const unsupported = (slug: string): MobilityError =>
  new MobilityError("PROVIDER_REQUIRES_APPROVAL", { providerSlug: slug });

// ── The registry ────────────────────────────────────────────────────────────
//
// Compiled-in capability records: the shape of each integration, and what it
// would take to switch it on. The *enablement* is not here — that is a row in
// `mobility_providers`, because it changes without a deploy.
//
// Every `lastVerified` below is null and every `shape` is "none" except Uber's,
// for one reason: this session could not reach the providers' documentation
// (the network egress proxy blocks `developer.uber.com` and the rest), and the
// instruction that matters more than completeness is that nothing may claim an
// API it has not read. A row here is a promise about what Visionex may do.
// Filling these in is provider research, and it is documented as outstanding in
// docs/mobility/providers.md rather than guessed at.

const capability = (over: Partial<ProviderCapability> & { slug: string; name: string }): ProviderCapability => ({
  shape: "none",
  quote: false,
  book: false,
  track: false,
  cancel: false,
  deeplink: false,
  oauth: false,
  sandbox: false,
  partnerApprovalRequired: true,
  requiredSecrets: [],
  approvalSteps: [],
  documentationUrl: null,
  lastVerified: null,
  ...over,
});

/**
 * Uber.
 *
 * Search of Uber's own developer material in September 2026 is consistent on
 * one point: the Riders API is not open access. Uber's documentation states
 * that access requires approval and that an applicant must go through an Uber
 * business-development contact. That is a `manual_partner_required` integration
 * and it is recorded as one.
 *
 * The official documentation pages could not be opened from this environment,
 * so nothing beyond that access fact is asserted: no endpoint paths, no scope
 * names, no request shapes. `docs/mobility/uber.md` records what was and was
 * not verified, and exactly what Visionex must submit.
 */
const UBER = capability({
  slug: "uber",
  name: "Uber",
  shape: "none",
  oauth: true,
  partnerApprovalRequired: true,
  requiredSecrets: ["UBER_CLIENT_ID", "UBER_CLIENT_SECRET", "UBER_REDIRECT_URI", "UBER_ENVIRONMENT"],
  approvalSteps: [
    "Contact an Uber business-development representative to request Riders API access.",
    "Have the approved redirect URI registered against the Visionex application.",
    "Obtain sandbox credentials and exercise quote, booking, status and cancellation there before any production request.",
  ],
  documentationUrl: "https://developer.uber.com/docs/",
});

const PENDING = [
  ["bolt", "Bolt"],
  ["lyft", "Lyft"],
  ["grab", "Grab"],
  ["didi", "DiDi"],
  ["cabify", "Cabify"],
  ["freenow", "FREE NOW"],
  ["gett", "Gett"],
  ["yango", "Yango"],
  ["indrive", "inDrive"],
  ["careem", "Careem"],
  ["splyt", "Splyt"],
] as const;

export const PROVIDER_CAPABILITIES: Readonly<Record<string, ProviderCapability>> = Object.freeze({
  uber: UBER,
  ...Object.fromEntries(PENDING.map(([slug, name]) => [slug, capability({ slug, name })])),
});

export const PROVIDERS: Readonly<Record<string, MobilityProvider>> = Object.freeze(
  Object.fromEntries(
    Object.entries(PROVIDER_CAPABILITIES).map(([slug, cap]) => [slug, pendingProvider(cap)]),
  ),
);

export const providerBySlug = (slug: string): MobilityProvider | null => PROVIDERS[slug] ?? null;

/**
 * Whether this provider could be called at all right now.
 *
 * Three things have to be true, and the order is the order they fail in: it has
 * to declare it can do the thing, it must not be waiting on a signature, and
 * its secrets have to be present. A provider failing any of them is skipped
 * before a request is built, which is why a half-configured provider costs
 * nothing rather than one timeout per search.
 */
export function isCallable(
  provider: MobilityProvider,
  action: "quote" | "book" | "track" | "cancel",
  secrets: Readonly<Record<string, string | undefined>>,
): boolean {
  const cap = provider.capability;
  if (!cap[action]) return false;
  if (cap.shape === "none") return false;
  return cap.requiredSecrets.every((name) => {
    const value = secrets[name];
    return typeof value === "string" && value.length > 0;
  });
}

/**
 * Ask several providers at once and keep whoever answers in time.
 *
 * Concurrent, because four providers asked one after another is four timeouts
 * a rider waits through. Per-provider deadlines, because one slow answer must
 * not cost the others theirs — the failure this repository has already been
 * bitten by once, in the AI provider chain, where a single shared budget let
 * one hanging call starve every fallback behind it.
 *
 * A provider that throws or times out contributes nothing and is reported
 * separately. It never takes the search down: a list of three is an answer, and
 * an error page is not.
 */
export async function gatherQuotes(
  providers: readonly MobilityProvider[],
  request: QuoteRequest,
): Promise<{ quotes: MobilityQuote[]; failed: Array<{ slug: string; code: string }> }> {
  const settled = await Promise.all(
    providers.map(async (provider) => {
      const slug = provider.capability.slug;
      if (!provider.getQuotes) {
        return { slug, quotes: [] as MobilityQuote[], code: "PROVIDER_REQUIRES_APPROVAL" };
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const deadline = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new MobilityError("PROVIDER_UNAVAILABLE", { providerSlug: slug })), request.timeoutMs);
        });
        const quotes = await Promise.race([provider.getQuotes(request), deadline]);
        return { slug, quotes, code: null };
      } catch (error) {
        const code = error instanceof MobilityError ? error.code : "PROVIDER_UNAVAILABLE";
        return { slug, quotes: [] as MobilityQuote[], code };
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    }),
  );

  return {
    quotes: settled.flatMap((result) => result.quotes),
    failed: settled
      .filter((result) => result.code !== null)
      .map((result) => ({ slug: result.slug, code: result.code as string })),
  };
}
