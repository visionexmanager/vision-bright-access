// Delivering a file to a WhatsApp sender — the one way every producer does it.
//
// A converted recording, a translated document, a song clip: each used to carry
// its own upload-and-send, each tried once, and each decided for itself which
// kind of message a file became. This is that step, once:
//
//   asset (bytes, or a URL on an allowed host)
//     → preflight: a type Meta takes, a size it takes, a real file of that type
//     → upload to the phone number's media store     (retried when transient)
//     → send as image / audio / video / document      (retried when transient)
//     → on failure, a link the sender can open, if the producer has one
//
// What Meta takes is not guessed. The rules below are Meta's published list
// (developers.facebook.com/docs/whatsapp/cloud-api/reference/media), and the
// list was checked against Meta itself: `whatsapp-media-acceptance.yml`
// uploaded a sample of every format Visionex produces. WAV, FLAC, MOV, MKV,
// WebM, GIF, BMP and TIFF were refused even labelled as a generic file.
//
// Deliberately not done here:
//   - Sending by link. Meta accepts a link message before it has fetched the
//     file, so a link that later fails is a failure nobody here sees — and a
//     delivery that cannot fail visibly cannot fall back. Files are uploaded.
//   - Anything about generating the file or charging for it. A delivery that
//     fails is a delivery failure; the producer's work and its accounting stand.
//   - Logging. The caller logs the result, which names no URL, number or id.

import { GRAPH_BASE } from "./meta.ts";
import { isRetryableSendStatus, sendBackoffMs } from "./whatsapp.ts";
import { say } from "./whatsappStrings.ts";
import type { Language } from "./whatsappCatalog.ts";

export type WhatsAppMediaKind = "image" | "audio" | "video" | "document";

interface DeliveryRule {
  kind: WhatsAppMediaKind;
  /** The type the upload is labelled with, where Meta's name differs from ours. */
  uploadMime: string;
  maxBytes: number;
  /** Whether the bytes really are this type. */
  looksRight: (bytes: Uint8Array) => boolean;
  /** The extension a file of this type gets; the first is the default. */
  extensions: readonly string[];
}

const MB = 1024 * 1024;

const startsWith = (bytes: Uint8Array, ...sig: number[]) => sig.every((b, i) => bytes[i] === b);
const ascii = (bytes: Uint8Array, at: number, text: string) =>
  [...text].every((ch, i) => bytes[at + i] === ch.charCodeAt(0));
const isIsoMedia = (bytes: Uint8Array) => ascii(bytes, 4, "ftyp");
const isPdf = (bytes: Uint8Array) => ascii(bytes, 0, "%PDF-");
const isZip = (bytes: Uint8Array) => startsWith(bytes, 0x50, 0x4b, 0x03, 0x04);
const isOle = (bytes: Uint8Array) => startsWith(bytes, 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
const isMp3 = (bytes: Uint8Array) => ascii(bytes, 0, "ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
const isAdts = (bytes: Uint8Array) => bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0;
/** Ogg carrying Opus: Meta takes Ogg audio with the Opus codec only. */
const isOggOpus = (bytes: Uint8Array) => {
  if (!ascii(bytes, 0, "OggS")) return false;
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 128));
  return head.includes("OpusHead");
};
/** Plain text: valid UTF-8 with no NUL byte. */
const isText = (bytes: Uint8Array) => {
  if (bytes.includes(0)) return false;
  try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); return true; } catch { return false; }
};

