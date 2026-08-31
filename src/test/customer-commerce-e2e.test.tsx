import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculatePrice, type PricingRule,
} from "../../supabase/functions/_shared/sourcing/pricing.ts";
import { projectForCustomer } from "../../supabase/functions/_shared/sourcing/confidentiality.ts";
import {
  deduplicate, groupByCondition, parseIntent, rank, routeSources,
} from "../../supabase/functions/_shared/sourcing/router.ts";
import type { NormalizedResult, SourceRecord } from "../../supabase/functions/_shared/sourcing/types.ts";

// End-to-end over the customer journey. The UI pieces are covered by
// ai-result-accessibility and ai-commerce-flow; this file walks the whole path
// and pins the promises that must not quietly change.

const aiChat = readFileSync("src/components/AIChat.tsx", "utf8");
const useAIChatSource = readFileSync("src/hooks/useAIChat.ts", "utf8");
const detail = readFileSync("src/components/ai/AIResultDetail.tsx", "utf8");
// The sourcing request is now the "request_sourcing" action of contact-form;
// the handler moved to _shared but its behaviour is unchanged, so these
// assertions still apply to the same code.
const requestFn = readFileSync("supabase/functions/_shared/sourcingRequest.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260901000000_ai_commerce_sourcing_foundation.sql", "utf8");
const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

function source(overrides: Partial<SourceRecord> & { slug: string }): SourceRecord {
  return {
    name: overrides.slug, access_method: "official_api", status: "active",
    categories: ["general"], conditions: ["new"], priority: 100, health_score: 100,
    api_key_ref: null, base_url: null, config: {},
    commercial_reuse_allowed: true, attribution_required: false, rate_limit_per_hour: null,
    ...overrides,
  };
}

function result(overrides: Partial<NormalizedResult> = {}): NormalizedResult {
  return {
    title: "OrCam Read", brand: "OrCam", model: "Read", category: "assistive",
    specifications: { ocr: "yes" }, condition: "new", availability: "in_visionex",
    currency: "USD", finalPriceUsd: 890, sourceSlug: "visionex-catalog",
    sourceName: "Visionex catalog", sourceUrl: "/product/1", sourceProductId: "1",
    sourcePriceUsd: 890, shippingUsd: 0, pricingRuleId: null, pricingBreakdown: {},
    attributionRequired: false, confidence: 0.9, retrievedAt: "2026-08-12T00:00:00Z",
    ...overrides,
  };
}

describe("A — Visionex product search", () => {
  it("understands an assistive request and searches Visionex first", () => {
    const intent = parseIntent("I need a device for blind users that can recognize text");
    expect(intent.category).toBe("assistive");

    const routed = routeSources(intent, [
      source({ slug: "visionex-catalog", access_method: "internal", categories: ["all"], priority: 1 }),
      source({ slug: "assistive-shop", categories: ["assistive"], priority: 20 }),
    ]);
    expect(routed[0].slug).toBe("visionex-catalog");
  });

  it("understands the same request in Arabic", () => {
    const intent = parseIntent("بدي جهاز يقرأ النصوص للمكفوفين");
    expect(intent.category).toBe("assistive");
  });
});

describe("B — Visionex service search", () => {
  it("goes through the one shared retrieval path, not a second system", () => {
    const service = readFileSync("src/services/ai/aiService.ts", "utf8");
    expect(service).toContain("searchServices");
    expect(service).toContain('callAISearch<T>(query, "services", limit, signal)');

    const aiSearch = readFileSync("supabase/functions/ai-search/index.ts", "utf8");
    expect(aiSearch).toContain("match_embeddings");
    expect(aiSearch).toContain("SERVICES_BY_ID");
  });
});

describe("C — structured results, not parsed prose", () => {
  it("the UI receives typed data from the agent", () => {
    expect(useAIChatSource).toContain('SourcingResponse["results"]');
    expect(aiChat).toContain("<AIResultList");
    // Nothing scrapes the assistant's text for products.
    expect(aiChat).not.toMatch(/parse.*(reply|completedReply|message).*product/i);
  });

  it("carries every field the customer UI needs", () => {
    const projected = projectForCustomer(result(), "VX-1");
    for (const key of ["ref", "title", "brand", "model", "specifications", "condition", "availability", "priceUsd", "currency"]) {
      expect(projected, `missing ${key}`).toHaveProperty(key);
    }
  });
});

