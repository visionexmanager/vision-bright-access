import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SERVICE_CATALOG } from "@/features/servicecenter/catalog";
import { buildServicesIndex, SERVICES_INDEX_PATH } from "@/features/servicecenter/servicesIndex";

// The approved decision was to index the existing catalogue rather than create
// a second service table. That only holds if the snapshot the indexer reads
// cannot drift from the catalogue.

const snapshot = JSON.parse(readFileSync(SERVICES_INDEX_PATH, "utf8"));
const embedContent = readFileSync("supabase/functions/embed-content/index.ts", "utf8");

describe("services index snapshot", () => {
  it("matches the catalogue exactly", () => {
    // Regenerate with: npx vite-node scripts/generate-services-index.ts
    expect(snapshot).toEqual(buildServicesIndex());
  });

  it("covers every service in the catalogue", () => {
    expect(snapshot).toHaveLength(SERVICE_CATALOG.length);
    expect(new Set(snapshot.map((s: { id: string }) => s.id)).size).toBe(SERVICE_CATALOG.length);
  });

  it("carries both languages so either finds a service", () => {
    for (const service of snapshot as Array<{ id: string; text: string }>) {
      const entry = SERVICE_CATALOG.find((e) => e.slug === service.id)!;
      expect(service.text, `${service.id} missing English title`).toContain(entry.title.en);
      expect(service.text, `${service.id} missing Arabic title`).toContain(entry.title.ar);
    }
  });

  it("keeps a usable destination for every service", () => {
    for (const service of snapshot as Array<{ id: string; path: string }>) {
      expect(service.path, `${service.id} path`).toMatch(/^\//);
    }
  });
});

describe("no duplicate service catalogue", () => {
  it("creates no services table", () => {
    // A migration adding one would mean the catalogue is no longer the single
    // source of truth, which is what the approved decision ruled out.
    const migrations = readFileSync("supabase/migrations/20260901000000_ai_commerce_sourcing_foundation.sql", "utf8");
    expect(migrations).not.toMatch(/CREATE TABLE[^;]*public\.services\b/i);
  });

  it("indexes services into the same ai_embeddings store", () => {
    expect(embedContent).toContain('source_table: SERVICES_SOURCE');
    expect(embedContent).toContain('from("ai_embeddings")');
  });

  it("still excludes library_books, which has its own index", () => {
    expect(embedContent).not.toMatch(/^\s*library_books:/m);
  });
});
