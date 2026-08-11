import { SERVICE_CATALOG } from "./catalog";

/**
 * Retrieval records derived from the service catalogue.
 *
 * The catalogue stays the single source of truth — the approved decision was
 * to index it, not duplicate it into a table. The semantic indexer is a Deno
 * edge function that cannot import from `src/`, so this shape is snapshotted
 * to JSON by `scripts/generate-services-index.ts` and read from there.
 */
export interface IndexedService {
  id: string;
  title_en: string;
  title_ar: string;
  hub: string;
  kind: string;
  path: string;
  difficulty: string;
  vx: number | null;
  text: string;
}

/** One retrieval string per service covering both languages, so either finds it. */
export function buildServicesIndex(): IndexedService[] {
  return SERVICE_CATALOG.map((entry) => ({
    id: entry.slug,
    title_en: entry.title.en,
    title_ar: entry.title.ar,
    hub: entry.hub,
    kind: entry.kind,
    path: entry.to,
    difficulty: entry.difficulty,
    vx: entry.vx ?? null,
    text: [
      entry.title.en,
      entry.title.ar,
      entry.hub,
      entry.kind,
      entry.tagline?.en,
      entry.tagline?.ar,
      ...(entry.keywords?.en ?? []),
      ...(entry.keywords?.ar ?? []),
      ...(entry.intents ?? []),
    ]
      .filter(Boolean)
      .join(". "),
  }));
}

export const SERVICES_INDEX_PATH = "supabase/functions/_shared/data/servicesCatalog.json";
