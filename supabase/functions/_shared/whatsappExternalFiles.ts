// A book, an audiobook or a film from an open source, delivered as the file.
//
// The books and media answers used to be a list of links, even when the sender
// asked for the file itself. This module is the step that turns "send me the PDF
// of X" into an attachment — and only where that is both allowed and possible:
//
//   allowed   the source states a licence that lets anyone copy the file
//             (public domain, CC0, Creative Commons), so it is on a source the
//             external-content registry connects, never a search-engine hit;
//   possible  a type Meta takes (whatsappAssetDelivery.ts holds Meta's list and
//             checks the bytes), within Meta's size limits, from a host we name.
//
// What is deliberately still a link: EPUB (not on Meta's list), Europe PMC PDFs
// (its server answers a bot challenge, which is not something to get past),
// podcast episodes (a publisher's stream, not a licensed copy), copyrighted or
// lend-only books, anything over Meta's limits, and every type Meta refuses.
//
// The link fallback is the existing list: when nothing here is delivered the
// caller carries on to it, so a sender never gets less than before.
//
// Language-neutral by construction: the words that travel with a file are the
// title, the source, the licence and the address — proper names and codes, no
// sentence to translate or to get wrong.

import { normalizeSearchInput, searchExternalContent } from "./externalContent/aggregate.ts";
import type { AggregateResult, ExternalContentItem, Fetch, GetEnv } from "./externalContent/types.ts";
import { deliveryRuleFor, fetchAssetBytes, isFetchableAssetUrl, type DeliverableAsset, type DeliveryResult, type WhatsAppMediaKind } from "./whatsappAssetDelivery.ts";

export type FileKind = "book" | "audiobook" | "video" | "image" | "audio" | "document";

// ─── Did the sender ask for the file? ──────────────────────────────────────

/** Words for "file" and "attachment" in the twenty languages, and the formats Meta takes. */
const FILE_WORDS = [
  "pdf", "mp3", "mp4", "txt", "docx?",
  "file", "files", "attachment", "attached", "attach", "download",
  "ملف", "ملفات", "مرفق", "تحميل", "حمل",
  "ফাইল", "সংযুক্তি", "datei", "anhang", "archivo", "adjunto", "descargar", "فایل", "پیوست", "fichier", "pièce jointe", "télécharger",
  "फ़ाइल", "फाइल", "अटैचमेंट", "berkas", "lampiran", "unduh", "documento", "allegato", "scarica", "file",
  "ファイル", "添付", "파일", "첨부", "bestand", "bijlage", "plik", "załącznik", "arquivo", "anexo", "baixar",
  "файл", "вложение", "скачать", "dosya", "ek dosya", "indir", "فائل", "منسلک", "tệp", "tập tin", "đính kèm",
  "文件", "档案", "附件", "下载",
];

const FILE_WISH = new RegExp(
  // Latin words need a boundary; the other scripts have none, so they match anywhere.
  FILE_WORDS.map((w) => (/^[a-z]/i.test(w) ? `\\b${w}\\b` : w)).join("|"),
  "iu",
);

/** True when the message asks for the file itself rather than for a list of places to find it. */
export function parseFileWish(text: string | null | undefined): boolean {
  return !!text && FILE_WISH.test(text);
}

/** The query without the words that asked for the file: "frankenstein pdf" searches "frankenstein". */
export function stripFileWish(query: string): string {
  return query.replace(new RegExp(FILE_WISH.source, "giu"), " ").replace(/\s+/g, " ").trim();
}

// ─── What each kind looks for, and where ───────────────────────────────────

