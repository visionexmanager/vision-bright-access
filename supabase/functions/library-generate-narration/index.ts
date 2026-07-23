/**
 * library-generate-narration — AI Audio: generates a chapter's audiobook
 * narration via OpenAI TTS when no (or an incomplete) audiobook exists yet.
 * Chapter-scoped: the client calls this once per chapter with a progress
 * dialog, never once for a whole book.
 *
 * Auth: user-jwt required, caller must be the book's author (is_library_
 * book_owner) OR admin — this is an AUTHORING action (same gating pattern
 * as library-embed-book), not a per-listener one; unbounded per-reader TTS
 * generation would be an uncontrolled OpenAI-cost/abuse vector.
 * Rate-limited (20/day) via check_ai_rate_limit("library-generate-narration").
 *
 * Chunking: OpenAI's /v1/audio/speech silently truncates long input, so the
 * chapter's content_text is split into <=4000-char, sentence-boundary-aware
 * segments, each synthesized separately, then the raw MP3 byte buffers are
 * concatenated into one file — a pragmatic approach (no ffmpeg available in
 * this Deno edge runtime), not studio-grade audio processing. Chapters over
 * ~48,000 characters (~12 segments, headroom under the ~150s function time
 * limit) are rejected with 422 rather than generated across multiple
 * invocations.
 *
 * Voice: OpenAI TTS exposes a fixed set of named voices and no literal
 * accent/dialect/emotion parameter, so gender maps to a default voice ID
 * and dialect/emotion/natural-pauses are composed into the natural-language
 * `instructions` steering string — the same mechanism text-to-speech/
 * index.ts already uses per-assistant, built dynamically here instead of
 * statically. `language` is UI/metadata labeling only (drives
 * library_narrators.languages elsewhere), not an API parameter.
 *
 * Duration: estimated from character count / (chars-per-second * speed)
 * using a fixed speech-rate heuristic — NOT decoded from the actual audio
 * (no audio-decoding library available here). Documented scope boundary.
 *
 * Persistence: uploads to the existing library-audiobooks bucket at
 * {book_id}/ai-{audiobookId}-ch{chapterNumber}-{timestamp}.mp3 (matches the
 * bucket's existing {book_id}/{filename} RLS convention exactly), inserts a
 * library_book_files row (file_type='audio') and upserts a
 * library_audiobook_chapters row (is_ai_generated=true). Auto-creates the
 * parent library_audiobooks row if none exists yet for this book.
 *
 * Input: JSON { book_id, chapter_id, voice?, gender?, dialect?, language?,
 *   speed?, emotion? }
 * Returns: JSON { ok, audiobook_id, chapter }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const MAX_CHAPTER_CHARS = 48000;
const CHUNK_TARGET_CHARS = 3900;
const CHARS_PER_SECOND = 12.5; // ~150 wpm * ~5 chars/word / 60s, at speed=1

const ALLOWED_VOICES = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer", "coral"]);

const GENDER_VOICE_MAP: Record<string, string> = {
  male: "onyx",
  female: "nova",
  neutral: "fable",
};

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  book_id: string;
  chapter_id: string;
  voice?: string;
  gender?: "male" | "female" | "neutral";
  dialect?: string;
  language?: string;
  speed?: number;
  emotion?: string;
}

/** Splits `text` into <=`maxChars`-length segments, preferring to break at
 *  the last sentence boundary before the limit (never mid-word/sentence)
 *  so each TTS call receives clean, well-formed input. Pure function. */
function chunkForNarration(text: string, maxChars: number): string[] {
  const clean = text.trim();
  if (!clean) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + maxChars, clean.length);
    if (end < clean.length) {
      const windowStart = Math.max(start + maxChars - 300, start);
      const sentenceBreak = clean.lastIndexOf(". ", end);
      const paragraphBreak = clean.lastIndexOf("\n", end);
      const cut = Math.max(sentenceBreak, paragraphBreak);
      if (cut > windowStart) end = cut + 1;
    }
    const segment = clean.slice(start, end).trim();
    if (segment) chunks.push(segment);
    start = end;
  }

  return chunks;
}

function buildInstructions(dialect?: string, emotion?: string): string {
  let instructions = "Narrate this audiobook chapter clearly and naturally, like a professional audiobook narrator.";
  if (dialect?.trim()) instructions += ` Use a ${dialect.trim()} accent.`;
  if (emotion?.trim()) instructions += ` Speak with a ${emotion.trim()} tone.`;
  instructions += " Use natural pauses between sentences and paragraphs.";
  return instructions;
}

