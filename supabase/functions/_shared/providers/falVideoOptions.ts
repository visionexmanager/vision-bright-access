// The video choices a person can make, and what each one costs in VX.
//
// ── Prices ──────────────────────────────────────────────────────────────────
//
// `costMilliUsdPerSecond` is what fal.ai charges for one second of that exact
// configuration, in thousandths of a dollar, read from the model's own fal.ai
// page on 2026-11-02. A VX is worth a thousandth of a dollar, so the two are
// the same number: 70 milli-dollars a second is 70 VX a second.
//
// fal prices the same endpoint differently by resolution and by sound, so every
// option fixes both and says so in its label. An option never forwards a
// resolution or an audio switch from the caller: the price a person is shown is
// the price of what is rendered.
//
// ── Margin ──────────────────────────────────────────────────────────────────
//
// `VIDEO_MARKUP_PERCENT` is the one number that puts Visionex's margin on top.
// At 100 a person pays exactly what fal charges. The registry rows in the
// migration are generated from these values and a test compares them, so
// changing the markup is a change to this file and to the next migration, never
// to one of them alone.
//
// Pure: no Deno, no environment.

import type { FalEndpoint } from "./fal.ts";
import { falVideoInput } from "./fal.ts";

export const VX_PER_USD = 1000;
export const VIDEO_MARKUP_PERCENT = 100;

export type FalVideoOptionId = "wan" | "pixverse" | "grok" | "kling" | "kling_audio";

export interface FalVideoInputParams {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  durationSec: number;
  seed?: number;
}

export interface FalVideoOption {
  id: FalVideoOptionId;
  /** The `central_pricing_registry.service_id` a reservation is made against. */
  serviceId: string;
  endpoint: FalEndpoint;
  label: string;
  description: string;
  /** What fal charges per second of this configuration, in thousandths of a dollar. */
  costMilliUsdPerSecond: number;
  /** The only lengths the option offers; anything else is refused, not rounded. */
  durations: readonly number[];
  aspectRatios: readonly string[];
  hasAudio: boolean;
  /** Largest prompt, in UTF-8 bytes, the model accepts. */
  maxPromptBytes?: number;
  input(params: FalVideoInputParams): Record<string, unknown>;
}

const utf8Bytes = (text: string): number => new TextEncoder().encode(text).length;

const withOptional = (base: Record<string, unknown>, params: FalVideoInputParams, negativeKey = "negative_prompt") => ({
  ...base,
  ...(params.negativePrompt ? { [negativeKey]: params.negativePrompt } : {}),
  ...(Number.isInteger(params.seed) ? { seed: params.seed } : {}),
});

export const FAL_VIDEO_OPTIONS: readonly FalVideoOption[] = [
  {
    id: "wan",
    serviceId: "video_wan",
    endpoint: "fal-ai/wan/v2.2-5b/text-to-video",
    label: "Wan 2.2 — basic, 720p",
    description: "The most economical. A short clip, no sound.",
    // $0.15 a video, offered at one length: 5 seconds.
    costMilliUsdPerSecond: 30,
    durations: [5],
    aspectRatios: ["16:9", "9:16", "1:1"],
    hasAudio: false,
    input: (p) => falVideoInput({
      prompt: p.prompt, negativePrompt: p.negativePrompt, aspectRatio: p.aspectRatio,
      resolution: "720p", durationSec: p.durationSec, seed: p.seed,
    }),
  },
  {
    id: "pixverse",
    serviceId: "video_pixverse",
    endpoint: "pixverse/v6/text-to-video",
    label: "PixVerse V6 — good, 720p",
    description: "Sharper motion and better prompt following. No sound.",
    costMilliUsdPerSecond: 45,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    hasAudio: false,
    maxPromptBytes: 2048,
    input: (p) => withOptional({
      prompt: p.prompt,
      aspect_ratio: p.aspectRatio,
      resolution: "720p",
      duration: p.durationSec,
      generate_audio_switch: false,
    }, p),
  },
  {
    id: "grok",
    serviceId: "video_grok",
    endpoint: "xai/grok-imagine-video/text-to-video",
    label: "Grok Imagine — with sound, 480p",
    description: "Lower resolution, but the clip comes with generated sound.",
    costMilliUsdPerSecond: 50,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    hasAudio: true,
    // The model has no negative-prompt field.
    input: (p) => ({
      prompt: p.prompt,
      aspect_ratio: p.aspectRatio,
      resolution: "480p",
      duration: p.durationSec,
    }),
  },
  {
    id: "kling",
    serviceId: "video_kling",
    endpoint: "fal-ai/kling-video/v2.6/pro/text-to-video",
    label: "Kling 2.6 Pro — best quality",
    description: "The most realistic motion. No sound.",
    costMilliUsdPerSecond: 70,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1"],
    hasAudio: false,
    input: (p) => ({
      prompt: p.prompt,
      aspect_ratio: p.aspectRatio,
      duration: String(p.durationSec),
      generate_audio: false,
      ...(p.negativePrompt ? { negative_prompt: p.negativePrompt } : {}),
    }),
  },
  {
    id: "kling_audio",
    serviceId: "video_kling_audio",
    endpoint: "fal-ai/kling-video/v2.6/pro/text-to-video",
    label: "Kling 2.6 Pro — best quality, with sound",
    description: "The same picture quality, with generated sound.",
    costMilliUsdPerSecond: 140,
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1"],
    hasAudio: true,
    input: (p) => ({
      prompt: p.prompt,
      aspect_ratio: p.aspectRatio,
      duration: String(p.durationSec),
      generate_audio: true,
      ...(p.negativePrompt ? { negative_prompt: p.negativePrompt } : {}),
    }),
  },
];

export function findFalVideoOption(id: unknown): FalVideoOption | null {
  return typeof id === "string" ? FAL_VIDEO_OPTIONS.find((o) => o.id === id) ?? null : null;
}

/** VX for one second: fal's price, plus the markup, rounded up to a whole VX. */
export function vxPerSecond(option: Pick<FalVideoOption, "costMilliUsdPerSecond">): number {
  return Math.ceil((option.costMilliUsdPerSecond * VIDEO_MARKUP_PERCENT) / 100);
}

/** VX for a whole clip. */
export function vxForClip(option: FalVideoOption, durationSec: number): number {
  return vxPerSecond(option) * durationSec;
}

/** The aspect ratio asked for when the option renders it, otherwise 16:9. */
export function aspectFor(option: FalVideoOption, requested: unknown): string {
  return typeof requested === "string" && option.aspectRatios.includes(requested) ? requested : "16:9";
}

export type OptionRefusal = "unknown_option" | "duration_not_offered" | "prompt_too_long";

/** Whether this option can render this request exactly as priced. */
export function checkOption(
  id: unknown,
  durationSec: number,
  prompt: string,
  negativePrompt?: string,
): { ok: true; option: FalVideoOption } | { ok: false; reason: OptionRefusal } {
  const option = findFalVideoOption(id);
  if (!option) return { ok: false, reason: "unknown_option" };
  if (!option.durations.includes(durationSec)) return { ok: false, reason: "duration_not_offered" };
  if (option.maxPromptBytes && (utf8Bytes(prompt) > option.maxPromptBytes || utf8Bytes(negativePrompt ?? "") > option.maxPromptBytes)) {
    return { ok: false, reason: "prompt_too_long" };
  }
  return { ok: true, option };
}
