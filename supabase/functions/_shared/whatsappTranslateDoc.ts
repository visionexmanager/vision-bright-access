// Translating a file, which is not the same problem as translating a sentence.
//
// ── What already existed, and what did not ──────────────────────────────────
//
// `whatsappVisionModes.ts` has translated for a while: a photograph of a sign,
// or text pasted into the message. Both are short and both arrive whole, so
// they are one prompt and one answer.
//
// A document is neither. A PDF is thousands of words — more than a model will
// take in one call, and far more than it will return without quietly dropping
// the middle. A subtitle file is not prose at all. And unlike a sign, nobody
// can proof-read the result: the sender asked precisely because they cannot
// read the original.
//
// So this module is about the three things that only appear at length:
// splitting text without cutting a sentence in half, what to do when the fourth
// chunk of nine fails, and putting a subtitle file back together with its
// timings untouched.
//
// The translating itself is not here. It is handed in, so this can be tested
// without a provider and so a local model — when there is one worth trusting
// for Arabic, which the audit's blocker 5 says there is not yet — slots in
// without any of the below changing.

import { cueText, parseSubtitles, serialiseSubtitles, translateCues } from "./whatsappSubtitles.ts";
import type { SubtitleFormat } from "./whatsappSubtitles.ts";
import { detectLanguage } from "./whatsappLanguageDetect.ts";
import type { DetectedLanguage } from "./whatsappLanguageDetect.ts";

/**
 * How much text goes into one call.
 *
 * Well under any model's context window on purpose. The limit that bites first
 * is not the input — it is that a model asked to return three thousand words
 * will return two thousand and stop, and the missing thousand is invisible to
 * somebody who cannot read either version. Smaller chunks cost more calls and
 * make that failure impossible.
 */
export const CHUNK_CHARS = 1_800;

/**
 * The most of a document that will be translated in one request.
 *
 * A hundred thousand characters is a short book. Past this the honest answer is
 * that this is not the tool — not a forty-minute wait and a bill, and not a
 * silent truncation either, which is what a cap with no message would be.
 */
export const MAX_DOCUMENT_CHARS = 100_000;

/** How many chunks may fail before the whole thing is called a failure. */
export const MAX_FAILED_CHUNK_RATIO = 0.2;

/**
 * Split text for translation without cutting a sentence in half.
 *
 * Paragraphs first, then sentences, then — only for a single sentence longer
 * than the whole budget — a hard cut. The order matters because a model
 * translates a whole sentence better than two halves of one, and because a
 * paragraph break is a real boundary that the reassembled text should keep.
 *
 * Sentence ends are matched in every script this channel speaks: the full stop
 * that ends an English sentence is not the character that ends an Arabic,
 * Chinese, Japanese or Devanagari one, and splitting only on `.` leaves those
 * languages as one enormous chunk.
 */
export function chunkForTranslation(text: string, limit = CHUNK_CHARS): string[] {
  const source = (text ?? "").trim();
  if (!source) return [];
  if (source.length <= limit) return [source];

  const chunks: string[] = [];
  let current = "";

  const push = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const paragraph of source.split(/\n{2,}/)) {
    const block = paragraph.trim();
    if (!block) continue;

    if (current && current.length + block.length + 2 > limit) push();

    if (block.length <= limit) {
      current = current ? `${current}\n\n${block}` : block;
      continue;
    }

    // Too big for one chunk on its own. `。！？` are Chinese and Japanese,
    // `।` is Devanagari, `؟` and `۔` are Arabic-script — a split on `.` alone
    // would leave any of those as a single chunk the size of the document.
    push();
    const sentences = block.split(/(?<=[.!?。！？।؟۔…])\s+/u);
    for (const sentence of sentences) {
      if (sentence.length > limit) {
        // One sentence longer than the budget. Cut it, because the alternative
        // is not translating it at all.
        push();
        for (let i = 0; i < sentence.length; i += limit) {
          chunks.push(sentence.slice(i, i + limit));
        }
        continue;
      }
      if (current && current.length + sentence.length + 1 > limit) push();
      current = current ? `${current} ${sentence}` : sentence;
    }
    push();
  }

  push();
  return chunks;
}

