// Adapter registry.
//
// The database row decides *whether* and *when* a source is asked; this map
// decides *how* it is asked. A row whose slug has no adapter is skipped with a
// log line — so an admin adding a row for a vendor nobody has implemented yet
// produces nothing, not a crash and not a fabricated result.

import type { RawResult, SourceAdapter, SourceRecord, SourcingIntent } from "./types.ts";
import { visionexCatalogAdapter } from "./adapters/visionexCatalog.ts";
import { bazaarListingsAdapter } from "./adapters/bazaarListings.ts";
import { assistiveGuideAdapter } from "./adapters/assistiveGuide.ts";
import { ebayBrowseAdapter } from "./adapters/ebayBrowse.ts";
import { alibabaAdapter, aliexpressAdapter } from "./adapters/aliOpenPlatform.ts";
import { amazonPaapiAdapter } from "./adapters/amazonPaapi.ts";
import { feedAdapterFor } from "./adapters/productFeed.ts";

const ADAPTERS: Record<string, SourceAdapter> = {
  // Visionex's own two shelves: the curated catalogue, and what shops on
  // VXBazaar have listed. Both `internal`, both searched before anyone else.
  [visionexCatalogAdapter.slug]: visionexCatalogAdapter,
  [bazaarListingsAdapter.slug]: bazaarListingsAdapter,

  // The one source that needs nothing at all — no key, no approval, no
  // network. Researched assistive equipment with the range the market
  // charges, so the agent has a real answer for its own audience on a day
  // when every merchant is still switched off.
  [assistiveGuideAdapter.slug]: assistiveGuideAdapter,

  // The five merchants, each through the only mechanism its owner permits:
  // eBay and Amazon have search APIs, the two Alibaba platforms share a
  // gateway design, and SHEIN — which publishes no product API — is reached
  // the way fashion retail actually is, through a feed.
  //
  // Every one of them is inert without its own credentials, and every one of
  // them still has to pass the terms review the database demands before its
  // row can go `active`. An adapter existing is not permission to call it.
  [ebayBrowseAdapter.slug]: ebayBrowseAdapter,
  [amazonPaapiAdapter.slug]: amazonPaapiAdapter,
  [aliexpressAdapter.slug]: aliexpressAdapter,
  [alibabaAdapter.slug]: alibabaAdapter,
  shein: feedAdapterFor("shein"),

  // A merchant with no API and no bespoke adapter is added by giving its row a
  // feed URL and a field map — no deploy. See docs/ai-commerce-sourcing.md.
  "product-feed": feedAdapterFor("product-feed"),
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
