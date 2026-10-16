// One lookup for the platform's approved fixed phrases, for text and for audio.
//
// There is no second catalogue here. The phrases are the ones already registered in
// `localAudioManifest.ts` (`LOCAL_RESPONSES`), whose words are read from
// `whatsappStrings.ts` or, for a curated one-word phrase, written once in the
// manifest. This module adds the three things a platform-wide caller needs and the
// WhatsApp path did not: a CONTEXT check, a REVIEW check, and separate switches for
// text reuse and audio reuse.
//
// What it will not do:
//   - match on text alone across contexts: "Yes." registered for a spoken
//     pleasantry is not returned for a quiz answer, nor "Okay." for a rating label;
//   - offer a recording unless it is active, reviewed by a person, present in the
//     manifest for that exact language, and both switches are on;
//   - touch the WhatsApp flags. `WHATSAPP_LOCAL_AUDIO` and `WHATSAPP_LOCAL_ACK` keep
//     their meaning; these switches are separate and ALL default to off.
//
// Mechanisms, kept distinct on purpose:
//   browser speech   `speakText` in src/lib/audio/speech.ts: free, never routed here
//   generated TTS    the `text-to-speech` / WhatsApp synthesis providers: paid
//   prerecorded clip a manifest entry, read through `loadClip` (Data Hub): free
//   WhatsApp voice   a clip or synthesis uploaded to Meta as a voice note
// This module only DECIDES whether an approved phrase and clip exist. It sends nothing.

import { LOCAL_AUDIO_ASSETS, LOCAL_RESPONSES, type PhraseContext } from "./localAudioManifest.ts";
import { clipName, matchPhrase } from "./localAudio.ts";
import { UI_STRINGS } from "./whatsappStrings.ts";
import type { EnvReader } from "./whatsappProcessor.ts";

export type { PhraseContext };

export const SHARED_PHRASES_FLAG = "VX_SHARED_PHRASES_ENABLED";
export const SHARED_PHRASE_AUDIO_FLAG = "VX_SHARED_PHRASE_AUDIO_ENABLED";

const on = (read: EnvReader, name: string): boolean => (read(name) ?? "").trim() === "1";

/** Text reuse. Off unless the flag is exactly "1". */
export const sharedPhrasesEnabled = (read: EnvReader): boolean => on(read, SHARED_PHRASES_FLAG);

/** Recording reuse. Needs its own flag AND the text flag: a clip never plays where the text may not. */
export const sharedPhraseAudioEnabled = (read: EnvReader): boolean =>
  sharedPhrasesEnabled(read) && on(read, SHARED_PHRASE_AUDIO_FLAG);

export type AudioState = "approved" | "unreviewed" | "disabled" | "missing" | "no_text";

const contextsOf = (id: string): readonly PhraseContext[] => LOCAL_RESPONSES[id]?.contexts ?? ["fixed_reply"];

/** Every registered phrase id. */
export const phraseIds = (): string[] => Object.keys(LOCAL_RESPONSES);

/** The approved words of a phrase in a locale, or null. No fallback to another language. */
export function phraseText(id: string, locale: string): string | null {
  const response = LOCAL_RESPONSES[id];
  if (!response) return null;
  const words = response.text ?? (response.uiKey ? (UI_STRINGS[response.uiKey as keyof typeof UI_STRINGS] as Record<string, string | undefined> | undefined) : undefined);
  return words?.[locale] ?? null;
}

/** Whether the phrase may be used in this context. */
export const phraseAllowedIn = (id: string, context: PhraseContext): boolean => contextsOf(id).includes(context);

/**
 * The registered phrase whose words are EXACTLY this text in this locale, for this
 * context; null when none, when the context is not permitted for it, or when the
 * text would also be a different phrase's words.
 */
export function findPhrase(text: string, locale: string, context: PhraseContext): { id: string; text: string } | null {
  const hit = matchPhrase(text, locale);
  if (!hit || hit.language !== locale) return null;
  if (!phraseAllowedIn(hit.id, context)) return null;
  const words = phraseText(hit.id, locale);
  return words ? { id: hit.id, text: words } : null;
}

/** The state of the recording for a phrase in a locale. Reads the manifest only. */
export function audioState(id: string, locale: string): AudioState {
  if (!phraseText(id, locale)) return "no_text";
  const clip = LOCAL_AUDIO_ASSETS[clipName(id, locale)];
  if (!clip) return "missing";
  if (clip.status !== "active") return "disabled";
  return clip.reviewed === true ? "approved" : "unreviewed";
}

/** Text to reuse for a phrase in a context, or null when the switch is off or the phrase does not belong there. */
export function sharedPhraseText(id: string, locale: string, context: PhraseContext, read: EnvReader): string | null {
  if (!sharedPhrasesEnabled(read) || !phraseAllowedIn(id, context)) return null;
  return phraseText(id, locale);
}

/** The clip name to read for a phrase, or null. Anything short of "approved" is null: the caller keeps its text or its TTS. */
export function sharedPhraseClip(id: string, locale: string, context: PhraseContext, read: EnvReader): string | null {
  if (!sharedPhraseAudioEnabled(read) || !phraseAllowedIn(id, context)) return null;
  return audioState(id, locale) === "approved" ? clipName(id, locale) : null;
}

export interface PhraseCoverageRow {
  id: string;
  contexts: readonly PhraseContext[];
  locales: string[];
  states: Record<string, AudioState>;
}

/** The registry as a table: which locale has words, and what state each recording is in. For reports and tests. */
export function phraseCoverage(locales: readonly string[]): PhraseCoverageRow[] {
  return phraseIds().map((id) => {
    const have = locales.filter((l) => phraseText(id, l));
    return { id, contexts: contextsOf(id), locales: have, states: Object.fromEntries(have.map((l) => [l, audioState(id, l)])) };
  });
}
