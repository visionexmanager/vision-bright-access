/**
 * Searches every ready provider that serves the requested categories, in
 * parallel with a concurrency cap, under one overall deadline. A provider that
 * fails, times out or is throttled is reported by code and skipped; the others
 * still answer. Results are interleaved so no single provider fills the page,
 * then de-duplicated across providers.
 *
 * Nothing is stored beyond a short in-memory cache of search results per
 * server instance: metadata and links, never media files.
 */

import { errorCode, getText, mapLimit, ProviderError } from "./http.ts";
import { CONTENT_PROVIDERS, providerById, providerStatus } from "./registry.ts";
import type {
  AggregateResult, ContentCategory, ContentProvider, ExternalContentItem, Fetch, GetEnv, ProviderContext,
  ProviderHealth, ProviderRun, SearchParams,
} from "./types.ts";
import { CONTENT_CATEGORIES } from "./types.ts";

export const MAX_QUERY_CHARS = 200;
export const MAX_PAGE = 20;
export const MAX_PER_PROVIDER = 12;
const DEFAULT_DEADLINE_MS = 12_000;
const DEFAULT_CONCURRENCY = 8;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 300;
const MAX_CAPTIONS_CHARS = 400_000;

// ─── Cache ────────────────────────────────────────────────────────────────

export class ResultCache {
  private entries = new Map<string, { at: number; items: ExternalContentItem[] }>();
  constructor(private ttlMs = CACHE_TTL_MS, private maxEntries = CACHE_MAX_ENTRIES, private now = () => Date.now()) {}

  get(key: string): ExternalContentItem[] | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (this.now() - hit.at > this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    // Re-insert so the Map's order is least-recently-used first.
    this.entries.delete(key);
    this.entries.set(key, hit);
    return hit.items;
  }

