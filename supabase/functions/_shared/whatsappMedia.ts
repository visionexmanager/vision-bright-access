// WhatsApp Cloud API media: fetching a customer's attachment safely.
//
// Media arrives as an id, not bytes. Turning it into bytes is two hops — ask
// Graph for a download URL, then fetch that URL with the same bearer token —
// and both hops are places to be careful:
//
//   * The download URL comes back from a *response*, and is then fetched. That
//     is the shape of an SSRF, so the host is checked against Meta's before
//     anything is requested. A URL that is not Meta's is not fetched at all.
//   * The URL carries an access token in its query string, so it is never
//     logged, never stored, and never put in an error message.
//   * A size limit is enforced from the declared size *and* from the bytes
//     actually read, because a declared size is a claim, not a fact.
//
// Everything here is pure or clearly isolated I/O so the policy — what is
// allowed, how big, which type — is testable without a Meta account.

import { GRAPH_BASE } from "./meta.ts";
import { trace } from "./whatsappTelemetry.ts";

/** Hosts Meta serves media from. Anything else is refused before a request. */
const ALLOWED_MEDIA_HOSTS = [
  "lookaside.fbsbx.com",
  "graph.facebook.com",
  "scontent.xx.fbcdn.net",
];

/**
 * Whether a download URL may be fetched.
 *
 * Exact host match or a `.fbcdn.net` / `.facebook.com` subdomain, HTTPS only.
 * A suffix check alone would accept `evil-fbcdn.net`, so the dot matters.
 */
export function isAllowedMediaUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (ALLOWED_MEDIA_HOSTS.includes(host)) return true;
  return host.endsWith(".fbcdn.net") || host.endsWith(".facebook.com");
}

export type MediaKind = "audio" | "image" | "document" | "video" | "sticker";

/**
 * Size ceilings, in bytes, per kind.
 *
 * Well under Meta's own limits. These bound the edge function's memory and the
 * downstream model cost, which is the part that actually hurts: a 25 MB video
 * is not a support question, it is a bill.
 */
export const MEDIA_LIMITS: Record<MediaKind, number> = {
  audio: 16 * 1024 * 1024,
  image: 8 * 1024 * 1024,
  document: 12 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  sticker: 2 * 1024 * 1024,
};

