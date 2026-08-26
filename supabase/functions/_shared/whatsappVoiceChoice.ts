// Choosing which of your own voices answers you on WhatsApp.
//
// ── What a sender is allowed to see ─────────────────────────────────────────
//
// A slot number and the name they gave the voice in the studio. That is all.
// No profile uuid, no ElevenLabs voice id, no account id — none of which they
// have any use for, and every one of which would be handed straight back to us
// in a list-row id, which is to say: printed in a chat log.
//
// This mirrors the principle `whatsapp_identity_state` was built on. The
// database enforces it too: `whatsapp_voice_options` returns slot and name and
// nothing else, so even a bug here cannot disclose what was never fetched.
//
// ── Why slots and not ids ───────────────────────────────────────────────────
//
// A slot is a position in a stable ordering, re-derived identically by the
// selection RPC. A voice that stopped being usable between rendering the list
// and tapping it is simply absent, and the RPC answers `unavailable` rather
// than selecting whatever moved into its place. The confirmation then names the
// voice actually chosen, so a shifted list is visible to the person rather than
// silent.
//
// Pure. No `Deno`, no fetch, no database client.

import type { Language } from "./whatsappCatalog.ts";
import { say } from "./whatsappStrings.ts";

/** One row of the sender's own voices, exactly as the RPC returns it. */
export interface VoiceOption {
  slot: number;
  name: string;
  language: string;
  selected: boolean;
}

/** The row id prefix. Distinct enough that no other menu can collide with it. */
const ROW_PREFIX = "voice_pick_";

/** Slot 0 is "the default voice" and is always offered. */
export const DEFAULT_SLOT = 0;

export const voiceRowId = (slot: number): string => `${ROW_PREFIX}${slot}`;

/**
 * The slot a tapped row refers to, or null.
 *
 * Deliberately strict: a non-integer, a negative number or a slot beyond what
 * any list could hold is not a near-miss to be coerced, it is something that
 * did not come from a menu we sent.
 */
export function readVoiceRowId(id: string | null | undefined): number | null {
  if (typeof id !== "string" || !id.startsWith(ROW_PREFIX)) return null;
  const raw = id.slice(ROW_PREFIX.length);
  if (!/^\d{1,2}$/.test(raw)) return null;
  const slot = Number(raw);
  return slot >= 0 && slot <= MAX_VOICE_SLOTS ? slot : null;
}

/**
 * How many cloned voices a list may offer.
 *
 * Meta allows ten rows across every section, and the default row and the way
 * back each take one. Eight is what is left, and it is also the ceiling the RPC
 * applies, so the two cannot disagree.
 */
export const MAX_VOICE_SLOTS = 8;

/** Parse whatever `whatsapp_voice_options` returned into something typed. */
export function readVoiceOptions(rows: unknown): VoiceOption[] {
  if (!Array.isArray(rows)) return [];
  const options: VoiceOption[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const slot = Number(record.slot);
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!Number.isInteger(slot) || slot < 1 || slot > MAX_VOICE_SLOTS || !name) continue;
    options.push({
      slot,
      name,
      language: typeof record.language === "string" ? record.language : "",
      selected: record.selected === true,
    });
  }
  return options;
}

export interface VoiceChoiceRow {
  id: string;
  title: string;
  description?: string;
}

/**
 * The rows of the voice menu: the default first, then the sender's own.
 *
 * The default leads because it is the answer to "get me out of this" — somebody
 * whose chosen voice was revoked, or who simply wants the ordinary voice back,
 * should not have to read past a list of their own recordings to find it.
 *
 * A tick marks the current choice. For a screen reader that is a character read
 * aloud, which is the point: the state of the setting is in the row's words and
 * not only in how it looks.
 */
export function voiceChoiceRows(options: VoiceOption[], language: Language): VoiceChoiceRow[] {
  const nothingChosen = !options.some((option) => option.selected);
  const rows: VoiceChoiceRow[] = [{
    id: voiceRowId(DEFAULT_SLOT),
    title: mark(say("voiceDefaultRow", language), nothingChosen),
    description: say("voiceDefaultRowDesc", language),
  }];

  for (const option of options.slice(0, MAX_VOICE_SLOTS)) {
    rows.push({
      id: voiceRowId(option.slot),
      // The name is the person's own words. It is clipped by the renderer to
      // Meta's row limit and never otherwise altered.
      title: mark(option.name, option.selected),
      ...(option.language ? { description: option.language } : {}),
    });
  }

  return rows;
}

const mark = (title: string, selected: boolean): string => (selected ? `✓ ${title}` : title);

// ── What the sender is told ─────────────────────────────────────────────────

/** The confirmation, naming the voice that was actually selected. */
export function voiceSelectedNotice(name: string | null, language: Language): string {
  if (!name) return say("voiceSetToDefault", language);
  return say("voiceSetTo", language).replace("{name}", name);
}

/** The chosen voice is gone. Says so, and says what happens instead. */
export const voiceGoneNotice = (language: Language): string => say("voiceGone", language);

/** No usable voices. Explains the three steps rather than just refusing. */
export const noVoicesNotice = (language: Language): string => say("voiceNoneNotice", language);

/** The number is not linked to an account, so there is nothing to list. */
export const voiceNeedsAccountNotice = (language: Language): string =>
  say("voiceNeedsAccount", language);

// ── Turning a selection into something the TTS seam understands ─────────────

export interface ResolvedVoice {
  provider: "openai" | "elevenlabs";
  voice: string;
  model: string;
}

/**
 * What `whatsapp_resolve_voice` returned, or null for "use the default".
 *
 * Null is the safe answer and the common one. The RPC re-checks consent and
 * lifecycle at resolution time rather than trusting the stored selection, so a
 * voice revoked ten seconds ago stops speaking on the next message — and this
 * function returning null is how that reaches the reply path.
 *
 * A row missing its provider voice id is treated as null rather than as an
 * error: the reply still has to go out, and it goes out in the default voice.
 */
export function readResolvedVoice(row: unknown): ResolvedVoice | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const voice = typeof record.voice_id === "string" ? record.voice_id.trim() : "";
  const provider = record.provider === "elevenlabs" ? "elevenlabs" : "openai";
  if (!voice) return null;
  // Only ElevenLabs holds cloned voices. A row claiming otherwise is a row we
  // do not know how to speak with, and the default is better than a guess.
  if (provider !== "elevenlabs") return null;
  const model = typeof record.model === "string" && record.model
    ? record.model
    : "eleven_multilingual_v2";
  return { provider, voice, model };
}
