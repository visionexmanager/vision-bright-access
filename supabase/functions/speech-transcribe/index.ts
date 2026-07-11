/**
 * speech-transcribe — AI Media Studio Speech-to-Text endpoint
 *
 * Provider: OpenAI Whisper (reuses existing OPENAI_API_KEY)
 * Auth: user-jwt required
 * Input: JSON { audio_base64, mime_type, filename, language_hint?, project_id? }
 * Returns: JSON { ok, job_id, transcript_text, detected_language, duration_sec }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

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

async function transcribeWithWhisper(
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
  languageHint?: string
): Promise<{ text: string; language?: string; duration?: number }> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured in Supabase Edge Function secrets.");

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimeType }), filename);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  if (languageHint) form.append("language", languageHint);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message ?? detail;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) detail = text.slice(0, 200);
    }
    const statusMap: Record<number, string> = {
      400: `Unsupported or corrupt audio file: ${detail}`,
      401: "OpenAI API key is invalid or revoked. Check OPENAI_API_KEY in Supabase secrets.",
      413: "Audio file is too large for transcription (25 MB limit).",
      429: "OpenAI rate limit reached. Please wait a moment and try again.",
      500: "OpenAI service error. This is temporary — please retry in a few seconds.",
      503: "OpenAI is temporarily unavailable. Please retry shortly.",
    };
    throw new Error(statusMap[res.status] ?? `Whisper transcription error (${res.status}): ${detail}`);
  }

  const data = await res.json();
  return { text: data.text ?? "", language: data.language, duration: data.duration };
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
