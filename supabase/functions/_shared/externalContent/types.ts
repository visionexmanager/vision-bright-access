/**
 * External content providers — the shared vocabulary.
 *
 * Every open catalogue, museum, archive or media API the Library can search is
 * a `ContentProvider`. Each one turns its own response into the same
 * `ExternalContentItem`, so the page, the admin panel and any later caller
 * never learn a provider's shape.
 *
 * Pure types: no Deno, no DOM. The web app imports them too.
 */

/** What an item is. */
export type ContentType =
  | "image"
  | "audio"
  | "video"
  | "book"
  | "document"
  | "article"
  | "dataset"
  | "podcast"
  | "radio";

/** What a reader filters by. A provider serves one or more of these. */
export type ContentCategory = "images" | "audio" | "video" | "books" | "documents" | "education" | "data" | "news";

export const CONTENT_CATEGORIES: readonly ContentCategory[] = ["images", "audio", "video", "books", "documents", "education", "data", "news"];

/**
 * ready                  — answers now: keyless, or its credentials are set.
 * configuration_required — the adapter exists; a server secret is missing.
 * unsupported            — no safe, legal and reliable way in today.
 */
export type ProviderStatus = "ready" | "configuration_required" | "unsupported";

export type ProviderAuth =
  | { kind: "none" }
  /** Works keyless; credentials only raise the rate limit. */
  | { kind: "optional"; env: readonly string[] }
  | { kind: "api_key"; env: readonly string[] };

export interface ProviderCapabilities {
  search: boolean;
  /** Returns a URL the page can show or play directly. */
  preview: boolean;
  /** Returns an official iframe player on an allow-listed host. */
  embed: boolean;
  /** Returns a file URL, and only where the licence permits it. */
  download: boolean;
}

/** Static facts about a provider: what the registry and the admin panel show. */
export interface ProviderDescriptor {
  id: string;
  name: string;
  homepage: string;
  /** The official API documentation. */
  docs: string;
  categories: readonly ContentCategory[];
  auth: ProviderAuth;
  capabilities: ProviderCapabilities;
  /** What the provider's terms say about reuse, in one line. */
  licenseNote: string;
  /** Documented or observed limit, in one line. */
  rateLimit: string;
  /** Minimum gap between two calls from one server instance (a provider's published rule). */
  minIntervalMs?: number;
  /** A query the health check can expect results for. */
  healthQuery?: string;
}

export interface UnsupportedProvider {
  id: string;
  name: string;
  homepage: string;
  categories: readonly ContentCategory[];
  status: "unsupported";
  reason: string;
}

export interface ContentLicense {
  /** Short form as the provider states it: "CC BY-SA 4.0", "CC0", "Public domain". */
  name: string;
  url: string | null;
}

/** The one shape every provider normalises into. */
export interface ExternalContentItem {
  /** `${provider}:${providerItemId}` — stable, unique across providers. */
  id: string;
  provider: string;
  providerName: string;
  providerItemId: string;
  title: string;
  description: string | null;
  /** The provider's own text alternative for an image, when it publishes one. */
  altText: string | null;
  contentType: ContentType;
  mimeType: string | null;
  thumbnailUrl: string | null;
  /** A file the page can show or play directly (image, audio, video). */
  previewUrl: string | null;
  /** An official iframe player; always on an allow-listed host. */
  embedUrl: string | null;
  /** The item's page at the provider. Always present. */
  externalUrl: string;
  /** Only when the licence or the provider's terms allow a download. */
  downloadUrl: string | null;
  /** WebVTT captions, where the provider publishes them. */
  captionsUrl: string | null;
  /**
   * The captions file itself, filled in only when an item is resolved: caption
   * hosts send no CORS headers, so the page cannot load captionsUrl as a track.
   */
  captionsVtt?: string;
  creator: string | null;
  publisher: string | null;
  durationSeconds: number | null;
  sizeBytes: number | null;
  language: string | null;
  /** Only what the provider states. Never inferred. */
  license: ContentLicense | null;
  /** Credit line to show with the item, when the provider gives one or requires one. */
  attribution: string | null;
  tags: string[];
  /** ISO date or a year, as the provider gives it. */
  publishedAt: string | null;
  /** True when the item must be resolved (`getItem`) before it can be played. */
  needsResolve: boolean;
}

export interface SearchParams {
  query: string;
  /** Empty means every category the provider serves. */
  categories: readonly ContentCategory[];
  /** Reader's language, ISO 639-1. */
  language: string;
  /** 1-based. */
  page: number;
  /** Per provider. */
  limit: number;
}

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export type GetEnv = (name: string) => string | undefined;

export interface ProviderContext {
  fetch: Fetch;
  env: GetEnv;
  signal?: AbortSignal;
}

export interface ContentProvider extends ProviderDescriptor {
  search(params: SearchParams, ctx: ProviderContext): Promise<ExternalContentItem[]>;
  /** Resolves an item the search could only describe (e.g. NASA video files). */
  getItem?(providerItemId: string, ctx: ProviderContext): Promise<ExternalContentItem | null>;
}

/** Why a provider did not answer — a code, never a raw message (URLs can carry keys). */
export type ProviderErrorCode = "timeout" | "rate_limited" | "http_error" | "network" | "invalid_response" | "not_configured";

export type ProviderRunState = "ok" | "empty" | "skipped" | ProviderErrorCode;

export interface ProviderRun {
  provider: string;
  state: ProviderRunState;
  count: number;
  latencyMs: number;
}

export interface AggregateResult {
  items: ExternalContentItem[];
  providers: ProviderRun[];
  /** Items dropped as duplicates of another provider's result. */
  duplicates: number;
}

/** A provider as the web app sees it: facts plus the state this server is in. */
export interface ProviderSummary extends ProviderDescriptor {
  status: ProviderStatus;
  /** Env var names that are still unset. Names only, never values. */
  missingEnv: string[];
}

export type HealthState = "healthy" | "degraded" | "down" | "not_configured";

export interface ProviderHealth {
  provider: string;
  state: HealthState;
  latencyMs: number | null;
  resultCount: number;
  errorCode: ProviderErrorCode | null;
  checkedAt: string;
}
