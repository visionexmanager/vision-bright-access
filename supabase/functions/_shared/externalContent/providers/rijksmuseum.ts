/**
 * Rijksmuseum, keyless, through its Linked Art API (data.rijksmuseum.nl).
 *
 * The search returns bare object ids. Each object is then read for its title,
 * maker and date, and the picture is two more hops away (object -> visual item
 * -> digital object -> an IIIF image address). That is three small requests per
 * result, so a page is capped at six results and the requests run in parallel.
 * Only objects the museum flags as downloadable (the public-domain ones, whose
 * images it releases as CC0) are kept.
 */

import { clean, cleanOrNull, getJson, httpsUrl, makeItem, mapLimit } from "../http.ts";
import type { ContentProvider, ExternalContentItem, ProviderContext } from "../types.ts";

const CC0 = { name: "CC0", url: "https://creativecommons.org/publicdomain/zero/1.0/" };
const ENGLISH = "http://vocab.getty.edu/aat/300388277";
const ACCESSION_NUMBER = "http://vocab.getty.edu/aat/300312355";
const MAX_RESULTS = 6;
const LD = { headers: { Accept: "application/ld+json" } };

type Json = Record<string, unknown>;
const arr = (v: unknown): Json[] => (Array.isArray(v) ? v.filter((x): x is Json => !!x && typeof x === "object") : []);
const OBJECT_ID = /^https:\/\/id\.rijksmuseum\.nl\/\d{1,30}$/;
const IIIF_ID = /^https:\/\/iiif\.micr\.io\/[A-Za-z0-9_-]{3,40}\/full\/max\/0\/default\.jpg$/;

/** The object's own record, without its picture. Null when it is not one to show. */
export function parseRijksObject(id: string, obj: unknown): { item: ExternalContentItem; visualItem: string | null } | null {
  const o = (obj ?? {}) as Json;
  const names = arr(o.identified_by).filter((n) => n.type === "Name" && typeof n.content === "string");
  const isEnglish = (n: Json) => arr(n.language).some((l) => l.id === ENGLISH);
  const title = clean((names.find(isEnglish) ?? names[0])?.content, 200);
  const number = arr(o.identified_by).find((n) => n.type === "Identifier" && arr(n.classified_as).some((c) => c.id === ACCESSION_NUMBER))?.content;
  if (!title || typeof number !== "string" || !/^[A-Za-z0-9.\- ]{1,40}$/.test(number)) return null;
  const production = (o.produced_by ?? {}) as Json;
  // The maker is on the production itself, or on one of its parts (a painter, an engraver).
  const maker = arr(production.carried_out_by)[0] ?? arr(production.part).flatMap((p) => arr(p.carried_out_by))[0];
  const notation = arr(maker?.notation);
  const creator = cleanOrNull((notation.find((n) => n["@language"] === "en") ?? notation[0])?.["@value"], 120);
  const span = arr(((production.timespan ?? {}) as Json).identified_by);
  const date = cleanOrNull((span.find(isEnglish) ?? span[0])?.content, 40);
  const visualItem = arr(o.shows)[0]?.id;
  const encoded = encodeURIComponent(number.replace(/\s+/g, ""));
  return {
    visualItem: typeof visualItem === "string" && OBJECT_ID.test(visualItem) ? visualItem : null,
    item: makeItem("Rijksmuseum", {
      provider: "rijksmuseum",
      providerItemId: id.replace("https://id.rijksmuseum.nl/", ""),
      title,
      contentType: "image",
      externalUrl: `https://www.rijksmuseum.nl/en/collection/${encoded}`,
      creator,
      publisher: "Rijksmuseum",
      license: CC0,
      attribution: [creator, "Rijksmuseum", "CC0"].filter(Boolean).join(", "),
      publishedAt: date,
    }),
  };
}

/** The picture of a digital object: an IIIF address, only when the museum marks the image downloadable. */
export function parseRijksImage(digital: unknown): string | null {
  const d = (digital ?? {}) as Json;
  const flags = arr(d.referred_to_by).map((r) => String(r.content ?? "").toLowerCase());
  if (!flags.includes("downloadbaar") && !flags.includes("downloadable")) return null;
  const url = httpsUrl(arr(d.access_point)[0]?.id);
  return url && IIIF_ID.test(url) ? url : null;
}

async function readObject(ctx: ProviderContext, id: string): Promise<ExternalContentItem | null> {
  const parsed = parseRijksObject(id, await getJson(ctx, id, LD));
  if (!parsed?.visualItem) return null;
  const visual = await getJson<Json>(ctx, parsed.visualItem, LD);
  const digitalId = arr(visual.digitally_shown_by)[0]?.id;
  if (typeof digitalId !== "string" || !OBJECT_ID.test(digitalId)) return null;
  const digital = await getJson<Json>(ctx, digitalId, LD);
  const image = parseRijksImage(digital);
  if (!image) return null;
  const small = image.replace("/full/max/0/", "/full/!480,480/0/");
  return { ...parsed.item, thumbnailUrl: small, previewUrl: small, downloadUrl: image, mimeType: "image/jpeg" };
}

export const rijksmuseum: ContentProvider = {
  id: "rijksmuseum",
  name: "Rijksmuseum",
  homepage: "https://www.rijksmuseum.nl/en/rijksstudio",
  docs: "https://data.rijksmuseum.nl/docs/",
  categories: ["images"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: true, embed: false, download: true },
  licenseNote: "Public-domain works, whose images the museum releases as CC0; anything not flagged downloadable is skipped.",
  rateLimit: "Not published. A search answered in 1.4 s on 2026-09-29; each result then costs three small requests, so a page is capped at six.",
  healthQuery: "windmill",
  async search(params, ctx) {
    const q = new URLSearchParams({ title: params.query, imageAvailable: "true" });
    const found = await getJson<{ orderedItems?: Array<{ id?: string }> }>(ctx, `https://data.rijksmuseum.nl/search/collection?${q}`, LD);
    const window = Math.min(params.limit, MAX_RESULTS);
    const ids = (found.orderedItems ?? []).map((i) => i.id).filter((id): id is string => typeof id === "string" && OBJECT_ID.test(id))
      .slice((params.page - 1) * window, params.page * window);
    const read = await mapLimit(ids, MAX_RESULTS, (id) => readObject(ctx, id));
    return read.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
  },
};
