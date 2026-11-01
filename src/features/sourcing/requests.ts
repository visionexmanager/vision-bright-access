/**
 * A product request, checked and written up for the sourcing desk.
 *
 * Nothing is scraped. The person gives the product in their own words, may paste
 * the vendor page address, and fills the specifications they care about; the
 * desk opens the vendor page itself. The request goes to `service_requests`,
 * the queue the travel desk uses (its RLS already lets people file and read only
 * their own rows and staff read all), so there is no new table.
 *
 * The summary is written for staff in one fixed language, like the travel one.
 * It never carries an email or phone: the support route builds a wa.me link, and
 * a wa.me link is a URL other services see.
 */

import { storeById } from "@/features/sourcing/stores";
import { vendorById } from "@/features/sourcing/vendors";

export const SOURCING_ROUTES = ["order", "support"] as const;
export type SourcingRoute = (typeof SOURCING_ROUTES)[number];

export const SERVICE_TYPE: Readonly<Record<SourcingRoute, string>> = Object.freeze({
  order: "Assistive Sourcing — Order for me",
  support: "Assistive Sourcing — Support chat",
});

/**
 * Which desk a request is for. `assistive` is the assistive-products desk;
 * `global` is ordering from the world's online stores (Amazon, AliExpress,
 * eBay and the like). They share one form, one queue and one fee, and are told
 * apart in `service_requests.service_type`.
 */
export type SourcingScope = "assistive" | "global";

export const GLOBAL_SERVICE_TYPE: Readonly<Record<SourcingRoute, string>> = Object.freeze({
  order: "Global Shopping — Order for me",
  support: "Global Shopping — Support chat",
});

export const serviceTypeFor = (scope: SourcingScope, route: SourcingRoute): string =>
  (scope === "global" ? GLOBAL_SERVICE_TYPE : SERVICE_TYPE)[route];

export const CONDITIONS = ["any", "new", "used"] as const;
export type SourcingCondition = (typeof CONDITIONS)[number];

const CONDITION_LINE: Readonly<Record<SourcingCondition, string>> = Object.freeze({
  any: "Condition: new or used",
  new: "Condition: new only",
  used: "Condition: used only",
});

/**
 * The owner's service fee for ordering on a person's behalf, as a percentage of
 * the product price (decided 2026-10-30). Shipping and taxes are passed on at
 * cost. It is a figure on the quote the team sends, not a charge taken here.
 */
export const SERVICE_FEE_PERCENT = 10;

export const PRODUCT_MAX = 200;
export const SPECS_MAX = 1500;
export const LINK_MAX = 500;

export interface SourcingDraft {
  product: string;
  vendorId: string;
  link: string;
  specs: string;
  quantity: number;
  budget: string;
  country: string;
  /** Only asked on the global desk; "any" elsewhere. */
  condition: SourcingCondition;
  route: SourcingRoute | "";
}

export const EMPTY_SOURCING_DRAFT: SourcingDraft = Object.freeze({
  product: "",
  vendorId: "",
  link: "",
  specs: "",
  quantity: 1,
  budget: "",
  country: "",
  condition: "any",
  route: "",
});

export interface SourcingIssue {
  field: string;
  code: string;
}

/** https only, no credentials in the address, a real host. The normalised URL or null. */
export function safeVendorLink(raw: string): string | null {
  const text = raw.trim();
  if (!text || text.length > LINK_MAX) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function sourcingIssues(draft: SourcingDraft): SourcingIssue[] {
  const issues: SourcingIssue[] = [];
  if (!draft.product.trim()) issues.push({ field: "product", code: "productRequired" });
  if (draft.link.trim() && !safeVendorLink(draft.link)) issues.push({ field: "link", code: "linkInvalid" });
  if (!draft.country.trim()) issues.push({ field: "country", code: "countryRequired" });
  if (!Number.isInteger(draft.quantity) || draft.quantity < 1 || draft.quantity > 99) {
    issues.push({ field: "quantity", code: "quantityInvalid" });
  }
  if (!draft.route) issues.push({ field: "route", code: "routeRequired" });
  return issues;
}

/** What staff read. Assumes `sourcingIssues` returned nothing. */
export function sourcingSummary(draft: SourcingDraft, scope: SourcingScope = "assistive"): string {
  const vendor = scope === "global" ? storeById(draft.vendorId) : vendorById(draft.vendorId);
  const link = safeVendorLink(draft.link);
  const lines = [
    scope === "global" ? "Desk: global stores" : null,
    `Product: ${draft.product.trim()}`,
    `Quantity: ${draft.quantity}`,
    scope === "global" ? CONDITION_LINE[draft.condition] : null,
    `Deliver to: ${draft.country.trim()}`,
    vendor ? `Preferred vendor: ${vendor.name} (${vendor.url})` : "Preferred vendor: any",
    link ? `Vendor page: ${link}` : null,
    draft.budget.trim() ? `Budget: ${draft.budget.trim()}` : null,
    draft.specs.trim() ? `Specifications and needs:\n${draft.specs.trim()}` : null,
    draft.route === "order"
      ? `Wants: Visionex to order it. Reply with a quote (item, shipping, taxes, ${SERVICE_FEE_PERCENT}% service fee on the item price) before any payment.`
      : "Wants: to talk to support first.",
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}
