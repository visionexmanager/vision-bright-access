/**
 * Where assistive products are sold, as a directory, not a catalogue.
 *
 * Nothing here copies a vendor product, price, image or description. Each row is
 * a fact about the vendor (who, where, what kinds of thing, how it sells) plus
 * the address of the vendor itself, so a person reads the specifications at the
 * source. MaxiAids is listed and linked and nothing more: importing its
 * catalogue is on hold until the owner has a licence.
 *
 * Every claim was read on the vendor's own site on `checkedOn`. Where a page did
 * not say (shipping, mostly) the row says `unknown` rather than guessing. Sites
 * that blocked an automated check (Freedom Scientific, Harris Communications,
 * Enabling Devices, Optelec) are left out until a person checks them; add them
 * with the same fields and a fresh `checkedOn`.
 */

export const VENDOR_CATEGORIES = ["vision", "hearing", "mobility", "daily", "tech"] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

/**
 * How the vendor's own pages describe getting a product to a customer.
 *  - home: ships within its home country; no international option was shown
 *  - international: the site shows international sales or regional stores
 *  - dealers: sells through dealers, clinics or distributors
 *  - unknown: the page did not say
 */
export type VendorShipping = "home" | "international" | "dealers" | "unknown";

export interface Vendor {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2, shown through Intl.DisplayNames. */
  country: string;
  url: string;
  categories: readonly VendorCategory[];
  shipping: VendorShipping;
  /** Languages of the vendor site (BCP 47). */
  languages: readonly string[];
  /** ISO date the claims were last read on the vendor's own site. */
  checkedOn: string;
}

const CHECKED = "2026-10-30";
const ALL: readonly VendorCategory[] = ["vision", "hearing", "mobility", "daily", "tech"];

export const VENDORS: readonly Vendor[] = Object.freeze([
  { id: "maxiaids", name: "MaxiAids", country: "US", url: "https://www.maxiaids.com/", categories: ALL, shipping: "home", languages: ["en"], checkedOn: CHECKED },
  { id: "independent-living-aids", name: "Independent Living Aids", country: "US", url: "https://www.independentliving.com/", categories: ALL, shipping: "unknown", languages: ["en"], checkedOn: CHECKED },
  { id: "lss", name: "LS&S", country: "US", url: "https://www.lssproducts.com/", categories: ["vision", "hearing", "daily", "tech"], shipping: "home", languages: ["en"], checkedOn: CHECKED },
  { id: "humanware", name: "HumanWare", country: "US", url: "https://store.humanware.com/", categories: ["vision", "tech"], shipping: "international", languages: ["en"], checkedOn: CHECKED },
  { id: "rnib-shop", name: "RNIB Shop", country: "GB", url: "https://shop.rnib.org.uk/", categories: ["vision", "daily", "tech"], shipping: "home", languages: ["en"], checkedOn: CHECKED },
  { id: "eschenbach", name: "Eschenbach Optik", country: "DE", url: "https://www.eschenbach-optik.com/", categories: ["vision"], shipping: "unknown", languages: ["de", "en", "fr"], checkedOn: CHECKED },
  { id: "esight", name: "eSight", country: "CA", url: "https://www.esighteyewear.com/", categories: ["vision", "tech"], shipping: "dealers", languages: ["en"], checkedOn: CHECKED },
  { id: "connevans", name: "Connevans", country: "GB", url: "https://www.connevans.co.uk/", categories: ["hearing", "daily"], shipping: "international", languages: ["en"], checkedOn: CHECKED },
  { id: "complete-care-shop", name: "Complete Care Shop", country: "GB", url: "https://www.completecareshop.co.uk/", categories: ["mobility", "daily"], shipping: "home", languages: ["en"], checkedOn: CHECKED },
  { id: "sunrise-medical", name: "Sunrise Medical", country: "US", url: "https://www.sunrisemedical.com/", categories: ["mobility"], shipping: "dealers", languages: ["en"], checkedOn: CHECKED },
  { id: "invacare", name: "Invacare", country: "US", url: "https://www.invacare.com/", categories: ["mobility", "daily"], shipping: "dealers", languages: ["en"], checkedOn: CHECKED },
  { id: "ottobock", name: "Ottobock", country: "DE", url: "https://www.ottobock.com/", categories: ["mobility"], shipping: "dealers", languages: ["de", "en"], checkedOn: CHECKED },
] satisfies Vendor[]);

export function vendorById(id: string): Vendor | undefined {
  return VENDORS.find((vendor) => vendor.id === id);
}
