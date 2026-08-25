// Not paying to synthesise the same sentence twice.
//
// ── Why this, out of everything left on the roadmap ─────────────────────────
//
// The self-hosting audit's own answer to "what single change saves the most":
// text-to-speech is billed per character on every voice reply, and it is the
// one high-frequency provider call with an exact equivalent rather than a
// cheaper approximation. Every other saving on that list trades quality for
// cost — a smaller Whisper, a weaker OCR, a local LLM. This one trades nothing.
// A hit returns the audio the provider returned the first time, byte for byte,
// because it *is* that audio.
//
// That matters more here than the money. The audience is largely blind, the
// voice note is frequently the whole answer, and the alternative saving on the
// same line item — Piper on the VPS — is "good English, weak Arabic". Caching
// gets the saving without that conversation.
//
// ── What the traffic actually looks like ────────────────────────────────────
//
// Repetitive, in a way that ordinary chat is not. The main menu, the list of
// twenty language names, "send the photo and I'll read it", every refusal
// notice, every welcome message: fixed strings, synthesised again for every
// sender who ever hears them. Those are the rows this exists for. A sentence
// that is genuinely unique — "your appointment is on Tuesday" — is synthesised
// once, cached, and never hit again, which costs one row and saves nothing.
// That is the expected case for a minority of traffic and it is harmless.
//
// ── Meta's media id, not the bytes ──────────────────────────────────────────
//
// A voice note has to be uploaded to the phone number's media store before it
// can be sent. Caching the id Meta returns skips the synthesis *and* the
// upload, so a hit costs one Graph call where a miss costs three.
//
// The price of that is expiry: Meta keeps uploaded media for thirty days. The
// TTL below sits well inside it, and a send that fails on a cached id drops the
// row and takes the ordinary path — so a stale id costs one retry, never a
// missing voice note. That fallback is the whole safety argument and it is what
// `speakReply` is built around.
//
// ── The words are never stored ──────────────────────────────────────────────
//
// The key is a SHA-256 of the text, the voice and the sending number. There is
// no row anywhere holding what was said, and no reference to who heard it.
//
// Pure apart from the hash: no `Deno`, no fetch, no database client. The store
// arrives as three functions, the same seam `whatsappGeoCache.ts` uses, so the
// entire policy — miss, hit, stale id, broken store — is testable without a
// network or a Postgres.

/**
 * How long a cached media id is trusted.
 *
 * Meta keeps uploaded media for thirty days. Fourteen leaves a wide margin for
 * clock drift, for a row written just before a retention sweep, and for the
 * possibility that thirty is a documented maximum rather than a promise.
 *
 * There is no benefit to running closer to the edge. The strings this cache is
 * for — menus, notices, language lists — are hit thousands of times inside a
 * fortnight, so the second week of a row's life is worth far less than the
 * first, and a stale id costs a retry that a shorter TTL avoids entirely.
 */
export const SPEECH_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Longest text that is cached at all.
 *
 * A long answer is almost certainly unique — a summary, a description of a
 * photograph — so caching it stores a row that will never be hit. The ceiling
 * is not about storage, which is trivial, but about keeping the table made of
 * the strings that repeat. `MAX_SPOKEN_CHARS` is 900; a canned notice is well
 * under 300.
 */
export const MAX_CACHEABLE_CHARS = 320;

/** A cache key: 64 hex characters, and nothing else is accepted. */
export const isSpeechCacheKey = (value: string): boolean => /^[0-9a-f]{64}$/.test(value);

/**
 * The separator between the fields of a cache key.
 *
 * A NUL, so that two different field splits cannot produce the same material.
 * A space would: voice "a" with text "b c" and voice "a b" with text "c" hash
 * identically, and one of the two would then be sent audio in the wrong voice.
 * A NUL cannot appear in any of these fields.
 *
 * Written as an escape and named, rather than typed into the argument list.
 * A raw NUL byte in a source file is invisible in every editor and turns the
 * file into something git reports as binary.
 */
const SEPARATOR = "\u0000";

/**
 * The key for one voice note.
 *
 * Every input that changes the audio is in it. The voice and the model are
 * obvious. The phone number id is there because the media id is scoped to the
 * number that uploaded it — a cached id from one sender's media store is not
 * valid for another, and a shared key would produce a 404 on every send from
 * the second number.
 *
 * `crypto.subtle` rather than a hand-rolled hash: it is present in Deno, in
 * Node and in the browser, and this value is a primary key that must be
 * identical across all three.
 */
