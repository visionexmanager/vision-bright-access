// Commerce Agent sourcing, served as the "source_products" action of
// ai-search. Extracted verbatim from the ai-source-products function: same
// Visionex-first search, same permitted-source gating, same pricing engine and
// same customer-facing projection.
// AI Commerce Agent: understand → search Visionex → decide if that is enough
// → ask permitted external sources → normalize → de-duplicate → rank → price.
//
// Returns only the customer-facing projection. Supplier identity, source URL,
// source price and the margin breakdown are written to `sourcing_results`,
// which is admin-read only, and never included in the response.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../cors.ts";
import { calculatePrice, type PricingRule } from "./pricing.ts";
import { projectForCustomer } from "./confidentiality.ts";
import { collectFromSources } from "./registry.ts";
import {
  deduplicate,
  groupByCondition,
  parseIntent,
  rank,
  routeSources,
} from "./router.ts";
import {
  TARGET_RESULT_COUNT,
  type ConditionFilter,
  type NormalizedResult,
  type SourceRecord,
} from "./types.ts";

const CONDITION_FILTERS: ConditionFilter[] = ["new", "used", "refurbished", "all"];

/**
 * When the internal catalogue already answers the question well, there is no
 * reason to spend an external call. "Well" means enough confident matches to
 * fill a useful list.
 */
function internalIsSufficient(results: NormalizedResult[]): boolean {
  const strong = results.filter((r) => r.confidence >= 0.5);
  return strong.length >= Math.ceil(TARGET_RESULT_COUNT / 2);
}

export async function handleSourceProducts(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { query, condition, channel = "website" } = await req.json().catch(() => ({}));

    if (typeof query !== "string" || query.trim().length < 2 || query.length > 500) {
      return json({ error: "A search query between 2 and 500 characters is required." }, 400);
    }
    const conditionFilter: ConditionFilter =
      CONDITION_FILTERS.includes(condition) ? condition : "all";

    // Identify the caller if they are signed in; anonymous sourcing is allowed
    // but is rate-accounted by the caller's own limits upstream.
    const authHeader = req.headers.get("Authorization");
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined,
    );
    const { data: { user } } = await anon.auth.getUser();

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const intent = parseIntent(query, conditionFilter === "all" ? undefined : conditionFilter);

    const [{ data: sourceRows }, { data: ruleRows }] = await Promise.all([
      db.from("sourcing_sources").select("*").eq("status", "active"),
      db.from("pricing_rules").select("*").eq("active", true),
    ]);

    const sources = (sourceRows ?? []) as unknown as SourceRecord[];
    const rules = (ruleRows ?? []) as unknown as PricingRule[];
    const routed = routeSources(intent, sources);

    if (routed.length === 0) {
      return json({ results: { new: [], used: [], refurbished: [] }, total: 0, note: "no_active_sources" });
    }

    const internalSources = routed.filter((s) => s.access_method === "internal");
    const externalSources = routed.filter((s) => s.access_method !== "internal");

    const normalize = (
      raw: Awaited<ReturnType<typeof collectFromSources>>[number],
    ): NormalizedResult[] =>
      raw.results.map((item) => {
        const condition = item.condition ?? "new";
        const isInternal = raw.source.access_method === "internal";

        // A catalogue price is already the Visionex price. Running it through
        // the margin engine would charge our own customers a second markup.
        const priced = isInternal
          ? { finalPriceUsd: item.sourcePriceUsd ?? null, ruleId: null, breakdown: { reason: "internal_catalog_price" } }
          : calculatePrice(
              {
                sourcePriceUsd: item.sourcePriceUsd ?? null,
                shippingUsd: item.shippingUsd ?? 0,
                condition,
                category: item.category ?? intent.category,
                sourceSlug: raw.source.slug,
              },
              rules,
            );

        return {
          title: item.title,
          brand: item.brand ?? null,
          model: item.model ?? null,
          category: item.category ?? intent.category,
          specifications: item.specifications ?? {},
          condition,
          availability:
            item.availability ?? (isInternal ? "in_visionex" : "requires_sourcing_confirmation"),
          currency: item.currency ?? "USD",
          finalPriceUsd: priced.finalPriceUsd,
          sourceSlug: raw.source.slug,
          sourceName: raw.source.name,
          sourceUrl: item.sourceUrl ?? null,
          sourceProductId: item.sourceProductId ?? null,
          sourcePriceUsd: item.sourcePriceUsd ?? null,
          shippingUsd: item.shippingUsd ?? 0,
          pricingRuleId: priced.ruleId,
          pricingBreakdown: priced.breakdown,
          attributionRequired: raw.source.attribution_required,
          confidence: item.confidence ?? 0.5,
          retrievedAt: new Date().toISOString(),
        } satisfies NormalizedResult;
      });

    // Visionex first, always.
    const internalRaw = await collectFromSources(intent, internalSources, TARGET_RESULT_COUNT);
    let normalized = internalRaw.flatMap(normalize);

    // Only reach outside when our own catalogue does not answer the question.
    const wentExternal = !internalIsSufficient(normalized) && externalSources.length > 0;
    if (wentExternal) {
      const externalRaw = await collectFromSources(intent, externalSources, TARGET_RESULT_COUNT);
      normalized = [...normalized, ...externalRaw.flatMap(normalize)];
    }

    // Never pad to reach the target: fewer honest results beat invented ones.
    const ranked = rank(deduplicate(normalized), intent).slice(0, TARGET_RESULT_COUNT);

    const { data: request } = await db
      .from("sourcing_requests")
      .insert({
        user_id: user?.id ?? null,
        channel,
        query: query.trim(),
        intent: intent as unknown as Record<string, unknown>,
        condition_filter: conditionFilter,
        sources_used: [...new Set(ranked.map((r) => r.sourceSlug))],
        result_count: ranked.length,
      })
      .select("id")
      .single();

    const refs = new Map<NormalizedResult, string>();
    if (request?.id && ranked.length > 0) {
      const { data: stored } = await db
        .from("sourcing_results")
        .insert(
          ranked.map((r) => ({
            request_id: request.id,
            title: r.title,
            brand: r.brand,
            model: r.model,
            category: r.category,
            specifications: r.specifications,
            condition: r.condition,
            availability: r.availability,
            final_price_usd: r.finalPriceUsd,
            currency: r.currency,
            source_slug: r.sourceSlug,
            source_url: r.sourceUrl,
            source_product_id: r.sourceProductId,
            source_price_usd: r.sourcePriceUsd,
            shipping_usd: r.shippingUsd,
            pricing_rule_id: r.pricingRuleId,
            pricing_breakdown: r.pricingBreakdown,
            confidence: r.confidence,
            retrieved_at: r.retrievedAt,
          })),
        )
        .select("visionex_ref");

      (stored ?? []).forEach((row, index) => {
        if (ranked[index]) refs.set(ranked[index], row.visionex_ref as string);
      });
    }

    const grouped = groupByCondition(ranked);
    const project = (list: NormalizedResult[]) =>
      list.map((r) => projectForCustomer(r, refs.get(r) ?? "VX-PENDING"));

    return json({
      results: {
        new: project(grouped.new),
        used: project(grouped.used),
        refurbished: project(grouped.refurbished),
      },
      total: ranked.length,
      searchedExternally: wentExternal,
    });
  } catch (error) {
    console.error("[ai-source-products] error:", error);
    return json({ error: "Sourcing failed" }, 500);
  }
}
