// The file behind a Library result, for a reader who wants to keep it.
//
// The Library used to offer a "Download" link that opened the provider's own
// address in a new tab. That is a hotlink, not a file: some hosts refuse it, some
// show a page instead, and none of them hand over a name. This fetches the file
// on the server, under the rules the chat channels already use (a named host, a
// licence that lets the work be passed on, a size limit, bytes that look like
// what they claim to be), and returns it to the page as a file.
//
// Only what the chat channels may deliver can be saved here, and nothing more:
// a result is saveable if, and only if, `directCandidate` would deliver it.

import { directCandidate, type FileCandidate } from "./whatsappExternalFiles.ts";
import { deliveryRuleFor, fetchAssetBytes, safeFileName } from "./whatsappAssetDelivery.ts";
import { convertMediaLocally } from "./whatsappProcessor.ts";
import type { ExternalContentItem } from "./externalContent/types.ts";

/** A file the page holds in memory as base64, so a ceiling well under what a chat allows. */
export const LIBRARY_FILE_MAX_BYTES = 12 * 1024 * 1024;

export type LibraryFileFailure = "not_deliverable" | "download_failed" | "too_large" | "convert_failed" | "content_mismatch";

export type LibraryFile =
  | { ok: true; bytes: Uint8Array; mimeType: string; fileName: string }
  | { ok: false; reason: LibraryFailure };

type LibraryFailure = LibraryFileFailure;

const KINDS: Readonly<Record<string, "image" | "audio" | "video" | "document" | "book">> = {
  image: "image", audio: "audio", video: "video", document: "document", book: "book",
};

/** The kind of file a result is, or null when it has none to give (a podcast feed, a live radio, a dataset page). */
export function libraryFileKind(item: ExternalContentItem): "image" | "audio" | "video" | "document" | "book" | null {
  return KINDS[item.contentType] ?? null;
}

export async function prepareLibraryFile(
  item: ExternalContentItem,
  deps: { fetch: typeof fetch; convert?: typeof convertMediaLocally },
): Promise<LibraryFile> {
  const kind = libraryFileKind(item);
  const candidate: FileCandidate | null = kind ? directCandidate(item, kind) : null;
  if (!candidate) return { ok: false, reason: "not_deliverable" };

  const rule = deliveryRuleFor(candidate.mime);
  if (!rule) return { ok: false, reason: "not_deliverable" };

  const needsConversion = candidate.mustConvert === true;
  const got = await fetchAssetBytes({
    url: candidate.url,
    allowedHosts: candidate.hosts,
    // A source that has to be converted may be larger than the file that comes out of it.
    maxBytes: needsConversion || candidate.convert ? 16 * 1024 * 1024 : Math.min(rule.maxBytes, LIBRARY_FILE_MAX_BYTES),
    fetchImpl: deps.fetch,
  });
  if ("reason" in got) return { ok: false, reason: got.reason === "asset_too_large" ? "too_large" : "download_failed" };

  let bytes = got.bytes;
  let mimeType = candidate.mime;
  if (needsConversion || (candidate.convert && bytes.byteLength > rule.maxBytes)) {
    if (!candidate.convert) return { ok: false, reason: "too_large" };
    const query = `to=${candidate.convert.to}${candidate.convert.options ? `&${candidate.convert.options}` : ""}`;
    const out = await (deps.convert ?? convertMediaLocally)({ bytes, query });
    if (!out.ok || !out.bytes?.length || !out.mime) return { ok: false, reason: "convert_failed" };
    bytes = out.bytes;
    mimeType = out.mime;
  }

  const outRule = deliveryRuleFor(mimeType) ?? rule;
  if (bytes.byteLength === 0 || bytes.byteLength > LIBRARY_FILE_MAX_BYTES) return { ok: false, reason: "too_large" };
  if (!outRule.looksRight(bytes)) return { ok: false, reason: "content_mismatch" };

  return { ok: true, bytes, mimeType, fileName: safeFileName(candidate.fileName, mimeType) };
}

/** Base64 in slices, so a large file does not overflow the argument limit of String.fromCharCode. */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
