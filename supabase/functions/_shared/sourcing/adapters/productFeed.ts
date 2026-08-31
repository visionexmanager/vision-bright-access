// Any merchant who gives us a product feed.
//
// This is the honest route to a merchant with no public product API — SHEIN is
// the one in the seeded list, and most fashion retailers are the same: the
// catalogue is reachable through an affiliate network's feed or a supplier
// agreement, not through a search endpoint. It is also the route for a
// wholesaler who simply mails us a JSON file every morning.
//
// One adapter serves all of them because nothing here is merchant-specific.
// The row carries the feed URL (`base_url`), where the products sit inside it
// and what the fields are called (`config.fields`), and optionally the name of
// a secret to send as a bearer token (`config.auth_ref`). A row without a feed
// URL returns nothing and says so.
//
// A feed is a file, not a query, so it is fetched once and held for a few
// minutes: asking a network for a megabyte per customer question would be slow
// for them and rude to the merchant.

import type { RawResult, SourceAdapter, SourceRecord, SourcingIntent } from "../types.ts";
import {
  feedConfidence,
  feedFieldMap,
  jsonItemToRaw,
  matchesIntent,
  pluckList,
  type JsonFieldMap,
} from "./jsonProductShape.ts";

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_FEED_BYTES = 8 * 1024 * 1024;

const cache = new Map<string, { fetchedAt: number; items: Record<string, unknown>[] }>();

function configValue(source: SourceRecord, name: string): string | undefined {
  const value = source.config?.[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function loadFeed(source: SourceRecord, fields: JsonFieldMap): Promise<Record<string, unknown>[]> {
  const url = source.base_url!;
  const cached = cache.get(url);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.items;

  const authRef = configValue(source, "auth_ref");
  const token = authRef ? Deno.env.get(authRef) : undefined;
  if (authRef && !token) {
    console.log(`[sourcing] ${source.slug}: ${authRef} not set — source skipped`);
    return [];
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    console.error(`[sourcing] ${source.slug} feed failed: ${response.status}`);
    return [];
  }

  // A feed that has grown past what a request can hold is a configuration
  // problem, not something to stream into memory on a customer's question.
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > MAX_FEED_BYTES) {
    console.error(`[sourcing] ${source.slug} feed is ${length} bytes — over the limit, skipped`);
    return [];
  }

  const items = pluckList(await response.json(), fields.resultPath);
  cache.set(url, { fetchedAt: Date.now(), items });
  return items;
}

export const productFeedAdapter: SourceAdapter = {
  slug: "product-feed",

  async search(intent: SourcingIntent, source: SourceRecord, limit: number): Promise<RawResult[]> {
    const fields = feedFieldMap(source);
    if (!source.base_url || !fields) {
      console.error(`[sourcing] ${source.slug}: row is missing base_url or config.fields`);
      return [];
    }

    const items = await loadFeed(source, fields);
    if (items.length === 0) return [];

    return items
      .map((item) =>
        jsonItemToRaw(item, fields, {
          fallbackCategory: intent.category,
          // A feed is a snapshot. Somebody confirms the item is still there
          // and still that price before we promise it to anyone.
          availability: "requires_sourcing_confirmation",
          confidence: 0.35,
        })
      )
      .filter((result): result is RawResult => result !== null)
      .filter((result) => matchesIntent(result, intent))
      .map((result) => ({ ...result, confidence: feedConfidence(result, intent) }))
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, limit);
  },
};

/** Every merchant integrated through a feed shares the adapter above. */
export function feedAdapterFor(slug: string): SourceAdapter {
  return { ...productFeedAdapter, slug };
}