export async function speechCacheKey(params: {
  phoneNumberId: string;
  voice: string;
  model: string;
  text: string;
}): Promise<string> {
  const material = [params.phoneNumberId, params.voice, params.model, params.text].join(SEPARATOR);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Whether this text is worth a row.
 *
 * Empty and over-long are both refused. The second is the interesting one: see
 * `MAX_CACHEABLE_CHARS`.
 */
export const isCacheableSpeech = (text: string): boolean => {
  const trimmed = (text ?? "").trim();
  return trimmed.length > 0 && trimmed.length <= MAX_CACHEABLE_CHARS;
};

/**
 * The three things a store has to do.
 *
 * Every one of them returns rather than throws, and the caller treats a failure
 * of any of them as a miss. A cache that is down must never be the reason a
 * blind person does not hear their answer — the whole feature is an
 * optimisation on a path that worked before it existed.
 */
export interface SpeechCacheStore {
  /** The media id for this key, or null for a miss or an expired row. */
  get(key: string): Promise<string | null>;
  /** Remember a media id. Failures are ignored; the note has already been sent. */
  put(key: string, mediaId: string, expiresAt: Date): Promise<void>;
  /** Forget a media id Meta has stopped recognising. */
  drop(key: string): Promise<void>;
}

/**
 * A store that cannot throw, wrapped around one that might.
 *
 * `speechCacheStore` below already swallows its own errors, so on the live path
 * this is belt and braces. It exists because the *type* is what `speakReply`
 * accepts, not that one implementation: anything satisfying `SpeechCacheStore`
 * can be handed in, and a throw from any of the three would propagate out of a
 * function whose entire contract is that it never costs somebody their answer.
 *
 * A cache is an optimisation on a path that worked before it existed. Making
 * that true by construction is cheaper than remembering it at every call site.
 */
export function neverThrows(store: SpeechCacheStore): SpeechCacheStore {
  return {
    async get(key) {
      try {
        return await store.get(key);
      } catch {
        return null;
      }
    },
    async put(key, mediaId, expiresAt) {
      try {
        await store.put(key, mediaId, expiresAt);
      } catch {
        // One future synthesis, and nothing else.
      }
    },
    async drop(key) {
      try {
        await store.drop(key);
      } catch {
        // Worst case the same stale id is tried once more, and dropped again.
      }
    },
  };
}

/**
 * A store backed by `whatsapp_speech_cache`.
 *
 * The client is handed in rather than created here, so this module still loads
 * under Vitest and so the webhook's existing service-role client is reused
 * instead of a second connection.
 *
 * Every path swallows its error. A `catch` that returned the error would give
 * the caller a decision it cannot act on: there is nothing useful to do about a
 * cache read failing except synthesise, which is what a miss already means.
 */
export function speechCacheStore(db: {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        gt(column: string, value: string): {
          maybeSingle(): Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
    upsert(values: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ error: unknown }>;
    delete(): { eq(column: string, value: string): Promise<{ error: unknown }> };
  };
}): SpeechCacheStore {
  const TABLE = "whatsapp_speech_cache";

  return {
    async get(key) {
      if (!isSpeechCacheKey(key)) return null;
      try {
        // Expiry is part of the query rather than a check afterwards: an
        // expired row must be a miss even if the sweep has not run, and doing
        // it in SQL means there is only one place it can be forgotten.
        const { data, error } = await db
          .from(TABLE)
          .select("media_id")
          .eq("cache_key", key)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (error || !data) return null;
        const mediaId = (data as { media_id?: unknown }).media_id;
        return typeof mediaId === "string" && mediaId ? mediaId : null;
      } catch {
        return null;
      }
    },

    async put(key, mediaId, expiresAt) {
      if (!isSpeechCacheKey(key) || !mediaId) return;
      try {
        await db.from(TABLE).upsert(
          {
            cache_key: key,
            media_id: mediaId,
            expires_at: expiresAt.toISOString(),
            last_used_at: new Date().toISOString(),
          },
          { onConflict: "cache_key" },
        );
      } catch {
        // The voice note has already been delivered. A failed write costs one
        // future synthesis and nothing else.
      }
    },

    async drop(key) {
      if (!isSpeechCacheKey(key)) return;
      try {
        await db.from(TABLE).delete().eq("cache_key", key);
      } catch {
        // Worst case the same stale id is tried once more, and dropped again.
      }
    },
  };
}
