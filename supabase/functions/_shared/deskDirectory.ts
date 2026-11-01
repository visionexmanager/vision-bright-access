// The two directories WhatsApp and the website both read.
//
// Plain data with no Deno global, no fetch and no client, so the app imports it
// (the way it already imports the flights and hotels cores) and the webhook
// uses the very same rows: one list, edited once. Names, home countries and the
// address of each site's own front door; nothing about prices, stock, shipping
// or accessibility, because none of that has been checked here. Add a row only
// for a site whose own address you have opened.

export type TravelKind = "flights" | "stays" | "cars";

export interface TravelSite {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2 of the company's home country. */
  country: string;
  /** The service's own front door. https only. */
  url: string;
  kinds: readonly TravelKind[];
}

export interface GlobalStore {
  id: string;
  name: string;
  country: string;
  url: string;
}

export const TRAVEL_SITES: readonly TravelSite[] = Object.freeze([
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
] satisfies TravelSite[]);

export const GLOBAL_STORES: readonly GlobalStore[] = Object.freeze([
  { id: "amazon", name: "Amazon", country: "US", url: "https://www.amazon.com/" },
  { id: "alibaba", name: "Alibaba.com", country: "CN", url: "https://www.alibaba.com/" },
  { id: "aliexpress", name: "AliExpress", country: "CN", url: "https://www.aliexpress.com/" },
  { id: "taobao", name: "Taobao", country: "CN", url: "https://world.taobao.com/" },
  { id: "shein", name: "SHEIN", country: "SG", url: "https://www.shein.com/" },
  { id: "temu", name: "Temu", country: "US", url: "https://www.temu.com/" },
  { id: "ebay", name: "eBay", country: "US", url: "https://www.ebay.com/" },
  { id: "walmart", name: "Walmart", country: "US", url: "https://www.walmart.com/" },
  { id: "etsy", name: "Etsy", country: "US", url: "https://www.etsy.com/" },
  { id: "noon", name: "noon", country: "AE", url: "https://www.noon.com/" },
  { id: "jumia", name: "Jumia", country: "NG", url: "https://www.jumia.com/" },
  { id: "mercadolibre", name: "Mercado Libre", country: "AR", url: "https://www.mercadolibre.com/" },
  { id: "flipkart", name: "Flipkart", country: "IN", url: "https://www.flipkart.com/" },
  { id: "rakuten", name: "Rakuten", country: "JP", url: "https://global.rakuten.com/" },
  { id: "trendyol", name: "Trendyol", country: "TR", url: "https://www.trendyol.com/" },
] satisfies GlobalStore[]);
