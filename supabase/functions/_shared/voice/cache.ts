// What makes two voice requests the same request.
//
// A cache key is a promise: "anything with this key sounds identical". Every
// input that can change the audio has to be in it, or the cache eventually
// hands somebody the right words in the wrong voice — and for a listener who
// cannot see the screen, that is not a cosmetic bug.
//
// ── Why this moved out of `whatsappSpeechCache.ts` ──────────────────────────
//
// That key covered the phone number, the voice, the model and the text, which
// was complete for a path that only ever calls OpenAI, only ever asks for opus
// and never passes a speed or a style instruction. All three of those are now
// variables: `tts.ts` takes a provider, a format, a speed and an instruction
// string. A key that ignores them is correct until the first day it is not.
//
// ── Text normalisation is deliberately shallow ──────────────────────────────
//
// Trim, and collapse runs of whitespace. Nothing else. Lower-casing would make
// "US" and "us" the same key, and they are not the same audio; stripping
// punctuation would make a question sound like a statement. The only changes
// folded here are ones no synthesiser reacts to.
//
// Pure apart from `crypto.subtle`, which is present in Deno, Node and the
// browser — this value is a primary key and must be identical in all three.

/** A cache key: 64 hex characters, and nothing else is accepted. */
export const isVoiceCacheKey = (value: string): boolean => /^[0-9a-f]{64}$/.test(value);

/**
 * The separator between fields.
 *
 * A NUL, so two different field splits cannot produce the same material: with a
 * space, voice "a" + text "b c" and voice "a b" + text "c" hash identically,
 * and one of them is then spoken in the wrong voice. A NUL appears in none of
 * these fields.
 *
 * Written as an escape and named rather than typed: a raw NUL is invisible in
 * every editor and turns the file into something git reports as binary.
 */
const SEPARATOR = "\u0000";

/** Trim and collapse whitespace. See the note above on why nothing more. */
export const normalizeCacheText = (text: string): string =>
  (text ?? "").replace(/\s+/g, " ").trim();

async function sha256Hex(material: Uint8Array): Promise<string> {
  // Copied into a plain `ArrayBuffer` rather than passed as a view: a
  // `Uint8Array` may be backed by a shared buffer, which several TypeScript
  // lib versions refuse as a `BufferSource`. The same reason
  // `whatsappAttachments.toBlob` exists.
  const copy = material.buffer.slice(
    material.byteOffset,
    material.byteOffset + material.byteLength,
  ) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Every field, tagged with its own name, so no two shapes share material. */
function material(fields: Array<[string, string]>): Uint8Array {
  const text = fields
    .map(([name, value]) => `${name}=${value}`)
    .join(SEPARATOR);
  return new TextEncoder().encode(text);
}

export interface VoiceCacheKeyInput {
  /**
   * What the cached artefact is only valid for.
   *
   * The WhatsApp path passes the phone number id, because a Meta media id
   * belongs to the media store that uploaded it and 404s from anywhere else.
   * A website caller that stores audio bytes rather than a provider handle can
   * pass an empty scope and share the row across users — the audio is a
   * function of the text and nothing about the requester.
   *
   * This field is also what keeps one user's audio out of another's cache when
   * the artefact *is* user-specific. When in doubt, scope it.
   */
  scope: string;
  text: string;
  provider: string;
  model: string;
  voice: string;
  format: string;
  /** The sender's language, when the caller resolved one. */
  language?: string;
  /**
   * Anything else that reaches the provider and changes the audio: speed,
   * style instructions, stability. Sorted, so key order cannot change the hash.
   */
  params?: Record<string, string | number | boolean | undefined>;
}

/** The key for one synthesised utterance. */
export async function voiceCacheKey(input: VoiceCacheKeyInput): Promise<string> {
  const params = Object.entries(input.params ?? {})
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, value]) => `${name}:${String(value)}`)
    .join(",");

  return sha256Hex(material([
    ["v", "2"], // Bump when the key's meaning changes, not when a field's value does.
    ["kind", "tts"],
    ["scope", input.scope ?? ""],
    ["provider", input.provider],
    ["model", input.model],
    ["voice", input.voice],
    ["format", input.format],
    ["language", input.language ?? ""],
    ["params", params],
    ["text", normalizeCacheText(input.text)],
  ]));
}

/**
 * The key for one *transcription*.
 *
 * The audio itself is hashed, so identical bytes reuse the answer and one
 * changed sample cannot. The provider and model are in the key because a
 * transcript is theirs: reusing Groq's answer for an OpenAI request would
 * silently defeat the fallback chain that exists precisely because the two
 * disagree sometimes.
 *
 * The bytes are hashed, never stored. Nothing about the speaker is in the key.
 */
export async function audioFingerprint(input: {
  bytes: Uint8Array;
  provider: string;
  model: string;
  language?: string;
}): Promise<string> {
  const header = new TextEncoder().encode(
    [
      ["v", "1"],
      ["kind", "stt"],
      ["provider", input.provider],
      ["model", input.model],
      ["language", input.language ?? ""],
    ].map(([name, value]) => `${name}=${value}`).join(SEPARATOR) + SEPARATOR,
  );
  const combined = new Uint8Array(header.length + input.bytes.length);
  combined.set(header, 0);
  combined.set(input.bytes, header.length);
  return sha256Hex(combined);
}

/**
 * A transcript store, as a port.
 *
 * Deliberately not implemented against a table in this phase. A transcript is
 * the content of somebody's speech: persisting it needs a retention clock, a
 * deletion path and a decision about who may read it, and this repository
 * already has one such decision recorded — WhatsApp transcripts live in
 * `whatsapp_messages` under a ninety-day prune. A second store with different
 * rules should not appear by accident, so the mechanism exists here and the
 * table waits for approval alongside the cloning-consent migration.
 *
 * Until then every caller passes nothing and the deduplication is a no-op that
 * costs one branch.
 */
export interface TranscriptCacheStore {
  get(fingerprint: string): Promise<string | null>;
  put(fingerprint: string, text: string, expiresAt: Date): Promise<void>;
}
