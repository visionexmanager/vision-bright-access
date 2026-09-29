/**
 * Museum open-access collections, keyless, public-domain images only:
 * The Metropolitan Museum of Art, the Art Institute of Chicago and the
 * Cleveland Museum of Art. Each museum releases these images under CC0.
 */

import { clean, cleanOrNull, getJson, httpsUrl, makeItem, mapLimit, positiveNumber, tagList } from "../http.ts";
import type { ContentProvider, ExternalContentItem } from "../types.ts";

const CC0 = { name: "CC0", url: "https://creativecommons.org/publicdomain/zero/1.0/" };

// ─── The Met ───────────────────────────────────────────────────────────────

export function parseMetObject(obj: Record<string, unknown>): ExternalContentItem | null {
  if (obj.isPublicDomain !== true || typeof obj.objectID !== "number") return null;
  const image = httpsUrl(obj.primaryImageSmall);
  const page = httpsUrl(obj.objectURL);
  const title = clean(obj.title, 200);
  if (!image || !page || !title) return null;
  const artist = cleanOrNull(obj.artistDisplayName, 160);
  return makeItem("The Metropolitan Museum of Art", {
    provider: "met_museum",
    providerItemId: String(obj.objectID),
    title,
    description: [clean(obj.objectName, 80), clean(obj.medium, 160), clean(obj.culture, 80)].filter(Boolean).join(" · ") || null,
    contentType: "image",
    thumbnailUrl: image,
    previewUrl: image,
    externalUrl: page,
    downloadUrl: httpsUrl(obj.primaryImage) ?? image,
    creator: artist,
    publisher: "The Metropolitan Museum of Art",
    license: CC0,
    attribution: [artist, "The Metropolitan Museum of Art", "CC0"].filter(Boolean).join(", "),
    tags: tagList(obj.tags),
    publishedAt: cleanOrNull(obj.objectDate, 40),
  });
}

export const metMuseum: ContentProvider = {
  id: "met_museum",
  name: "The Metropolitan Museum of Art",
  homepage: "https://www.metmuseum.org/art/collection",
  docs: "https://metmuseum.github.io/",
  categories: ["images"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: true, embed: false, download: true },
  licenseNote: "Open Access images of public-domain works are CC0; other objects are skipped.",
  rateLimit: "80 requests per second.",
  healthQuery: "sunflowers",
  async search(params, ctx) {
    const q = new URLSearchParams({ hasImages: "true", q: params.query });
    const found = await getJson<{ objectIDs?: number[] | null }>(ctx, `https://collectionapi.metmuseum.org/public/collection/v1/search?${q}`);
    // The search returns ids only, and many objects are not public domain, so
    // read twice the page size and keep what qualifies.
    const window = params.limit * 2;
    const ids = (found.objectIDs ?? []).filter((id) => Number.isInteger(id)).slice((params.page - 1) * window, params.page * window);
    const objects = await mapLimit(ids, 6, (id) => getJson<Record<string, unknown>>(ctx, `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`));
    return objects.flatMap((r) => (r.status === "fulfilled" ? parseMetObject(r.value) : null) ?? []).slice(0, params.limit);
  },
};

// ─── Art Institute of Chicago ──────────────────────────────────────────────

