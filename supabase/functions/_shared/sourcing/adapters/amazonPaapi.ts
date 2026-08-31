// Amazon, through the Product Advertising API 5.0.
//
// Inert without `AMAZON_PAAPI_ACCESS_KEY`, `AMAZON_PAAPI_SECRET_KEY` and
// `AMAZON_PARTNER_TAG`. Worth saying plainly: PA-API access is granted only
// after an Associates account has made qualifying sales, so this source is the
// slowest of the five to come alive — the code is not the obstacle, the
// approval is.

import type { RawResult, SourceAdapter, SourceRecord, SourcingIntent } from "../types.ts";
import {
  amazonItemToRaw,
  PAAPI_HOST,
  PAAPI_PATH,
  PAAPI_TARGET,
  searchItemsPayload,
  signSearchItems,
  type PaapiItem,
} from "./amazonMapping.ts";

export const amazonPaapiAdapter: SourceAdapter = {
  slug: "amazon",

  async search(intent: SourcingIntent, _source: SourceRecord, limit: number): Promise<RawResult[]> {
    const accessKey = Deno.env.get("AMAZON_PAAPI_ACCESS_KEY");
    const secretKey = Deno.env.get("AMAZON_PAAPI_SECRET_KEY");
    const partnerTag = Deno.env.get("AMAZON_PARTNER_TAG");
    if (!accessKey || !secretKey || !partnerTag) {
      console.log("[sourcing] amazon: PA-API credentials not set — source skipped");
      return [];
    }

    const payload = searchItemsPayload(intent, partnerTag, limit);
    if (!payload) return [];

    const signed = await signSearchItems(payload, accessKey, secretKey, new Date());

    const response = await fetch(`https://${PAAPI_HOST}${PAAPI_PATH}`, {
      method: "POST",
      headers: {
        "content-encoding": "amz-1.0",
        "content-type": "application/json; charset=utf-8",
        "x-amz-date": signed.amzDate,
        "x-amz-target": PAAPI_TARGET,
        Authorization: signed.authorization,
      },
      body: payload,
    });

    if (!response.ok) {
      console.error(`[sourcing] amazon PA-API failed: ${response.status}`);
      return [];
    }

    const body = await response.json() as { SearchResult?: { Items?: PaapiItem[] } };

    return (body.SearchResult?.Items ?? [])
      .map((item) => amazonItemToRaw(item, intent.category))
      .filter((result): result is RawResult => result !== null)
      .slice(0, limit);
  },
};