/** Meta's published list, keyed by the MIME type a producer declares. */
const RULES: Readonly<Record<string, DeliveryRule>> = {
  "image/jpeg": { kind: "image", uploadMime: "image/jpeg", maxBytes: 5 * MB, looksRight: (b) => startsWith(b, 0xff, 0xd8, 0xff), extensions: ["jpg"] },
  "image/png": { kind: "image", uploadMime: "image/png", maxBytes: 5 * MB, looksRight: (b) => startsWith(b, 0x89, 0x50, 0x4e, 0x47), extensions: ["png"] },
  "audio/mpeg": { kind: "audio", uploadMime: "audio/mpeg", maxBytes: 16 * MB, looksRight: isMp3, extensions: ["mp3"] },
  "audio/aac": { kind: "audio", uploadMime: "audio/aac", maxBytes: 16 * MB, looksRight: isAdts, extensions: ["aac"] },
  "audio/mp4": { kind: "audio", uploadMime: "audio/mp4", maxBytes: 16 * MB, looksRight: isIsoMedia, extensions: ["m4a"] },
  "audio/amr": { kind: "audio", uploadMime: "audio/amr", maxBytes: 16 * MB, looksRight: (b) => ascii(b, 0, "#!AMR"), extensions: ["amr"] },
  "audio/ogg": { kind: "audio", uploadMime: "audio/ogg", maxBytes: 16 * MB, looksRight: isOggOpus, extensions: ["ogg"] },
  // What our processor labels an Opus file is Meta's audio/ogg.
  "audio/opus": { kind: "audio", uploadMime: "audio/ogg", maxBytes: 16 * MB, looksRight: isOggOpus, extensions: ["opus"] },
  "video/mp4": { kind: "video", uploadMime: "video/mp4", maxBytes: 16 * MB, looksRight: isIsoMedia, extensions: ["mp4"] },
  "video/3gpp": { kind: "video", uploadMime: "video/3gpp", maxBytes: 16 * MB, looksRight: isIsoMedia, extensions: ["3gp"] },
  "application/pdf": { kind: "document", uploadMime: "application/pdf", maxBytes: 100 * MB, looksRight: isPdf, extensions: ["pdf"] },
  "text/plain": { kind: "document", uploadMime: "text/plain", maxBytes: 100 * MB, looksRight: isText, extensions: ["txt", "srt", "vtt", "csv", "md"] },
  // Subtitles are plain text, and Meta takes them as text/plain; the name keeps
  // the .srt or .vtt a player needs to recognise them.
  "application/x-subrip": { kind: "document", uploadMime: "text/plain", maxBytes: 100 * MB, looksRight: isText, extensions: ["srt"] },
  "text/vtt": { kind: "document", uploadMime: "text/plain", maxBytes: 100 * MB, looksRight: isText, extensions: ["vtt"] },
  "application/msword": { kind: "document", uploadMime: "application/msword", maxBytes: 100 * MB, looksRight: isOle, extensions: ["doc"] },
  "application/vnd.ms-excel": { kind: "document", uploadMime: "application/vnd.ms-excel", maxBytes: 100 * MB, looksRight: isOle, extensions: ["xls"] },
  "application/vnd.ms-powerpoint": { kind: "document", uploadMime: "application/vnd.ms-powerpoint", maxBytes: 100 * MB, looksRight: isOle, extensions: ["ppt"] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { kind: "document", uploadMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", maxBytes: 100 * MB, looksRight: isZip, extensions: ["docx"] },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { kind: "document", uploadMime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", maxBytes: 100 * MB, looksRight: isZip, extensions: ["xlsx"] },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { kind: "document", uploadMime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", maxBytes: 100 * MB, looksRight: isZip, extensions: ["pptx"] },
};

const baseMime = (mime: string) => mime.split(";")[0].trim().toLowerCase();

/** How WhatsApp carries this type, or null when it cannot carry it at all. */
export function deliveryRuleFor(mime: string): Readonly<DeliveryRule> | null {
  return RULES[baseMime(mime)] ?? null;
}

/** Whether a file of this type can reach a WhatsApp sender. */
export function isDeliverableMime(mime: string): boolean {
  return deliveryRuleFor(mime) !== null;
}

/**
 * A filename safe to show and to store: no path, no control characters, no
 * characters a file system refuses, not too long, and ending in the extension
 * the type really has. A name is what a screen reader announces first about a
 * document, so a meaningless one is replaced rather than passed on.
 */
export function safeFileName(name: string | undefined, mime: string, base = "visionex"): string {
  const rule = deliveryRuleFor(mime);
  const leaf = (name ?? "").split(/[\\/]/).pop() ?? "";
  const own = leaf.match(/\.([A-Za-z0-9]{1,5})$/)?.[1]?.toLowerCase();
  // The producer's own extension when it fits the type (movie.ar.srt stays
  // .srt), otherwise the type's own, so a name never claims to be what it is not.
  const extension = own && rule?.extensions.includes(own) ? own : rule?.extensions[0] ?? "bin";
  let stem = leaf;
  // deno-lint-ignore no-control-regex
  stem = stem.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").replace(/\.[^.]*$/, "").replace(/^[.\s]+|[.\s]+$/g, "");
  if (!stem) stem = base;
  const chars = [...stem];
  if (chars.length > 80) stem = chars.slice(0, 80).join("");
  return `${stem}.${extension}`;
}

// ── Fetching a file from a URL ───────────────────────────────────────────────
//
// Only for delivery, and only from hosts the producer names: this is not a
// proxy. HTTPS only, no credentials in the URL, no IP literal and no localhost
// whatever the allowlist says (so no metadata endpoint, no private network),
// every redirect re-checked against the same rules, a deadline, and a byte cap
// enforced while reading rather than after.

export type DeliveryFailure =
  | "asset_invalid"
  | "asset_not_found"
  | "asset_too_large"
  | "asset_type_unsupported"
  | "asset_download_timeout"
  | "asset_download_failed"
  | "asset_content_mismatch"
  | "whatsapp_upload_rejected"
  | "whatsapp_send_rejected"
  | "whatsapp_transport_error";

const IP_LITERAL = /^(\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:.]+\])$/i;

