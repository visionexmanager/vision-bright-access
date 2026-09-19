// The service catalogue could never be indexed: ai_embeddings.source_id is a
// uuid and catalogue ids are slugs, so every upsert failed (the daily content
// run reported services = -1). Each slug now maps to a stable uuid.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../supabase/functions/_shared/aiProvider.ts", () => ({
  createEmbedding: vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2])),
}));

// A variable path keeps the app type check out of the Deno provider modules.
const indexPath = "../../supabase/functions/_shared/contentIndex.ts";
const index = await import(/* @vite-ignore */ indexPath) as {
  serviceSourceId: (slug: string) => Promise<string>;
  catalogServicesByStoredId: () => Promise<Map<string, { id: string }>>;
  indexSources: (db: unknown, requested: string[]) => Promise<Record<string, number>>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("service ids in the index", () => {
  it("are valid, stable and distinct uuids", async () => {
    const a = await index.serviceSourceId("egg-incubator");
    expect(a).toMatch(UUID);
    expect(await index.serviceSourceId("egg-incubator")).toBe(a);
    expect(await index.serviceSourceId("sports-coach")).not.toBe(a);
  });

  it("are what the indexer writes, and what search maps back", async () => {
    const upserts: Array<{ source_table: string; source_id: string }> = [];
    const db = {
      from: () => ({
        upsert: async (rows: Array<{ source_table: string; source_id: string }>) => {
          upserts.push(...rows);
          return { error: null };
        },
      }),
    };
    const summary = await index.indexSources(db, ["services"]);
    expect(summary.services).toBeGreaterThan(0);
    expect(upserts.every((row) => UUID.test(row.source_id))).toBe(true);

    const byStoredId = await index.catalogServicesByStoredId();
    expect(byStoredId.get(upserts[0].source_id)?.id).toBeTruthy();

    const search = readFileSync("supabase/functions/ai-search/index.ts", "utf8");
    expect(search).toContain("await catalogServicesByStoredId()");
  });
});
