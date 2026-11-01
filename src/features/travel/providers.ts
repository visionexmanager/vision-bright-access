/**
 * Where to book a flight, a room or a car yourself, as a directory and not a
 * catalogue.
 *
 * The same idea as `src/features/sourcing/vendors.ts`: each row is the name of a
 * well-known booking service, the country it is based in, what it books, and the
 * address of its own site. No fare, rate, review, image or description is copied,
 * because every one of them changes by the minute and belongs to the service.
 * Visionex says nothing here about how accessible these sites are, how they are
 * priced or whether they cover a given country: none of that has been checked,
 * so the directory does not claim it. Add a row only for a service whose own
 * address you have opened.
 */

import { TRAVEL_SITES } from "../../../supabase/functions/_shared/deskDirectory.ts";

export const PROVIDER_KINDS = ["flights", "stays", "cars"] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export interface TravelProvider {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2 of the company's home country, shown through Intl.DisplayNames. */
  country: string;
  /** The service's own front door. https only. */
  url: string;
  kinds: readonly ProviderKind[];
}

export const TRAVEL_PROVIDERS: readonly TravelProvider[] = TRAVEL_SITES;

export const providersFor = (kind: ProviderKind): TravelProvider[] =>
  TRAVEL_PROVIDERS.filter((provider) => provider.kinds.includes(kind));