/** Whether this URL may be fetched for delivery. */
export function isFetchableAssetUrl(raw: string, allowedHosts: readonly string[]): boolean {
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (IP_LITERAL.test(host) || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return false;
  return allowedHosts.some((allowed) => host === allowed.toLowerCase() || host.endsWith(`.${allowed.toLowerCase()}`));
}

const MAX_REDIRECTS = 3;
const DOWNLOAD_TIMEOUT_MS = 20_000;

export async function fetchAssetBytes(params: {
  url: string;
  allowedHosts: readonly string[];
  maxBytes: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<{ ok: true; bytes: Uint8Array; contentType: string } | { ok: false; reason: DeliveryFailure }> {
  const doFetch = params.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? DOWNLOAD_TIMEOUT_MS);
  try {
    let url = params.url;
    for (let hop = 0; ; hop++) {
      if (!isFetchableAssetUrl(url, params.allowedHosts)) return { ok: false, reason: "asset_invalid" };
      const res = await doFetch(url, { redirect: "manual", signal: controller.signal });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        if (!next || hop >= MAX_REDIRECTS) return { ok: false, reason: "asset_download_failed" };
        url = new URL(next, url).toString();
        continue;
      }
      if (res.status === 404 || res.status === 410) return { ok: false, reason: "asset_not_found" };
      if (!res.ok || !res.body) return { ok: false, reason: "asset_download_failed" };
      const declared = Number(res.headers.get("content-length") ?? "0");
      if (declared > params.maxBytes) return { ok: false, reason: "asset_too_large" };
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > params.maxBytes) {
          await reader.cancel().catch(() => undefined);
          return { ok: false, reason: "asset_too_large" };
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total);
      let at = 0;
      for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
      return { ok: true, bytes, contentType: res.headers.get("content-type") ?? "" };
    }
  } catch {
    return { ok: false, reason: controller.signal.aborted ? "asset_download_timeout" : "asset_download_failed" };
  } finally {
    clearTimeout(timer);
  }
}

// ── Upload and send ──────────────────────────────────────────────────────────

const TRANSPORT_ATTEMPTS = 3;
const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function withTransportRetry(
  attempt: () => Promise<Response>,
  sleep: (ms: number) => Promise<void>,
): Promise<{ response?: Response; status: number; tries: number }> {
  for (let tries = 1; ; tries++) {
    let status: number;
    try {
      const response = await attempt();
      if (response.ok) return { response, status: response.status, tries };
      status = response.status;
    } catch {
      // A network fault is transient by definition; treated like a 503.
      status = 503;
    }
    if (!isRetryableSendStatus(status) || tries >= TRANSPORT_ATTEMPTS) return { status, tries };
    await sleep(sendBackoffMs(tries));
  }
}

