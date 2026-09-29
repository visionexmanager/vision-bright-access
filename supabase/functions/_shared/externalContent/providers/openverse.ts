/**
 * Openverse — WordPress's search engine over 800M+ openly licensed images and
 * audio tracks (Flickr, Wikimedia, Jamendo, Freesound, museums…). Keyless;
 * registered client credentials only raise the rate limit.
 */

import { clean, cleanOrNull, getJson, httpsUrl, licenseFromUrl, makeItem, positiveNumber, tagList, wants } from "../http.ts";
import type { ContentLicense, ContentProvider, ExternalContentItem, ProviderContext } from "../types.ts";

const LICENSE_NAMES: Record<string, string> = {
  by: "CC BY", "by-sa": "CC BY-SA", "by-nd": "CC BY-ND", "by-nc": "CC BY-NC",
  "by-nc-sa": "CC BY-NC-SA", "by-nc-nd": "CC BY-NC-ND", cc0: "CC0", pdm: "Public Domain Mark",
};

function openverseLicense(item: Record<string, unknown>): ContentLicense | null {
  const code = typeof item.license === "string" ? item.license.toLowerCase() : "";
  const name = LICENSE_NAMES[code];
  if (!name) return licenseFromUrl(item.license_url);
  const version = typeof item.license_version === "string" && /^\d\.\d$/.test(item.license_version) && code !== "pdm" && code !== "cc0" ? ` ${item.license_version}` : "";
  return { name: `${name}${version}`, url: httpsUrl(item.license_url) };
}

export function parseOpenverse(data: unknown, kind: "image" | "audio"): ExternalContentItem[] {
  const results = ((data as { results?: Array<Record<string, unknown>> })?.results) ?? [];
  return results.flatMap((item) => {
    const id = typeof item.id === "string" && /^[0-9a-f-]{36}$/.test(item.id) ? item.id : null;
    const landing = httpsUrl(item.foreign_landing_url);
    const file = httpsUrl(item.url);
    const title = clean(item.title, 200);
    if (!id || !landing || !title) return [];
    const license = openverseLicense(item);
    const duration = positiveNumber(item.duration);
    return [makeItem("Openverse", {
      provider: "openverse",
      providerItemId: `${kind}:${id}`,
      title,
      contentType: kind,
      mimeType: kind === "audio" && typeof item.filetype === "string" && /^mp3/.test(item.filetype) ? "audio/mpeg" : null,
      thumbnailUrl: httpsUrl(item.thumbnail),
      previewUrl: file,
      externalUrl: landing,
      // Openverse indexes only CC-licensed and public-domain works.
      downloadUrl: license ? file : null,
      creator: cleanOrNull(item.creator, 160),
      publisher: cleanOrNull(item.source, 80),
      durationSeconds: duration ? Math.round(duration / 1000) : null,
      sizeBytes: positiveNumber(item.filesize),
      license,
      attribution: cleanOrNull(item.attribution, 400),
      tags: tagList(item.tags),
    })];
  });
}

// Registered clients get a bearer token (client_credentials, ~12h). One per
// server instance; any failure falls back to anonymous access.
let token: { value: string; expiresAt: number } | null = null;

async function bearer(ctx: ProviderContext): Promise<Record<string, string>> {
  const id = ctx.env("OPENVERSE_CLIENT_ID");
  const secret = ctx.env("OPENVERSE_CLIENT_SECRET");
  if (!id || !secret) return {};
  if (token && token.expiresAt > Date.now() + 60_000) return { Authorization: `Bearer ${token.value}` };
  try {
    const data = await getJson<{ access_token?: string; expires_in?: number }>(ctx, "https://api.openverse.org/v1/auth_tokens/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" }).toString(),
    });
    if (!data.access_token) return {};
    token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return { Authorization: `Bearer ${token.value}` };
  } catch {
    return {};
  }
}

export const openverse: ContentProvider = {
  id: "openverse",
  name: "Openverse",
  homepage: "https://openverse.org",
  docs: "https://api.openverse.org/v1/",
  categories: ["images", "audio"],
  auth: { kind: "optional", env: ["OPENVERSE_CLIENT_ID", "OPENVERSE_CLIENT_SECRET"] },
  capabilities: { search: true, preview: true, embed: false, download: true },
  licenseNote: "Only CC-licensed and public-domain works; each result carries its licence and a ready attribution line.",
  rateLimit: "Anonymous requests are throttled per IP; registered client credentials raise the limit.",
  healthQuery: "cat",
  async search(params, ctx) {
    const kinds = (["image", "audio"] as const).filter((k) => wants(params.categories, k === "image" ? "images" : "audio"));
    const headers = await bearer(ctx);
    const pageSize = String(Math.min(params.limit, 20));
    const runs = await Promise.allSettled(kinds.map(async (kind) => {
      const q = new URLSearchParams({ q: params.query, page_size: pageSize, page: String(params.page), mature: "false" });
      const endpoint = kind === "image" ? "images" : "audio";
      return parseOpenverse(await getJson(ctx, `https://api.openverse.org/v1/${endpoint}/?${q}`, { headers }), kind);
    }));
    const ok = runs.flatMap((r) => r.status === "fulfilled" ? r.value : []);
    if (ok.length === 0 && runs.length > 0 && runs.every((r) => r.status === "rejected")) throw (runs[0] as PromiseRejectedResult).reason;
    return ok;
  },
};
