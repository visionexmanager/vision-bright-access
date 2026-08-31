// eBay, through the official Browse API.
//
// The first external source with an adapter. It exists because the internal
// catalogue cannot answer every question: a person asking for a used laptop
// under $400 is asking about a market Visionex does not stock, and the honest
// answer is a real listing, not silence.
//
// Three things make it safe to ship dark:
//
//  1. No credentials, no calls. `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` are
//     read once; without them the adapter logs a line and returns nothing, so
//     an active row costs a customer neither an error nor a wait.
//  2. Attribution, not concealment. The `ebay` row sets
//     `attribution_required`, so §8's supplier confidentiality steps aside and
//     the customer is shown eBay's name and eBay's link — which is what the
//     API's licence asks for, and what makes this a recommendation rather than
//     a resale.
//  3. No margin. A pricing rule scoped to this source passes the listing price
//     through untouched: marking up an item the buyer will pay eBay for
//     directly would put a number on the page that nobody ever charges.

import type { RawResult, SourceAdapter, SourceRecord, SourcingIntent } from "../types.ts";
import {
  buildBrowseQuery,
  EBAY_BROWSE_URL,
  EBAY_MARKETPLACE,
  EBAY_OAUTH_URL,
  EBAY_SCOPE,
  ebayItemToRaw,
  type EbayItemSummary,
} from "./ebayMapping.ts";

/** Application tokens last two hours; re-minting one per search is waste. */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function applicationToken(): Promise<string | null> {
  const clientId = Deno.env.get("EBAY_CLIENT_ID");
  const clientSecret = Deno.env.get("EBAY_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    console.log("[sourcing] ebay: EBAY_CLIENT_ID/EBAY_CLIENT_SECRET not set — source skipped");
    return null;
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const response = await fetch(EBAY_OAUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: EBAY_SCOPE }),
  });

  if (!response.ok) {
    console.error(`[sourcing] ebay token request failed: ${response.status}`);
    return null;
  }

  const body = await response.json() as { access_token?: string; expires_in?: number };
  if (!body.access_token) return null;

  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + Math.max(60, body.expires_in ?? 7200) * 1000,
  };
  return cachedToken.value;
}

export const ebayBrowseAdapter: SourceAdapter = {
  slug: "ebay",

  async search(intent: SourcingIntent, _source: SourceRecord, limit: number): Promise<RawResult[]> {
    const query = buildBrowseQuery(intent, limit);
    if (!query) return [];

    const token = await applicationToken();
    if (!token) return [];

    const url = new URL(EBAY_BROWSE_URL);
    url.searchParams.set("q", query.q);
    url.searchParams.set("filter", query.filter);
    url.searchParams.set("limit", String(query.limit));

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": EBAY_MARKETPLACE,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      // A stale cached token is the one failure worth retrying, and the cheapest
      // retry is to drop it so the next search mints a fresh one.
      if (response.status === 401) cachedToken = null;
      console.error(`[sourcing] ebay browse failed: ${response.status}`);
      return [];
    }

    const body = await response.json() as { itemSummaries?: EbayItemSummary[] };

    return (body.itemSummaries ?? [])
      .map((item) => ebayItemToRaw(item, intent.category))
      .filter((result): result is RawResult => result !== null)
      .slice(0, limit);
  },
};
