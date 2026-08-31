import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  aliFieldMap,
  aliRequestParams,
  aliSignature,
  aliTimestamp,
  ALIEXPRESS_FIELDS,
  credentialNames,
} from "../../supabase/functions/_shared/sourcing/adapters/aliMapping.ts";
import {
  amazonItemToRaw,
  amazonSearchIndex,
  amzDates,
  searchItemsPayload,
  signingKey,
  signSearchItems,
  type PaapiItem,
} from "../../supabase/functions/_shared/sourcing/adapters/amazonMapping.ts";
import {
  feedConfidence,
  feedFieldMap,
  jsonItemToRaw,
  matchesIntent,
  pluckList,
  readPrice,
} from "../../supabase/functions/_shared/sourcing/adapters/jsonProductShape.ts";
import { parseIntent } from "../../supabase/functions/_shared/sourcing/router.ts";
import { projectForCustomer } from "../../supabase/functions/_shared/sourcing/confidentiality.ts";
import type {
  NormalizedResult,
  SourceRecord,
} from "../../supabase/functions/_shared/sourcing/types.ts";

const registry = readFileSync("supabase/functions/_shared/sourcing/registry.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261002000000_sourcing_five_merchants.sql", "utf8");
const feedAdapter = readFileSync("supabase/functions/_shared/sourcing/adapters/productFeed.ts", "utf8");
const amazonAdapter = readFileSync("supabase/functions/_shared/sourcing/adapters/amazonPaapi.ts", "utf8");
const aliAdapter = readFileSync("supabase/functions/_shared/sourcing/adapters/aliOpenPlatform.ts", "utf8");

function source(overrides: Partial<SourceRecord> & { slug: string }): SourceRecord {
  return {
    name: overrides.slug,
    access_method: "official_api",
    status: "unverified",
    categories: ["general"],
    conditions: ["new"],
    priority: 100,
    health_score: 100,
    api_key_ref: null,
    base_url: null,
    config: {},
    commercial_reuse_allowed: false,
    attribution_required: false,
    rate_limit_per_hour: null,
    ...overrides,
  };
}

describe("the Alibaba-family gateway", () => {
  it("signs the parameters sorted by name, and never signs the signature", async () => {
    const params = { b: "2", a: "1", sign: "STALE" };
    const signed = await aliSignature(params, "secret");

    // Independently computed, with a different implementation, over the string
    // the specification describes: sorted, name and value concatenated.
    const expected = createHmac("sha256", "secret").update("a1b2").digest("hex").toUpperCase();
    expect(signed).toBe(expected);
  });

  it("puts the API path in front when the row asks for it", async () => {
    const withPath = await aliSignature({ a: "1" }, "secret", "/rest/product/search");
    const without = await aliSignature({ a: "1" }, "secret");
    expect(withPath).not.toBe(without);
    expect(withPath).toBe(
      createHmac("sha256", "secret").update("/rest/product/searcha1").digest("hex").toUpperCase(),
    );
  });

  it("returns upper-case hex, so a gateway comparing strings agrees", async () => {
    expect(await aliSignature({ a: "1" }, "s")).toMatch(/^[0-9A-F]{64}$/);
  });

  it("pushes the budget down to the gateway, in minor units", () => {
    const intent = parseIntent("laptop under 400");
    const params = aliRequestParams({
      appKey: "key",
      method: "aliexpress.affiliate.product.query",
      timestamp: aliTimestamp(new Date("2026-10-02T09:30:00Z")),
      keywords: intent.keywords.join(" "),
      limit: 10,
      minPriceUsd: intent.minPriceUsd,
      maxPriceUsd: intent.maxPriceUsd,
    });

    expect(params.max_sale_price).toBe("40000");
    expect(params.min_sale_price).toBeUndefined();
    expect(params.target_currency).toBe("USD");
    expect(params.timestamp).toBe("2026-10-02 09:30:00");
  });

  it("caps the page size the gateway will accept", () => {
    const params = aliRequestParams({
      appKey: "k", method: "m", timestamp: "t", keywords: "x",
      limit: 500, minPriceUsd: null, maxPriceUsd: null,
    });
    expect(params.page_size).toBe("50");
  });

  it("derives both secret names from the row, one convention for every gateway", () => {
    expect(credentialNames(source({ slug: "aliexpress", api_key_ref: "ALIEXPRESS_APP_KEY" })))
      .toEqual({ key: "ALIEXPRESS_APP_KEY", secret: "ALIEXPRESS_APP_SECRET" });
    expect(credentialNames(source({ slug: "new-gateway" })))
      .toEqual({ key: "NEW_GATEWAY_APP_KEY", secret: "NEW_GATEWAY_APP_SECRET" });
  });

  it("lets a row override part of the field map without restating all of it", () => {
    const overridden = aliFieldMap(source({
      slug: "aliexpress",
      config: { fields: { price: "original_price" } },
    }));
    expect(overridden?.price).toBe("original_price");
    expect(overridden?.title).toBe(ALIEXPRESS_FIELDS.title);
  });

  it("has no field map for a gateway nobody configured, and says so rather than guessing", () => {
    expect(aliFieldMap(source({ slug: "mystery-gateway" }))).toBeNull();
  });

  it("stops on the gateway's own error envelope instead of reporting no results", () => {
    expect(aliAdapter).toContain("error_response");
    expect(aliAdapter).toContain("returned error");
  });
});

