/**
 * speech-transcribe — AI Media Studio Speech-to-Text endpoint
 *
 * Provider: the shared STT seam (`_shared/voice/stt.ts`) — Groq Whisper first,
 * OpenAI Whisper fallback. Previously called OpenAI directly; this endpoint
 * now shares its provider chain with WhatsApp's voice-note transcription
 * instead of duplicating it, per the provider-allocation audit's Phase 1.
 * Auth: user-jwt required
 * Input: JSON { audio_base64, mime_type, filename, language_hint?, project_id? }
 * Returns: JSON { ok, job_id, transcript_text, detected_language, duration_sec }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isSupportedLanguage } from "../_shared/voice/capabilities.ts";
import { transcribe, type SttProviderName, type TranscribeAttempt } from "../_shared/voice/stt.ts";
import type { VoiceFailure } from "../_shared/voice/providers/types.ts";
import { providerBySlug, recordResult } from "../_shared/providerRouter.ts";

// ── Provider Registry recording (Phase 2D) ─────────────────────────────────
//
// The `groq-stt`/`openai-stt` rows Phase 2C seeded. Recording only — the
// fallback order, per-language capability filtering, skip-on-no-key and
// retry-on-empty-transcript behavior all stay exactly as `_shared/voice/stt.ts`
// already implements them (and WhatsApp's voice notes already rely on). That
// chain is more sophisticated than a single resolveProvider() pick — it is
// capability-aware and cannot regress to something the registry does not yet
// model. Wiring it in as a real dependency of the transcription itself would
// also mean a Supabase hiccup could break transcription that works today; a
// best-effort recording call after the fact carries none of that risk.
const STT_SLUG: Record<SttProviderName, string> = { groq: "groq-stt", openai: "openai-stt" };

/**
 * Record every attempt `transcribe()` actually made against a network — a
 * provider skipped for a missing key never reached the wire and is excluded,
 * so it cannot be mistaken for a real failure in that provider's health score.
 */
async function recordSttAttempts(
  attempts: TranscribeAttempt[],
  final?: { provider: SttProviderName; ms: number },
): Promise<void> {
  const real = attempts.filter((a) => a.failure.reason !== "no_key");
  try {
    for (const attempt of real) {
      const row = await providerBySlug(STT_SLUG[attempt.provider]);
      if (!row) continue;
      await recordResult({
        provider_id: row.id, provider_slug: row.slug, job_type: "stt",
        success: false, latency_ms: attempt.ms,
        error_message: attempt.failure.reason === "rejected" ? attempt.failure.detail : attempt.failure.reason,
      });
    }
    if (final) {
      const row = await providerBySlug(STT_SLUG[final.provider]);
      if (row) {
        await recordResult({ provider_id: row.id, provider_slug: row.slug, job_type: "stt", success: true, latency_ms: final.ms });
      }
    }
  } catch {
    // Best-effort. The transcript the sender already has must never depend on this.
  }
}

const MAX_BYTES = 25 * 1024 * 1024; // OpenAI Whisper's hard limit

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function base64ToBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

interface RequestBody {
  audio_base64:  string;
  mime_type?:    string;
  filename?:     string;
  language_hint?: string;
  project_id?:   string;
}

/**
 * The provider's own vocabulary, turned into the sentence this endpoint has
 * always shown — the status-code mapping OpenAI's error responses justified,
 * now keyed by whichever provider in the chain produced the failure that
 * matters (the seam already picks the most informative one when every
 * provider was tried and none answered).
 */
