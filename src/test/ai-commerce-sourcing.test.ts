import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculatePrice, selectRule, type PricingRule } from "../../supabase/functions/_shared/sourcing/pricing.ts";
import { projectForCustomer, INTERNAL_ONLY_FIELDS } from "../../supabase/functions/_shared/sourcing/confidentiality.ts";
import {
  deduplicate,
  groupByCondition,
  parseIntent,
  rank,
  routeSources,
} from "../../supabase/functions/_shared/sourcing/router.ts";
import type { NormalizedResult, SourceRecord } from "../../supabase/functions/_shared/sourcing/types.ts";

const migration = readFileSync("supabase/migrations/20260901000000_ai_commerce_sourcing_foundation.sql", "utf8");
const routerSource = readFileSync("supabase/functions/_shared/sourcing/router.ts", "utf8");

function source(overrides: Partial<SourceRecord> & { slug: string }): SourceRecord {
  return {
    name: overrides.slug,
    access_method: "official_api",
    status: "active",
    categories: ["general"],
    conditions: ["new"],
    priority: 100,
    health_score: 100,
    api_key_ref: null,
    base_url: null,
    config: {},
    commercial_reuse_allowed: true,
    attribution_required: false,
    rate_limit_per_hour: null,
    ...overrides,
  };
}

function result(overrides: Partial<NormalizedResult> = {}): NormalizedResult {
  return {
    title: "Dell Latitude 5420",
    brand: "Dell",
    model: "Latitude 5420",
    category: "electronics",
    specifications: { cpu: "i7", ram: "16GB" },
    condition: "new",
    availability: "available_for_sourcing",
    currency: "USD",
    finalPriceUsd: 399,
    sourceSlug: "some-supplier",
    sourceName: "Some Supplier",
    sourceUrl: "https://supplier.example/item/1",
    sourceProductId: "SUP-1",
    sourcePriceUsd: 330,
    shippingUsd: 20,
    pricingRuleId: null,
    pricingBreakdown: { margin: 49 },
    attributionRequired: false,
    confidence: 0.8,
    retrievedAt: "2026-08-11T00:00:00Z",
    ...overrides,
  };
}

const rules: PricingRule[] = [
  { id: "a", name: "default", source_slug: null, category: null, condition: null,
    margin_percent: 15, margin_flat_usd: 0, fees_percent: 3, apply_to_used: false, round_to: 1, active: true },
  { id: "b", name: "electronics", source_slug: null, category: "electronics", condition: null,
    margin_percent: 10, margin_flat_usd: 5, fees_percent: 0, apply_to_used: false, round_to: 1, active: true },
  { id: "c", name: "supplier-specific", source_slug: "supplier-x", category: "electronics", condition: null,
    margin_percent: 5, margin_flat_usd: 0, fees_percent: 0, apply_to_used: false, round_to: 1, active: true },
];

describe("pricing engine", () => {
  it("prefers the most specific active rule", () => {
    expect(selectRule(rules, { sourceSlug: "supplier-x", category: "electronics", condition: "new" })?.id).toBe("c");
    expect(selectRule(rules, { sourceSlug: "other", category: "electronics", condition: "new" })?.id).toBe("b");
    expect(selectRule(rules, { sourceSlug: "other", category: "fashion", condition: "new" })?.id).toBe("a");
  });

  it("ignores inactive rules", () => {
    const off = rules.map((r) => (r.id === "b" ? { ...r, active: false } : r));
    expect(selectRule(off, { sourceSlug: "other", category: "electronics", condition: "new" })?.id).toBe("a");
  });

  it("adds shipping, fees and margin", () => {
    const priced = calculatePrice(
      { sourcePriceUsd: 100, shippingUsd: 10, condition: "new", category: null, sourceSlug: "s" },
      rules,
    );
    // (100 + 10) + 3% fees + 15% margin = 110 + 3.30 + 16.50 = 129.80 -> 130
    expect(priced.finalPriceUsd).toBe(130);
    expect(priced.ruleId).toBe("a");
  });

  it("never marks up a used listing unless the rule opts in", () => {
    const used = calculatePrice(
      { sourcePriceUsd: 200, shippingUsd: 0, condition: "used", category: null, sourceSlug: "s" },
      rules,
    );
    expect(used.breakdown.margin).toBe(0);
    expect(used.breakdown.margin_applied).toBe("skipped_used_listing");
    expect(used.finalPriceUsd).toBe(206); // fees only

    const optedIn = calculatePrice(
      { sourcePriceUsd: 200, shippingUsd: 0, condition: "used", category: null, sourceSlug: "s" },
      [{ ...rules[0], apply_to_used: true }],
    );
    expect(optedIn.breakdown.margin).toBe(30);
  });

  it("returns no price rather than guessing when the source has none", () => {
    const priced = calculatePrice(
      { sourcePriceUsd: null, shippingUsd: 10, condition: "new", category: null, sourceSlug: "s" },
      rules,
    );
    expect(priced.finalPriceUsd).toBeNull();
    expect(priced.breakdown.reason).toBe("no_source_price");
  });

  it("keeps margins out of the AI layer entirely", () => {
    // Prompts must never carry a margin. If this fails, pricing has leaked
    // into something a model can see and therefore change.
    const assistants = readFileSync("supabase/functions/_shared/assistants.ts", "utf8");
    expect(assistants).not.toMatch(/margin/i);
  });
});

