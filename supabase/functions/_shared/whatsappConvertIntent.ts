// "Convert this to MP3", in whatever language somebody says it.
//
// ── The one piece of luck in this feature ───────────────────────────────────
//
// Format names are the same word everywhere. A Turkish sender writes "mp3", a
// Bengali sender writes "mp3", and the Arabic for "convert this to MP3" has
// "MP3" in it in Latin letters because that is how the format is written in
// Arabic too. So the target needs no translation table at all — which is worth
// stating plainly, because every other capability in this assistant needed
// twenty translations and this one genuinely does not.
//
// What does vary is the verb, and it turns out not to matter: this only ever
// runs when a file is already attached or has just arrived. Somebody who sends
// a video and writes "mp3" has said everything needed, in any language, and
// insisting on a recognised verb first would refuse the clearest possible
// request from the eighteen languages whose verb is not listed.
//
// ── Why it is still narrow ──────────────────────────────────────────────────
//
// A bare format name is only a request when a file is in hand. "mp4" in the
// middle of a conversation about something else is not, which is why the caller
// passes the attachment and this returns null without one — the guard is the
// file, not the wording.

import { AUDIO_TARGETS_BY_NAME, VIDEO_TARGETS_BY_NAME } from "./whatsappConvertFormats.ts";

/** Every target the processing service will produce, as one set. */
export const CONVERT_TARGETS: readonly string[] = [
  ...Object.keys(AUDIO_TARGETS_BY_NAME),
  ...Object.keys(VIDEO_TARGETS_BY_NAME),
];

/** The kind of file each target is, which decides what may be asked of what. */
export type MediaKindForConvert = "audio" | "video";

export const targetKind = (target: string): MediaKindForConvert | null => {
  // `in` rather than `Object.hasOwn`: the app target is ES2021 and hasOwn is ES2022.
  if (target in AUDIO_TARGETS_BY_NAME) return "audio";
  if (target in VIDEO_TARGETS_BY_NAME) return "video";
  return null;
};

/**
 * A word boundary that holds for every alphabet, which `\b` does not.
 *
 * The same problem `whatsappLocation.ts` documents: `\b` is defined against
 * `[A-Za-z0-9_]`, so it sits *inside* a word the moment the letter beside it is
 * not ASCII — and "حوّلها mp3" is exactly that shape. Anchoring on Unicode
 * letters and digits instead is the difference between a pattern that fires and
 * one that silently never does.
 */
const NOT_A_LETTER_BEFORE = "(?<![\\p{L}\\p{N}])";
const NOT_A_LETTER_AFTER = "(?![\\p{L}\\p{N}])";

/** Longest a message can be and still be read as a conversion request. */
export const CONVERT_MAX_CHARS = 120;

/**
 * The target a message names, or null.
 *
 * Only ever one: a message naming two formats is ambiguous, and guessing which
 * of them somebody meant produces a file they did not ask for after ninety
 * seconds of waiting. Ambiguity is answered with the menu instead.
 */
export function parseConvertTarget(text: string): string | null {
  const trimmed = (text ?? "").trim();
  if (!trimmed || trimmed.length > CONVERT_MAX_CHARS) return null;

  const found = new Set<string>();
  for (const target of CONVERT_TARGETS) {
    const pattern = new RegExp(`${NOT_A_LETTER_BEFORE}${target}${NOT_A_LETTER_AFTER}`, "iu");
    if (pattern.test(trimmed)) found.add(target);
  }

  // "m4a" contains "m4a" and nothing else, but "mp4" is a substring of nothing
  // here — the boundary guards do the work. What is left is a genuine
  // ambiguity: somebody wrote two format names.
  if (found.size !== 1) return null;
  return [...found][0];
}

/**
 * Whether this target can be made from this file.
 *
 * Audio out of video is the one direction that crosses: taking the sound off a
 * recording is the most asked-for conversion there is, and it is the same code
 * path as any other audio target with the video stream dropped. Video out of
 * audio is not a conversion, it is an invention, and refusing it here means the
 * sender is told so immediately rather than after a queue and a transcode.
 */
export function targetAllowedFrom(sourceKind: MediaKindForConvert, target: string): boolean {
  const wanted = targetKind(target);
  if (!wanted) return false;
  if (sourceKind === "video") return true;
  return wanted === "audio";
}

/**
 * The whole request, or null.
 *
 * `sourceKind` is what the file actually is — decided by the caller from the
 * attachment, not from what the message claims — so a target that cannot be
 * made from it is refused before anything is queued.
 */
export function parseConvertRequest(params: {
  text: string;
  sourceKind: MediaKindForConvert;
}): { target: string } | null {
  const target = parseConvertTarget(params.text);
  if (!target) return null;
  if (!targetAllowedFrom(params.sourceKind, target)) return null;
  return { target };
}

/**
 * What to offer when a file arrives and the message did not say.
 *
 * Only the targets that can be made from what was sent, and only as many as a
 * list can hold — the caller adds the way out. Ordered by what people actually
 * ask for rather than alphabetically: MP3 first for audio, MP4 first for video,
 * and "the sound out of this" high up for a video because it is the request
 * this feature exists for.
 */
export function offeredTargets(sourceKind: MediaKindForConvert): readonly string[] {
  if (sourceKind === "audio") return ["mp3", "wav", "m4a", "ogg", "flac"];
  return ["mp4", "mp3", "webm", "gif", "mkv"];
}