/** Upload bytes to the phone number's media store: the media id, or why not. */
export async function uploadMediaBytes(params: {
  phoneNumberId: string;
  token: string;
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  attempts?: number;
}): Promise<{ ok: true; id: string; tries: number } | { ok: false; status: number; tries: number }> {
  const doFetch = params.fetchImpl ?? fetch;
  const { response, status, tries } = await withTransportRetry(() => {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", params.mimeType);
    form.append("file", new Blob([params.bytes as BlobPart], { type: params.mimeType }), params.filename);
    return doFetch(`${GRAPH_BASE}/${params.phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.token}` },
      body: form,
    });
  }, params.sleep ?? defaultSleep);
  if (!response) return { ok: false, status, tries };
  const id = ((await response.json().catch(() => ({}))) as { id?: string }).id;
  return id ? { ok: true, id, tries } : { ok: false, status: 502, tries };
}

async function sendMediaMessage(params: {
  phoneNumberId: string;
  token: string;
  to: string;
  kind: WhatsAppMediaKind;
  mediaId: string;
  filename: string;
  caption?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ ok: boolean; status: number; tries: number }> {
  const doFetch = params.fetchImpl ?? fetch;
  const media: Record<string, unknown> = { id: params.mediaId };
  // Meta takes a caption on images, videos and documents, and a filename on
  // documents — the first thing a screen reader announces about one. Audio
  // takes neither; its sentence is sent before it (see deliverAsset).
  if (params.caption && params.kind !== "audio") media.caption = params.caption;
  if (params.kind === "document") media.filename = params.filename;
  const { response, status, tries } = await withTransportRetry(() =>
    doFetch(`${GRAPH_BASE}/${params.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: params.kind,
        [params.kind]: media,
      }),
    }), params.sleep ?? defaultSleep);
  return { ok: !!response, status, tries };
}

async function sendText(params: {
  phoneNumberId: string;
  token: string;
  to: string;
  body: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): Promise<boolean> {
  const doFetch = params.fetchImpl ?? fetch;
  const { response } = await withTransportRetry(() =>
    doFetch(`${GRAPH_BASE}/${params.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${params.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: "text",
        text: { body: params.body, preview_url: true },
      }),
    }), params.sleep ?? defaultSleep);
  return !!response;
}

// ── The delivery ─────────────────────────────────────────────────────────────

/** A file to put in front of a sender. Either its bytes, or a URL to fetch them from. */
export interface DeliverableAsset {
  bytes?: Uint8Array;
  url?: string;
  /** Hosts `url` may be fetched from. Required with `url`; nothing else is fetched. */
  allowedHosts?: readonly string[];
  /** The type the producer says it made. Checked against the bytes. */
  mimeType: string;
  fileName?: string;
  /** A short sentence the sender reads with the file, already in their language. */
  caption?: string;
  /**
   * A link the sender can open instead, used only when the file itself cannot
   * be delivered. HTTPS only; a producer passes one only if it is safe to show.
   */
  fallbackUrl?: string;
  /** The sentence that carries the fallback link, already in their language, with `{url}`. */
  fallbackText?: string;
}

export type DeliveryResult =
  | { outcome: `delivered_${WhatsAppMediaKind}`; kind: WhatsAppMediaKind; bytes: number; uploadTries: number; sendTries: number; ms: number }
  | { outcome: "fallback_url"; reason: DeliveryFailure; ms: number }
  | { outcome: "failed"; reason: DeliveryFailure; ms: number };

/**
 * Deliver one file. Never throws, and never reports a delivery that did not
 * happen: `delivered_*` means Meta accepted the message carrying the file.
 */