  set(key: string, items: ExternalContentItem[]): void {
    this.entries.delete(key);
    this.entries.set(key, { at: this.now(), items });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

const sharedCache = new ResultCache();
const lastCall = new Map<string, number>();

// ─── Input ────────────────────────────────────────────────────────────────

export interface SearchInput {
  query: string;
  categories?: readonly string[];
  providers?: readonly string[];
  language?: string;
  page?: number;
  limit?: number;
}

export type NormalizedInput = SearchParams & { providers: string[] };

/** Clamps and validates what a caller sent. Returns null when there is nothing to search. */
export function normalizeSearchInput(input: SearchInput): NormalizedInput | null {
  const query = typeof input.query === "string" ? input.query.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_CHARS) : "";
  if (query.length < 2) return null;
  const categories = (Array.isArray(input.categories) ? input.categories : [])
    .filter((c): c is ContentCategory => (CONTENT_CATEGORIES as readonly string[]).includes(c));
  const providers = (Array.isArray(input.providers) ? input.providers : [])
    .filter((p): p is string => typeof p === "string" && !!providerById(p));
  const language = typeof input.language === "string" && /^[a-z]{2}$/i.test(input.language.slice(0, 2)) ? input.language.slice(0, 2).toLowerCase() : "en";
  const page = Number.isInteger(input.page) ? Math.min(Math.max(input.page as number, 1), MAX_PAGE) : 1;
  const limit = Number.isInteger(input.limit) ? Math.min(Math.max(input.limit as number, 1), MAX_PER_PROVIDER) : 6;
  return { query, categories: [...new Set(categories)], providers: [...new Set(providers)], language, page, limit };
}

/** Ready providers that serve at least one requested category (or any, when none is requested). */
export function selectProviders(input: NormalizedInput, env: GetEnv, registry: readonly ContentProvider[] = CONTENT_PROVIDERS): ContentProvider[] {
  return registry.filter((p) =>
    providerStatus(p, env) === "ready" &&
    // A provider with a small quota answers only when a search names it.
    (input.providers.length === 0 ? !p.optIn : input.providers.includes(p.id)) &&
    (input.categories.length === 0 || p.categories.some((c) => input.categories.includes(c))));
}

// ─── Merge ────────────────────────────────────────────────────────────────

/**
 * One address in a form that two providers' spellings of it share: no scheme, no
 * "www.", no tracking query, no trailing slash. The query is dropped EXCEPT the
 * parameters that name the resource (YouTube's `v` and `list`), because
 * `youtube.com/watch?v=A` and `youtube.com/watch?v=B` are different videos, and
 * stripping the query made every YouTube result look like a copy of the first.
 */
function normalizeUrl(url: string | null): string | null {
  if (!url) return null;
  let keep = "";
  try {
    const u = new URL(url);
    const named = ["v", "list"].flatMap((name) => (u.searchParams.has(name) ? [`${name}=${u.searchParams.get(name)}`] : []));
    if (named.length) keep = `?${named.join("&")}`;
  } catch {
    // Not an absolute address: no query to keep.
  }
  return url.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[?#].*$/, "").replace(/\/+$/, "") + keep.toLowerCase();
}

function normalizeText(text: string | null): string {
  return (text ?? "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Keys that identify the same work across providers. */
export function dedupeKeys(item: ExternalContentItem): string[] {
  const keys = [item.externalUrl, item.previewUrl, item.downloadUrl]
    .map(normalizeUrl).filter((k): k is string => !!k).map((k) => `url:${k}`);
  const title = normalizeText(item.title);
  const creator = normalizeText(item.creator);
  // A bare title ("Moon") is not proof of sameness; with the same creator it is.
  if (title.length >= 4 && creator) keys.push(`work:${item.contentType}:${title}:${creator}`);
  return keys;
}

/** Round-robin across providers, then drop anything already seen. */
export function mergeResults(perProvider: ExternalContentItem[][]): { items: ExternalContentItem[]; duplicates: number } {
  const seen = new Set<string>();
  const items: ExternalContentItem[] = [];
  let duplicates = 0;
  const longest = Math.max(0, ...perProvider.map((list) => list.length));
  for (let i = 0; i < longest; i++) {
    for (const list of perProvider) {
      const item = list[i];
      if (!item) continue;
      const keys = dedupeKeys(item);
      if (seen.has(item.id) || keys.some((k) => seen.has(k))) {
        duplicates++;
        continue;
      }
      seen.add(item.id);
      keys.forEach((k) => seen.add(k));
      items.push(item);
    }
  }
  return { items, duplicates };
}

// ─── Search ───────────────────────────────────────────────────────────────

export interface AggregateOptions {
  deadlineMs?: number;
  concurrency?: number;
  cache?: ResultCache | null;
  registry?: readonly ContentProvider[];
  now?: () => number;
  /** Called once per provider that did not answer. Receives codes only. */
  onProviderError?: (provider: string, code: string) => void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function retryable(err: unknown): boolean {
  const code = errorCode(err);
  if (code === "network") return true;
  return err instanceof ProviderError && code === "http_error" && (err.status ?? 0) >= 500;
}

export async function searchExternalContent(
  input: NormalizedInput,
  deps: { fetch: Fetch; env: GetEnv },
  options: AggregateOptions = {},
): Promise<AggregateResult> {
  const now = options.now ?? (() => Date.now());
  const cache = options.cache === undefined ? sharedCache : options.cache;
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const selected = selectProviders(input, deps.env, options.registry);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("deadline", "TimeoutError")), deadlineMs);
  const startedAt = now();
  const ctx: ProviderContext = { fetch: deps.fetch, env: deps.env, signal: controller.signal };
  // A provider that ignores the abort signal still loses the race to the deadline.
  const deadline = new Promise<never>((_, reject) => {
    controller.signal.addEventListener("abort", () => reject(new ProviderError("timeout")), { once: true });
  });
  deadline.catch(() => {});
  const params: SearchParams = { query: input.query, categories: input.categories, language: input.language, page: input.page, limit: input.limit };

  const runOne = async (provider: ContentProvider): Promise<{ run: ProviderRun; items: ExternalContentItem[] }> => {
    const began = now();
    const key = `${provider.id}|${params.query.toLowerCase()}|${[...params.categories].sort().join(",")}|${params.language}|${params.page}|${params.limit}`;
    const cached = cache?.get(key);
    if (cached) return { run: { provider: provider.id, state: cached.length ? "ok" : "empty", count: cached.length, latencyMs: 0 }, items: cached };

    if (provider.minIntervalMs) {
      const last = lastCall.get(provider.id) ?? -Infinity;
      if (now() - last < provider.minIntervalMs) return { run: { provider: provider.id, state: "skipped", count: 0, latencyMs: 0 }, items: [] };
      lastCall.set(provider.id, now());
    }

    for (let attempt = 1; ; attempt++) {
      try {
        const items = await Promise.race([provider.search(params, ctx), deadline]);
        cache?.set(key, items);
        return { run: { provider: provider.id, state: items.length ? "ok" : "empty", count: items.length, latencyMs: now() - began }, items };
      } catch (err) {
        const timeLeft = deadlineMs - (now() - startedAt);
        if (attempt === 1 && retryable(err) && timeLeft > 3000 && !controller.signal.aborted) {
          await sleep(250);
          continue;
        }
        const code = errorCode(err);
        options.onProviderError?.(provider.id, code);
        return { run: { provider: provider.id, state: code, count: 0, latencyMs: now() - began }, items: [] };
      }
    }
  };

  try {
    const settled = await mapLimit(selected, options.concurrency ?? DEFAULT_CONCURRENCY, runOne);
    const outcomes = settled.map((s, i) => s.status === "fulfilled"
      ? s.value
      : { run: { provider: selected[i].id, state: "network" as const, count: 0, latencyMs: 0 }, items: [] });
    const { items, duplicates } = mergeResults(outcomes.map((o) => o.items));
    return { items, providers: outcomes.map((o) => o.run), duplicates };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Single item ──────────────────────────────────────────────────────────

/** "nasa:PIA12345" -> the provider's fresh, fully resolved item, or null. */
export async function resolveExternalItem(itemId: string, deps: { fetch: Fetch; env: GetEnv }): Promise<ExternalContentItem | null> {
  if (typeof itemId !== "string" || itemId.length > 300) return null;
  const colon = itemId.indexOf(":");
  if (colon <= 0) return null;
  const provider = providerById(itemId.slice(0, colon));
  const providerItemId = itemId.slice(colon + 1);
  if (!provider?.getItem || !providerItemId || providerStatus(provider, deps.env) !== "ready") return null;
  const ctx = { fetch: deps.fetch, env: deps.env };
  const item = await provider.getItem(providerItemId, ctx);
  if (!item?.captionsUrl) return item;
  try {
    const vtt = await getText(ctx, item.captionsUrl);
    if (vtt.startsWith("WEBVTT") && vtt.length <= MAX_CAPTIONS_CHARS) return { ...item, captionsVtt: vtt };
  } catch {
    // Captions are an addition; the item still plays without them.
  }
  return item;
}

// ─── Health ───────────────────────────────────────────────────────────────

const SLOW_MS = 5000;

export async function checkProviderHealth(provider: ContentProvider, deps: { fetch: Fetch; env: GetEnv }, now = () => Date.now()): Promise<ProviderHealth> {
  const checkedAt = new Date(now()).toISOString();
  if (providerStatus(provider, deps.env) !== "ready") {
    return { provider: provider.id, state: "not_configured", latencyMs: null, resultCount: 0, errorCode: "not_configured", checkedAt };
  }
  const began = now();
  try {
    const items = await provider.search(
      { query: provider.healthQuery ?? "water", categories: [], language: "en", page: 1, limit: 3 },
      { fetch: deps.fetch, env: deps.env },
    );
    const latencyMs = now() - began;
    const healthy = items.length > 0 && latencyMs < SLOW_MS;
    return { provider: provider.id, state: healthy ? "healthy" : "degraded", latencyMs, resultCount: items.length, errorCode: null, checkedAt };
  } catch (err) {
    const code = errorCode(err);
    return { provider: provider.id, state: code === "rate_limited" ? "degraded" : "down", latencyMs: now() - began, resultCount: 0, errorCode: code, checkedAt };
  }
}

export async function checkAllProviders(deps: { fetch: Fetch; env: GetEnv }, registry: readonly ContentProvider[] = CONTENT_PROVIDERS): Promise<ProviderHealth[]> {
  const settled = await mapLimit(registry, 8, (p) => checkProviderHealth(p, deps));
  return settled.map((s, i) => s.status === "fulfilled"
    ? s.value
    : { provider: registry[i].id, state: "down" as const, latencyMs: null, resultCount: 0, errorCode: "network" as const, checkedAt: new Date().toISOString() });
}
