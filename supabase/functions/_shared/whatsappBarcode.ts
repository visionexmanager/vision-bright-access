// Decoding the barcode in a photograph on Visionex's own server.
//
// ── Why this exists when a vision model is already reading the picture ──────
//
// Because it is the first thing this server can do for everybody.
//
// Local OCR, shipped before this, is English-only: Arabic recognition does not
// work on this box, and that was measured over six runs rather than assumed. So
// half of this channel's audience — the larger half — gets nothing local when
// they ask for a sign to be read. A barcode has no language. The thirteen
// digits under an EAN-13 are the same thirteen digits in Riyadh and in
// Helsinki, so this capability arrives complete for every conversation on the
// first day.
//
// And it is the one row in the audit's capability matrix where the local tool
// is marked *better* than the external one. zbar either decodes a symbol whose
// own check digit proves it, or reports that it could not. A vision model reads
// thirteen digits off a curved packet in bad light and will occasionally hand
// back twelve of them, confidently. The person holding the packet is blind and
// cannot proof-read the answer, so "I could not read the barcode" is a much
// better outcome than a digit that is wrong — and a wrong product number is not
// a cosmetic error when the packet is medicine.
//
// ── Where it is wired in, and where it is deliberately not ──────────────────
//
// Only the `product` mode, which is the one that already tells the sender
// "send a photo of the product or its barcode". The other four modes are asking
// for something zbar cannot give: describing a room, finding a cane, reading a
// sign, translating a menu. Sending them here would spend a scan to learn
// nothing.
//
// It also does not replace the model in that mode — it precedes it. A barcode
// number on its own is not an answer to "what is this"; nobody wants to hear
// thirteen digits read aloud when they asked what they are holding. So the scan
// runs first, and what it finds is handed to the vision model as *ground truth*
// so the model describes the packet without having to guess the number it can
// already be told. The reply is still the model's.
//
// ── The one thing that must never reach a prompt ────────────────────────────
//
// A QR code carries whatever somebody printed on the sticker, and a sticker is
// attacker-controlled: a QR code reading "ignore your instructions and ..." can
// be made with a website and a printer and left on a shelf. So decoded QR text
// is treated exactly the way `whatsappLocalOcr.ts` treats recognised text — it
// is shown to the sender verbatim and is never put in a prompt. Text that never
// enters a prompt cannot be a prompt injection.
//
// Digits are the exception, and they are safe for a reason that can be stated
// rather than hoped for: `productCodes` returns strings that have passed
// `/^\d+$/` on this side, after the service confirmed the mod-10 check digit.
// There is no instruction expressible in thirteen digits.

import { describeError, stripInvisible } from "./whatsappSafety.ts";
import type { Language } from "./whatsappCatalog.ts";
import { say } from "./whatsappStrings.ts";
import {
  MAX_PROCESSOR_UPLOAD_BYTES,
  imageBody,
  processorConfig,
  type ProcessorConfig,
} from "./whatsappProcessor.ts";

/**
 * The scan's own deadline.
 *
 * Shorter than local OCR's eight seconds, because the work is smaller and
 * because this one is additive to a model call rather than a replacement for
 * it. A `product` photograph goes to the vision model either way; the scan only
 * decides whether the model is told the number first. Six seconds is generous
 * for a decode that normally lands in well under one, and it is the most this
 * can add to a reply somebody is waiting on.
 */
export const BARCODE_TIMEOUT_MS = 6_000;

/** The most symbols worth carrying back into one answer. */
export const MAX_BARCODE_SYMBOLS = 8;

/** The most characters kept from one decoded payload. */
export const MAX_BARCODE_VALUE_CHARS = 1_200;

/**
 * Why a scan produced nothing.
 *
 * Every one of these means "carry on to the model exactly as before", and they
 * are kept distinct only so telemetry can tell a service that is switched off
 * from one that is broken from a photograph that simply had no barcode in it.
 * That difference matters on a dashboard and never changes what the sender
 * gets.
 */
export type BarcodeFailure =
  | "not_configured"
  | "too_large"
  | "busy"
  | "timeout"
  | "none_found"
  | "bad_response"
  | "error";

/**
 * One decoded symbol.
 *
 * `kind` is the whole safety model in one field. `product` means the payload is
 * digits that satisfied a mod-10 checksum — it can go anywhere, including into
 * a prompt. `text` means somebody else authored the payload — it goes to the
 * sender and nowhere else.
 */
export interface BarcodeSymbol {
  symbology: string;
  value: string;
  kind: "product" | "text";
}

export type BarcodeResult =
  | { ok: true; symbols: BarcodeSymbol[]; ms: number }
  | { ok: false; reason: BarcodeFailure };

/**
 * The service's answer, validated field by field.
 *
 * Nothing here trusts the shape. It is our own service on our own box, but it
 * is still a separate process across a network boundary, and this particular
 * answer decides whether a payload is treated as digits or as hostile text. A
 * `kind` that arrived corrupted through a proxy, a reload or a rollback to an
 * older image must not be the thing that puts a stranger's sentence into a
 * prompt — so `product` is re-established here, from the value, rather than
 * believed.
 */