export async function deliverAsset(params: {
  phoneNumberId: string;
  token: string;
  to: string;
  asset: DeliverableAsset;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}): Promise<DeliveryResult> {
  const started = Date.now();
  const { asset } = params;
  const ms = () => Date.now() - started;

  const fail = async (reason: DeliveryFailure): Promise<DeliveryResult> => {
    const link = asset.fallbackUrl;
    if (link && asset.fallbackText && /^https:\/\//i.test(link)) {
      const sent = await sendText({
        phoneNumberId: params.phoneNumberId,
        token: params.token,
        to: params.to,
        body: asset.fallbackText.replace("{url}", link),
        fetchImpl: params.fetchImpl,
        sleep: params.sleep,
      }).catch(() => false);
      if (sent) return { outcome: "fallback_url", reason, ms: ms() };
    }
    return { outcome: "failed", reason, ms: ms() };
  };

  try {
    const rule = deliveryRuleFor(asset.mimeType);
    if (!rule) return await fail("asset_type_unsupported");

    let bytes = asset.bytes;
    if (!bytes) {
      if (!asset.url || !asset.allowedHosts?.length) return await fail("asset_invalid");
      const fetched = await fetchAssetBytes({
        url: asset.url,
        allowedHosts: asset.allowedHosts,
        maxBytes: rule.maxBytes,
        fetchImpl: params.fetchImpl,
      });
      if ("reason" in fetched) return await fail(fetched.reason);
      // The server's own word on what it sent, where it gave one, must agree
      // with the producer's in kind: an HTML error page is not a PDF.
      const served = baseMime(fetched.contentType);
      if (served && served !== "application/octet-stream" && deliveryRuleFor(served)?.kind !== rule.kind) {
        return await fail("asset_content_mismatch");
      }
      bytes = fetched.bytes;
    }

    if (bytes.byteLength === 0) return await fail("asset_invalid");
    if (bytes.byteLength > rule.maxBytes) return await fail("asset_too_large");
    if (!rule.looksRight(bytes)) return await fail("asset_content_mismatch");

    const filename = safeFileName(asset.fileName, asset.mimeType);
    const upload = await uploadMediaBytes({
      phoneNumberId: params.phoneNumberId,
      token: params.token,
      bytes,
      mimeType: rule.uploadMime,
      filename,
      fetchImpl: params.fetchImpl,
      sleep: params.sleep,
    });
    if ("status" in upload) {
      return await fail(isRetryableSendStatus(upload.status) ? "whatsapp_transport_error" : "whatsapp_upload_rejected");
    }

    // Audio carries no caption, so its sentence goes first: a clip that arrives
    // before its explanation is a clip somebody cannot place.
    if (rule.kind === "audio" && asset.caption) {
      await sendText({
        phoneNumberId: params.phoneNumberId, token: params.token, to: params.to, body: asset.caption,
        fetchImpl: params.fetchImpl, sleep: params.sleep,
      }).catch(() => false);
    }

    const sent = await sendMediaMessage({
      phoneNumberId: params.phoneNumberId,
      token: params.token,
      to: params.to,
      kind: rule.kind,
      mediaId: upload.id,
      filename,
      caption: asset.caption,
      fetchImpl: params.fetchImpl,
      sleep: params.sleep,
    });
    if (!sent.ok) {
      return await fail(isRetryableSendStatus(sent.status) ? "whatsapp_transport_error" : "whatsapp_send_rejected");
    }
    return {
      outcome: `delivered_${rule.kind}`,
      kind: rule.kind,
      bytes: bytes.byteLength,
      uploadTries: upload.tries,
      sendTries: sent.tries,
      ms: ms(),
    };
  } catch {
    return await fail("whatsapp_transport_error");
  }
}

/**
 * The sentence a delivered file carries, in the sender's language: short,
 * because it is read with the file. Audio carries none (Meta takes no caption
 * on audio, and a producer that has something to say says it first).
 */
export function deliveryCaption(mime: string, language: Language): string | undefined {
  const kind = deliveryRuleFor(mime)?.kind;
  if (kind === "image") return say("assetReadyImage", language);
  if (kind === "document" || kind === "video") return say("assetReadyFile", language);
  return undefined;
}

/** The sentence that carries a fallback link, with `{url}` for the link. */
export const deliveryFallbackText = (language: Language): string => say("assetFallbackLink", language);

/** Log-safe fields of a result: no URL, number, id or content. */
export function deliveryLogFields(result: DeliveryResult, source: "bytes" | "url", mime: string): Record<string, unknown> {
  return {
    outcome: result.outcome,
    mime: baseMime(mime),
    source,
    ms: result.ms,
    ...("reason" in result ? { reason: result.reason } : {}),
    ...("bytes" in result ? { bytes: result.bytes, upload_tries: result.uploadTries, send_tries: result.sendTries } : {}),
  };
}
