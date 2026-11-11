// The free week's local lane on WhatsApp.
//
// The subscription gate refuses a free-week number every AI service, and that
// does not change here. This lane runs only AFTER the gate has refused, and only
// for work done on Visionex's own server with no model and no paid provider:
//
//   read_text  a photo's text, by the local OCR (Arabic and English)
//   barcode    QR codes and barcodes, by the local scanner
//   office     the text of a .docx / .pptx, by the local extractor
//
// Two rules keep it free to serve:
//   • there is no fallback. Where the main assistant sends an unreadable photo to
//     a vision model, this lane says it could not read it and stops.
//   • an allowance, counted in SQL (`trial_local_take`), so the sender is told
//     the limit, what is left, and when it has run out. A try that produced
//     nothing is handed back.
//
// Nothing here logs text, a file or a number. The caller has already refused to
// run this for a silenced or human-owned conversation.

import { PRICING_URL } from "./subscriptionGate.ts";
import { trialLaneSay } from "./whatsappTrialLaneStrings.ts";
import { localOcrLanguage, MAX_OCR_ANSWER_CHARS, ocrTextIsUsable, readTextLocally } from "./whatsappLocalOcr.ts";
import { productCodes, qrCodeNotice, scanBarcodes, textPayloads } from "./whatsappBarcode.ts";
import { corruptOfficeNotice, emptyOfficeNotice, officeKind, readOfficeLocally } from "./whatsappOffice.ts";
import { mediaFailureNotice, type MediaResult } from "./whatsappMedia.ts";
import { describeLocally } from "./whatsappLocalDescribe.ts";
import { freeDescribeSay } from "./whatsappFreeDescribeStrings.ts";

export type TrialFeature = "read_text" | "barcode" | "office";

// A photo whose caption asks for its writing stays on the local OCR; any other
// photo, when the server's describer is on, is described instead.
const READ_TEXT_WORDS = [
  "read", "text", "ocr", "says", "written", "اقرأ", "إقرأ", "قراءة", "نص", "مكتوب", "يقول", "ماذا كتب",
];

/** True when the caption asks for the photo's writing rather than a description. */
export function asksToReadText(caption: string | undefined): boolean {
  const c = (caption ?? "").toLowerCase();
  return READ_TEXT_WORDS.some((w) => c.includes(w));
}

const BARCODE_WORDS = ["barcode", "bar code", "qr", "باركود", "بار كود", "كيو ار", "رمز qr", "الرمز"];
const MAX_OFFICE_ANSWER_CHARS = 3_000;

export interface TrialMedia {
  kind: "audio" | "image" | "document" | "video" | "sticker";
  mimeType?: string;
  caption?: string;
}

/** Which local feature a message is asking for, or null when the lane does not serve it. */
export function pickTrialFeature(media: TrialMedia | null | undefined): TrialFeature | null {
  if (!media) return null;
  if (media.kind === "document") return officeKind(media.mimeType ?? "") ? "office" : null;
  if (media.kind !== "image") return null;
  const caption = (media.caption ?? "").toLowerCase();
  return BARCODE_WORDS.some((w) => caption.includes(w)) ? "barcode" : "read_text";
}

export interface TrialLaneDeps {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
  download(): Promise<MediaResult>;
  ocr?: typeof readTextLocally;
  scan?: typeof scanBarcodes;
  office?: typeof readOfficeLocally;
  describe?: typeof describeLocally;
  /** Sends a message now, before the lane's own reply (the "this takes a minute" notice). */
  notify?(text: string): Promise<void>;
}

export interface TrialLaneTurn {
  handled: boolean;
  reply?: string;
  /** A log-safe outcome word. */
  outcome?: string;
}

const PASS: TrialLaneTurn = { handled: false };

interface Quota {
  status: string;
  limit: number;
  remaining: number;
}

function quotaOf(data: unknown): Quota {
  const o = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return { status: String(o.status ?? "none"), limit: Number(o.limit ?? 0), remaining: Number(o.remaining ?? 0) };
}

const WHAT = { read_text: "featRead", barcode: "featBarcode", office: "featOffice" } as const;

const fill = (text: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), text);

