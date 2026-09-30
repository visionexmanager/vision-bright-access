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
import { deliveryRuleFor, isFetchableAssetUrl, type DeliverableAsset, type DeliveryResult, type WhatsAppMediaKind } from "./whatsappAssetDelivery.ts";

export type FileKind = "book" | "audiobook" | "video";

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
};

export const KIND_SEARCH: Readonly<Record<FileKind, { categories: readonly string[]; providers: readonly string[] }>> = {
  book: { categories: ["books", "education"], providers: ["gutenberg", "openstax", "internet_archive"] },
  audiobook: { categories: ["audio"], providers: ["internet_archive"] },
  video: { categories: ["video"], providers: ["internet_archive"] },
};

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

export interface FileCandidate {
  url: string;
  mime: string;
  fileName: string;
  size: number | null;
  hosts: readonly string[];
}

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
  return null;
}

/**
 * Is this the work the sender asked for? A search across catalogues returns
 * whatever ranks, and sending the wrong book as a file is worse than sending a
 * link. Every word of a short query, or the first two of a longer one, must be
 * in the title or the maker's name. Words are compared as letters and digits, so
 * Arabic and Chinese titles match too (a query of one word needs that one word).
 */
export function matchesRequest(item: ExternalContentItem, query: string): boolean {
  const terms = query.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2);
  if (terms.length === 0) return false;
  const haystack = `${item.title} ${item.creator ?? ""}`.toLocaleLowerCase();
  return terms.filter((w) => haystack.includes(w)).length >= Math.min(terms.length, 2);
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

/** The credit that travels with a file: title, maker, source, licence, address — names and codes only. */
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
  /** Overridable for tests. */
  search?: (input: NonNullable<ReturnType<typeof normalizeSearchInput>>) => Promise<AggregateResult>;
}

export type AttachOutcome =
  | { outcome: "delivered"; provider: string; kind: WhatsAppMediaKind; tried: number }
  | { outcome: "none"; reason: "no_query" | "search_failed" | "no_candidate" | "delivery_failed"; tried: number };

const MAX_CANDIDATES = 3;
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
 * Searches the connected sources for a licensed file of this kind and delivers
 * the first one that goes through. Returns what happened; sends nothing itself
 * when nothing was delivered, so the caller's list of links still follows.
 */
export async function attachExternalFile(
  params: { kind: FileKind; query: string; language: string },
  deps: AttachDeps,
): Promise<AttachOutcome> {
  const query = stripFileWish(params.query);
  if (query.length < 2) return { outcome: "none", reason: "no_query", tried: 0 };

  const spec = KIND_SEARCH[params.kind];
  const input = normalizeSearchInput({ query, categories: [...spec.categories], providers: [...spec.providers], language: params.language, limit: 4 });
  if (!input) return { outcome: "none", reason: "no_query", tried: 0 };

  let found: AggregateResult;
  try {
    found = await (deps.search ?? ((i) => searchExternalContent(i, { fetch: deps.fetch, env: deps.env }, { deadlineMs: 6_000 })))(input);
  } catch {
    return { outcome: "none", reason: "search_failed", tried: 0 };
  }

  let tried = 0;
  for (const item of found.items) {
    if (tried >= MAX_CANDIDATES) break;
    // The work asked for, not merely the top of a ranking.
    if (!matchesRequest(item, query)) continue;
    const candidate = item.provider === "internet_archive"
      ? await archiveCandidate(item, params.kind, deps)
      : directCandidate(item, params.kind);
    if (!candidate) continue;
    const rule = deliveryRuleFor(candidate.mime);
    if (!rule) continue;
    // A file whose size nobody stated is asked its size before it is downloaded.
    const size = candidate.size ?? await declaredSize(candidate.url, candidate.hosts, deps.fetch);
    if (size !== null && size > rule.maxBytes) continue;

    tried++;
    const result = await deps.deliver({
      url: candidate.url,
      allowedHosts: candidate.hosts,
      mimeType: candidate.mime,
      fileName: candidate.fileName,
    });
    if (result.outcome.startsWith("delivered_")) {
      await deps.sendText(creditText(item)).catch(() => undefined);
      return { outcome: "delivered", provider: item.provider, kind: (result as Extract<DeliveryResult, { kind: WhatsAppMediaKind }>).kind, tried };
    }
  }
  return { outcome: "none", reason: tried === 0 ? "no_candidate" : "delivery_failed", tried };
}