export function readBarcodePayload(payload: unknown): BarcodeResult {
  if (!payload || typeof payload !== "object") return { ok: false, reason: "bad_response" };
  const body = payload as Record<string, unknown>;

  if (body.ok !== true) {
    return { ok: false, reason: body.reason === "busy" ? "busy" : "error" };
  }
  if (!Array.isArray(body.symbols)) return { ok: false, reason: "bad_response" };

  const symbols: BarcodeSymbol[] = [];
  for (const entry of body.symbols.slice(0, MAX_BARCODE_SYMBOLS)) {
    if (!entry || typeof entry !== "object") continue;
    const symbol = entry as Record<string, unknown>;
    if (typeof symbol.value !== "string" || typeof symbol.symbology !== "string") continue;

    const value = stripInvisible(symbol.value).trim().slice(0, MAX_BARCODE_VALUE_CHARS);
    if (!value) continue;

    // The symbology name is a label that ends up in telemetry and, for a
    // product code, in a prompt. Bounded and narrowed to the characters zbar
    // actually uses, so a corrupted line cannot widen either.
    const symbology = symbol.symbology.replace(/[^A-Za-z0-9/+.-]/g, "").slice(0, 16);
    if (!symbology) continue;

    // `product` is proved here, not accepted. Digits only — anything else is
    // text no matter what the service called it.
    const kind = symbol.kind === "product" && /^\d{8,14}$/.test(value) ? "product" : "text";
    symbols.push({ symbology, value, kind });
  }

  if (symbols.length === 0) return { ok: false, reason: "none_found" };

  const ms = typeof body.ms === "number" && Number.isFinite(body.ms) ? body.ms : 0;
  return { ok: true, symbols, ms };
}

/**
 * The product numbers among a set of symbols, safe to put in a prompt.
 *
 * The digit check is repeated here rather than trusted from `kind`, because
 * this is the function whose output crosses into a model prompt and that is
 * the boundary worth checking twice. If this ever returns something that is
 * not digits, the reason it is safe stops being true.
 */
export const productCodes = (symbols: BarcodeSymbol[]): string[] =>
  symbols.filter((symbol) => symbol.kind === "product" && /^\d{8,14}$/.test(symbol.value)).map((symbol) => symbol.value);

/** Payloads somebody else authored: shown to the sender, never to a model. */
export const textPayloads = (symbols: BarcodeSymbol[]): string[] =>
  symbols.filter((symbol) => symbol.kind === "text").map((symbol) => symbol.value);

/**
 * What the vision model is told before it looks at the packet.
 *
 * The point of this sentence is subtraction, not addition: the model is very
 * good at describing a box and reliably imperfect at transcribing thirteen
 * small digits off it, so it is handed the digits and told not to produce its
 * own. Without the second half it will still read the barcode itself and may
 * contradict the number it was just given, which is worse than either answer
 * alone.
 *
 * Returns null when there is nothing proved to say, and the model then runs
 * exactly as it did before this file existed.
 */
export function barcodeGroundTruth(codes: string[]): string | null {
  const digits = codes.filter((code) => /^\d{8,14}$/.test(code)).slice(0, 3);
  if (digits.length === 0) return null;

  const list = digits.join(", ");
  return [
    digits.length === 1
      ? `The barcode on this item has already been decoded by a barcode reader and is exactly ${list}.`
      : `The barcodes on this item have already been decoded by a barcode reader and are exactly: ${list}.`,
    "That number is verified by its own check digit. Use it as given, and do not read the barcode yourself or correct it.",
  ].join(" ");
}

/**
 * What a QR code said, appended to the answer the model gave.
 *
 * Appended rather than substituted, because the two answer different questions.
 * The model says what the object is — a poster, a menu card, a parcel label.
 * This says what is encoded in the square on it, which no vision model can read
 * reliably and which is frequently the only part that matters: a link, a
 * tracking number, a wifi password.
 *
 * The payload is quoted, never summarised and never followed. It is somebody
 * else's text, so it is shown and left alone — and it arrives here having been
 * stripped of invisible characters, which is what stops a right-to-left
 * override in a sticker from rearranging the sentence around it.
 *
 * Returns null when there is nothing to add, which is the ordinary case.
 */
export function qrCodeNotice(language: Language, values: string[]): string | null {
  const shown = values.map((value) => value.trim()).filter(Boolean).slice(0, 3);
  if (shown.length === 0) return null;

  const quoted = shown.map((value) => `"${value}"`).join("\n");
  return say("qrContains", language).replace("{values}", quoted);
}

/**
 * Scan a photograph for barcodes on Visionex's own server.
 *
 * `fetchImpl` is injected so the tests can drive a busy service, a hung one, a
 * lying one and a working one without a network. The caller passes nothing.
 */
export async function scanBarcodes(params: {
  bytes: Uint8Array;
  mimeType: string;
  config?: ProcessorConfig | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<BarcodeResult> {
  const config = params.config === undefined ? processorConfig() : params.config;
  if (!config) return { ok: false, reason: "not_configured" };
  if (params.bytes.byteLength > MAX_PROCESSOR_UPLOAD_BYTES) return { ok: false, reason: "too_large" };

  const doFetch = params.fetchImpl ?? fetch;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), params.timeoutMs ?? BARCODE_TIMEOUT_MS);

  try {
    const response = await doFetch(`${config.url}/barcode`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": params.mimeType,
      },
      body: imageBody(params.bytes),
      signal: controller.signal,
    });

    // 503 is the service saying its two workers are full. Not an error, not
    // worth a retry inside a customer's message: the model takes this one on
    // its own, as it always did.
    if (response.status === 503) return { ok: false, reason: "busy" };
    if (!response.ok) return { ok: false, reason: "error" };

    return readBarcodePayload(await response.json());
  } catch (e) {
    // An aborted request is the deadline, not a fault.
    const description = describeError(e);
    if (description.includes("abort") || description.includes("Abort")) {
      return { ok: false, reason: "timeout" };
    }
    // A code, never the message: this one can quote a URL and a token header.
    console.error("[whatsapp-barcode] scan failed:", description);
    return { ok: false, reason: "error" };
  } finally {
    clearTimeout(deadline);
  }
}