/** The providers whose files a server may fetch, and the hosts that may serve them. */
export const DELIVERY_HOSTS: Readonly<Record<string, readonly string[]>> = {
  gutenberg: ["gutenberg.org"],
  openstax: ["openstax.org"],
  internet_archive: ["archive.org"],
  // A picture: Commons' own file servers, and Openverse's thumbnail endpoint (its
  // originals sit on whatever site the work came from, which is not a host we name).
  // Special:FilePath answers with a redirect to thumb.wikimedia.org, where Commons keeps its resized copies.
  wikimedia_commons: ["upload.wikimedia.org", "commons.wikimedia.org", "thumb.wikimedia.org"],
  openverse: ["api.openverse.org"],
  // Museum images released as CC0, from the museum's own image servers.
  met_museum: ["images.metmuseum.org"],
  artic: ["www.artic.edu"],
  cleveland_museum: ["openaccess-cdn.clevelandart.org"],
  rijksmuseum: ["iiif.micr.io"],
  // Flickr: only a photo whose own licence allows it (see licenceAllows).
  flickr: ["staticflickr.com"],
  // Research: the open repositories and publishers whose open-access PDFs a server can fetch.
  // Left out on purpose: Europe PMC, PubMed Central, bioRxiv and medRxiv, which answer a bot challenge.
  openalex: [
    "arxiv.org", "zenodo.org", "hal.science", "hal.archives-ouvertes.fr", "core.ac.uk", "osf.io", "figshare.com", "mdpi.com", "mdpi-res.com",
    "frontiersin.org", "plos.org", "peerj.com", "elifesciences.org", "biomedcentral.com", "springeropen.com", "nature.com", "oapen.org", "scielo.org",
    "redalyc.org", "hindawi.com",
  ],
};

export const KIND_SEARCH: Readonly<Record<FileKind, { categories: readonly string[]; providers: readonly string[] }>> = {
  book: { categories: ["books", "education"], providers: ["gutenberg", "openstax", "internet_archive"] },
  audiobook: { categories: ["audio"], providers: ["internet_archive"] },
  video: { categories: ["video"], providers: ["internet_archive", "wikimedia_commons"] },
  // Freely licensed pictures, in the order they are preferred: Commons and Openverse first, then the museums' CC0 images, then Flickr.
  image: { categories: ["images"], providers: ["wikimedia_commons", "openverse", "met_museum", "artic", "cleveland_museum", "rijksmuseum", "flickr"] },
  audio: { categories: ["audio"], providers: ["wikimedia_commons", "internet_archive"] },
  // A paper or a PDF: an open-access full text with a stated open licence, or a PDF on Commons.
  document: { categories: ["documents"], providers: ["openalex", "wikimedia_commons"] },
};

/** Kinds whose caller has no list of links of its own, so a result's own page is what a failed attachment falls back to. */
const LINK_FALLBACK_KINDS: ReadonlySet<FileKind> = new Set(["image", "audio", "video", "document"]);

const ARCHIVE_ID = /^[A-Za-z0-9._-]{1,100}$/;
const MB = 1024 * 1024;

export interface ArchiveFile { name: string; format: string; size: number }

/** The files in an Internet Archive metadata answer, checked field by field. */
export function readArchiveFiles(meta: unknown): ArchiveFile[] {
  const files = (meta as { files?: unknown })?.files;
  if (!Array.isArray(files)) return [];
  return files.flatMap((f) => {
    const name = (f as { name?: unknown })?.name;
    const format = (f as { format?: unknown })?.format;
    const size = Number((f as { size?: unknown })?.size);
    if (typeof name !== "string" || typeof format !== "string" || !Number.isFinite(size) || size <= 0) return [];
    // A plain file name: no path, no traversal, nothing that needs URL escaping beyond a single segment.
    if (name.includes("/") || name.includes("\\") || name.startsWith(".") || name.length > 200) return [];
    return [{ name, format, size }];
  });
}

export interface PickedFile { name: string; mime: string; size: number }

/**
 * The one file worth sending from an Internet Archive item, or null.
 *
 *   audiobook  the first chapter as a 64 kbit MP3 (small enough for Meta's 16 MB), else any MP3 that fits
 *   video      an MP4 that fits in 16 MB
 *   book       the text PDF, up to Meta's 100 MB for documents
 */
export function pickArchiveFile(files: readonly ArchiveFile[], kind: FileKind): PickedFile | null {
  const byName = [...files].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  const fits = (f: ArchiveFile, mime: string) => f.size <= (deliveryRuleFor(mime)?.maxBytes ?? 0);
  if (kind === "audiobook") {
    const mp3 = byName.filter((f) => /\.mp3$/i.test(f.name) && /MP3/i.test(f.format) && fits(f, "audio/mpeg"));
    // Chapter 1 rather than the preface when there is one, and the small encoding rather than the big.
    const small = mp3.filter((f) => /64Kbps/i.test(f.format));
    const chapters = (small.length ? small : mp3).filter((f) => !/_00_|_intro|preface/i.test(f.name));
    const chosen = (chapters.length ? chapters : small.length ? small : mp3)[0];
    return chosen ? { name: chosen.name, mime: "audio/mpeg", size: chosen.size } : null;
  }
  if (kind === "video") {
    const mp4 = byName.find((f) => /\.mp4$/i.test(f.name) && /MPEG4|h\.264/i.test(f.format) && fits(f, "video/mp4"));
    return mp4 ? { name: mp4.name, mime: "video/mp4", size: mp4.size } : null;
  }
  const pdf = byName.find((f) => /\.pdf$/i.test(f.name) && /PDF/i.test(f.format) && fits(f, "application/pdf"));
  return pdf ? { name: pdf.name, mime: "application/pdf", size: pdf.size } : null;
}

