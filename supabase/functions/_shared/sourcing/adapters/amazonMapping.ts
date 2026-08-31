// Pure half of the Amazon adapter: SigV4 signing, the SearchItems payload and
// item normalization for the Product Advertising API 5.0.
//
// PA-API is the only permitted way to read Amazon's catalogue programmatically,
// and it is signed with AWS Signature Version 4 — which is fiddly, entirely
// deterministic, and therefore worth having in a file the suite can pin byte
// for byte. Free of `Deno`, of fetch and of npm imports.

import type { RawResult, SourcingIntent } from "../types.ts";

export const PAAPI_HOST = "webservices.amazon.com";
export const PAAPI_REGION = "us-east-1";
export const PAAPI_SERVICE = "ProductAdvertisingAPI";
export const PAAPI_PATH = "/paapi5/searchitems";
export const PAAPI_TARGET = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems";
export const PAAPI_MARKETPLACE = "www.amazon.com";

const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Text as a standalone ArrayBuffer.
 *
 * Every key and message below is passed as an ArrayBuffer rather than a typed
 * array, because the two TypeScript DOM libs in this repository disagree about
 * whether a `Uint8Array` is a `BufferSource` — one accepts it, the other
 * refuses `Uint8Array<ArrayBufferLike>`, and only the pnpm CI job sees the
 * strict one. An ArrayBuffer is unambiguous in both. The bytes are copied
 * whole, never sliced with an offset: a partial view would sign the wrong
 * message and nothing downstream would question the result.
 */
function buffer(text: string): ArrayBuffer {
  const view = encoder.encode(text);
  const copy = new ArrayBuffer(view.byteLength);
  new Uint8Array(copy).set(view);
  return copy;
}

async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", buffer(text)));
}

async function hmac(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const imported = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return await crypto.subtle.sign("HMAC", imported, buffer(message));
}

/** AWS4 key derivation: secret → date → region → service → request. */
export async function signingKey(
  secret: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const dateKey = await hmac(buffer(`AWS4${secret}`), dateStamp);
  const regionKey = await hmac(dateKey, region);
  const serviceKey = await hmac(regionKey, service);
  return await hmac(serviceKey, "aws4_request");
}

/** `20260901T120000Z` and `20260901`, the two forms SigV4 asks for. */
export function amzDates(now: Date): { amzDate: string; dateStamp: string } {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

export interface SignedRequest {
  authorization: string;
  amzDate: string;
  payload: string;
}

/**
 * Sign a PA-API SearchItems call.
 *
 * The header set is fixed and sorted, which is what makes the canonical
 * request reproducible: content-encoding, host, x-amz-date, x-amz-target.
 * Anything else sent alongside is not signed and must not be, or Amazon's
 * recomputation will not match ours.
 */
export async function signSearchItems(
  payload: string,
  accessKey: string,
  secretKey: string,
  now: Date,
): Promise<SignedRequest> {
  const { amzDate, dateStamp } = amzDates(now);

  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `host:${PAAPI_HOST}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${PAAPI_TARGET}\n`;
  const signedHeaders = "content-encoding;host;x-amz-date;x-amz-target";

  const canonicalRequest = [
    "POST",
    PAAPI_PATH,
    "",
    canonicalHeaders,
    signedHeaders,
    await sha256Hex(payload),
  ].join("\n");

  const scope = `${dateStamp}/${PAAPI_REGION}/${PAAPI_SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const key = await signingKey(secretKey, dateStamp, PAAPI_REGION, PAAPI_SERVICE);
  const signature = hex(await hmac(key, stringToSign));

  return {
    authorization:
      `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    amzDate,
    payload,
  };
}

/** The search index PA-API expects, from the category the router derived. */
export function amazonSearchIndex(category: string | null): string {
  switch (category) {
    case "electronics": return "Electronics";
    case "appliances": return "Appliances";
    case "fashion": return "Fashion";
    case "home": return "HomeAndKitchen";
    case "automotive": return "Automotive";
    case "children": return "ToysAndGames";
    // Assistive equipment is spread across health, electronics and office, so
    // narrowing it would hide most of what a blind customer is asking for.
    default: return "All";
  }
}

export function searchItemsPayload(intent: SourcingIntent, partnerTag: string, limit: number): string | null {
  const keywords = intent.keywords.join(" ").trim() || intent.query.trim();
  if (keywords.length < 2) return null;

  const body: Record<string, unknown> = {
    Keywords: keywords.slice(0, 100),
    SearchIndex: amazonSearchIndex(intent.category),
    ItemCount: Math.max(1, Math.min(10, limit)),
    PartnerTag: partnerTag,
    PartnerType: "Associates",
    Marketplace: PAAPI_MARKETPLACE,
    Resources: [
      "ItemInfo.Title",
      "ItemInfo.ByLineInfo",
      "ItemInfo.Classifications",
      "Offers.Listings.Price",
      "Offers.Listings.Condition",
      "Images.Primary.Medium",
    ],
  };

  // PA-API takes the bounds in the marketplace's minor unit.
  if (intent.minPriceUsd !== null) body.MinPrice = Math.round(intent.minPriceUsd * 100);
  if (intent.maxPriceUsd !== null) body.MaxPrice = Math.round(intent.maxPriceUsd * 100);

  return JSON.stringify(body);
}

export interface PaapiItem {
  ASIN?: string;
  DetailPageURL?: string;
  ItemInfo?: {
    Title?: { DisplayValue?: string };
    ByLineInfo?: { Brand?: { DisplayValue?: string }; Manufacturer?: { DisplayValue?: string } };
    Classifications?: { ProductGroup?: { DisplayValue?: string } };
  };
  Images?: { Primary?: { Medium?: { URL?: string } } };
  Offers?: {
    Listings?: Array<{
      Price?: { Amount?: number; Currency?: string };
      Condition?: { Value?: string };
    }>;
  };
}

/**
 * One item, normalized — or null when it cannot be reported honestly.
 *
 * No offer means no price, and no price means the item is dropped rather than
 * shown with a gap where the number belongs. An item Amazon does not describe
 * as new is called used: guessing "new" would put a second-hand listing into
 * the group the spec reserves for new stock.
 */
export function amazonItemToRaw(item: PaapiItem, fallbackCategory: string | null): RawResult | null {
  const title = item.ItemInfo?.Title?.DisplayValue?.trim();
  const listing = item.Offers?.Listings?.[0];
  const amount = listing?.Price?.Amount;
  if (!title || typeof amount !== "number" || !(amount > 0)) return null;
  if ((listing?.Price?.Currency ?? "USD") !== "USD") return null;

  const conditionText = (listing?.Condition?.Value ?? "New").toLowerCase();
  const condition = conditionText.includes("refurbish") || conditionText.includes("renewed")
    ? "refurbished"
    : conditionText.includes("new")
      ? "new"
      : "used";

  const image = item.Images?.Primary?.Medium?.URL;

  return {
    title,
    brand: item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue
      ?? item.ItemInfo?.ByLineInfo?.Manufacturer?.DisplayValue
      ?? null,
    model: null,
    category: item.ItemInfo?.Classifications?.ProductGroup?.DisplayValue ?? fallbackCategory,
    specifications: image ? { image } : {},
    condition,
    sourcePriceUsd: amount,
    shippingUsd: 0,
    currency: "USD",
    sourceUrl: item.DetailPageURL ?? null,
    sourceProductId: item.ASIN ?? null,
    availability: "available_for_sourcing",
    confidence: 0.5,
  };
}
