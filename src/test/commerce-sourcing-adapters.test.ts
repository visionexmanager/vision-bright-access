import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BAZAAR_FETCH_LIMIT,
  bazaarConfidence,
  bazaarFilter,
  bazaarPriceUsd,
  bazaarRowToRaw,
  isSellable,
  VX_PER_USD,
  type BazaarProductRow,
} from "../../supabase/functions/_shared/sourcing/adapters/bazaarMapping.ts";
import {
  buildBrowseQuery,
  ebayCondition,
  ebayConditionFilter,
  ebayItemToRaw,
  type EbayItemSummary,
} from "../../supabase/functions/_shared/sourcing/adapters/ebayMapping.ts";
import { projectForCustomer } from "../../supabase/functions/_shared/sourcing/confidentiality.ts";
import { parseIntent } from "../../supabase/functions/_shared/sourcing/router.ts";
import type { NormalizedResult } from "../../supabase/functions/_shared/sourcing/types.ts";

const registry = readFileSync("supabase/functions/_shared/sourcing/registry.ts", "utf8");
const migration = readFileSync("supabase/migrations/20261001000000_sourcing_bazaar_and_ebay.sql", "utf8");
const bazaarAdapter = readFileSync(
  "supabase/functions/_shared/sourcing/adapters/bazaarListings.ts",
  "utf8",
);

function listing(overrides: Partial<BazaarProductRow> = {}): BazaarProductRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    shop_id: "22222222-2222-2222-2222-222222222222",
    name: "Talking Kitchen Scale",
    description: "Speaks the weight aloud in Arabic and English.",
    category: "assistive",
    product_type: "physical",
    price: 25_000,
    price_vx: 25_000,
    price_usd: null,
    accepts_vx: true,
    accepts_cash: false,
    in_stock: true,
    stock_qty: 3,
    shipping_cost: 0,
    shipping_from: "Amman",
    delivery_time: "3 days",
    is_accessible: true,
    bazaar_shops: { name: "Noor Assistive", is_active: true, vacation_mode: false },
    ...overrides,
  };
}

describe("VXBazaar listings become findable by the Commerce Agent", () => {
  it("searches the name and the description of every usable keyword", () => {
    const filter = bazaarFilter(["talking", "scale"]);
    expect(filter).toBe(
      "name.ilike.%talking%,description.ilike.%talking%,name.ilike.%scale%,description.ilike.%scale%",
    );
  });

  it("drops words too short to mean anything, as the Arabic search hazard requires", () => {
    expect(bazaarFilter(["في", "من", "ا"])).toBeNull();
    expect(bazaarFilter(["ب", "ساعة"])).toBe("name.ilike.%ساعة%,description.ilike.%ساعة%");
  });

  it("cannot be reshaped by punctuation in a keyword", () => {
    const filter = bazaarFilter(["laptop,name.ilike.%*%,description.ilike.%'"]);
    expect(filter).not.toBeNull();
    expect(filter).not.toContain("'");
    expect(filter).not.toContain("*");
    expect(filter!.split(",")).toHaveLength(2);
  });

  it("prices a cash listing in cash and a VX listing at the platform rate", () => {
    expect(bazaarPriceUsd(listing({ accepts_cash: true, price_usd: 19.99 }))).toBe(19.99);
    expect(bazaarPriceUsd(listing())).toBe(25_000 / VX_PER_USD);
  });

  it("falls back to the legacy price column, and reports nothing when there is no price", () => {
    expect(bazaarPriceUsd(listing({ price_vx: null, price: 4_000 }))).toBe(4);
    expect(bazaarPriceUsd(listing({ price_vx: null, price: null }))).toBeNull();
  });

  it("never offers a listing from a shop that is shut, on holiday, or out of stock", () => {
    expect(isSellable(listing())).toBe(true);
    expect(isSellable(listing({ bazaar_shops: { name: "x", is_active: false, vacation_mode: false } }))).toBe(false);
    expect(isSellable(listing({ bazaar_shops: { name: "x", is_active: true, vacation_mode: true } }))).toBe(false);
    expect(isSellable(listing({ in_stock: false }))).toBe(false);
    expect(isSellable(listing({ stock_qty: 0 }))).toBe(false);
  });

  it("calls a listing Visionex stock, and does not dress the shop up as a brand", () => {
    const raw = bazaarRowToRaw(listing(), ["talking", "scale"]);
    expect(raw.availability).toBe("in_visionex");
    expect(raw.brand).toBeNull();
    expect(raw.specifications).toMatchObject({ shop: "Noor Assistive" });
    expect(raw.condition).toBe("new");
    expect(raw.sourceProductId).toBe(listing().id);
  });

  it("scores a listing by how much of the request it actually matches", () => {
    const keywords = ["talking", "scale"];
    const both = bazaarConfidence(listing(), keywords);
    const one = bazaarConfidence(listing({ name: "Scale", description: null }), keywords);
    expect(both).toBeGreaterThan(one);
    expect(both).toBeLessThanOrEqual(0.9);
    expect(one).toBeGreaterThanOrEqual(0.4);
  });

  it("asks the database only for listings on shops that are open", () => {
    expect(bazaarAdapter).toContain("bazaar_shops!inner(name, is_active, vacation_mode)");
    expect(bazaarAdapter).toContain('.eq("bazaar_shops.is_active", true)');
    expect(bazaarAdapter).toContain('.eq("in_stock", true)');
    expect(bazaarAdapter).toContain("BAZAAR_FETCH_LIMIT");
    expect(BAZAAR_FETCH_LIMIT).toBeGreaterThan(0);
  });
});

