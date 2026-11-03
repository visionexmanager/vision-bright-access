/**
 * Four more keyless, openly licensed collections:
 *
 *   Wellcome Collection  pictures (medicine, science, history), public domain and CC
 *   iNaturalist          photographs of wildlife by its community, each with its own CC licence
 *   ccMixter             music and sound under Creative Commons
 *   SepiaSearch          videos across PeerTube instances, searched by licence
 *
 * Each asks the source only for what it may pass on, and the parser checks again:
 * the licence on an item is what travels with it, never an assumption about the site.
 */

import { clean, cleanOrNull, getJson, httpsUrl, licenseFromUrl, makeItem, positiveNumber, tagList } from "../http.ts";
import type { ContentLicense, ContentProvider, ExternalContentItem } from "../types.ts";

// ─── Wellcome Collection ───────────────────────────────────────────────────

const WELLCOME_LICENSES: Record<string, ContentLicense> = {
  pdm: { name: "Public Domain Mark", url: "https://creativecommons.org/publicdomain/mark/1.0/" },
  cc0: { name: "CC0", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
  "cc-by": { name: "CC BY", url: "https://creativecommons.org/licenses/by/4.0/" },
  "cc-by-sa": { name: "CC BY-SA", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
};

interface WellcomeImage {
  id?: string;
  source?: { id?: string; title?: string };
  locations?: Array<{ url?: string; credit?: string; license?: { id?: string; url?: string } }>;
}

/** The IIIF image address for an id, at a width that fits Meta's limit. */
export function wellcomeImageUrl(imageId: string): string | null {
  return /^[A-Za-z0-9_-]{3,40}$/.test(imageId) ? `https://iiif.wellcomecollection.org/image/${imageId}/full/!1200,1200/0/default.jpg` : null;
}

export function parseWellcome(data: unknown): ExternalContentItem[] {
  const results = ((data as { results?: WellcomeImage[] })?.results) ?? [];
  return results.flatMap((row) => {
    const loc = row.locations?.[0];
    const imageId = /\/image\/([A-Za-z0-9_-]{3,40})\//.exec(loc?.url ?? "")?.[1] ?? null;
    const license = loc?.license?.id ? WELLCOME_LICENSES[loc.license.id] ?? null : null;
    const title = clean(row.source?.title, 200);
    const image = imageId ? wellcomeImageUrl(imageId) : null;
    if (!imageId || !image || !title || !license || !row.source?.id || !/^[a-z0-9]{4,12}$/.test(row.source.id)) return [];
    const credit = cleanOrNull(loc?.credit, 160);
    return [makeItem("Wellcome Collection", {
      provider: "wellcome",
      providerItemId: imageId,
      title,
      contentType: "image",
      mimeType: "image/jpeg",
      thumbnailUrl: `https://iiif.wellcomecollection.org/image/${imageId}/full/!400,400/0/default.jpg`,
      previewUrl: image,
      externalUrl: `https://wellcomecollection.org/works/${row.source.id}/images?id=${row.id ?? ""}`.replace(/\?id=$/, ""),
      downloadUrl: image,
      creator: credit,
      publisher: "Wellcome Collection",
      license,
      attribution: [credit, "Wellcome Collection", license.name].filter(Boolean).join(", "),
    })];
  });
}

export const wellcome: ContentProvider = {
  id: "wellcome",
  name: "Wellcome Collection",
  homepage: "https://wellcomecollection.org",
  docs: "https://developers.wellcomecollection.org/",
  categories: ["images", "education"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: true, embed: false, download: true },
  licenseNote: "Only public domain and Creative Commons (without NonCommercial) pictures are asked for.",
  rateLimit: "No published quota.",
  healthQuery: "anatomy",
  async search(params, ctx) {
    const q = new URLSearchParams({
      query: params.query, pageSize: String(params.limit), page: String(params.page),
      "locations.license": "pdm,cc0,cc-by,cc-by-sa",
    });
    return parseWellcome(await getJson(ctx, `https://api.wellcomecollection.org/catalogue/v2/images?${q}`));
  },
};

// ─── iNaturalist ───────────────────────────────────────────────────────────

const INATURALIST_LICENSES: Record<string, ContentLicense> = {
  cc0: { name: "CC0", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
  "cc-by": { name: "CC BY", url: "https://creativecommons.org/licenses/by/4.0/" },
  "cc-by-sa": { name: "CC BY-SA", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
};

interface INatObservation {
  id?: number;
  uri?: string;
  species_guess?: string;
  taxon?: { name?: string; preferred_common_name?: string };
  user?: { login?: string; name?: string };
  photos?: Array<{ id?: number; license_code?: string; url?: string; attribution?: string }>;
}

export function parseINaturalist(data: unknown): ExternalContentItem[] {
  const results = ((data as { results?: INatObservation[] })?.results) ?? [];
  return results.flatMap((obs) => {
    const photo = obs.photos?.find((p) => p.license_code && INATURALIST_LICENSES[p.license_code] && typeof p.url === "string");
    const license = photo?.license_code ? INATURALIST_LICENSES[photo.license_code] : null;
    const base = /^https:\/\/inaturalist-open-data\.s3\.amazonaws\.com\/photos\/(\d{1,12})\/square\.(jpe?g|png)$/i.exec(photo?.url ?? "");
    const name = clean(obs.taxon?.preferred_common_name ?? obs.species_guess ?? obs.taxon?.name, 200);
    const page = httpsUrl(obs.uri);
    if (!photo || !license || !base || !name || !page || typeof obs.id !== "number") return [];
    const large = `https://inaturalist-open-data.s3.amazonaws.com/photos/${base[1]}/large.${base[2].toLowerCase()}`;
    const creator = cleanOrNull(obs.user?.name ?? obs.user?.login, 120);
    return [makeItem("iNaturalist", {
      provider: "inaturalist",
      providerItemId: String(obs.id),
      title: name,
      description: cleanOrNull(obs.taxon?.name, 160),
      contentType: "image",
      mimeType: "image/jpeg",
      thumbnailUrl: photo.url as string,
      previewUrl: large,
      externalUrl: page,
      downloadUrl: large,
      creator,
      publisher: "iNaturalist",
      license,
      attribution: [creator, "iNaturalist", license.name].filter(Boolean).join(", "),
      tags: tagList([obs.taxon?.name]),
    })];
  });
}

export const inaturalist: ContentProvider = {
  id: "inaturalist",
  name: "iNaturalist",
  homepage: "https://www.inaturalist.org",
  docs: "https://api.inaturalist.org/v1/docs/",
  categories: ["images", "education"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: true, embed: false, download: true },
  licenseNote: "Research-grade observations whose photo is CC0, CC BY or CC BY-SA; each photo carries its own licence.",
  rateLimit: "About 60 requests per minute.",
  healthQuery: "butterfly",
  async search(params, ctx) {
    const q = new URLSearchParams({
      q: params.query, photos: "true", photo_license: "cc0,cc-by,cc-by-sa", quality_grade: "research",
      per_page: String(params.limit), page: String(params.page), order_by: "votes",
    });
    return parseINaturalist(await getJson(ctx, `https://api.inaturalist.org/v1/observations?${q}`));
  },
};

// ─── ccMixter ──────────────────────────────────────────────────────────────

interface CcMixterUpload {
  upload_id?: number;
  upload_name?: string;
  user_name?: string;
  user_real_name?: string;
  file_page_url?: string;
  license_url?: string;
  upload_tags?: string;
  files?: Array<{ download_url?: string; file_filesize?: string; file_format_info?: { "default-ext"?: string; ps?: string } }>;
}

/** "4:47" or "1:02:03" in seconds, or null. */
function clockSeconds(value: unknown): number | null {
  const m = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/.exec(typeof value === "string" ? value.trim() : "");
  return m ? positiveNumber(Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3])) : null;
}

/** "(4.39MB)" or "(605KB)" in bytes. */
function parseFileSize(value: unknown): number | null {
  const m = /([\d.]+)\s*(KB|MB|GB)/i.exec(typeof value === "string" ? value : "");
  if (!m) return null;
  const unit = { kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[m[2].toLowerCase() as "kb" | "mb" | "gb"];
  return positiveNumber(Math.round(Number(m[1]) * unit));
}

export function parseCcMixter(data: unknown): ExternalContentItem[] {
  const uploads = Array.isArray(data) ? data as CcMixterUpload[] : [];
  return uploads.flatMap((up) => {
    const license = licenseFromUrl(up.license_url);
    // NonCommercial licences are left out: Visionex passes files on as a service.
    if (!license || /^(?:CC BY-NC|CC BY-NC-SA|CC BY-NC-ND)/.test(license.name) || /\/by-nc/.test(license.url ?? "")) return [];
    const mp3 = up.files?.find((f) => f.file_format_info?.["default-ext"] === "mp3" && /^https:\/\/ccmixter\.org\/content\/[\w.-]+\/[\w.%()+ -]+\.mp3$/.test(f.download_url ?? ""));
    const title = clean(up.upload_name, 200);
    const page = httpsUrl(up.file_page_url);
    if (!mp3 || !title || !page || typeof up.upload_id !== "number") return [];
    const creator = cleanOrNull(up.user_real_name ?? up.user_name, 120);
    return [makeItem("ccMixter", {
      provider: "ccmixter",
      providerItemId: String(up.upload_id),
      title,
      contentType: "audio",
      mimeType: "audio/mpeg",
      // The files are hotlink-protected (403 unless the request names ccmixter.org as its referrer), so neither a
      // preview nor a download address is offered: the track's own page, with its licence, is the answer.
      externalUrl: page,
      creator,
      publisher: "ccMixter",
      durationSeconds: clockSeconds(mp3.file_format_info?.ps),
      sizeBytes: parseFileSize(mp3.file_filesize),
      license,
      attribution: [creator, "ccMixter", license.name].filter(Boolean).join(", "),
      tags: tagList((up.upload_tags ?? "").split(",").filter(Boolean).slice(0, 8)),
    })];
  });
}

export const ccmixter: ContentProvider = {
  id: "ccmixter",
  name: "ccMixter",
  homepage: "https://ccmixter.org",
  docs: "https://ccmixter.org/query-api",
  categories: ["audio"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: false, embed: false, download: false },
  licenseNote: "Creative Commons music and samples; NonCommercial uploads are skipped. The files are hotlink-protected, so each result is a link to its page.",
  rateLimit: "No published quota.",
  healthQuery: "piano",
  async search(params, ctx) {
    // The site's own licence filter rejects a list, so a wider page is read and filtered here.
    const q = new URLSearchParams({ f: "json", search: params.query, search_type: "all", limit: String(Math.min(40, params.limit * 3)), offset: String((params.page - 1) * params.limit * 3) });
    return parseCcMixter(await getJson(ctx, `https://ccmixter.org/api/query?${q}`)).slice(0, params.limit);
  },
};

// ─── SepiaSearch (PeerTube) ────────────────────────────────────────────────

// PeerTube's licence ids. Only the ones that let a service pass the video on are asked for.
const PEERTUBE_LICENSES: Record<number, ContentLicense> = {
  1: { name: "CC BY", url: "https://creativecommons.org/licenses/by/4.0/" },
  2: { name: "CC BY-SA", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
  3: { name: "CC BY-ND", url: "https://creativecommons.org/licenses/by-nd/4.0/" },
  7: { name: "CC0", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
};

interface SepiaVideo {
  id?: number;
  uuid?: string;
  name?: string;
  url?: string;
  licence?: { id?: number };
  duration?: number;
  thumbnailUrl?: string;
  account?: { displayName?: string } | string;
  channel?: { displayName?: string };
  isLive?: boolean;
  nsfw?: boolean;
  language?: { id?: string };
  publishedAt?: string;
  description?: string;
}

export function parseSepia(data: unknown): ExternalContentItem[] {
  const rows = ((data as { data?: SepiaVideo[] })?.data) ?? [];
  return rows.flatMap((v) => {
    const license = typeof v.licence?.id === "number" ? PEERTUBE_LICENSES[v.licence.id] : undefined;
    const page = httpsUrl(v.url);
    const title = clean(v.name, 200);
    if (!license || !page || !title || v.isLive || v.nsfw || !v.uuid || !/^[0-9a-f-]{36}$/i.test(v.uuid)) return [];
    const account = typeof v.account === "string" ? v.account : v.account?.displayName;
    const creator = cleanOrNull(v.channel?.displayName ?? account, 120);
    return [makeItem("SepiaSearch (PeerTube)", {
      provider: "sepiasearch",
      providerItemId: v.uuid,
      title,
      description: cleanOrNull(v.description, 400),
      contentType: "video",
      thumbnailUrl: httpsUrl(v.thumbnailUrl),
      externalUrl: page,
      creator,
      publisher: new URL(page).hostname,
      durationSeconds: positiveNumber(v.duration),
      language: cleanOrNull(v.language?.id, 10),
      license,
      attribution: [creator, new URL(page).hostname, license.name].filter(Boolean).join(", "),
      publishedAt: typeof v.publishedAt === "string" ? v.publishedAt.slice(0, 10) : null,
    })];
  });
}

export const sepiasearch: ContentProvider = {
  id: "sepiasearch",
  name: "SepiaSearch (PeerTube)",
  homepage: "https://sepiasearch.org",
  docs: "https://docs.joinpeertube.org/api-rest-reference.html",
  categories: ["video"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: false, embed: false, download: false },
  licenseNote: "Videos from independent PeerTube servers, asked for by licence (CC BY, CC BY-SA, CC BY-ND, CC0). The files stay on their own servers, so each is delivered as a link.",
  rateLimit: "No published quota.",
  healthQuery: "nature",
  async search(params, ctx) {
    const q = new URLSearchParams({ search: params.query, count: String(params.limit), start: String((params.page - 1) * params.limit), nsfw: "false", isLive: "false" });
    for (const id of [1, 2, 3, 7]) q.append("licenceOneOf", String(id));
    return parseSepia(await getJson(ctx, `https://sepiasearch.org/api/v1/search/videos?${q}`));
  },
};
