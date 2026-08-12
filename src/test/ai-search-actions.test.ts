import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// ai-source-products became the "source_products" action of ai-search. These
// pin that existing search is untouched, that the action is gated, and that
// every Phase 1 guarantee survived the move.

const search = readFileSync("supabase/functions/ai-search/index.ts", "utf8");
const handler = readFileSync("supabase/functions/_shared/sourcing/handler.ts", "utf8");
const client = readFileSync("src/lib/api/edgeFunctions.ts", "utf8");

describe("existing ai-search behaviour is unchanged", () => {
  it("treats a request with no action as a search", () => {
    // Every existing caller sends { query, source, limit } and no action.
    expect(search).toContain('typeof body.action === "string" ? body.action : "search"');
  });

  it("keeps the embedding search path intact", () => {
    expect(search).toContain("createEmbedding");
    expect(search).toContain('rpc("match_embeddings"');
    expect(search).toContain("filter_source: source ?? null");
  });

  it("keeps the services hydration added in Phase 3", () => {
    expect(search).toContain("SERVICES_BY_ID");
  });

  it("keeps the 429 handling for embedding rate limits", () => {
    expect(search).toContain("Rate limit exceeded");
    expect(search).toContain("e.status === 429");
  });

  it("still reads its own fields from the parsed body", () => {
    expect(search).toContain("const { query, source, limit = 8 } = body;");
  });
});

describe("the action is gated", () => {
  it("accepts exactly two actions", () => {
    expect(search).toContain('allowed: ["search", "source_products"]');
    expect(search).toContain("Unknown action");
  });

  it("cannot dispatch to an arbitrary handler", () => {
    expect(search).not.toMatch(/await import\(|new Function|eval\(/);
    // Dispatch is a literal comparison, not a table lookup on user input.
    expect(search).toContain('if (action === "source_products")');
  });

  it("peeks on a clone so the handler still receives an unread body", () => {
    // The handler parses the request itself; consuming the stream here would
    // have handed it an empty body — a silent, runtime-only failure.
    expect(search).toContain("await req.clone().json()");
    expect(search).toContain("return handleSourceProducts(req);");
  });
});

describe("Phase 1 guarantees survived the move", () => {
  it("still searches Visionex before any external source", () => {
    expect(handler).toContain("internalIsSufficient");
    expect(handler).toContain("const wentExternal = !internalIsSufficient(normalized)");
  });

  it("still refuses to pad results", () => {
    expect(handler).toContain("TARGET_RESULT_COUNT");
    expect(handler).toMatch(/Never pad to reach the target/);
  });

  it("still returns only the customer-facing projection", () => {
    expect(handler).toContain("projectForCustomer");
    // Supplier identity is written to the row, never to the response.
    expect(handler).toContain("source_slug: r.sourceSlug");
    expect(handler).not.toMatch(/return json\(\{[^}]*sourceSlug/);
  });

  it("still skips the margin engine for internal catalogue prices", () => {
    expect(handler).toContain("internal_catalog_price");
  });

  it("still groups new and used separately", () => {
    expect(handler).toContain("groupByCondition");
  });
});

describe("the old function is gone and the client follows", () => {
  it("removed the standalone function", () => {
    expect(existsSync("supabase/functions/ai-source-products")).toBe(false);
  });

  it("calls ai-search with the action instead", () => {
    expect(client).toContain('fn: "ai-search"');
    expect(client).toContain('action: "source_products"');
    expect(client).not.toContain('"ai-source-products"');
  });

  it("dropped the retired name from the function-name union", () => {
    const types = readFileSync("src/lib/types/ai.ts", "utf8");
    expect(types).not.toContain('"ai-source-products"');
    expect(types).toContain('"ai-search"');
  });
});