/** How to turn a file WhatsApp will not carry (or that is too big) into one it will, on the media processor. */
export interface ConvertSpec {
  /** The processor's target name. */
  to: "jpg" | "mp3" | "mp4";
  /** The MIME type of what comes back. */
  mime: string;
  /** Extra processor options, as a query string ("width=1600"). */
  options?: string;
}

export interface FileCandidate {
  url: string;
  mime: string;
  fileName: string;
  size: number | null;
  hosts: readonly string[];
  /** Only used when the file as it is cannot be sent: a type Meta refuses, or a size over its limit. */
  convert?: ConvertSpec;
  /** The declared type looks sendable but the real content is not (an Ogg is Vorbis more often than Opus): always convert. */
  mustConvert?: boolean;
}

const TO_JPEG: ConvertSpec = { to: "jpg", mime: "image/jpeg", options: "width=1600&quality=balanced" };
const TO_MP3: ConvertSpec = { to: "mp3", mime: "audio/mpeg" };
const TO_MP4: ConvertSpec = { to: "mp4", mime: "video/mp4" };

const extensionFor = (mime: string): string => deliveryRuleFor(mime)?.extensions[0] ?? "bin";

/** A safe file name from a title: letters, digits, dashes; never a path. */
export function fileNameFor(title: string, mime: string): string {
  const base = title.normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "visionex";
  return `${base}.${extensionFor(mime)}`;
}

/**
 * The file for an item that names it directly, without a second request.
 * Only a licensed item on a provider with a named host list ever qualifies.
 */
export function directCandidate(item: ExternalContentItem, kind: FileKind): FileCandidate | null {
  const hosts = DELIVERY_HOSTS[item.provider];
  if (!hosts || !item.license) return null;
  if (item.provider === "gutenberg" && kind === "book" && /^\d{1,8}$/.test(item.providerItemId)) {
    // Gutenberg's EPUB is not on Meta's list; its plain-text edition is.
    const id = item.providerItemId;
    return { url: `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`, mime: "text/plain", fileName: fileNameFor(item.title, "text/plain"), size: null, hosts };
  }
  if (item.provider === "openstax" && kind === "book" && item.downloadUrl && /\.pdf(\?|$)/i.test(item.downloadUrl)) {
    return { url: item.downloadUrl, mime: "application/pdf", fileName: fileNameFor(item.title, "application/pdf"), size: item.sizeBytes, hosts };
  }
  if (kind === "image") return imageCandidate(item, hosts);
  if (kind === "audio" || kind === "video") return commonsMediaCandidate(item, kind, hosts);
  if (kind === "document") return documentCandidate(item, hosts);
  return null;
}

/**
 * May this licence's work be passed on by a commercial service? Creative
 * Commons (without NonCommercial), public domain, CC0 and government works do;
 * anything else, or no licence, does not. A no-derivatives licence allows the
 * file as it is but not a resized or converted copy, so `modified` refuses it.
 */
export function licenceAllows(licence: { name: string } | null | undefined, modified: boolean): boolean {
  const name = licence?.name ?? "";
  // "Attribution" is how Commons names its older Creative Commons tags ("Attribution-ShareAlike").
  if (!/^(CC0|CC[ -]|Attribution|Public Domain|United States Government Work|No known copyright)/i.test(name)) return false;
  if (/(?:^|[\s-])NC(?:[\s-]|$)|Non-?Commercial/i.test(name)) return false;
  if (modified && NO_DERIVATIVES.test(name)) return false;
  return true;
}

const extensionOf = (url: string): string => /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase() ?? "";

