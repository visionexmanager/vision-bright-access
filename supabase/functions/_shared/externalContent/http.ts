/**
 * The small toolkit every adapter shares: a fetch with a timeout that fails
 * with a code instead of a message, text and URL sanitisers, and the licence
 * vocabulary.
 *
 * Error messages never carry the request URL: several providers take their key
 * as a query parameter, and whatever reaches a log or a response is public.
 */

import type { ContentCategory, ContentLicense, ContentType, ExternalContentItem, ProviderContext, ProviderErrorCode } from "./types.ts";

export const USER_AGENT = "Visionex-Library/1.0 (+https://visionex.app)";
export const PROVIDER_TIMEOUT_MS = 8000;

export class ProviderError extends Error {
  constructor(readonly code: ProviderErrorCode, readonly status?: number) {
    super(code);
    this.name = "ProviderError";
  }
}

/** Maps anything a fetch can throw to a code. */
export function errorCode(err: unknown): ProviderErrorCode {
  if (err instanceof ProviderError) return err.code;
  const name = (err as { name?: string } | null)?.name;
  if (name === "TimeoutError" || name === "AbortError") return "timeout";
  if (err instanceof SyntaxError) return "invalid_response";
  // The research-assistant adapters throw Error("HTTP <status>").
  const status = Number((err as { message?: string } | null)?.message?.match(/^HTTP (\d{3})$/)?.[1]);
  if (status === 429) return "rate_limited";
  if (status) return "http_error";
  return "network";
}

function timeoutSignal(parent?: AbortSignal): AbortSignal | undefined {
  // AbortSignal.timeout is in Deno and every current browser; jsdom lacks it.
  const own = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(PROVIDER_TIMEOUT_MS) : undefined;
  if (!parent) return own;
  if (!own) return parent;
  return typeof AbortSignal.any === "function" ? AbortSignal.any([parent, own]) : own;
}

async function request(ctx: ProviderContext, url: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await ctx.fetch(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, ...(init.headers as Record<string, string> | undefined) },
      signal: timeoutSignal(ctx.signal),
    });
  } catch (err) {
    throw new ProviderError(errorCode(err));
  }
  if (res.status === 429) throw new ProviderError("rate_limited", 429);
  if (!res.ok) throw new ProviderError("http_error", res.status);
  return res;
}

export async function getJson<T = unknown>(ctx: ProviderContext, url: string, init: RequestInit = {}): Promise<T> {
  const res = await request(ctx, url, { ...init, headers: { Accept: "application/json", ...(init.headers as Record<string, string> | undefined) } });
  try {
    return await res.json() as T;
  } catch {
    throw new ProviderError("invalid_response");
  }
}

export async function getText(ctx: ProviderContext, url: string, init: RequestInit = {}): Promise<string> {
  const res = await request(ctx, url, init);
  return res.text();
}

const ENTITIES: Record<string, string> = { "&quot;": '"', "&amp;": "&", "&#39;": "'", "&apos;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };

/** Plain text: tags stripped, common entities decoded, whitespace collapsed. */
export function clean(value: unknown, max = 300): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&(quot|amp|#39|apos|lt|gt|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export const cleanOrNull = (value: unknown, max = 300): string | null => clean(value, max) || null;

/**
 * Only https URLs survive. A provider's `http://` link is upgraded when its
 * host is known to serve the same path over TLS; anything else is dropped, so
 * a result can never inject `javascript:` or mixed content into the page.
 */
const UPGRADABLE_HOSTS = new Set([
  "images-assets.nasa.gov", "images.nasa.gov", "archive.org", "creativecommons.org",
  "www.opendefinition.org", "opendefinition.org", "www.gutenberg.org", "s1.dmcdn.net",
]);

export function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(value.startsWith("//") ? `https:${value}` : value);
  } catch {
    return null;
  }
  if (url.protocol === "http:" && UPGRADABLE_HOSTS.has(url.hostname)) url.protocol = "https:";
  if (url.protocol !== "https:" || url.username || url.password) return null;
  return url.toString();
}