export type TranslatableKind = "text" | "subtitles";

export interface DocumentToTranslate {
  /** The whole file as text. For subtitles, the file itself. */
  source: string;
  kind: TranslatableKind;
}

/**
 * What a file is, for translation purposes.
 *
 * Subtitles are detected from the content rather than the filename, because a
 * `.txt` holding an SRT is common — people rename them to get past upload
 * filters — and translating one as prose destroys its timings.
 */
export function classifyForTranslation(source: string): DocumentToTranslate {
  const parsed = parseSubtitles(source);
  if (parsed.cues.length > 0) return { source, kind: "subtitles" };
  return { source, kind: "text" };
}

export interface TranslationOutcome {
  ok: boolean;
  /** The translated file, in the same shape it arrived in. */
  output?: string;
  /** Set when the file was subtitles, so a caller can name the result. */
  format?: SubtitleFormat;
  /** What the source turned out to be, where it could be told. */
  detected?: DetectedLanguage | null;
  /** How much came back untranslated, as a share. `0` when all of it did. */
  incomplete?: number;
  reason?: "empty" | "too_long" | "translation_failed";
}

/**
 * Translate one document.
 *
 * `translate` is called once per chunk and may return null for "this one did
 * not work". A few failures are survivable and reported as `incomplete`; past
 * a fifth of the document the answer is a failure rather than a file with holes
 * in it, because a reader who cannot check the original has no way to notice
 * the holes.
 */
export async function translateDocument(params: {
  source: string;
  translate: (text: string) => Promise<string | null>;
  maxChars?: number;
}): Promise<TranslationOutcome> {
  const source = (params.source ?? "").trim();
  if (!source) return { ok: false, reason: "empty" };
  if (source.length > (params.maxChars ?? MAX_DOCUMENT_CHARS)) {
    return { ok: false, reason: "too_long" };
  }

  const document = classifyForTranslation(source);

  // ── Subtitles: the timings are the file ─────────────────────────────────
  if (document.kind === "subtitles") {
    const { format, cues } = parseSubtitles(source);
    const detected = detectLanguage(cueText(cues));

    let failed = 0;
    const translated = await translateCues(cues, async (text) => {
      const answer = await params.translate(text);
      if (!answer?.trim()) failed++;
      return answer;
    });

    const spoken = cues.filter((cue) => cue.text).length;
    const ratio = spoken > 0 ? failed / spoken : 1;
    if (ratio > MAX_FAILED_CHUNK_RATIO) return { ok: false, reason: "translation_failed", detected };

    return {
      ok: true,
      output: serialiseSubtitles(translated, format),
      format,
      detected,
      incomplete: Math.round(ratio * 100) / 100,
    };
  }

  // ── Prose ───────────────────────────────────────────────────────────────
  const detected = detectLanguage(source);
  const chunks = chunkForTranslation(source);
  if (chunks.length === 0) return { ok: false, reason: "empty", detected };

  const out: string[] = [];
  let failed = 0;
  for (const chunk of chunks) {
    const answer = await params.translate(chunk);
    if (answer?.trim()) {
      out.push(answer.trim());
    } else {
      failed++;
      // The original, not a gap. A missing paragraph is invisible; a paragraph
      // in the language it started in is at least visibly untranslated.
      out.push(chunk);
    }
  }

  const ratio = failed / chunks.length;
  if (ratio > MAX_FAILED_CHUNK_RATIO) return { ok: false, reason: "translation_failed", detected };

  return {
    ok: true,
    // Paragraph breaks are how the chunks were split, so they are how the
    // pieces go back together.
    output: out.join("\n\n"),
    detected,
    incomplete: Math.round(ratio * 100) / 100,
  };
}