/** Audio and video from Wikimedia Commons: what Meta takes as it is, or converted on the processor. */
function commonsMediaCandidate(item: ExternalContentItem, kind: "audio" | "video", hosts: readonly string[]): FileCandidate | null {
  const original = item.provider === "wikimedia_commons" ? commonsOriginal(item.downloadUrl) : null;
  if (!original) return null;
  let mime = (item.mimeType ?? "").toLowerCase();
  // Commons labels every Ogg "application/ogg": a .ogv is a video, the rest are sound.
  if (mime === "application/ogg") mime = /\.ogv$/i.test(original.name) ? "video/ogg" : "audio/ogg";
  const wanted = kind === "audio" ? /^audio\// : /^video\//;
  if (!wanted.test(mime)) return null;
  const direct = mime === "audio/mpeg" || mime === "video/mp4";
  if (!licenceAllows(item.license, !direct)) return null;
  return {
    url: original.url, mime, fileName: fileNameFor(item.title, direct ? mime : (kind === "audio" ? TO_MP3.mime : TO_MP4.mime)),
    size: item.sizeBytes, hosts, ...(direct ? {} : { convert: kind === "audio" ? TO_MP3 : TO_MP4, mustConvert: true }),
  };
}

/** The suffix-matched allowlist entry a PDF's host falls under, or null. */
function hostEntry(url: string, hosts: readonly string[]): string | null {
  let host: string;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  return hosts.find((h) => host === h || host.endsWith(`.${h}`)) ?? null;
}

/** A paper or a PDF: an open-access PDF with a stated open licence from a named repository, or a PDF on Commons. */
function documentCandidate(item: ExternalContentItem, hosts: readonly string[]): FileCandidate | null {
  if (!item.downloadUrl || !licenceAllows(item.license, false)) return null;
  if (item.provider === "wikimedia_commons") {
    const original = commonsOriginal(item.downloadUrl);
    if (item.mimeType !== "application/pdf" || !original) return null;
    return { url: original.url, mime: "application/pdf", fileName: fileNameFor(item.title, "application/pdf"), size: item.sizeBytes, hosts };
  }
  if (item.provider === "openalex") {
    const entry = hostEntry(item.downloadUrl, hosts);
    if (!entry || !isFetchableAssetUrl(item.downloadUrl, [entry])) return null;
    return { url: item.downloadUrl, mime: "application/pdf", fileName: fileNameFor(item.title, "application/pdf"), size: null, hosts: [entry] };
  }
  return null;
}

const IMAGE_MIMES = new Set(["image/jpeg", "image/png"]);
// The API answers with "?utm_source=..." after the address; the file is served without it, and it is dropped.
const COMMONS_FILE = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/(?!thumb\/)[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+))(?:\?utm_[\w=&.%:/-]{0,200})?$/;
/** The file's own address (no tracking query) and its name, or null when this is not a Commons original. */
function commonsOriginal(url: string | null): { url: string; name: string } | null {
  const m = url ? COMMONS_FILE.exec(url) : null;
  return m ? { url: m[1], name: m[2] } : null;
}
/** The exact shape of each museum's image address; anything else is not delivered. */
const MUSEUM_IMAGE: Readonly<Record<string, RegExp>> = {
  met_museum: /^https:\/\/images\.metmuseum\.org\/CRDImages\/[\w/.-]+\.(?:jpg|jpeg|png)$/i,
  artic: /^https:\/\/www\.artic\.edu\/iiif\/2\/[0-9a-f-]{36}\/full\/\d{2,4},\/0\/default\.jpg$/,
  cleveland_museum: /^https:\/\/openaccess-cdn\.clevelandart\.org\/[\w./-]+\.(?:jpg|jpeg|png)$/i,
  rijksmuseum: /^https:\/\/iiif\.micr\.io\/[A-Za-z0-9_-]{3,40}\/full\/max\/0\/default\.jpg$/,
};
const OPENVERSE_THUMB = /^https:\/\/api\.openverse\.org\/v1\/images\/[0-9a-f-]{36}\/thumb\/?$/;
/** A Creative Commons licence that forbids a changed copy: a resized picture would be one. */
const NO_DERIVATIVES = /(?:^|[\s-])ND(?:[\s-]|$)/i;

/**
 * The picture for an image item.
 *
 *   Wikimedia Commons  the original when it fits Meta's 5 MB, else Commons' own resized copy;
 *                      a WebP, GIF or TIFF is converted to JPEG on the processor
 *   Openverse          its resized thumbnail, which it serves itself (the originals sit on the
 *                      site the work came from, which is not a host we name)
 *   the museums        the CC0 image from the museum's own server; resized on the processor
 *                      when it is over Meta's limit
 *   Flickr             the photo as Flickr serves it, only where its own licence allows
 *
 * Only a licence that permits passing the work on qualifies, and a
 * no-derivatives licence never gets a resized or converted copy.
 */