export function positiveNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

const CC_NAMES: Record<string, string> = {
  by: "CC BY", "by-sa": "CC BY-SA", "by-nd": "CC BY-ND", "by-nc": "CC BY-NC",
  "by-nc-sa": "CC BY-NC-SA", "by-nc-nd": "CC BY-NC-ND", zero: "CC0", mark: "Public Domain Mark",
  publicdomain: "Public Domain Dedication",
};

/** "https://creativecommons.org/licenses/by-sa/4.0/" -> { name: "CC BY-SA 4.0", url }. Unknown URLs keep the URL only. */
export function licenseFromUrl(value: unknown): ContentLicense | null {
  const url = httpsUrl(value);
  if (!url) return null;
  const cc = url.match(/creativecommons\.org\/(?:licenses|publicdomain)\/([a-z-]+)\/(\d\.\d)?/i);
  if (cc) {
    const name = CC_NAMES[cc[1].toLowerCase()];
    if (name) return { name: cc[2] && name.startsWith("CC") ? `${name} ${cc[2]}` : name, url };
  }
  // A Creative Commons URL in a shape not listed above still names a CC licence.
  if (new URL(url).hostname === "creativecommons.org") return { name: "Creative Commons", url };
  return { name: new URL(url).hostname, url };
}

/**
 * Licences that let anyone copy and share the unchanged file: every Creative
 * Commons licence (NC and ND restrict reuse, not a verbatim copy), public
 * domain, and the open-data licences the data portals use.
 */
export function allowsRedistribution(license: ContentLicense | null): boolean {
  if (!license) return false;
  return /^(CC|Creative Commons|Public Domain|Open Data Commons|Open Government Licence)/i.test(license.name);
}

export function isArabicScript(text: string): boolean {
  return new RegExp(`[${String.fromCharCode(0x0600)}-${String.fromCharCode(0x06ff)}]`).test(text);
}

type ItemFields = Omit<ExternalContentItem, "id" | "providerName" | "needsResolve" | keyof OptionalItemFields> & Partial<OptionalItemFields> & { needsResolve?: boolean };
type OptionalItemFields = Pick<ExternalContentItem,
  "description" | "altText" | "mimeType" | "thumbnailUrl" | "previewUrl" | "embedUrl" | "downloadUrl" | "captionsUrl" | "creator" |
  "publisher" | "durationSeconds" | "sizeBytes" | "language" | "license" | "attribution" | "tags" | "publishedAt">;

/** Fills every optional field with null so adapters only state what they know. */
export function makeItem(providerName: string, fields: ItemFields): ExternalContentItem {
  return {
    id: `${fields.provider}:${fields.providerItemId}`,
    providerName,
    description: null, altText: null, mimeType: null, thumbnailUrl: null, previewUrl: null, embedUrl: null,
    downloadUrl: null, captionsUrl: null, creator: null, publisher: null, durationSeconds: null,
    sizeBytes: null, language: null, license: null, attribution: null, tags: [], publishedAt: null,
    ...fields,
    needsResolve: fields.needsResolve ?? false,
  };
}

/** Commons and Openverse both name file kinds by MIME; this names the ContentType. */
export function typeFromMime(mime: string | null | undefined, fallback: ContentType): ContentType {
  if (!mime) return fallback;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/") || mime === "application/ogg") return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "document";
  return fallback;
}

export function tagList(values: unknown, max = 8): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => clean(typeof v === "string" ? v : (v as { name?: string; term?: string } | null)?.name ?? (v as { term?: string } | null)?.term, 60))
    .filter(Boolean)
    .slice(0, max);
}

/** True when the search asks for this category (an empty list asks for all). */
export function wants(categories: readonly ContentCategory[], category: ContentCategory): boolean {
  return categories.length === 0 || categories.includes(category);
}

/** Runs `fn` over `items` with at most `limit` in flight. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