describe("source confidentiality", () => {
  it("hides the supplier from customer-facing output by default", () => {
    const projected = projectForCustomer(result(), "VX-ABC123");
    expect(projected.priceUsd).toBe(399);
    expect(projected).not.toHaveProperty("sourceName");
    expect(projected).not.toHaveProperty("sourceUrl");
    for (const field of INTERNAL_ONLY_FIELDS) {
      expect(projected, `${field} leaked`).not.toHaveProperty(field);
    }
    expect(JSON.stringify(projected)).not.toContain("supplier.example");
    expect(JSON.stringify(projected)).not.toContain("330");
  });

  it("names the merchant when the agreement requires it", () => {
    // Confidentiality must never become a reason to breach a vendor's terms.
    const projected = projectForCustomer(result({ attributionRequired: true }), "VX-ABC123");
    expect(projected.sourceName).toBe("Some Supplier");
    expect(projected.sourceUrl).toBe("https://supplier.example/item/1");
  });

  it("is an allow-list, so a new internal field cannot leak by default", () => {
    const extended = { ...result(), secretInternalNote: "supplier discount 40%" } as NormalizedResult;
    const projected = projectForCustomer(extended, "VX-1");
    expect(JSON.stringify(projected)).not.toContain("supplier discount");
  });
});

describe("intent parsing", () => {
  it("reads condition from the wording in both languages", () => {
    expect(parseIntent("I need a used Dell laptop").condition).toBe("used");
    expect(parseIntent("بدي لابتوب مستعمل").condition).toBe("used");
    expect(parseIntent("refurbished iPhone").condition).toBe("refurbished");
    expect(parseIntent("a vacuum cleaner").condition).toBe("all");
  });

  it("an explicit filter overrides what the sentence implies", () => {
    expect(parseIntent("I need a used laptop", "new").condition).toBe("new");
  });

  it("routes assistive wording to the assistive category", () => {
    expect(parseIntent("I need an OCR device for blind users").category).toBe("assistive");
    expect(parseIntent("بدي جهاز قراءة للمكفوفين").category).toBe("assistive");
    expect(parseIntent("I need a vacuum cleaner").category).toBe("appliances");
    expect(parseIntent("I need a laptop for university").category).toBe("electronics");
  });

  it("extracts a budget ceiling", () => {
    expect(parseIntent("laptop i7 16GB around $500").maxPriceUsd).toBe(500);
    expect(parseIntent("laptop under 800 dollars").maxPriceUsd).toBe(800);
    expect(parseIntent("a laptop").maxPriceUsd).toBeNull();
  });

  it("drops stopwords that would match everything", () => {
    const intent = parseIntent("بدي أريد لابتوب");
    expect(intent.keywords).not.toContain("بدي");
    expect(intent.keywords).toContain("لابتوب");
  });
});

