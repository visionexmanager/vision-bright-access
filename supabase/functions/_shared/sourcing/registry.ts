// Adapter registry.
//
// The database row decides *whether* and *when* a source is asked; this map
// decides *how* it is asked. A row whose slug has no adapter is skipped with a
// log line — so an admin adding a row for a vendor nobody has implemented yet
// produces nothing, not a crash and not a fabricated result.

import type { RawResult, SourceAdapter, SourceRecord, SourcingIntent } from "./types.ts";
import { visionexCatalogAdapter } from "./adapters/visionexCatalog.ts";
import { bazaarListingsAdapter } from "./adapters/bazaarListings.ts";
import { ebayBrowseAdapter } from "./adapters/ebayBrowse.ts";

const ADAPTERS: Record<string, SourceAdapter> = {
  // Visionex's own two shelves: the curated catalogue, and what shops on
  // VXBazaar have listed. Both `internal`, both searched before anyone else.
  [visionexCatalogAdapter.slug]: visionexCatalogAdapter,
  [bazaarListingsAdapter.slug]: bazaarListingsAdapter,

  // The first external source with an adapter. It is inert until
  // EBAY_CLIENT_ID/EBAY_CLIENT_SECRET exist — obtaining those is itself the
  // acceptance of eBay's API licence, which is why the row can be active
  // before the keys are.
  [ebayBrowseAdapter.slug]: ebayBrowseAdapter,

  // Further external adapters are added here as each source's terms are
  // verified and its row is switched to `active`. Until then their rows stay
  // 'unverified' and the router never reaches them. See
  // docs/ai-commerce-sourcing.md.
};

export function getAdapter(slug: string): SourceAdapter | null {
  return ADAPTERS[slug] ?? null;
}

export function registeredAdapterSlugs(): string[] {
  return Object.keys(ADAPTERS);
}

/**
 * Ask every routed source that has an adapter, in parallel.
 *
 * A source that throws or times out contributes nothing and does not fail the
 * request: a customer asking for a laptop should get the results that did
 * arrive, not an error because one supplier was down.
 */
export async function collectFromSources(
  intent: SourcingIntent,
  sources: SourceRecord[],
  perSourceLimit: number,
  timeoutMs = 8000,
): Promise<Array<{ source: SourceRecord; results: RawResult[] }>> {
  const runnable = sources.filter((source) => {
    if (getAdapter(source.slug)) return true;
    console.log(`[sourcing] no adapter for '${source.slug}' — skipped`);
    return false;
  });

  const settled = await Promise.allSettled(
    runnable.map(async (source) => {
      const adapter = getAdapter(source.slug)!;
      const results = await Promise.race([
        adapter.search(intent, source, perSourceLimit),
        new Promise<RawResult[]>((_, reject) =>
          setTimeout(() => reject(new Error(`${source.slug} timed out`)), timeoutMs),
        ),
      ]);
      return { source, results };
    }),
  );

  const collected: Array<{ source: SourceRecord; results: RawResult[] }> = [];
  for (const [index, outcome] of settled.entries()) {
    if (outcome.status === "fulfilled") {
      collected.push(outcome.value);
    } else {
      console.error(`[sourcing] ${runnable[index].slug} failed:`, outcome.reason?.message ?? outcome.reason);
    }
  }
  return collected;
}