/** MIME types worth accepting, per kind. Anything else is declined politely. */
export const ALLOWED_MIME: Record<MediaKind, readonly string[]> = {
  audio: ["audio/ogg", "audio/opus", "audio/mpeg", "audio/mp4", "audio/amr", "audio/aac", "audio/wav", "audio/x-wav", "audio/webm"],
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  document: [
    "application/pdf",
    "text/plain",
    "text/csv",
    "text/markdown",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    // Added when the processing service learned to unpack OOXML. A `.docx` was
    // already downloaded and then declined; a `.pptx` was refused one step
    // earlier, at this list, and would have gone on being refused after the
    // unpacker could read it.
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  video: ["video/mp4", "video/3gpp", "video/quicktime"],
  sticker: ["image/webp"],
};

export function isAllowedMime(kind: MediaKind, mime: string | undefined): boolean {
  if (!mime) return false;
  // Meta sometimes appends codec parameters: audio/ogg; codecs=opus
  const base = mime.split(";")[0].trim().toLowerCase();
  return (ALLOWED_MIME[kind] ?? []).includes(base);
}

export interface MediaDescriptor {
  url: string;
  mimeType: string;
  fileSize: number;
  sha256?: string;
}

/** Ask Graph where a media id can be downloaded from. */
export async function fetchMediaDescriptor(
  mediaId: string,
  token: string,
): Promise<MediaDescriptor | null> {
  const res = await fetch(`${GRAPH_BASE}/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error("[whatsapp-media] descriptor lookup failed:", res.status);
    return null;
  }
  const body = await res.json() as {
    url?: string; mime_type?: string; file_size?: number; sha256?: string;
  };
  if (!body.url || !body.mime_type) {
    console.error("[whatsapp-media] descriptor missing url or mime type");
    return null;
  }
  return {
    url: body.url,
    mimeType: body.mime_type,
    fileSize: Number(body.file_size ?? 0),
    sha256: body.sha256,
  };
}

export type MediaFailure =
  | "not_found"
  | "blocked_host"
  | "unsupported_type"
  | "too_large"
  | "download_failed";

export type MediaResult =
  | { ok: true; bytes: Uint8Array; mimeType: string }
  | { ok: false; reason: MediaFailure };

/**
 * Download a customer's attachment, refusing anything outside policy.
 *
 * The declared size is checked first because it is free, and the streamed
 * length is checked as it arrives because the declaration is only a claim.
 */
export async function downloadMedia(params: {
  mediaId: string;
  kind: MediaKind;
  token: string;
  descriptor?: MediaDescriptor | null;
  /**
   * The delivery's correlation id, for the lines this prints.
   *
   * Optional, and used for nothing but a log suffix. It is what lets a failed
   * synthesis or an unreadable download be tied to the delivery that asked
   * for it, without the log line naming the person who sent it.
   */
  trace?: string;
}): Promise<MediaResult> {
  const descriptor = params.descriptor !== undefined
    ? params.descriptor
    : await fetchMediaDescriptor(params.mediaId, params.token);
  if (!descriptor) return { ok: false, reason: "not_found" };

  // Checked before any request is made to it.
  if (!isAllowedMediaUrl(descriptor.url)) {
    console.error(`[whatsapp-media] refused a download host outside Meta${trace(params.trace)}`);
    return { ok: false, reason: "blocked_host" };
  }
  if (!isAllowedMime(params.kind, descriptor.mimeType)) {
    return { ok: false, reason: "unsupported_type" };
  }

  const limit = MEDIA_LIMITS[params.kind];
  if (descriptor.fileSize > limit) return { ok: false, reason: "too_large" };

  let res: Response;
  try {
    res = await fetch(descriptor.url, { headers: { Authorization: `Bearer ${params.token}` } });
  } catch {
    // The URL carries an access token; log the failure, never the URL.
    console.error(`[whatsapp-media] download transport error${trace(params.trace)}`);
    return { ok: false, reason: "download_failed" };
  }
  if (!res.ok) {
    console.error(`[whatsapp-media] download rejected: ${res.status}${trace(params.trace)}`);
    return { ok: false, reason: "download_failed" };
  }

  const buffer = new Uint8Array(await res.arrayBuffer());
  // The declared size was a claim; this is the fact.
  if (buffer.byteLength > limit) return { ok: false, reason: "too_large" };
  if (buffer.byteLength === 0) return { ok: false, reason: "download_failed" };

  return { ok: true, bytes: buffer, mimeType: descriptor.mimeType.split(";")[0].trim() };
}

/** Told to the user when their attachment could not be used, and why. */
export function mediaFailureNotice(
  language: "ar" | "en",
  kind: MediaKind,
  reason: MediaFailure,
): string {
  const en: Record<MediaFailure, string> = {
    not_found: "I couldn't open that attachment — it may have expired. Please send it again.",
    blocked_host: "I couldn't open that attachment safely. Please describe it in text and I'll help.",
    unsupported_type: `I can't read that ${kind} format. Try a common one, or describe it in text.`,
    too_large: `That ${kind} is too large for me to process. Please send a smaller one.`,
    download_failed: "I couldn't download that attachment. Please try sending it again.",
  };
  const ar: Record<MediaFailure, string> = {
    not_found: "تعذّر فتح المرفق، ربما انتهت صلاحيته. أعد إرساله من فضلك.",
    blocked_host: "تعذّر فتح المرفق بأمان. صف لي المحتوى نصاً وسأساعدك.",
    unsupported_type: "لا أستطيع قراءة هذه الصيغة. جرّب صيغة شائعة أو صف المحتوى نصاً.",
    too_large: "حجم الملف كبير جداً للمعالجة. أرسل ملفاً أصغر من فضلك.",
    download_failed: "تعذّر تنزيل المرفق. حاول إرساله مرة أخرى.",
  };
  return language === "ar" ? ar[reason] : en[reason];
}