export async function runTrialLane(
  deps: TrialLaneDeps,
  input: { waPhone: string; media: TrialMedia | null | undefined; language: string; describeEnabled?: boolean },
): Promise<TrialLaneTurn> {
  const { waPhone, language } = input;
  const feature = pickTrialFeature(input.media);
  if (!feature || !input.media) return PASS;

  const done = (reply: string, outcome: string): TrialLaneTurn => ({ handled: true, reply, outcome });

  // A plain photo, when the server's describer is on: described for any number
  // the gate refused, ten a day, counted by number rather than by account.
  if (input.describeEnabled && input.media.kind === "image" && feature === "read_text" && !asksToReadText(input.media.caption)) {
    const taken = await deps.rpc("free_local_describe_take", { _wa_phone: waPhone });
    if (taken.error) throw taken.error;
    const q = quotaOf(taken.data);
    if (q.status === "exhausted") {
      return done(freeDescribeSay("exhausted", language, { limit: q.limit, url: PRICING_URL }), "describe_exhausted");
    }
    if (q.status !== "ok") return PASS;
    const giveBack = async (reply: string, outcome: string) => {
      await deps.rpc("free_local_describe_release", { _wa_phone: waPhone });
      return done(reply, outcome);
    };
    const file = await deps.download();
    if (file.ok === false) return giveBack(mediaFailureNotice(language as never, input.media.kind, file.reason), "download_failed");
    // Said before the slow part, so the sender is not left wondering.
    if (deps.notify) await deps.notify(freeDescribeSay("wait", language, { url: PRICING_URL }));
    const seen = await (deps.describe ?? describeLocally)({ bytes: file.bytes, mimeType: file.mimeType, answerLanguage: language });
    if (seen.ok === false) {
      return giveBack(trialLaneSay(seen.reason === "unreadable" ? "nothing" : "unavailable", language), `describe_${seen.reason}`);
    }
    return done(`${seen.text}\n\n${freeDescribeSay("note", language, { left: q.remaining, limit: q.limit })}`, "describe");
  }
  const what = (key: (typeof WHAT)[TrialFeature]) => trialLaneSay(key, language);

  // A language the local reader cannot do is said before a unit is spent.
  if (feature === "read_text" && !localOcrLanguage(language)) {
    const probe = quotaOf((await deps.rpc("trial_local_take", { _wa_phone: waPhone, _feature: feature })).data);
    if (probe.status === "not_trial") return PASS;
    await deps.rpc("trial_local_release", { _wa_phone: waPhone, _feature: feature });
    return done(fill(trialLaneSay("ocrLanguage", language), { url: PRICING_URL }), "language");
  }

  const { data, error } = await deps.rpc("trial_local_take", { _wa_phone: waPhone, _feature: feature });
  if (error) throw error;
  const quota = quotaOf(data);
  if (quota.status === "not_trial") return PASS;
  if (quota.status === "exhausted") {
    return done(fill(trialLaneSay("exhausted", language), { limit: quota.limit, what: what(WHAT[feature]), url: PRICING_URL }), "exhausted");
  }
  if (quota.status !== "ok") return PASS;

  const note = () =>
    fill(trialLaneSay("note", language), { left: quota.remaining, limit: quota.limit, what: what(WHAT[feature]) });
  const refund = async (reply: string, outcome: string) => {
    await deps.rpc("trial_local_release", { _wa_phone: waPhone, _feature: feature });
    return done(reply, outcome);
  };

  const media = await deps.download();
  if (media.ok === false) return refund(mediaFailureNotice(language as never, input.media.kind, media.reason), "download_failed");

  if (feature === "read_text") {
    const r = await (deps.ocr ?? readTextLocally)({ bytes: media.bytes, mimeType: media.mimeType, answerLanguage: language });
    if (r.ok === false) {
      return refund(trialLaneSay(r.reason === "unreadable" ? "nothing" : "unavailable", language), `ocr_${r.reason}`);
    }
    if (!ocrTextIsUsable(r.text)) return refund(trialLaneSay("nothing", language), "ocr_empty");
    return done(`${r.text.slice(0, MAX_OCR_ANSWER_CHARS)}\n\n${note()}`, "read_text");
  }

  if (feature === "barcode") {
    const r = await (deps.scan ?? scanBarcodes)({ bytes: media.bytes, mimeType: media.mimeType });
    if (r.ok === false) return refund(trialLaneSay(r.reason === "busy" || r.reason === "not_configured" ? "unavailable" : "nothing", language), `barcode_${r.reason}`);
    const lines = productCodes(r.symbols).map((value) => fill(trialLaneSay("code", language), { value }));
    const texts = textPayloads(r.symbols);
    const qr = texts.length ? qrCodeNotice(language as never, texts) : null;
    const body = [...lines, qr].filter((s): s is string => !!s).join("\n");
    if (!body) return refund(trialLaneSay("nothing", language), "barcode_none");
    return done(`${body}\n\n${note()}`, "barcode");
  }

  const kind = officeKind(media.mimeType);
  const r = await (deps.office ?? readOfficeLocally)({ bytes: media.bytes, mimeType: media.mimeType });
  if (r.ok === false) {
    if (r.reason === "no_text" && kind) return refund(emptyOfficeNotice(language as never, kind), "office_empty");
    if (r.reason === "corrupt") return refund(corruptOfficeNotice(language as never), "office_corrupt");
    return refund(trialLaneSay("unavailable", language), `office_${r.reason}`);
  }
  return done(`${r.text.slice(0, MAX_OFFICE_ANSWER_CHARS)}\n\n${note()}`, "office");
}
