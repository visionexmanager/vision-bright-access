// Turning any picture a person can send into one the readers understand.
//
// Meta delivers a photograph as JPEG or PNG, and WebP as a sticker. Anything
// else arrives as a *document* carrying an image type: a BMP, a TIFF, an AVIF,
// an iPhone's HEIC, a picture sent "as a file" so that it is not compressed.
// The readers (Tesseract, the vision providers) take JPEG, PNG, WebP and GIF
// and nothing more, and until this existed every other format was declined with
// "I can't read that" — for the person who most needed it read.
//
// The processor's ffmpeg decodes what it can and writes a PNG. A format it
// cannot decode comes back as a failure, and the caller says so honestly
// instead of guessing.

import { convertMediaLocally } from "./whatsappProcessor.ts";

/** What the readers take as they are. */
export const READABLE_IMAGE_MIMES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/**
 * Further picture types a sender can produce, converted before reading.
 *
 * Aliases are listed because clients disagree on the name: `image/jpg` and
 * `image/pjpeg` are JPEG, `image/x-png` is PNG, `image/x-ms-bmp` is BMP.
 */
export const CONVERTIBLE_IMAGE_MIMES: readonly string[] = [
  "image/jpg",
  "image/pjpeg",
  "image/jfif",
  "image/x-png",
  "image/bmp",
  "image/x-ms-bmp",
  "image/tiff",
  "image/tif",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  "image/jp2",
  "image/jxl",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/x-tga",
  "image/x-portable-pixmap",
  "image/x-portable-graymap",
  "image/x-portable-bitmap",
  "image/x-portable-anymap",
  "image/x-pcx",
];

const baseType = (mime: string | undefined): string =>
  (mime ?? "").split(";")[0].trim().toLowerCase();

/** Is this a picture type of any kind, readable as it is or after conversion? */
export function isImageMime(mime: string | undefined): boolean {
  return baseType(mime).startsWith("image/");
}

/** Does a picture of this type have to be converted before it can be read? */
export function needsImageConversion(mime: string | undefined): boolean {
  const base = baseType(mime);
  return base.startsWith("image/") && !READABLE_IMAGE_MIMES.includes(base);
}

export type NormalisedImage =
  | { ok: true; bytes: Uint8Array; mimeType: string; converted: boolean }
  | { ok: false; reason: string };

/**
 * The picture as a format the readers take.
 *
 * Unchanged when it already is one. Otherwise converted to PNG, which is
 * lossless: re-encoding as JPEG would blur the small print that is the whole
 * reason for sending the picture.
 */
export async function normaliseImage(params: {
  bytes: Uint8Array;
  mimeType: string;
  convert?: typeof convertMediaLocally;
}): Promise<NormalisedImage> {
  const mimeType = baseType(params.mimeType);
  if (!needsImageConversion(mimeType)) {
    return { ok: true, bytes: params.bytes, mimeType, converted: false };
  }
  const result = await (params.convert ?? convertMediaLocally)({
    bytes: params.bytes,
    query: new URLSearchParams({ to: "png" }).toString(),
    path: "/convert",
  });
  if (!result.ok || !result.bytes) return { ok: false, reason: result.code ?? "conversion_failed" };
  return { ok: true, bytes: result.bytes, mimeType: "image/png", converted: true };
}