export function parseArtic(data: unknown): ExternalContentItem[] {
  const body = (data ?? {}) as { data?: Array<Record<string, unknown>>; config?: { iiif_url?: string } };
  const iiif = httpsUrl(body.config?.iiif_url) ?? "https://www.artic.edu/iiif/2";
  return (body.data ?? []).flatMap((art) => {
    const imageId = typeof art.image_id === "string" && /^[0-9a-f-]{36}$/.test(art.image_id) ? art.image_id : null;
    const title = clean(art.title, 200);
    if (art.is_public_domain !== true || !imageId || !title || typeof art.id !== "number") return [];
    const thumb = (art.thumbnail ?? {}) as { alt_text?: string };
    const artist = cleanOrNull(String(art.artist_display ?? "").split("\n")[0], 160);
    return [makeItem("Art Institute of Chicago", {
      provider: "artic",
      providerItemId: String(art.id),
      title,
      altText: cleanOrNull(thumb.alt_text, 300),
      contentType: "image",
      mimeType: "image/jpeg",
      thumbnailUrl: `${iiif}/${imageId}/full/400,/0/default.jpg`,
      // 843px is the width the museum's API guide recommends.
      previewUrl: `${iiif}/${imageId}/full/843,/0/default.jpg`,
      externalUrl: `https://www.artic.edu/artworks/${art.id}`,
      downloadUrl: `${iiif}/${imageId}/full/843,/0/default.jpg`,
      creator: artist,
      publisher: "Art Institute of Chicago",
      license: CC0,
      attribution: [artist, "Art Institute of Chicago", "CC0"].filter(Boolean).join(", "),
      publishedAt: cleanOrNull(art.date_display, 40),
    })];
  });
}

export const artic: ContentProvider = {
  id: "artic",
  name: "Art Institute of Chicago",
  homepage: "https://www.artic.edu/collection",
  docs: "https://api.artic.edu/docs/",
  categories: ["images"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: true, embed: false, download: true },
  licenseNote: "Public-domain artwork images are CC0; the museum publishes alt text for many of them.",
  rateLimit: "60 requests per minute per IP.",
  healthQuery: "landscape",
  async search(params, ctx) {
    const q = new URLSearchParams({
      q: params.query, limit: String(params.limit), page: String(params.page),
      fields: "id,title,image_id,is_public_domain,artist_display,date_display,thumbnail",
      "query[term][is_public_domain]": "true",
    });
    return parseArtic(await getJson(ctx, `https://api.artic.edu/api/v1/artworks/search?${q}`));
  },
};

// ─── Cleveland Museum of Art ───────────────────────────────────────────────

export function parseCleveland(data: unknown): ExternalContentItem[] {
  const rows = ((data as { data?: Array<Record<string, unknown>> })?.data) ?? [];
  return rows.flatMap((art) => {
    const images = (art.images ?? {}) as Record<string, { url?: string; filesize?: string } | null>;
    const web = httpsUrl(images.web?.url);
    const page = httpsUrl(art.url);
    const title = clean(art.title, 200);
    if (art.share_license_status !== "CC0" || !web || !page || !title || typeof art.id !== "number") return [];
    const creators = (art.creators as Array<{ description?: string }> | undefined) ?? [];
    const artist = cleanOrNull(creators[0]?.description, 160);
    return [makeItem("Cleveland Museum of Art", {
      provider: "cleveland_museum",
      providerItemId: String(art.id),
      title,
      description: cleanOrNull(art.description, 400),
      contentType: "image",
      mimeType: "image/jpeg",
      thumbnailUrl: web,
      previewUrl: web,
      externalUrl: page,
      downloadUrl: httpsUrl(images.print?.url) ?? web,
      sizeBytes: positiveNumber(images.print?.filesize),
      creator: artist,
      publisher: "Cleveland Museum of Art",
      license: CC0,
      attribution: [artist, "Cleveland Museum of Art", "CC0"].filter(Boolean).join(", "),
      tags: tagList([art.type, art.technique].filter((v) => typeof v === "string")),
      publishedAt: cleanOrNull(art.creation_date, 40),
    })];
  });
}

export const clevelandMuseum: ContentProvider = {
  id: "cleveland_museum",
  name: "Cleveland Museum of Art",
  homepage: "https://www.clevelandart.org/open-access",
  docs: "https://openaccess-api.clevelandart.org/",
  categories: ["images"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: true, embed: false, download: true },
  licenseNote: "Open Access works are CC0; the search asks for those only.",
  rateLimit: "No published quota.",
  healthQuery: "sun",
  async search(params, ctx) {
    const q = new URLSearchParams({
      q: params.query, cc0: "1", has_image: "1",
      limit: String(params.limit), skip: String((params.page - 1) * params.limit),
    });
    return parseCleveland(await getJson(ctx, `https://openaccess-api.clevelandart.org/api/artworks/?${q}`));
  },
};