describe("reading somebody else's product JSON", () => {
  it("walks a documented path, and tolerates one object where a list was promised", () => {
    expect(pluckList({ a: { b: [{ x: 1 }, { x: 2 }] } }, "a.b")).toHaveLength(2);
    expect(pluckList({ a: { b: { x: 1 } } }, "a.b")).toHaveLength(1);
    expect(pluckList({ a: {} }, "a.b.c")).toEqual([]);
    expect(pluckList(null, "a")).toEqual([]);
  });

  it("takes the low end of a wholesale range, which is what a small order is honoured at", () => {
    expect(readPrice("2.30-4.10")).toBe(2.3);
    expect(readPrice("US $19.99")).toBe(19.99);
    expect(readPrice("free")).toBeNull();
    expect(readPrice(null)).toBeNull();
  });

  it("drops a product it cannot quote in dollars rather than showing a gap", () => {
    const fields = { resultPath: "products", title: "t", price: "p", currency: "c" };
    const options = { fallbackCategory: null, availability: "available_for_sourcing" as const, confidence: 0.4 };

    expect(jsonItemToRaw({ t: "Kettle", p: "12.00", c: "USD" }, fields, options)).not.toBeNull();
    expect(jsonItemToRaw({ t: "Kettle", p: "12.00", c: "EUR" }, fields, options)).toBeNull();
    expect(jsonItemToRaw({ t: "Kettle", p: "0" }, fields, options)).toBeNull();
    expect(jsonItemToRaw({ p: "12.00" }, fields, options)).toBeNull();
  });

  it("filters a feed by keyword and by the budget the customer stated", () => {
    const intent = parseIntent("braille display under 900");
    const inside = { title: "Braille display 40 cell", sourcePriceUsd: 850, brand: null, category: null };
    const over = { title: "Braille display 80 cell", sourcePriceUsd: 2400, brand: null, category: null };
    const unrelated = { title: "Garden hose", sourcePriceUsd: 20, brand: null, category: null };

    expect(matchesIntent(inside, intent)).toBe(true);
    expect(matchesIntent(over, intent)).toBe(false);
    expect(matchesIntent(unrelated, intent)).toBe(false);
  });

  it("scores a feed product below anything the catalogue matched semantically", () => {
    const intent = parseIntent("braille display");
    const score = feedConfidence(
      { title: "Braille display 40 cell", sourcePriceUsd: 850, brand: null, category: null },
      intent,
    );
    expect(score).toBeLessThanOrEqual(0.6);
    expect(score).toBeGreaterThan(0.3);
  });

  it("refuses a feed row that names neither a title nor a price", () => {
    expect(feedFieldMap(source({ slug: "shein", config: { fields: { title: "name" } } }))).toBeNull();
    expect(feedFieldMap(source({ slug: "shein", config: {} }))).toBeNull();

    const usable = feedFieldMap(source({
      slug: "shein",
      config: { fields: { title: "name", price: "sale_price" } },
    }));
    expect(usable).toMatchObject({ title: "name", price: "sale_price", resultPath: "products" });
  });

  it("treats a feed as a snapshot somebody confirms, not as stock", () => {
    expect(feedAdapter).toContain("requires_sourcing_confirmation");
    expect(feedAdapter).toContain("CACHE_TTL_MS");
    expect(feedAdapter).toContain("MAX_FEED_BYTES");
  });
});

