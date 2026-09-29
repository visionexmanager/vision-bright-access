// ─── Library — external content sources ────────────────────────────────────
// Open catalogues, museums, archives and media APIs, searched server-side by
// the library-research-assistant edge function (content_* modes). Provider
// keys never reach the browser: this module only sees normalised items and
// provider states. Types come straight from the server module so the two
// sides cannot drift.

import { supabase } from "@/integrations/supabase/client";
import type {
  AggregateResult, ContentCategory, ExternalContentItem, ProviderHealth, ProviderSummary, UnsupportedProvider,
} from "../../../supabase/functions/_shared/externalContent/types.ts";

export type {
  ContentCategory, ContentType, ExternalContentItem, HealthState, ProviderHealth, ProviderRun, ProviderSummary, UnsupportedProvider,
} from "../../../supabase/functions/_shared/externalContent/types.ts";
export { CONTENT_CATEGORIES } from "../../../supabase/functions/_shared/externalContent/types.ts";
export { isAllowedEmbed } from "../../../supabase/functions/_shared/externalContent/embed.ts";

export interface ExternalSearchRequest {
  query: string;
  categories?: ContentCategory[];
  providers?: string[];
  language?: string;
  page?: number;
  limit?: number;
}

export type ExternalSearchResponse = AggregateResult & { page: number };

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("library-research-assistant", { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function searchExternalContent(request: ExternalSearchRequest): Promise<ExternalSearchResponse> {
  return invoke<ExternalSearchResponse>({ mode: "content_search", ...request });
}

export async function resolveExternalItem(itemId: string): Promise<ExternalContentItem> {
  const data = await invoke<{ item: ExternalContentItem }>({ mode: "content_item", item_id: itemId });
  return data.item;
}

export function fetchExternalProviders(): Promise<{ providers: ProviderSummary[]; unsupported: UnsupportedProvider[] }> {
  return invoke({ mode: "content_providers" });
}

/** Admin only: runs a live check of every provider and saves the result. */
export async function runExternalProviderHealthCheck(): Promise<ProviderHealth[]> {
  const data = await invoke<{ health: ProviderHealth[] }>({ mode: "content_health" });
  return data.health;
}

/** Admin only (RLS): the last saved check per provider, in the shape a live check returns. */
export async function fetchStoredProviderHealth(): Promise<ProviderHealth[]> {
  const { data, error } = await supabase
    .from("library_external_provider_health")
    .select("provider_id, state, latency_ms, result_count, error_code, checked_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    provider: row.provider_id,
    // The table's CHECK constraints hold these to the same vocabularies.
    state: row.state as ProviderHealth["state"],
    latencyMs: row.latency_ms,
    resultCount: row.result_count,
    errorCode: row.error_code as ProviderHealth["errorCode"],
    checkedAt: row.checked_at,
  }));
}