async function synthesizeSegment(apiKey: string, text: string, voice: string, instructions: string, speed: number): Promise<Uint8Array> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", input: text, voice, instructions, speed, response_format: "mp3" }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("library-generate-narration: TTS segment failed:", res.status, errText);
    throw new Error(`Narration synthesis failed (${res.status})`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

function concatBuffers(buffers: Uint8Array[]): Uint8Array {
  const total = buffers.reduce((sum, b) => sum + b.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) return json({ error: "OPENAI_API_KEY is not configured" }, 500, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }
  if (!body.book_id || !body.chapter_id) {
    return json({ error: "book_id and chapter_id are required" }, 400, cors);
  }

  try {
    const [{ data: isOwner }, { data: isAdmin }] = await Promise.all([
      userClient.rpc("is_library_book_owner", { _book_id: body.book_id }),
      userClient.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    ]);
    if (!isOwner && !isAdmin) return json({ error: "You may only generate narration for your own books" }, 403, cors);

    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: allowed } = await serviceClient.rpc("check_ai_rate_limit", { _user_id: user.id, _function_name: "library-generate-narration" });
    if (allowed === false) return json({ error: "Daily narration-generation limit reached (20/day). Try again tomorrow." }, 429, cors);

    const { data: chapter, error: chapterErr } = await serviceClient
      .from("library_chapters")
      .select("id, book_id, chapter_number, title, content_text")
      .eq("id", body.chapter_id)
      .eq("book_id", body.book_id)
      .maybeSingle();
    if (chapterErr) throw chapterErr;
    if (!chapter) return json({ error: "Chapter not found for this book" }, 404, cors);

    const text = (chapter.content_text ?? "").trim();
    if (!text) return json({ error: "This chapter has no text content to narrate" }, 422, cors);
    if (text.length > MAX_CHAPTER_CHARS) {
      return json({ error: `This chapter is too long to narrate in one request (${text.length} characters, max ${MAX_CHAPTER_CHARS}). Split it into shorter chapters first.` }, 422, cors);
    }

    const speed = Math.min(2, Math.max(0.5, body.speed ?? 1));
    const voice = body.voice && ALLOWED_VOICES.has(body.voice) ? body.voice : GENDER_VOICE_MAP[body.gender ?? "neutral"] ?? "fable";
    const instructions = buildInstructions(body.dialect, body.emotion);

    const segments = chunkForNarration(text, CHUNK_TARGET_CHARS);
    if (segments.length === 0) return json({ error: "This chapter has no text content to narrate" }, 422, cors);

    const buffers: Uint8Array[] = [];
    for (const segment of segments) {
      buffers.push(await synthesizeSegment(OPENAI_API_KEY, segment, voice, instructions, speed));
    }
    const audioBytes = concatBuffers(buffers);

    let audiobookId: string;
    const { data: existingAudiobook } = await serviceClient
      .from("library_audiobooks")
      .select("id")
      .eq("book_id", body.book_id)
      .maybeSingle();

    if (existingAudiobook) {
      audiobookId = existingAudiobook.id;
    } else {
      const { data: created, error: createErr } = await serviceClient
        .from("library_audiobooks")
        .insert({ book_id: body.book_id, narrator_name: "AI Narrator" })
        .select("id")
        .single();
      if (createErr) throw createErr;
      audiobookId = created.id;
    }

    const storagePath = `${body.book_id}/ai-${audiobookId}-ch${chapter.chapter_number}-${Date.now()}.mp3`;
    const { error: uploadErr } = await serviceClient.storage
      .from("library-audiobooks")
      .upload(storagePath, audioBytes, { contentType: "audio/mpeg", upsert: true });
    if (uploadErr) throw uploadErr;

    const { data: fileRow, error: fileErr } = await serviceClient
      .from("library_book_files")
      .insert({ book_id: body.book_id, file_type: "audio", storage_path: storagePath, file_size_bytes: audioBytes.length, is_primary: false })
      .select("id")
      .single();
    if (fileErr) throw fileErr;

    const estimatedDurationSeconds = Math.round(text.length / (CHARS_PER_SECOND * speed));

    const { data: chapterRow, error: upsertErr } = await serviceClient
      .from("library_audiobook_chapters")
      .upsert(
        {
          audiobook_id: audiobookId,
          book_id: body.book_id,
          chapter_number: chapter.chapter_number,
          title: chapter.title,
          audio_file_id: fileRow.id,
          duration_seconds: estimatedDurationSeconds,
          order_index: chapter.chapter_number,
          is_ai_generated: true,
        },
        { onConflict: "audiobook_id,chapter_number" }
      )
      .select("id, chapter_number, title, duration_seconds")
      .single();
    if (upsertErr) throw upsertErr;

    return json({ ok: true, audiobook_id: audiobookId, chapter: chapterRow }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-generate-narration error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
