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

export const TRAVEL_PROVIDERS: readonly TravelProvider[] = Object.freeze([
  { id: "google-flights", name: "Google Flights", country: "US", url: "https://www.google.com/travel/flights", kinds: ["flights"] },
  { id: "skyscanner", name: "Skyscanner", country: "GB", url: "https://www.skyscanner.net/", kinds: ["flights", "stays", "cars"] },
  { id: "kayak", name: "KAYAK", country: "US", url: "https://www.kayak.com/", kinds: ["flights", "stays", "cars"] },
  { id: "momondo", name: "Momondo", country: "DK", url: "https://www.momondo.com/", kinds: ["flights", "stays", "cars"] },
  { id: "kiwi", name: "Kiwi.com", country: "CZ", url: "https://www.kiwi.com/", kinds: ["flights"] },
  { id: "trip-com", name: "Trip.com", country: "SG", url: "https://www.trip.com/", kinds: ["flights", "stays", "cars"] },
  { id: "booking", name: "Booking.com", country: "NL", url: "https://www.booking.com/", kinds: ["stays", "cars"] },
  { id: "expedia", name: "Expedia", country: "US", url: "https://www.expedia.com/", kinds: ["flights", "stays", "cars"] },
  { id: "hotels-com", name: "Hotels.com", country: "US", url: "https://www.hotels.com/", kinds: ["stays"] },
  { id: "agoda", name: "Agoda", country: "SG", url: "https://www.agoda.com/", kinds: ["stays", "flights"] },
  { id: "airbnb", name: "Airbnb", country: "US", url: "https://www.airbnb.com/", kinds: ["stays"] },
  { id: "rentalcars", name: "Rentalcars.com", country: "GB", url: "https://www.rentalcars.com/", kinds: ["cars"] },
  { id: "discover-cars", name: "Discover Cars", country: "EE", url: "https://www.discovercars.com/", kinds: ["cars"] },
  { id: "hertz", name: "Hertz", country: "US", url: "https://www.hertz.com/", kinds: ["cars"] },
  { id: "avis", name: "Avis", country: "US", url: "https://www.avis.com/", kinds: ["cars"] },
  { id: "europcar", name: "Europcar", country: "FR", url: "https://www.europcar.com/", kinds: ["cars"] },
  { id: "sixt", name: "SIXT", country: "DE", url: "https://www.sixt.com/", kinds: ["cars"] },
  { id: "enterprise", name: "Enterprise", country: "US", url: "https://www.enterprise.com/", kinds: ["cars"] },
] satisfies TravelProvider[]);

export const providersFor = (kind: ProviderKind): TravelProvider[] =>
  TRAVEL_PROVIDERS.filter((provider) => provider.kinds.includes(kind));
