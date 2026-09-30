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
    metadata: item.metadata ?? null,
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

const CONTENT_TYPES: readonly string[] = ["image", "audio", "video", "book", "document", "article", "dataset", "podcast", "radio", "channel", "playlist"];

/** The caller's shelf, newest first, in the same shape a search returns (RLS: only their own rows). */
export async function fetchSavedExternalItems(): Promise<ExternalContentItem[]> {
  const { data, error } = await supabase
    .from("library_saved_external_items")
    .select("item_id, provider, provider_name, title, content_type, description, creator, thumbnail_url, external_url, download_url, license_name, license_url, attribution, language, published_at, metadata")
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
      metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata as ExternalContentItem["metadata"] : undefined,
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

// ─── YouTube (official Data API, discovery only) ───────────────────────────
//
// Searched server-side by the same function, behind the same plan gate and daily
// ceiling as every other source. The key never reaches this file: what comes back
// is normalised items, a page token, or a VisionEX error code.

export type YouTubeResourceType = "video" | "channel" | "playlist";
export type YouTubeOrder = "relevance" | "date" | "viewCount";

export interface YouTubeSearchRequest {
  query: string;
  type?: YouTubeResourceType;
  order?: YouTubeOrder;
  language?: string;
  region?: string;
  captions?: boolean;
  hd?: boolean;
  duration?: "short" | "medium" | "long";
  channelId?: string;
  pageToken?: string;
  limit?: number;
}

export interface YouTubePage {
  items: ExternalContentItem[];
  nextPageToken: string | null;
  prevPageToken: string | null;
  totalResults: number | null;
  cached: boolean;
}

export type YouTubeErrorCode =
  | "youtube_not_configured" | "youtube_unavailable" | "youtube_quota_exceeded" | "youtube_rate_limited"
  | "youtube_invalid_request" | "youtube_not_found" | "youtube_timeout" | "youtube_bad_response" | "youtube_failed";

const KNOWN_YOUTUBE_ERRORS: readonly string[] = [
  "youtube_not_configured", "youtube_unavailable", "youtube_quota_exceeded", "youtube_rate_limited", "youtube_invalid_request",
  "youtube_not_found", "youtube_timeout", "youtube_bad_response", "youtube_failed",
];

export class YouTubeRequestError extends Error {
  constructor(readonly code: YouTubeErrorCode | "daily_limit" | "network") {
    super(code);
    this.name = "YouTubeRequestError";
  }
}

/** The VisionEX code in a function's error answer (a non-2xx response carries it in its body). */
async function youtubeErrorCode(error: unknown, data: unknown): Promise<YouTubeRequestError> {
  const fromBody = (body: unknown): YouTubeRequestError | null => {
    const code = (body as { error?: unknown } | null)?.error;
    if (typeof code === "string" && KNOWN_YOUTUBE_ERRORS.includes(code)) return new YouTubeRequestError(code as YouTubeErrorCode);
    if (typeof code === "string" && /daily limit/i.test(code)) return new YouTubeRequestError("daily_limit");
    return null;
  };
  const direct = fromBody(data);
  if (direct) return direct;
  const response = (error as { context?: Response } | null)?.context;
  if (response && typeof response.json === "function") {
    try {
      const parsed = fromBody(await response.clone().json());
      if (parsed) return parsed;
    } catch { /* not JSON: fall through */ }
  }
  return new YouTubeRequestError("youtube_failed");
}

async function youtubeInvoke<T>(body: Record<string, unknown>): Promise<T> {
  let result: { data: unknown; error: unknown };
  try {
    result = await supabase.functions.invoke("library-research-assistant", { body });
  } catch {
    throw new YouTubeRequestError("network");
  }
  if (result.error || (result.data as { ok?: unknown } | null)?.ok === false || (result.data as { error?: unknown } | null)?.error) {
    throw await youtubeErrorCode(result.error, result.data);
  }
  return result.data as T;
}

export async function searchYouTube(request: YouTubeSearchRequest): Promise<YouTubePage> {
  const { query, ...filters } = request;
  const data = await youtubeInvoke<YouTubePage & { ok: true }>({ mode: "youtube_search", query, youtube: filters });
  return { items: data.items, nextPageToken: data.nextPageToken, prevPageToken: data.prevPageToken, totalResults: data.totalResults, cached: data.cached };
}

export async function fetchYouTubeResource(type: YouTubeResourceType, id: string): Promise<ExternalContentItem> {
  const data = await youtubeInvoke<{ ok: true; item: ExternalContentItem }>({ mode: "youtube_resource", resource_type: type, resource_id: id });
  return data.item;
}
