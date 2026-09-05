// The formats this channel offers, and what to call them out loud.
//
// ── This is a menu, not a second allowlist ──────────────────────────────────
//
// The authority on what may be produced is `services/media-processor/src/
// convert.mjs`, which is the thing that runs ffmpeg and refuses anything not on
// its list. This file cannot import it — that is a Node module on the VPS and
// this is Deno on Supabase's infrastructure — so what is written here is the
// subset this channel puts in front of somebody, plus the label a screen reader
// reads for it.
//
// Two lists in two places is exactly the drift this repository warns about
// everywhere else, so it is bound rather than trusted: `whatsapp-convert.test.ts`
// reads the targets out of `convert.mjs` and fails if this file offers one the
// service would refuse. The service may know more than this menu — that is
// fine, and is what "subset" means — but this menu may never know more than the
// service.
//
// ── Why the labels are not translated ───────────────────────────────────────
//
// "MP3" is MP3 in all twenty languages, in Latin letters, including the ones
// written right to left. A translation table here would be twenty copies of the
// same four characters, and the one thing it could add — calling MP3 "audio" in
// Arabic — is worse, because the sender asked for a format and the row should
// say the format they asked for.
//
// The *description* is a different matter and does need words, so rows that
// carry one take it from `whatsappStrings.ts` like everything else.

/** Audio containers, in the order they are offered. */
export const AUDIO_TARGETS_BY_NAME: Record<string, { label: string; mime: string }> = {
  mp3:  { label: "MP3", mime: "audio/mpeg" },
  wav:  { label: "WAV", mime: "audio/wav" },
  m4a:  { label: "M4A", mime: "audio/mp4" },
  ogg:  { label: "OGG", mime: "audio/ogg" },
  opus: { label: "Opus", mime: "audio/opus" },
  flac: { label: "FLAC", mime: "audio/flac" },
  aac:  { label: "AAC", mime: "audio/aac" },
};

/** Video containers, plus the one that is not a video at all. */
export const VIDEO_TARGETS_BY_NAME: Record<string, { label: string; mime: string }> = {
  mp4:  { label: "MP4", mime: "video/mp4" },
  webm: { label: "WebM", mime: "video/webm" },
  mkv:  { label: "MKV", mime: "video/x-matroska" },
  mov:  { label: "MOV", mime: "video/quicktime" },
  // A GIF is frames in a picture format, and Meta will only take it as a
  // document. It is here because it is asked for constantly.
  gif:  { label: "GIF", mime: "image/gif" },
};

/** The label for a target, or the target itself if it is somehow unknown. */
export function targetLabel(target: string): string {
  return AUDIO_TARGETS_BY_NAME[target]?.label
    ?? VIDEO_TARGETS_BY_NAME[target]?.label
    ?? IMAGE_TARGETS_BY_NAME[target]?.label
    ?? target.toUpperCase();
}

/** What the answer will be, so the send can name a type Meta accepts. */
export function targetMime(target: string): string {
  return AUDIO_TARGETS_BY_NAME[target]?.mime
    ?? VIDEO_TARGETS_BY_NAME[target]?.mime
    ?? IMAGE_TARGETS_BY_NAME[target]?.mime
    ?? "application/octet-stream";
}

/**
 * Still images.
 *
 * Converted by the same ffmpeg as everything else — a third capability that
 * needed a route rather than an installation. HEIC is deliberately absent: a
 * Debian ffmpeg is not built with libheif, so offering it would be offering a
 * conversion that fails on the one format iPhone owners most want converted.
 * Better to say nothing than to say it and fail.
 */
export const IMAGE_TARGETS_BY_NAME: Record<string, { label: string; mime: string }> = {
  jpg:  { label: "JPG", mime: "image/jpeg" },
  png:  { label: "PNG", mime: "image/png" },
  webp: { label: "WebP", mime: "image/webp" },
  bmp:  { label: "BMP", mime: "image/bmp" },
  tiff: { label: "TIFF", mime: "image/tiff" },
};