describe("Amazon PA-API signing", () => {
  it("derives the AWS4 key exactly as an independent implementation does", async () => {
    const mine = await signingKey("secret", "20261002", "us-east-1", "ProductAdvertisingAPI");

    const dateKey = createHmac("sha256", "AWS4secret").update("20261002").digest();
    const regionKey = createHmac("sha256", dateKey).update("us-east-1").digest();
    const serviceKey = createHmac("sha256", regionKey).update("ProductAdvertisingAPI").digest();
    const expected = createHmac("sha256", serviceKey).update("aws4_request").digest();

    expect(Buffer.from(mine).toString("hex")).toBe(expected.toString("hex"));
  });

  it("formats both dates the way SigV4 demands", () => {
    expect(amzDates(new Date("2026-10-02T09:30:00.123Z"))).toEqual({
      amzDate: "20261002T093000Z",
      dateStamp: "20261002",
    });
  });

  it("builds an authorization header with the scope, the header list and a signature", async () => {
    const signed = await signSearchItems("{}", "AKIAEXAMPLE", "secret", new Date("2026-10-02T09:30:00Z"));

    expect(signed.authorization).toContain(
      "Credential=AKIAEXAMPLE/20261002/us-east-1/ProductAdvertisingAPI/aws4_request",
    );
    expect(signed.authorization).toContain(
      "SignedHeaders=content-encoding;host;x-amz-date;x-amz-target",
    );
    expect(signed.authorization).toMatch(/Signature=[0-9a-f]{64}$/);
  });

  it("signs the payload, so two different bodies never share a signature", async () => {
    const at = new Date("2026-10-02T09:30:00Z");
    const one = await signSearchItems('{"Keywords":"laptop"}', "AK", "s", at);
    const two = await signSearchItems('{"Keywords":"kettle"}', "AK", "s", at);
    expect(one.authorization).not.toBe(two.authorization);
  });

  it("narrows the search index by category, but never for assistive equipment", () => {
    expect(amazonSearchIndex("electronics")).toBe("Electronics");
    expect(amazonSearchIndex("fashion")).toBe("Fashion");
    // Assistive gear is spread across health, electronics and office; narrowing
    // would hide most of what a blind customer is asking for.
    expect(amazonSearchIndex("assistive")).toBe("All");
    expect(amazonSearchIndex(null)).toBe("All");
  });

  it("sends the keywords, the budget in cents and a bounded item count", () => {
    const payload = JSON.parse(searchItemsPayload(parseIntent("used laptop under 400"), "tag-20", 50)!);
    expect(payload.Keywords).toContain("laptop");
    expect(payload.MaxPrice).toBe(40000);
    expect(payload.ItemCount).toBe(10);
    expect(payload.PartnerTag).toBe("tag-20");
  });

  it("drops an item with no offer, rather than showing a product with no price", () => {
    const base: PaapiItem = {
      ASIN: "B000",
      DetailPageURL: "https://www.amazon.com/dp/B000",
      ItemInfo: { Title: { DisplayValue: "Talking watch" } },
      Offers: { Listings: [{ Price: { Amount: 39.99, Currency: "USD" }, Condition: { Value: "New" } }] },
    };

    expect(amazonItemToRaw(base, null)?.sourcePriceUsd).toBe(39.99);
    expect(amazonItemToRaw({ ...base, Offers: undefined }, null)).toBeNull();
    expect(amazonItemToRaw(
      { ...base, Offers: { Listings: [{ Price: { Amount: 10, Currency: "GBP" } }] } },
      null,
    )).toBeNull();
  });

  it("never calls an item new unless Amazon does", () => {
    const item = (condition: string): PaapiItem => ({
      ItemInfo: { Title: { DisplayValue: "Thing" } },
      Offers: { Listings: [{ Price: { Amount: 10, Currency: "USD" }, Condition: { Value: condition } }] },
    });
    expect(amazonItemToRaw(item("New"), null)?.condition).toBe("new");
    expect(amazonItemToRaw(item("Renewed"), null)?.condition).toBe("refurbished");
    expect(amazonItemToRaw(item("Collectible"), null)?.condition).toBe("used");
  });

  it("is skipped, not failed, when the credentials are absent", () => {
    expect(amazonAdapter).toContain("AMAZON_PAAPI_ACCESS_KEY");
    expect(amazonAdapter).toContain("source skipped");
  });
});

describe("the resale model", () => {
  it("shows the customer a product and a price, and never the supplier", () => {
    const result = {
      title: "Dell Latitude 5420",
      brand: "Dell",
      model: null,
      category: "electronics",
      specifications: {},
      condition: "used",
      availability: "available_for_sourcing",
      currency: "USD",
      finalPriceUsd: 431,
      priceRangeUsd: null,
      sourceSlug: "ebay",
      sourceName: "eBay",
      sourceUrl: "https://www.ebay.com/itm/123",
      sourceProductId: "v1|123|0",
      sourcePriceUsd: 349,
      shippingUsd: 12,
      pricingRuleId: null,
      pricingBreakdown: { margin: 65 },
      attributionRequired: false,
      confidence: 0.45,
      retrievedAt: "2026-10-02T00:00:00Z",
    } satisfies NormalizedResult;

    const shown = projectForCustomer(result, "VX-42");
    expect(shown).toEqual({
      ref: "VX-42",
      title: "Dell Latitude 5420",
      brand: "Dell",
      model: null,
      category: "electronics",
      specifications: {},
      condition: "used",
      availability: "available_for_sourcing",
      priceUsd: 431,
      currency: "USD",
    });
    expect(JSON.stringify(shown)).not.toContain("ebay");
  });

  it("registers an adapter for every merchant that was asked for", () => {
    for (const slug of ["ebayBrowseAdapter", "amazonPaapiAdapter", "aliexpressAdapter", "alibabaAdapter"]) {
      expect(registry).toContain(slug);
    }
    expect(registry).toContain('shein: feedAdapterFor("shein")');
    expect(registry).toContain('"product-feed": feedAdapterFor("product-feed")');
  });

  it("leaves every external source switched off for a person to review", () => {
    expect(migration).not.toMatch(/status\s*=\s*'active'/);
    expect(migration).not.toMatch(/commercial_reuse_allowed\s*=\s*true/);
    expect(migration).toContain("attribution_required = false");
  });

  it("charges a margin on second-hand stock, because under resale we own it first", () => {
    expect(migration).toMatch(/'Resale margin, second-hand'[^;]*'used', 18, 0, 3, true/);
    expect(migration).toMatch(/pricing_rules[\s\S]*SET active = false[\s\S]*pass-through/);
  });
});