function imageCandidate(item: ExternalContentItem, hosts: readonly string[]): FileCandidate | null {
  const limit = deliveryRuleFor("image/jpeg")?.maxBytes ?? 0;
  if (!item.downloadUrl && item.provider !== "openverse") return null;
  if (item.provider === "openverse") {
    if (!item.downloadUrl || !item.thumbnailUrl || !OPENVERSE_THUMB.test(item.thumbnailUrl) || !licenceAllows(item.license, true)) return null;
    return { url: item.thumbnailUrl, mime: "image/jpeg", fileName: fileNameFor(item.title, "image/jpeg"), size: null, hosts };
  }
  const url = item.downloadUrl as string;
  if (item.provider === "wikimedia_commons") {
    const mime = (item.mimeType ?? "").toLowerCase();
    const original = commonsOriginal(url);
    if (!original) return null;
    if (IMAGE_MIMES.has(mime)) {
      if (item.sizeBytes !== null && item.sizeBytes <= limit) {
        return licenceAllows(item.license, false)
          ? { url: original.url, mime, fileName: fileNameFor(item.title, mime), size: item.sizeBytes, hosts }
          : null;
      }
      if (!licenceAllows(item.license, true)) return null;
      // Special:FilePath answers with a redirect to Commons' resized copy, of the original's type.
      return { url: `https://commons.wikimedia.org/wiki/Special:FilePath/${original.name}?width=1600`, mime, fileName: fileNameFor(item.title, mime), size: null, hosts };
    }
    // A raster type Meta refuses (WebP, GIF, TIFF, BMP) can still be converted; a vector drawing cannot.
    if (/^image\/(webp|gif|tiff|bmp)$/.test(mime) && licenceAllows(item.license, true)) {
      return { url: original.url, mime, fileName: fileNameFor(item.title, "image/jpeg"), size: item.sizeBytes, hosts, convert: TO_JPEG };
    }
    return null;
  }
  const ext = extensionOf(url);
  const pattern = MUSEUM_IMAGE[item.provider];
  if (item.provider === "flickr") {
    if (!/^https:\/\/live\.staticflickr\.com\/[\w/-]+\.jpg$/.test(url) || !licenceAllows(item.license, false)) return null;
    return { url, mime: "image/jpeg", fileName: fileNameFor(item.title, "image/jpeg"), size: null, hosts };
  }
  if (!pattern || !pattern.test(url) || !licenceAllows(item.license, false)) return null;
  const mime = ext === "png" ? "image/png" : "image/jpeg";
  // Over Meta's limit (museum originals often are) it is resized, which CC0 allows.
  return { url, mime, fileName: fileNameFor(item.title, mime), size: item.sizeBytes, hosts, convert: TO_JPEG };
}

/**
 * Is this the work the sender asked for? A search across catalogues returns
 * whatever ranks, and sending the wrong book as a file is worse than sending a
 * link. Every word of a short query, or the first two of a longer one, must be
 * in the title or the maker's name. Words are compared as letters and digits, so
 * Arabic and Chinese titles match too (a query of one word needs that one word).
 */
export function matchesRequest(item: ExternalContentItem, query: string, loose = false, need = 2): boolean {
  const terms = query.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2);
  if (terms.length === 0) return false;
  // A picture's title is often a file name; its description and tags say what it shows.
  const haystack = `${item.title} ${item.creator ?? ""}${loose ? ` ${item.description ?? ""} ${(item.tags ?? []).join(" ")}` : ""}`.toLocaleLowerCase();
  return terms.filter((w) => haystack.includes(w)).length >= Math.min(terms.length, need);
}

/**
 * The size a server states for a file, from a HEAD request, before anything is
 * downloaded. Null when it does not say (or the request fails), which is not a
 * refusal: the download itself still enforces Meta's limit as it streams.
 */
