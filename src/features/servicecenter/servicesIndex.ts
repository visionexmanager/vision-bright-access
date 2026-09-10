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
  /**
   * The one-line pitch, kept as its own field rather than only inside `text`.
   *
   * `text` is a retrieval string — every field concatenated so either language
   * finds the service — and it is unreadable as a sentence. The WhatsApp
   * service directory shows a sender the tagline under the title, so it needs
   * the line itself, not the haystack it was folded into.
   */
  tagline_en: string;
  tagline_ar: string;
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
    tagline_en: entry.tagline?.en ?? "",
    tagline_ar: entry.tagline?.ar ?? "",
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
