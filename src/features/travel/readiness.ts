/**
 * What Visionex Travel can actually do today, read from the supplier registries
 * rather than written down beside them.
 *
 * Three booking cores exist — flights, stays and rides — and every supplier in
 * all three is `not_researched` / shape `none`, because supplier documentation
 * was unreachable from the build environment and inventing a request against a
 * live reservation system is worse than shipping nothing. See
 * `docs/flights/providers.md` and `docs/hotels/providers.md`.
 *
 * The traveller-facing pages must say that, and must stop saying it the day it
 * stops being true. So nothing here is a constant: each answer is derived from
 * the same capability rows the Edge Functions read, and the page that renders
 * it changes its verb — "request" becomes "search" — without an edit.
 *
 * Deliberately client-safe. A capability row names the secrets an adapter would
 * need; it never holds one. And a supplier that is not `live` cannot sell
 * whatever the environment holds, so the honest answer needs no server call.
 */

import {
  SUPPLIERS as FLIGHT_SUPPLIERS,
  canSellTickets,
} from "../../../supabase/functions/_shared/flightsProviders.ts";
import {
  SUPPLIERS as STAY_SUPPLIERS,
  canSellStays,
} from "../../../supabase/functions/_shared/hotelsProviders.ts";
import { PROVIDERS as RIDE_PROVIDERS } from "../../../supabase/functions/_shared/mobilityProviders.ts";

export type TravelDomain = "flights" | "stays" | "rides";

export const TRAVEL_DOMAINS: readonly TravelDomain[] = ["flights", "stays", "rides"] as const;

/**
 * How far a domain has got, in the one word a traveller needs.
 *
 * `concierge` is not a failure state. It is what Visionex sells today: a person
 * who books the thing, for which a structured request is worth more than a
 * search box that returns nothing.
 */
export type TravelStage =
  /** No supplier is integrated. A request goes to the travel desk. */
  | "concierge"
  /** At least one supplier is integrated but none can complete a sale. */
  | "preview"
  /** At least one supplier can search, book and settle. */
  | "live";

export interface DomainReadiness {
  domain: TravelDomain;
  stage: TravelStage;
  /** How many suppliers the registry names. Never zero — the list is real. */
  suppliers: number;
  /** How many have had their documentation read by a person. */
  researched: number;
  /** True when a traveller could complete a booking here without a person. */
  sellable: boolean;
}

const readinessFrom = (
  domain: TravelDomain,
  suppliers: number,
  researched: number,
  sellable: boolean,
): DomainReadiness => ({
  domain,
  suppliers,
  researched,
  sellable,
  stage: sellable ? "live" : researched > 0 ? "preview" : "concierge",
});

export function flightsReadiness(): DomainReadiness {
  const rows = Object.values(FLIGHT_SUPPLIERS);
  return readinessFrom(
    "flights",
    rows.length,
    rows.filter((supplier) => supplier.capability.status !== "not_researched").length,
    rows.some(canSellTickets),
  );
}

export function staysReadiness(): DomainReadiness {
  const rows = Object.values(STAY_SUPPLIERS);
  return readinessFrom(
    "stays",
    rows.length,
    rows.filter((supplier) => supplier.capability.status !== "not_researched").length,
    rows.some(canSellStays),
  );
}

/**
 * Rides have no `canSellRides` in the core, because a ride is hailed rather
 * than sold: the equivalent is a provider that can both quote and book.
 */
export function ridesReadiness(): DomainReadiness {
  const rows = Object.values(RIDE_PROVIDERS);
  return readinessFrom(
    "rides",
    rows.length,
    rows.filter((provider) => provider.capability.shape !== "none").length,
    rows.some(
      (provider) =>
        provider.capability.shape !== "none" &&
        provider.capability.quote &&
        provider.capability.book,
    ),
  );
}

export function domainReadiness(domain: TravelDomain): DomainReadiness {
  if (domain === "flights") return flightsReadiness();
  if (domain === "stays") return staysReadiness();
  return ridesReadiness();
}

export const travelReadiness = (): DomainReadiness[] => TRAVEL_DOMAINS.map(domainReadiness);

/** True while no domain can complete a booking on its own. */
export const everythingIsConcierge = (): boolean =>
  travelReadiness().every((readiness) => !readiness.sellable);