describe("eBay listings are reported honestly", () => {
  it("reads the condition from the id, and from the wording when the id is missing", () => {
    expect(ebayCondition("1000")).toBe("new");
    expect(ebayCondition("2030")).toBe("refurbished");
    expect(ebayCondition("3000")).toBe("used");
    expect(ebayCondition(null, "Certified - Refurbished")).toBe("refurbished");
    expect(ebayCondition(null, "Pre-owned")).toBe("used");
  });

  it("never guesses 'new' for a listing it cannot classify", () => {
    expect(ebayCondition("9999", "mystery")).toBe("used");
    expect(ebayCondition(null, null)).toBe("used");
  });

  it("never asks for parts-only listings", () => {
    expect(ebayConditionFilter("all")).not.toContain("7000");
    expect(ebayConditionFilter("used")).not.toContain("7000");
    expect(ebayConditionFilter("new")).toEqual(["1000", "1500", "1750"]);
  });

  it("searches the keywords rather than the sentence, and pushes the budget down", () => {
    const intent = parseIntent("بدي لابتوب مستعمل تحت 400 دولار");
    const query = buildBrowseQuery(intent, 10);

    expect(query).not.toBeNull();
    expect(query!.q).not.toContain("بدي");
    expect(query!.q).toContain("لابتوب");
    expect(query!.filter).toContain("price:[..400]");
    expect(query!.filter).toContain("priceCurrency:USD");
    expect(query!.filter).toContain("conditionIds:{3000|4000|5000|6000}");
  });

  it("asks for a bounded range when the customer gave two numbers", () => {
    const intent = parseIntent("headphones between 50 and 150");
    expect(buildBrowseQuery(intent, 5)!.filter).toContain("price:[50..150]");
  });

  it("caps the page size the API will accept", () => {
    expect(buildBrowseQuery(parseIntent("braille display"), 500)!.limit).toBe(50);
    expect(buildBrowseQuery(parseIntent("x"), 10)).toBeNull();
  });

  it("turns a listing into a recommendation, never into Visionex stock", () => {
    const item: EbayItemSummary = {
      itemId: "v1|123|0",
      title: "Dell Latitude 5420 i7 16GB",
      conditionId: "3000",
      condition: "Used",
      itemWebUrl: "https://www.ebay.com/itm/123",
      price: { value: "349.00", currency: "USD" },
      shippingOptions: [{ shippingCost: { value: "12.50", currency: "USD" } }],
      categories: [{ categoryName: "PC Laptops & Netbooks" }],
    };

    const raw = ebayItemToRaw(item, "electronics");
    expect(raw).not.toBeNull();
    expect(raw!.availability).toBe("external_recommendation");
    expect(raw!.condition).toBe("used");
    expect(raw!.sourcePriceUsd).toBe(349);
    expect(raw!.shippingUsd).toBe(12.5);
    expect(raw!.sourceUrl).toBe("https://www.ebay.com/itm/123");
  });

  it("drops a listing it cannot quote in dollars, rather than showing a blank price", () => {
    const base: EbayItemSummary = {
      title: "Thing",
      itemWebUrl: "https://www.ebay.com/itm/1",
      price: { value: "10.00", currency: "USD" },
    };
    expect(ebayItemToRaw({ ...base, price: { value: "10.00", currency: "EUR" } }, null)).toBeNull();
    expect(ebayItemToRaw({ ...base, price: undefined }, null)).toBeNull();
    expect(ebayItemToRaw({ ...base, itemWebUrl: undefined }, null)).toBeNull();
    expect(ebayItemToRaw({ ...base, title: "  " }, null)).toBeNull();
  });

  it("ignores a shipping cost quoted in another currency instead of counting it as dollars", () => {
    const raw = ebayItemToRaw(
      {
        title: "Thing",
        itemWebUrl: "https://www.ebay.com/itm/1",
        price: { value: "10.00", currency: "USD" },
        shippingOptions: [{ shippingCost: { value: "9.99", currency: "GBP" } }],
      },
      null,
    );
    expect(raw!.shippingUsd).toBe(0);
  });

  it("names eBay to the customer, because its licence requires it", () => {
    const result = {
      title: "Dell Latitude",
      brand: null,
      model: null,
      category: "electronics",
      specifications: {},
      condition: "used",
      availability: "external_recommendation",
      currency: "USD",
      finalPriceUsd: 349,
      sourceSlug: "ebay",
      sourceName: "eBay",
      sourceUrl: "https://www.ebay.com/itm/123",
      sourceProductId: "v1|123|0",
      sourcePriceUsd: 349,
      shippingUsd: 0,
      pricingRuleId: null,
      pricingBreakdown: {},
      attributionRequired: true,
      confidence: 0.45,
      retrievedAt: "2026-10-01T00:00:00Z",
    } satisfies NormalizedResult;

    const shown = projectForCustomer(result, "VX-1");
    expect(shown.sourceName).toBe("eBay");
    expect(shown.sourceUrl).toBe("https://www.ebay.com/itm/123");

    const internal = projectForCustomer({ ...result, attributionRequired: false }, "VX-2");
    expect(internal.sourceName).toBeUndefined();
    expect(internal.sourceUrl).toBeUndefined();
  });
});

describe("the sources are wired up", () => {
  it("registers both new adapters", () => {
    expect(registry).toContain("bazaarListingsAdapter");
    expect(registry).toContain("ebayBrowseAdapter");
  });

  it("switches VXBazaar on as an internal source", () => {
    expect(migration).toContain("'visionex-bazaar'");
    expect(migration).toMatch(/'visionex-bazaar'[\s\S]{0,80}'internal', 'active'/);
  });

  it("prepares eBay without switching it on: that stays a human decision", () => {
    expect(migration).toContain("'official_api'");
    expect(migration).toContain("attribution_required = true");
    expect(migration).not.toMatch(/SET[\s\S]*status\s*=\s*'active'[\s\S]*WHERE slug = 'ebay'/);
  });

  it("adds no margin to a listing the buyer pays eBay for", () => {
    expect(migration).toMatch(/pricing_rules[\s\S]*'ebay', 0, 0, 0/);
  });
});
