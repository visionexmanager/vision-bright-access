// Pure half of the Alibaba-family adapter: signing and request parameters for
// the AliExpress and Alibaba.com open platforms.
//
// One file serves both because they are the same gateway design: a flat set of
// system parameters, an HMAC signature over the parameters sorted by name, and
// a response whose product list sits at a documented path. What differs — the
// gateway URL, the API method, where the list lives, what the fields are
// called — is configuration on the source's row, not code. Reading the
// response is `jsonProductShape.ts`, which the feed adapter shares.
//
// Free of `Deno`, of fetch and of npm imports, so the suite can pin every
// decision here. `crypto.subtle` is the platform's, present in both runtimes.

import type { SourceRecord } from "../types.ts";
import type { JsonFieldMap } from "./jsonProductShape.ts";

/** AliExpress affiliate product query — the documented default. */
export const ALIEXPRESS_FIELDS: JsonFieldMap = {
  resultPath: "aliexpress_affiliate_product_query_response.resp_result.result.products.product",
  title: "product_title",
  price: "target_sale_price",
  currency: "target_sale_price_currency",
  url: "promotion_link",
  id: "product_id",
  category: "second_level_category_name",
  image: "product_main_image_url",
};

/** Alibaba.com ICBU product search. */
export const ALIBABA_FIELDS: JsonFieldMap = {
  resultPath: "alibaba_icbu_product_search_response.result_list.product_brief_response",
  title: "subject",
  price: "fob_price",
  currency: "currency",
  url: "detail_url",
  id: "product_id",
  category: "category_name",
  image: "main_image_url",
};

export const ALI_FIELD_DEFAULTS: Record<string, JsonFieldMap> = {
  aliexpress: ALIEXPRESS_FIELDS,
  alibaba: ALIBABA_FIELDS,
};

/**
 * The signature these gateways expect.
 *
 * Sort the parameters by name, concatenate name and value with no separator,
 * HMAC-SHA256 that with the app secret, and upper-case the hex. `sign` itself
 * is never part of what is signed. Some deployments prefix the API path; when
 * the row sets `sign_path`, it goes in front, which is the documented
 * behaviour of the REST-style gateway.
 *
 * Written from the published specification and NOT yet run against a live
 * gateway — nobody here has an app key. Verify it in the provider's sandbox as
 * part of the terms review the database already demands before the source can
 * be switched on.
 */
export async function aliSignature(
  params: Record<string, string>,
  secret: string,
  signPath?: string,
): Promise<string> {
  const canonical = Object.keys(params)
    .filter((key) => key !== "sign")
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");

  const payload = `${signPath ?? ""}${canonical}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  // The view, not a sliced buffer: a detached or over-long ArrayBuffer hashes
  // the wrong bytes and nothing downstream notices.
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));

  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export interface AliRequestOptions {
  appKey: string;
  method: string;
  /** Timestamp the gateway expects, in UTC. */
  timestamp: string;
  keywords: string;
  limit: number;
  minPriceUsd: number | null;
  maxPriceUsd: number | null;
  extra?: Record<string, string>;
}

/** Every parameter except the signature, which is computed over these. */
export function aliRequestParams(options: AliRequestOptions): Record<string, string> {
  const params: Record<string, string> = {
    app_key: options.appKey,
    method: options.method,
    format: "json",
    v: "2.0",
    sign_method: "sha256",
    timestamp: options.timestamp,
    keywords: options.keywords.slice(0, 100),
    page_size: String(Math.max(1, Math.min(50, options.limit))),
    page_no: "1",
    target_currency: "USD",
    target_language: "EN",
    ...options.extra,
  };

  // Budget is pushed down to the gateway rather than filtered afterwards, so
  // the page that comes back is one the customer can afford. These gateways
  // take the bounds in the currency's minor unit.
  if (options.minPriceUsd !== null) params.min_sale_price = String(Math.round(options.minPriceUsd * 100));
  if (options.maxPriceUsd !== null) params.max_sale_price = String(Math.round(options.maxPriceUsd * 100));

  return params;
}

/** UTC timestamp in the `yyyy-MM-dd HH:mm:ss` form the gateway documents. */
export function aliTimestamp(now: Date): string {
  return now.toISOString().replace("T", " ").slice(0, 19);
}

/**
 * The two environment variables a gateway source needs, derived from its row.
 *
 * The row names the key; the secret is that name with `_KEY` swapped for
 * `_SECRET`. One convention, so adding a gateway is a row and two secrets
 * rather than a code change.
 */
export function credentialNames(source: SourceRecord): { key: string; secret: string } {
  const key = source.api_key_ref ?? `${source.slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_APP_KEY`;
  return { key, secret: key.replace(/_KEY$/, "_SECRET") };
}

/** The row may override the field map; anything it omits keeps the default. */
export function aliFieldMap(source: SourceRecord): JsonFieldMap | null {
  const fallback = ALI_FIELD_DEFAULTS[source.slug] ?? null;
  const configured = source.config?.fields;

  if (configured && typeof configured === "object" && !Array.isArray(configured)) {
    const merged = { ...(fallback ?? {}), ...(configured as Partial<JsonFieldMap>) };
    if (merged.resultPath && merged.title && merged.price) return merged as JsonFieldMap;
  }
  return fallback;
}