function describeSttFailure(failure: VoiceFailure): string {
  switch (failure.reason) {
    case "invalid_input":
      return "Audio file is empty or invalid.";
    case "no_key":
    case "no_capable_provider":
      return "No speech-to-text provider is configured.";
    case "empty":
      return "No speech was detected in the audio file.";
    case "transport":
      return `${failure.provider} is temporarily unavailable. Please retry shortly.`;
    case "rejected": {
      const { provider, status, detail } = failure;
      const statusMap: Record<number, string> = {
        400: `Unsupported or corrupt audio file: ${detail}`,
        401: `${provider} API key is invalid or revoked. Check Supabase secrets.`,
        413: "Audio file is too large for transcription (25 MB limit).",
        429: `${provider} rate limit reached. Please wait a moment and try again.`,
        500: `${provider} service error. This is temporary — please retry in a few seconds.`,
        503: `${provider} is temporarily unavailable. Please retry shortly.`,
      };
      return statusMap[status] ?? `Transcription error (${status}): ${detail}`;
    }
  }
}

async function transcribeWithWhisper(
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
  languageHint?: string
): Promise<{ text: string; language?: string; duration?: number }> {
  const heard = await transcribe({
    bytes,
    mimeType,
    filename,
    // Only a canonical code is passed on: an unrecognised hint is safer
    // omitted than sent to a provider that would silently ignore or
    // mishandle it — Whisper detects the language itself either way.
    language: isSupportedLanguage(languageHint) ? languageHint : undefined,
  });

  if (heard.outcome !== "transcript") {
    await recordSttAttempts(heard.attempts);
    throw new Error(describeSttFailure(heard.failure));
  }
  await recordSttAttempts(heard.attempts, { provider: heard.provider, ms: heard.ms });
  return { text: heard.text, language: heard.language, duration: heard.duration };
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient    = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  const {
    audio_base64,
    mime_type   = "audio/webm",
    filename    = "audio.webm",
    language_hint,
    project_id,
  } = body;

  if (!audio_base64) return json({ error: "audio_base64 is required" }, 400, cors);

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(audio_base64);
  } catch {
    return json({ error: "Invalid base64 audio data" }, 400, cors);
  }
  if (bytes.byteLength === 0) return json({ error: "Audio file is empty" }, 400, cors);
  if (bytes.byteLength > MAX_BYTES) {
    return json({ error: `Audio file (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB) exceeds the 25 MB transcription limit.` }, 400, cors);
  }

  const { data: jobRow, error: jobErr } = await serviceClient
    .from("ams_transcription_jobs")
    .insert({
      user_id:          user.id,
      project_id:       project_id ?? null,
      input_filename:   filename,
      input_mime_type:  mime_type,
      input_size_bytes: bytes.byteLength,
      language_hint:    language_hint ?? null,
      status:           "processing",
      started_at:       new Date().toISOString(),
    })
    .select("id")
    .single();

  if (jobErr || !jobRow) {
    const detail = jobErr?.message ?? "unknown reason";
    const msg = detail.includes("does not exist")
      ? "Database table 'ams_transcription_jobs' not found. Run Supabase migrations to set up the AI Media Studio schema."
      : `Failed to create transcription job: ${detail}`;
    return json({ error: msg, code: "DB_ERROR" }, 500, cors);
  }
  const jobId: string = jobRow.id;

  try {
    const result = await transcribeWithWhisper(bytes, filename, mime_type, language_hint);

    if (!result.text.trim()) {
      throw new Error("No speech was detected in the audio file.");
    }

    await serviceClient.from("ams_transcription_jobs").update({
      status:            "completed",
      transcript_text:   result.text,
      detected_language: result.language ?? null,
      duration_sec:      result.duration ?? null,
      completed_at:      new Date().toISOString(),
    }).eq("id", jobId);

    return json({
      ok:                true,
      job_id:            jobId,
      transcript_text:   result.text,
      detected_language: result.language ?? null,
      duration_sec:      result.duration ?? null,
    }, 200, cors);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Transcription failed:", msg);

    await serviceClient.from("ams_transcription_jobs").update({
      status:        "failed",
      error_message: msg,
      completed_at:  new Date().toISOString(),
    }).eq("id", jobId);

    return json({ error: msg, job_id: jobId }, 500, cors);
  }
});
