/**
 * speech-generate — AI Media Studio Speech Studio generation endpoint
 *
 * Provider architecture:
 *   BaseSpeechProvider (interface) → OpenAISpeechProvider (Phase 2)
 *   Future: ElevenLabsProvider, PlayHTProvider, AzureProvider
 *
 * Auth: user-jwt required
 * Returns: JSON { ok, job_id, asset_id, audio_base64, mime_type, duration_sec, size_bytes }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  describeTtsFailure,
  mimeFor,
  synthesize,
  type TtsFormat,
  type TtsProvider,
} from "../_shared/voice/tts.ts";

// ─── Providers ───────────────────────────────────────────────────────────────
//
// Both providers moved to `_shared/voice/tts.ts`, which the WhatsApp voice
// reply and the two assistant-voice functions now share. What stays here is
// this endpoint's own policy: it is the only caller that lets a *user* pick
// the provider, the model, the voice, the speed and the container, and the
// only one that shows a provider's failure to a person — which is why the
// sentences in `describeTtsFailure` were written for this screen.

function speechProviderOf(name: string): TtsProvider {
  if (name === "openai" || name === "elevenlabs") return name;
  throw new Error(`Unknown speech provider: "${name}". Supported: openai, elevenlabs`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function estimateDuration(text: string, speed: number): number {
  const words = text.trim().split(/\s+/).length;
  return Math.round((words / 150) * 60 / Math.max(0.25, speed));
}

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ─── Request Body ─────────────────────────────────────────────────────────────

interface RequestBody {
  text: string;
  voice_id: string;
  provider_voice_id: string;
  voice_name?: string;
  provider?: string;
  model?: string;
  language?: string;
  emotion?: string;
  speed?: number;
  pitch?: number;
  output_format?: string;
  project_id?: string;
  preset_id?: string;
  preset_name?: string;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient    = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  // Parse body
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  const {
    text,
    voice_id,
    provider_voice_id,
    voice_name,
    provider   = "openai",
    model      = "tts-1",
    language   = "en",
    emotion    = "neutral",
    speed      = 1.0,
    pitch      = 0,
    output_format = "mp3",
    project_id,
    preset_id,
    preset_name,
  } = body;

  if (!text?.trim()) return json({ error: "text is required" }, 400, cors);
  if (!voice_id || !provider_voice_id) return json({ error: "voice_id and provider_voice_id are required" }, 400, cors);
  if (text.length > 4096) return json({ error: "Text exceeds 4096 character limit" }, 400, cors);

  // Create job record
  const { data: jobRow, error: jobErr } = await serviceClient
    .from("ams_speech_jobs")
    .insert({
      user_id:      user.id,
      project_id:   project_id ?? null,
      input_text:   text.trim(),
      voice_id,
      voice_name:   voice_name ?? voice_id,
      language,
      emotion,
      speed,
      pitch,
      output_format,
      model,
      provider,
      preset_id:    preset_id ?? null,
      preset_name:  preset_name ?? null,
      status:       "processing",
      started_at:   new Date().toISOString(),
    })
    .select("id")
    .single();

  if (jobErr || !jobRow) {
    const detail = jobErr?.message ?? "unknown reason";
    console.error("Job insert failed:", detail);
    const msg = detail.includes("does not exist")
      ? "Database table 'ams_speech_jobs' not found. Run Supabase migrations to set up the AI Media Studio schema."
      : `Failed to create generation job: ${detail}`;
    return json({ error: msg, code: "DB_ERROR" }, 500, cors);
  }
  const jobId: string = jobRow.id;

  // Generate
  try {
    const result = await synthesize({
      provider: speechProviderOf(provider),
      voice: provider_voice_id,
      text: text.trim(),
      speed,
      format: output_format as TtsFormat,
      model,
    });
    // Thrown, not returned: this endpoint's error path already turns a thrown
    // message into the JSON body the studio shows, and the wording is the
    // wording it has always shown.
    if (result.outcome === "failed") throw new Error(describeTtsFailure(result.failure));

    const audioBase64 = bufferToBase64(result.bytes.buffer as ArrayBuffer);
    const durationSec = estimateDuration(text, speed);
    const sizeBytes   = result.bytes.byteLength;

    // Create asset record
    const filename = `speech_${jobId.slice(0, 8)}.${output_format}`;
    const { data: assetRow } = await serviceClient
      .from("ams_assets")
      .insert({
        owner_id:      user.id,
        project_id:    project_id ?? null,
        filename,
        original_name: filename,
        asset_type:    "generated",
        mime_type:     mimeFor(speechProviderOf(provider), output_format as TtsFormat),
        size_bytes:    sizeBytes,
        duration_sec:  durationSec,
        status:        "ready",
        metadata: {
          source:     "speech-studio",
          voice_id,
          voice_name: voice_name ?? voice_id,
          language,
          emotion,
          speed,
          model,
          provider,
          job_id: jobId,
        },
      })
      .select("id")
      .single();

    const assetId = assetRow?.id ?? null;

    // Complete the job
    await serviceClient.from("ams_speech_jobs").update({
      status:         "completed",
      asset_id:       assetId,
      duration_sec:   durationSec,
      file_size_bytes: sizeBytes,
      completed_at:   new Date().toISOString(),
    }).eq("id", jobId);

    // Record voice usage (best-effort)
    try {
      await userClient.rpc("ams_record_voice_usage", { p_voice_id: voice_id });
    } catch { /* non-critical */ }

    // Recalculate storage quota (best-effort)
    try {
      await serviceClient.rpc("ams_recalculate_storage", { p_user_id: user.id });
    } catch { /* non-critical */ }

    return json({
      ok:           true,
      job_id:       jobId,
      asset_id:     assetId,
      audio_base64: audioBase64,
      mime_type:    mimeFor(speechProviderOf(provider), output_format as TtsFormat),
      duration_sec: durationSec,
      size_bytes:   sizeBytes,
      output_format,
    }, 200, cors);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Speech generation failed:", msg);

    await serviceClient.from("ams_speech_jobs").update({
      status:        "failed",
      error_message: msg,
      completed_at:  new Date().toISOString(),
    }).eq("id", jobId);

    return json({ error: msg, job_id: jobId }, 500, cors);
  }
});
