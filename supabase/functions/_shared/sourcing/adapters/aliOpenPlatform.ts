// AliExpress and Alibaba.com, through their open platforms.
//
// One adapter, two sources. The gateway URL, the API method and the field map
// come from the row, so moving Alibaba.com's endpoint or adding a third
// gateway in the same family is an admin edit, not a deploy.
//
// Inert without credentials: the row names its key (`api_key_ref`) and the
// secret is that name with `_KEY` swapped for `_SECRET`. Missing either one
// logs a line and returns nothing, so an active row with no keys costs a
// customer neither an error nor a wait.

import type { RawResult, SourceAdapter, SourceRecord, SourcingIntent } from "../types.ts";
import {
  aliFieldMap,
  aliRequestParams,
  aliSignature,
  aliTimestamp,
  credentialNames,
} from "./aliMapping.ts";
import { jsonItemToRaw, pluckList } from "./jsonProductShape.ts";

function configString(source: SourceRecord, name: string): string | undefined {
  const value = source.config?.[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function aliOpenPlatformAdapter(slug: string): SourceAdapter {
  return {
    slug,

    async search(intent: SourcingIntent, source: SourceRecord, limit: number): Promise<RawResult[]> {
      const keywords = intent.keywords.join(" ").trim() || intent.query.trim();
      if (keywords.length < 2) return [];

      const gateway = source.base_url;
      const method = configString(source, "method");
      const fields = aliFieldMap(source);
      if (!gateway || !method || !fields) {
        console.error(`[sourcing] ${slug}: row is missing base_url, config.method or a field map`);
        return [];
      }

      const names = credentialNames(source);
      const appKey = Deno.env.get(names.key);
      const appSecret = Deno.env.get(names.secret);
      if (!appKey || !appSecret) {
        console.log(`[sourcing] ${slug}: ${names.key}/${names.secret} not set — source skipped`);
        return [];
      }

      const params = aliRequestParams({
        appKey,
        method,
        timestamp: aliTimestamp(new Date()),
        keywords,
        limit,
        minPriceUsd: intent.minPriceUsd,
        maxPriceUsd: intent.maxPriceUsd,
      });
      params.sign = await aliSignature(params, appSecret, configString(source, "sign_path"));

      const response = await fetch(gateway, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params),
      });

      if (!response.ok) {
        console.error(`[sourcing] ${slug} gateway failed: ${response.status}`);
        return [];
      }

      const body = await response.json();

      // A gateway that rejects the call answers 200 with an error envelope.
      // Logging the code is what turns a silent "no results" into something an
      // admin can act on. It reaches no customer.
      const envelope = (body as { error_response?: { code?: unknown; msg?: unknown } }).error_response;
      if (envelope) {
        console.error(`[sourcing] ${slug} returned error ${String(envelope.code)}: ${String(envelope.msg)}`);
        return [];
      }

      return pluckList(body, fields.resultPath)
        .map((item) =>
          jsonItemToRaw(item, fields, {
            fallbackCategory: intent.category,
            // We can buy this and resell it: a supplier route, not stock we
            // hold, and not a link handed to the customer.
            availability: "available_for_sourcing",
            confidence: 0.45,
          })
        )
        .filter((result): result is RawResult => result !== null)
        .slice(0, limit);
    },
  };
}

export const aliexpressAdapter = aliOpenPlatformAdapter("aliexpress");
export const alibabaAdapter = aliOpenPlatformAdapter("alibaba");
