// ─── Library — external content sources ────────────────────────────────────
// Open catalogues, museums, archives and media APIs, searched server-side by
// the library-research-assistant edge function (content_* modes). Provider
// keys never reach the browser: this module only sees normalised items and
// provider states. Types come straight from the server module so the two
// sides cannot drift.

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
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

// ─── My Library: saving an external result ─────────────────────────────────
//
// Metadata and links only. The table takes writes from one RPC that re-checks
// the shape and the caller's plan, so this module only ever sends what the
// search already showed.

export type SaveErrorCode = "subscription_required" | "library_full" | "failed";

export class SaveExternalItemError extends Error {
  constructor(readonly code: SaveErrorCode) {
    super(code);
    this.name = "SaveExternalItemError";
  }
}

function saveErrorCode(error: { message?: string } | null): SaveErrorCode {
  const message = error?.message ?? "";
  if (message.includes("subscription_required")) return "subscription_required";
  if (message.includes("library_full")) return "library_full";
  return "failed";
}

/** The fields the shelf keeps — never the media, captions or anything a provider sent beyond them. */
export function savedPayload(item: ExternalContentItem): Record<string, Json> {
  return {
    id: item.id, provider: item.provider, providerName: item.providerName, title: item.title, contentType: item.contentType,
    description: item.description, creator: item.creator, thumbnailUrl: item.thumbnailUrl, externalUrl: item.externalUrl,
    downloadUrl: item.downloadUrl, license: item.license ? { name: item.license.name, url: item.license.url } : null,
    attribution: item.attribution, language: item.language, publishedAt: item.publishedAt,
  };
}

export async function saveExternalItem(item: ExternalContentItem, note?: string): Promise<void> {
  const { error } = await supabase.rpc("library_save_external_item", { _item: savedPayload(item), _note: note });
  if (error) throw new SaveExternalItemError(saveErrorCode(error));
}

/** True when something was removed. Not plan-gated: a lapsed plan can still tidy its shelf. */
export async function unsaveExternalItem(itemId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("library_unsave_external_item", { _item_id: itemId });
  if (error) throw new SaveExternalItemError("failed");
  return data === true;
}

const CONTENT_TYPES: readonly string[] = ["image", "audio", "video", "book", "document", "article", "dataset", "podcast", "radio"];

/** The caller's shelf, newest first, in the same shape a search returns (RLS: only their own rows). */
export async function fetchSavedExternalItems(): Promise<ExternalContentItem[]> {
  const { data, error } = await supabase
    .from("library_saved_external_items")
    .select("item_id, provider, provider_name, title, content_type, description, creator, thumbnail_url, external_url, download_url, license_name, license_url, attribution, language, published_at")
    .order("saved_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    if (!CONTENT_TYPES.includes(row.content_type)) return [];
    const item: ExternalContentItem = {
      id: row.item_id, provider: row.provider, providerName: row.provider_name, providerItemId: row.item_id.slice(row.provider.length + 1),
      title: row.title, description: row.description, altText: null, contentType: row.content_type as ExternalContentItem["contentType"],
      mimeType: null, thumbnailUrl: row.thumbnail_url, previewUrl: null, embedUrl: null, externalUrl: row.external_url,
      downloadUrl: row.download_url, captionsUrl: null, creator: row.creator, publisher: null, durationSeconds: null, sizeBytes: null,
      language: row.language, license: row.license_name ? { name: row.license_name, url: row.license_url } : null,
      attribution: row.attribution, tags: [], publishedAt: row.published_at, needsResolve: false,
    };
    return [item];
  });
}

// ─── Research projects: an external result as a reference ──────────────────

/**
 * One line for a bibliography, made of names, a year and the address — no
 * sentence to translate: "Creator (2026). Title. Source. Licence. https://…".
 * It is what lands in a research project as a `reference` item, exactly as the
 * research assistant's OpenAlex, Open Library and Wikipedia references do.
 */
export function citationFor(item: ExternalContentItem): string {
  const year = item.publishedAt?.match(/\d{4}/)?.[0];
  const who = item.creator ? `${item.creator} (${year ?? "n.d."}).` : year ? `(${year}).` : "";
  return [who, `${item.title}.`, `${item.providerName}.`, item.license ? `${item.license.name}.` : "", item.externalUrl]
    .filter(Boolean).join(" ").slice(0, 1000);
}