export async function declaredSize(url: string, hosts: readonly string[], fetchImpl: Fetch): Promise<number | null> {
  if (!isFetchableAssetUrl(url, hosts)) return null;
  try {
    const res = await fetchImpl(url, { method: "HEAD", redirect: "manual", signal: timeoutSignal(5_000), headers: { "User-Agent": "Visionex-Library/1.0 (+https://visionex.app)" } });
    // A redirect is followed by the delivery, which re-checks every hop; the size is on the far side.
    const n = Number(res.headers.get("content-length"));
    return res.ok && Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * The attribution that travels INSIDE the file's own message (its caption): title, maker, licence, source —
 * no address, no link. Public domain and CC0 need none. A licence that asks for credit (CC BY and the
 * like) gets it here, so the sender receives the file and nothing else.
 */
export function attributionCaption(item: ExternalContentItem): string | undefined {
  const licence = item.license?.name ?? "";
  if (!licence || /^(CC0|Public Domain|United States Government|No known copyright)/i.test(licence)) return undefined;
  const text = [[item.title, item.creator].filter(Boolean).join(" — "), [licence, item.providerName].filter(Boolean).join(" · ")].filter(Boolean).join("\n");
  return text.length > 400 ? text.slice(0, 399) + "…" : text;
}

/** The credit that travels with a file, for a reply that IS a link: title, maker, source, licence, address — names and codes only. */
export function creditText(item: ExternalContentItem): string {
  return [
    [item.title, item.creator].filter(Boolean).join(" — "),
    [item.providerName, item.license?.name].filter(Boolean).join(" · "),
    item.externalUrl,
  ].join("\n");
}

// ─── The flow ──────────────────────────────────────────────────────────────

export interface AttachDeps {
  fetch: Fetch;
  env: GetEnv;
  /** Puts one file in front of the sender (deliverAsset, bound to their number). Never throws. */
  deliver: (asset: DeliverableAsset) => Promise<DeliveryResult>;
  /** Plain text to the sender, for the credit line. */
  sendText: (body: string) => Promise<unknown>;
  /** Translates a search phrase into English, for a request in a script the catalogues do not index. Absent when there is no provider. */
  translate?: (query: string) => Promise<string | null>;
  /** Converts a file on the media processor (convertMediaLocally, bound to its config). Absent when there is none. */
  convert?: (bytes: Uint8Array, query: string) => Promise<{ ok: boolean; bytes?: Uint8Array; mime?: string; code?: string }>;
  /** Overridable for tests. */
  search?: (input: NonNullable<ReturnType<typeof normalizeSearchInput>>) => Promise<AggregateResult>;
}

export type AttachOutcome =
  | { outcome: "delivered"; provider: string; kind: WhatsAppMediaKind; tried: number; count: number }
  | {
    outcome: "none";
    reason: "no_query" | "search_failed" | "no_candidate" | "delivery_failed";
    tried: number;
    /** The first matching result's own page (it carries the licence), for a caller that answers with a link. */
    link?: { url: string; title: string };
  };

const MAX_CANDIDATES = 3;
/** The most files one request sends: "some pictures of ..." is three, a number is honoured up to five. */
export const MAX_FILES = 5;
const METADATA_TIMEOUT_MS = 8_000;

/** AbortSignal.timeout exists in Deno and current browsers; a test runtime without it just has no timeout. */
const timeoutSignal = (ms: number): AbortSignal | undefined => (typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(ms) : undefined);

async function archiveCandidate(item: ExternalContentItem, kind: FileKind, deps: AttachDeps): Promise<FileCandidate | null> {
  const id = item.providerItemId;
  if (!ARCHIVE_ID.test(id) || !item.license) return null;
  let meta: unknown;
  try {
    const res = await deps.fetch(`https://archive.org/metadata/${id}`, { signal: timeoutSignal(METADATA_TIMEOUT_MS), headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    meta = await res.json();
  } catch {
    return null;
  }
  const picked = pickArchiveFile(readArchiveFiles(meta), kind);
  if (!picked) return null;
  return {
    url: `https://archive.org/download/${id}/${encodeURIComponent(picked.name)}`,
    mime: picked.mime,
    fileName: fileNameFor(item.title, picked.mime),
    size: picked.size,
    hosts: DELIVERY_HOSTS.internet_archive,
  };
}

/**
 * Fetches the file from its named host (every redirect re-checked), converts it on the
 * media processor, and delivers what comes back. The bytes of the result are checked
 * against their type by deliverAsset like any other file; a failure anywhere is a failed
 * delivery, never a partial one.
 */
async function deliverConverted(candidate: FileCandidate, spec: ConvertSpec, deps: AttachDeps, caption?: string): Promise<DeliveryResult> {
  const failed = (reason: "asset_too_large" | "asset_type_unsupported" | "asset_download_failed" | "asset_not_found" | "asset_invalid" | "asset_download_timeout"): DeliveryResult =>
    ({ outcome: "failed", reason, ms: 0 });
  // The processor takes at most 16 MB; a bigger source is refused before it is downloaded.
  if (candidate.size !== null && candidate.size > CONVERT_SOURCE_MAX) return failed("asset_too_large");
  const got = await fetchAssetBytes({ url: candidate.url, allowedHosts: candidate.hosts, maxBytes: CONVERT_SOURCE_MAX, fetchImpl: deps.fetch as typeof fetch });
  if (!got.ok) {
    const reason = (got as { reason: string }).reason;
    const known = ["asset_too_large", "asset_not_found", "asset_invalid", "asset_download_timeout"] as const;
    return failed((known as readonly string[]).includes(reason) ? reason as (typeof known)[number] : "asset_download_failed");
  }
  const out = await deps.convert!(got.bytes, `to=${spec.to}${spec.options ? `&${spec.options}` : ""}`);
  if (!out.ok || !out.bytes?.length || !out.mime) return failed("asset_type_unsupported");
  return deps.deliver({ bytes: out.bytes, mimeType: out.mime, fileName: fileNameFor(candidate.fileName.replace(/\.[^.]+$/, ""), out.mime), caption });
}

const CONVERT_SOURCE_MAX = 16 * 1024 * 1024;

/**
 * Searches the connected sources for a licensed file of this kind and delivers
 * the first one that goes through. Returns what happened; sends nothing itself
 * when nothing was delivered, so the caller's list of links still follows.
 */
export async function attachExternalFile(
  params: { kind: FileKind; query: string; language: string; count?: number },
  deps: AttachDeps,
): Promise<AttachOutcome> {
  // The catalogues are mostly indexed in English. A request in another script is searched in English
  // first when the caller can translate it (an Arabic title is rarely on a file), then as it was written.
  let english: string | null = null;
  if (deps.translate && NON_LATIN.test(params.query)) {
    try { english = await deps.translate(stripFileWish(params.query)); } catch { english = null; }
    english = english?.replace(/\s+/g, " ").trim().slice(0, 80) ?? null;
    if (english && english.length >= 2 && english.toLowerCase() !== params.query.toLowerCase() && !NON_LATIN.test(english)) {
      const translated = await attemptAttach({ ...params, query: english }, deps);
      if (translated.outcome === "delivered") return translated;
      const original = await attemptAttach(params, deps);
      if (original.outcome === "delivered") return original;
      return { ...original, tried: translated.tried + original.tried, ...(translated.link ?? original.link ? { link: translated.link ?? original.link } : {}) };
    }
  }
  return attemptAttach(params, deps);
}

/** A letter outside the Latin script: the catalogues will not match it by title. */
const NON_LATIN = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

async function attemptAttach(
  params: { kind: FileKind; query: string; language: string; count?: number },
  deps: AttachDeps,
): Promise<AttachOutcome> {
  const query = stripFileWish(params.query);
  if (query.length < 2) return { outcome: "none", reason: "no_query", tried: 0 };

  const spec = KIND_SEARCH[params.kind];
  const input = normalizeSearchInput({ query, categories: [...spec.categories], providers: [...spec.providers], language: params.language, limit: Math.min(12, 4 + 2 * ((params.count ?? 1) - 1)) });
  if (!input) return { outcome: "none", reason: "no_query", tried: 0 };

  let found: AggregateResult;
  try {
    found = await (deps.search ?? ((i) => searchExternalContent(i, { fetch: deps.fetch, env: deps.env }, { deadlineMs: 6_000 })))(input);
  } catch {
    return { outcome: "none", reason: "search_failed", tried: 0 };
  }

  // A picture, recording, film or paper comes from the sources in the order they are preferred (Commons and
  // Openverse before a museum's artwork for "a photo of a fox"); within a source the catalogue's ranking stands.
  if (params.kind === "image" || params.kind === "audio" || params.kind === "video" || params.kind === "document") {
    const rank = (provider: string) => { const i = spec.providers.indexOf(provider); return i < 0 ? spec.providers.length : i; };
    found = { ...found, items: found.items.map((item, at) => ({ item, at })).sort((a, b) => rank(a.item.provider) - rank(b.item.provider) || a.at - b.at).map((x) => x.item) };
  }

  let tried = 0;
  let sent = 0;
  let first: { provider: string; kind: WhatsAppMediaKind } | null = null;
  const wanted = Math.max(1, Math.min(MAX_FILES, params.count ?? 1));
  const seen = new Set<string>();
  let link: { url: string; title: string } | undefined;
  for (const item of found.items) {
    if (tried >= MAX_CANDIDATES + wanted - 1) break;
    // The work asked for, not merely the top of a ranking. A picture is what the search engine matched
    // to the words (its title is often a file name, and the subject may be in another language), so
    // the catalogue's own ranking decides; a book, a paper or a film is held to its title.
    if (params.kind !== "image" && !matchesRequest(item, query, params.kind === "document", params.kind === "document" ? 1 : 2)) continue;
    if (LINK_FALLBACK_KINDS.has(params.kind) && !link && /^https:\/\//i.test(item.externalUrl)) link = { url: item.externalUrl, title: item.title };
    const candidate = item.provider === "internet_archive"
      // A recording from the Archive is chosen the way an audiobook chapter is: a small MP3 that fits.
      ? await archiveCandidate(item, params.kind === "audio" ? "audiobook" : params.kind, deps)
      : directCandidate(item, params.kind);
    if (!candidate || seen.has(candidate.url)) continue;
    seen.add(candidate.url);
    const caption = attributionCaption(item);
    const rule = deliveryRuleFor(candidate.mime);
    // A file whose size nobody stated is asked its size before it is downloaded.
    const size = candidate.size ?? await declaredSize(candidate.url, candidate.hosts, deps.fetch);
    const fits = rule !== null && !candidate.mustConvert && (size === null || size <= rule.maxBytes);

    let result: DeliveryResult;
    if (fits) {
      tried++;
      result = await deps.deliver({ url: candidate.url, allowedHosts: candidate.hosts, mimeType: candidate.mime, fileName: candidate.fileName, caption });
    } else if (candidate.convert && deps.convert) {
      // A type Meta refuses, or a file over its limit: converted on the media processor, then sent as bytes.
      tried++;
      result = await deliverConverted(candidate, candidate.convert, deps, caption);
    } else {
      continue;
    }
    if (result.outcome.startsWith("delivered_")) {
      sent++;
      first ??= { provider: item.provider, kind: (result as Extract<DeliveryResult, { kind: WhatsAppMediaKind }>).kind };
      if (sent >= wanted) break;
    }
  }
  // The file, and nothing else: no link and no second message. What credit a licence asks for
  // travelled in the caption.
  if (first) return { outcome: "delivered", provider: first.provider, kind: first.kind, tried, count: sent };
  return { outcome: "none", reason: tried === 0 ? "no_candidate" : "delivery_failed", tried, ...(link ? { link } : {}) };
}

/**
 * "Send me the link to ...": what the sender asked for is the address, so the answer is the address and
 * nothing is downloaded or attached. The results' own pages (they carry the licence), up to three.
 */
export async function findExternalLinks(
  params: { kind: FileKind; query: string; language: string },
  deps: Pick<AttachDeps, "fetch" | "env" | "search" | "translate">,
): Promise<Array<{ title: string; url: string }>> {
  const run = async (raw: string): Promise<Array<{ title: string; url: string }>> => {
    const query = stripFileWish(raw);
    const spec = KIND_SEARCH[params.kind];
    const input = query.length >= 2 ? normalizeSearchInput({ query, categories: [...spec.categories], providers: [...spec.providers], language: params.language, limit: 4 }) : null;
    if (!input) return [];
    try {
      const found = await (deps.search ?? ((i) => searchExternalContent(i, { fetch: deps.fetch, env: deps.env }, { deadlineMs: 6_000 })))(input);
      return found.items.filter((i) => /^https:\/\//i.test(i.externalUrl)).slice(0, 3).map((i) => ({ title: i.title, url: i.externalUrl }));
    } catch {
      return [];
    }
  };
  if (deps.translate && NON_LATIN.test(params.query)) {
    let english: string | null = null;
    try { english = await deps.translate(stripFileWish(params.query)); } catch { english = null; }
    if (english && !NON_LATIN.test(english)) {
      const links = await run(english.slice(0, 80));
      if (links.length) return links;
    }
  }
  return run(params.query);
}