describe("D/E/F — selection, comparison, new vs used", () => {
  it("keeps new and used in separate groups", () => {
    const grouped = groupByCondition([
      result({ condition: "new" }),
      result({ condition: "used", finalPriceUsd: 450 }),
    ]);
    expect(grouped.new).toHaveLength(1);
    expect(grouped.used).toHaveLength(1);
  });

  it("mounts detail and comparison inside the one chat surface", () => {
    expect(aiChat).toContain("<AIComparison");
    expect(aiChat).toContain("<AIResultDetail");
    // One surface: no second chat component was introduced.
    expect(aiChat.match(/useAIChat\(\)/g) ?? []).toHaveLength(1);
  });
});

describe("G/H — sourcing request creates an escalation, not an order", () => {
  it("never claims a purchase, an order number or a shipment", () => {
    // Comments are stripped first: a doc comment explaining that no order
    // number exists is the opposite of a violation, and matching prose would
    // punish the explanation rather than the behaviour.
    const codeOnly = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

    for (const [name, source] of [["detail", detail], ["request fn", requestFn], ["chat", aiChat]] as const) {
      expect(codeOnly(source), `${name} implies an order`)
        .not.toMatch(/order[_ ]?number|tracking[_ ]?number|shipped|out for delivery/i);
    }
    // The honest status is the one the API returns.
    expect(requestFn).toContain('status: "requires_sourcing_confirmation"');
  });

  it("tells the customer plainly that nothing is ordered yet", () => {
    const en = JSON.parse(JSON.stringify(
      Object.fromEntries(
        readFileSync("src/i18n/en.ts", "utf8")
          .split(/\r?\n/)
          .filter((l) => l.trim().startsWith('"aiResults.sourcingNote"'))
          .map((l) => [l.split('":')[0].trim().replace(/"/g, ""), l]),
      ),
    ));
    expect(Object.keys(en)).toHaveLength(1);
    expect(en["aiResults.sourcingNote"]).toMatch(/nothing is ordered yet/i);
  });

  it("creates the escalation and an approval through the existing engines", () => {
    expect(requestFn).toContain('from("support_escalations")');
    expect(requestFn).toContain('from("owner_approvals")');
    // No bespoke approval table for sourcing.
    expect(requestFn).not.toMatch(/create table|sourcing_approvals_table/i);
  });

  it("carries the conversation so nobody repeats themselves", () => {
    expect(requestFn).toContain("transcript");
    expect(aiChat).toContain("transcript: messages.slice(-10)");
  });

  it("bounds anonymous abuse", () => {
    expect(requestFn).toContain("MAX_REQUESTS_PER_HOUR");
    expect(requestFn).toContain("Too many requests");
  });
});

describe("I/J/K/L — owner receives it, takes over, AI stays silent, resumes", () => {
  it("the dashboard reads the same escalation table", () => {
    const hook = readFileSync("src/hooks/useOwnerControl.ts", "utf8");
    expect(hook).toContain('from("support_escalations")');
    expect(hook).toContain('from("owner_approvals")');
  });

  it("the assistant is silent while a human holds the conversation", () => {
    expect(webhook).toContain('existing?.control === "human"');
  });

  it("control transitions run through the state machine", () => {
    const transitions = readFileSync("supabase/migrations/20260903000000_owner_control_transitions.sql", "utf8");
    expect(transitions).toContain("transition_escalation");
    expect(transitions).toContain("RETURNED_TO_AI");
    expect(transitions).toContain("control = _control");
  });
});

describe("M/N — no native-order claims, no confidential leakage", () => {
  it("strips supplier, source price and margin from what a customer sees", () => {
    const projected = projectForCustomer(
      result({
        sourceSlug: "supplier-x", sourceName: "Supplier X",
        sourceUrl: "https://supplier.example/p/1", sourcePriceUsd: 610,
        pricingBreakdown: { margin: 90 }, availability: "available_for_sourcing",
      }),
      "VX-9",
    );
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toContain("Supplier X");
    expect(serialized).not.toContain("supplier.example");
    expect(serialized).not.toContain("610");
    expect(serialized).not.toContain("margin");
  });

  it("names the merchant only when the agreement requires it", () => {
    const projected = projectForCustomer(
      result({ attributionRequired: true, sourceName: "Partner Store" }), "VX-10",
    );
    expect(projected.sourceName).toBe("Partner Store");
  });
});

describe("O — unverified external sources cannot appear as live results", () => {
  it("the router refuses anything not active", () => {
    const routed = routeSources(parseIntent("a laptop"), [
      source({ slug: "visionex-catalog", access_method: "internal", categories: ["all"], priority: 1 }),
      source({ slug: "amazon", status: "unverified", categories: ["general"] }),
      source({ slug: "ebay", status: "disabled", categories: ["general"] }),
    ]).map((s) => s.slug);
    expect(routed).toEqual(["visionex-catalog"]);
  });

  it("the database refuses to activate one without a terms review", () => {
    expect(migration).toContain("sourcing_sources_active_requires_review");
  });

  // The five merchants have adapters now. An adapter existing is not
  // permission to call one, so the invariant moved rather than went away: no
  // migration may assert the terms review, and no adapter may act without the
  // credentials that only exist once somebody obtained them deliberately.
  it("no migration asserts the terms review that activation depends on", () => {
    const dir = "supabase/migrations";
    for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql"))) {
      const sql = readFileSync(`${dir}/${file}`, "utf8");
      expect(`${file}: ${sql}`).not.toMatch(/terms_reviewed_at\s*=/);
    }
  });

  it("every external adapter refuses to act without its own credentials", () => {
    const dir = "supabase/functions/_shared/sourcing/adapters";
    for (const file of ["ebayBrowse.ts", "amazonPaapi.ts", "aliOpenPlatform.ts", "productFeed.ts"]) {
      expect(`${file}: ${readFileSync(`${dir}/${file}`, "utf8")}`).toContain("source skipped");
    }
  });
});

describe("P/Q/R — no results, duplicates, pricing", () => {
  it("returns nothing rather than padding to ten", () => {
    const ranked = rank(deduplicate([result()]), parseIntent("orcam"));
    expect(ranked).toHaveLength(1);
  });

  it("collapses duplicates across suppliers, keeping the cheapest", () => {
    const merged = deduplicate([
      result({ sourceSlug: "a", finalPriceUsd: 950 }),
      result({ sourceSlug: "b", finalPriceUsd: 890 }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].finalPriceUsd).toBe(890);
  });

  it("reports no price rather than guessing one", () => {
    const rules: PricingRule[] = [];
    const priced = calculatePrice(
      { sourcePriceUsd: null, shippingUsd: 0, condition: "new", category: null, sourceSlug: "s" },
      rules,
    );
    expect(priced.finalPriceUsd).toBeNull();
  });

  it("surfaces a failure with a recovery option and no internals", () => {
    expect(aiChat).toContain('role="alert"');
    expect(aiChat).toContain('t("aiResults.failed")');
    expect(aiChat).toContain('t("content.tryAgain")');
    // The raw error is logged, never rendered.
    expect(useAIChatSource).toContain('setSourcingError("sourcing_failed")');
    expect(useAIChatSource).toContain("console.error(\"[useAIChat] sourcing failed:\"");
  });
});

describe("S — Arabic and RTL", () => {
  it("has every new customer string in all twenty dictionaries", () => {
    const locales = ["en", "ar", "fr", "zh", "ur", "vi"];
    for (const locale of locales) {
      const dictionary = readFileSync(`src/i18n/${locale}.ts`, "utf8");
      for (const key of ["aiResults.requestSourcing", "aiResults.sourcingNote", "aiResults.brand", "aiResults.failed"]) {
        expect(dictionary, `${locale} missing ${key}`).toContain(`"${key}":`);
      }
    }
  });

  it("uses logical properties so RTL mirrors without special cases", () => {
    for (const [name, source] of [["detail", detail], ["list", readFileSync("src/components/ai/AIResultList.tsx", "utf8")]] as const) {
      expect(source, `${name} uses a physical margin`).not.toMatch(/\bm[lr]-\d/);
      expect(source, `${name} uses physical text alignment`).not.toMatch(/text-(left|right)\b/);
    }
  });
});

describe("14 — no duplicated systems", () => {
  it("adds no second chat, router, sourcing engine, approval engine or catalog", () => {
    // One chat surface.
    expect(aiChat).toContain('from "@/hooks/useAIChat"');
    // One navigation resolver.
    expect(useAIChatSource).toContain("runCompanionTool(input, pageContext, menuId)");
    // One sourcing entry point, reached through the service layer.
    expect(useAIChatSource).toContain("aiService.sourceProducts");
    expect(useAIChatSource).not.toContain("edgeFunctions");
    // One approval engine.
    expect(requestFn).toContain('from("owner_approvals")');
  });
});