describe("source routing", () => {
  const sources = [
    source({ slug: "visionex-catalog", access_method: "internal", categories: ["all"], priority: 1 }),
    source({ slug: "general-shop", categories: ["general", "electronics", "appliances"], priority: 50 }),
    source({ slug: "assistive-shop", categories: ["assistive"], priority: 20 }),
    source({ slug: "used-market", categories: ["used", "general"], conditions: ["used"], priority: 55 }),
    source({ slug: "unverified-shop", status: "unverified", categories: ["general"] }),
    source({ slug: "disabled-shop", status: "disabled", categories: ["general"] }),
  ];

  it("always searches Visionex first", () => {
    const routed = routeSources(parseIntent("I need a laptop"), sources);
    expect(routed[0].slug).toBe("visionex-catalog");
  });

  it("never routes to an unverified or disabled source", () => {
    const slugs = routeSources(parseIntent("anything"), sources).map((s) => s.slug);
    expect(slugs).not.toContain("unverified-shop");
    expect(slugs).not.toContain("disabled-shop");
  });

  it("prefers assistive suppliers for assistive requests", () => {
    const slugs = routeSources(parseIntent("I need an OCR device for blind users"), sources).map((s) => s.slug);
    expect(slugs[1]).toBe("assistive-shop");
  });

  it("prefers general retail for a household request", () => {
    const slugs = routeSources(parseIntent("I need a vacuum cleaner"), sources).map((s) => s.slug);
    expect(slugs[1]).toBe("general-shop");
    expect(slugs).not.toContain("assistive-shop");
  });

  it("reaches used marketplaces only when used is wanted", () => {
    expect(routeSources(parseIntent("I need a used Dell laptop"), sources).map((s) => s.slug)).toContain("used-market");
    expect(routeSources(parseIntent("I need a new Dell laptop"), sources).map((s) => s.slug)).not.toContain("used-market");
  });

  it("names no vendor in the routing logic itself", () => {
    // Routing is driven by the sourcing_sources rows. A vendor name appearing
    // here would mean an admin can no longer add or retire a source without a
    // code change, which is the thing §4 forbids.
    for (const vendor of ["amazon", "alibaba", "shein", "ebay", "olx"]) {
      expect(routerSource.toLowerCase(), `${vendor} hard-coded in the router`).not.toContain(vendor);
    }
  });
});

describe("de-duplication and ranking", () => {
  it("collapses the same product from several suppliers, keeping the cheapest", () => {
    const merged = deduplicate([
      result({ sourceSlug: "a", finalPriceUsd: 420 }),
      result({ sourceSlug: "b", finalPriceUsd: 399 }),
      result({ sourceSlug: "c", finalPriceUsd: 450 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].finalPriceUsd).toBe(399);
  });

  it("treats a used listing as a different product from the new one", () => {
    expect(deduplicate([result({ condition: "new" }), result({ condition: "used" })])).toHaveLength(2);
  });

  it("prefers a priced offer over an unpriced duplicate", () => {
    const merged = deduplicate([result({ finalPriceUsd: null }), result({ finalPriceUsd: 380 })]);
    expect(merged[0].finalPriceUsd).toBe(380);
  });

  it("puts Visionex stock above an external match of equal confidence", () => {
    const ranked = rank(
      [result({ title: "External", availability: "external_recommendation" }),
       result({ title: "Ours", availability: "in_visionex" })],
      parseIntent("laptop"),
    );
    expect(ranked[0].title).toBe("Ours");
  });

  it("favours results inside the stated budget", () => {
    const ranked = rank(
      [result({ title: "Over", finalPriceUsd: 900 }), result({ title: "Within", finalPriceUsd: 480 })],
      parseIntent("laptop around $500"),
    );
    expect(ranked[0].title).toBe("Within");
  });

  it("separates new from used rather than interleaving them", () => {
    const grouped = groupByCondition([
      result({ condition: "new" }), result({ condition: "used" }), result({ condition: "refurbished" }),
    ]);
    expect(grouped.new).toHaveLength(1);
    expect(grouped.used).toHaveLength(1);
    expect(grouped.refurbished).toHaveLength(1);
  });
});

describe("registry safety rules in the schema", () => {
  it("a source cannot go active without a recorded terms review", () => {
    expect(migration).toContain("sourcing_sources_active_requires_review");
    expect(migration).toMatch(/terms_reviewed_at IS NOT NULL AND commercial_reuse_allowed/);
  });

  it("seeds every external example disabled and unverified", () => {
    for (const slug of ["amazon", "alibaba", "shein", "ebay", "olx"]) {
      const line = migration.split("\n").find((l) => l.includes(`('${slug}',`));
      expect(line, `${slug} seed row`).toBeDefined();
      expect(line, `${slug} must be seeded unverified`).toContain("'unverified'");
      expect(line, `${slug} must not be seeded with an access method`).toContain("'none'");
    }
  });

  it("keeps supplier identity server-side", () => {
    // No public or authenticated-user read policy on results.
    expect(migration).toContain("ALTER TABLE public.sourcing_results  ENABLE ROW LEVEL SECURITY");
    expect(migration).toMatch(/Admins manage/);
    expect(migration).not.toMatch(/sourcing_results[\s\S]{0,400}FOR SELECT TO public/);
  });

  it("stores a secret name, never a secret", () => {
    expect(migration).toMatch(/api_key_ref\s+text/);
    expect(migration).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
  });
});
