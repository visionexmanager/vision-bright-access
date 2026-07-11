// Voice Studio edge function
// Handles: create profile, start training, cancel training, profile management
// Provider abstraction: ElevenLabsVoiceProvider | MockVoiceProvider

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Provider interface ────────────────────────────────────────────────────────

interface VoiceCloneInput {
  profileId: string;
  profileName: string;
  description?: string;
  language: string;
  storagePaths: string[];   // Supabase Storage paths
  supabaseUrl: string;
  supabaseServiceKey: string;
}

interface VoiceCloneResult {
  ok: boolean;
  providerVoiceId?: string;
  error?: string;
}

interface VoiceProvider {
  name: string;
  cloneVoice(input: VoiceCloneInput): Promise<VoiceCloneResult>;
  deleteVoice(providerVoiceId: string): Promise<void>;
}

// ── ElevenLabs Provider ───────────────────────────────────────────────────────

class ElevenLabsVoiceProvider implements VoiceProvider {
  name = "elevenlabs";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async cloneVoice(input: VoiceCloneInput): Promise<VoiceCloneResult> {
    // Download audio files from Supabase Storage and upload to ElevenLabs
    const db = createClient(input.supabaseUrl, input.supabaseServiceKey);
    const formData = new FormData();
    formData.append("name", input.profileName);
    if (input.description) formData.append("description", input.description);
    formData.append("labels", JSON.stringify({ language: input.language }));

    // Download each sample and attach
    for (const storagePath of input.storagePaths) {
      const { data, error } = await db.storage
        .from("voice-datasets")
        .download(storagePath);
      if (error || !data) continue;

      const filename = storagePath.split("/").pop() ?? "sample.wav";
      formData.append("files", data, filename);
    }

    const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": this.apiKey },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
      return { ok: false, error: err.detail || "ElevenLabs cloning failed" };
    }

    const json = await response.json();
    return { ok: true, providerVoiceId: json.voice_id };
  }

  async deleteVoice(providerVoiceId: string): Promise<void> {
    await fetch(`https://api.elevenlabs.io/v1/voices/${providerVoiceId}`, {
      method: "DELETE",
      headers: { "xi-api-key": this.apiKey },
    });
  }
}

// ── Provider factory ──────────────────────────────────────────────────────────
//
// No mock/fake provider: if ELEVENLABS_API_KEY isn't configured, callers must
// see a clear "not configured" error rather than a fake successful clone that
// can never actually speak (a provider_voice_id with no real ElevenLabs voice
// behind it).

function getProvider(): VoiceProvider {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY is not configured in Supabase Edge Function secrets. " +
      "Voice Cloning requires a real ElevenLabs API key — add it in Project Settings → Edge Functions → Secrets."
    );
  }
  return new ElevenLabsVoiceProvider(apiKey);
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleStartTraining(
  body: Record<string, unknown>,
  userId: string,
  db: ReturnType<typeof createClient>,
  dbService: ReturnType<typeof createClient>
): Promise<Response> {
  const { profile_id } = body as { profile_id: string };
  if (!profile_id) return jsonError("profile_id required", 400);

  // Verify profile ownership
  const { data: profile, error: profErr } = await (db as any)
    .from("vs_voice_profiles")
    .select("*, vs_voice_datasets(id, storage_path, status)")
    .eq("id", profile_id)
    .eq("user_id", userId)
    .single();

  if (profErr || !profile) return jsonError("Profile not found", 404);
  if (profile.status === "training") return jsonError("Already training", 409);

  // Get accepted datasets
  const accepted = (profile.vs_voice_datasets ?? []).filter(
    (d: Record<string, unknown>) => d.status === "accepted"
  );
  if (accepted.length === 0) return jsonError("No accepted audio samples", 422);

  // Create training job
  const { data: job, error: jobErr } = await (db as any)
    .from("vs_training_jobs")
    .insert({
      profile_id,
      user_id:  userId,
      status:   "queued",
      progress: 0,
      provider: "elevenlabs",
    })
    .select()
    .single();

  if (jobErr) {
    const detail = (jobErr as any)?.message ?? "unknown";
    const msg = detail.includes("does not exist")
      ? "Database table 'vs_training_jobs' not found. Run Supabase migrations to set up the Voice Studio schema."
      : `Failed to create training job: ${detail}`;
    return jsonError(msg, 500);
  }

  // Update profile status
  await (db as any)
    .from("vs_voice_profiles")
    .update({ status: "training", training_status: "queued", updated_at: new Date().toISOString() })
    .eq("id", profile_id);

  // Run training asynchronously (background via edge runtime)
  EdgeRuntime.waitUntil(runTraining(profile, accepted, job.id, userId, dbService));

  return json({ ok: true, job_id: job.id });
}

async function runTraining(
  profile: Record<string, unknown>,
  datasets: Array<{ storage_path: string }>,
  jobId: string,
  userId: string,
  db: ReturnType<typeof createClient>
): Promise<void> {
  const supabaseUrl     = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey      = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const updateJob = async (patch: Record<string, unknown>) =>
    (db as any).from("vs_training_jobs").update(patch).eq("id", jobId);
  const updateProfile = async (patch: Record<string, unknown>) =>
    (db as any).from("vs_voice_profiles").update(patch).eq("id", profile.id);
  const logEvent = async (level: string, message: string) =>
    (db as any).rpc("vs_log_training", { p_job_id: jobId, p_level: level, p_message: message });

  try {
    // Constructed inside the try block so a missing ELEVENLABS_API_KEY fails
    // the job with a clear message instead of becoming an unhandled rejection
    // that leaves the job stuck in "training" forever.
    const provider = getProvider();

    await updateJob({ status: "uploading", progress: 10, started_at: new Date().toISOString() });
    await updateProfile({ training_status: "uploading" });
    await logEvent("info", "Uploading samples to voice provider…");

    const result = await provider.cloneVoice({
      profileId:         profile.id as string,
      profileName:       profile.name as string,
      description:       profile.description as string | undefined,
      language:          profile.language as string,
      storagePaths:      datasets.map((d) => d.storage_path),
      supabaseUrl,
      supabaseServiceKey: serviceKey,
    });

    if (!result.ok) {
      await updateJob({ status: "failed", progress: 0, error_message: result.error, completed_at: new Date().toISOString() });
      await updateProfile({ status: "failed", training_status: "failed" });
      await logEvent("error", result.error ?? "Training failed");
      return;
    }

    await updateJob({ status: "optimizing", progress: 90, provider_voice_id: result.providerVoiceId });
    await updateProfile({ training_status: "optimizing" });
    await logEvent("info", "Voice model created. Finalizing…");

    // Small pause before finalizing
    await new Promise((r) => setTimeout(r, 1500));

    // Add user voice to the shared ams_voices table so Speech Studio sees it
    const voiceId = `user-${userId.slice(0, 8)}-${(profile.id as string).slice(0, 8)}`;
    await (db as any).from("ams_voices").upsert({
      id:               voiceId,
      name:             profile.name,
      provider:         provider.name,
      provider_voice_id: result.providerVoiceId,
      gender:           profile.gender ?? "neutral",
      language:         profile.language,
      supported_languages: [profile.language],
      description:      profile.description ?? `Custom cloned voice: ${profile.name}`,
      tags:             ["cloned", "custom", ...(profile.tags as string[] ?? [])],
      category:         "general",
      is_premium:       false,
      sort_order:       999,
    }, { onConflict: "id" });

    await updateJob({ status: "completed", progress: 100, provider_voice_id: result.providerVoiceId, completed_at: new Date().toISOString() });
    await updateProfile({
      status:             "completed",
      training_status:    "completed",
      provider_voice_id:  result.providerVoiceId,
      updated_at:         new Date().toISOString(),
    });
    await logEvent("success", "Voice cloning completed successfully!");

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    await updateJob({ status: "failed", error_message: msg, completed_at: new Date().toISOString() });
    await updateProfile({ status: "failed", training_status: "failed" });
    await logEvent("error", `Training error: ${msg}`);
  }
}

async function handleCancelTraining(
  body: Record<string, unknown>,
  userId: string,
  db: ReturnType<typeof createClient>
): Promise<Response> {
  const { profile_id, job_id } = body as { profile_id: string; job_id: string };

  await (db as any).from("vs_training_jobs")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", job_id)
    .eq("user_id", userId)
    .in("status", ["queued", "uploading", "validating"]);

  await (db as any).from("vs_voice_profiles")
    .update({ status: "draft", training_status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", profile_id)
    .eq("user_id", userId);

  return json({ ok: true });
}

async function handleDeleteProfile(
  body: Record<string, unknown>,
  userId: string,
  db: ReturnType<typeof createClient>
): Promise<Response> {
  const { profile_id } = body as { profile_id: string };

  const { data: profile } = await (db as any)
    .from("vs_voice_profiles")
    .select("provider_voice_id, provider")
    .eq("id", profile_id)
    .eq("user_id", userId)
    .single();

  // Delete from provider if cloned
  if (profile?.provider_voice_id && profile.provider === "elevenlabs") {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (apiKey) {
      const p = new ElevenLabsVoiceProvider(apiKey);
      await p.deleteVoice(profile.provider_voice_id).catch(() => null);
    }
  }

  // Remove from ams_voices if it was injected
  const voiceId = `user-${userId.slice(0, 8)}-${(profile_id).slice(0, 8)}`;
  await (db as any).from("ams_voices").delete().eq("id", voiceId);

  // Delete profile (cascades to datasets + jobs)
  await (db as any).from("vs_voice_profiles").delete().eq("id", profile_id).eq("user_id", userId);

  return json({ ok: true });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 500): Response {
  return json({ ok: false, error: message }, status);
}

// ── Entry point ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonError("Unauthorized", 401);

  const supabaseUrl    = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey        = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const db        = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const dbService = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return jsonError("Unauthorized", 401);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const action = body.action as string;

  switch (action) {
    case "start_training":  return handleStartTraining(body, user.id, db, dbService);
    case "cancel_training": return handleCancelTraining(body, user.id, db);
    case "delete_profile":  return handleDeleteProfile(body, user.id, db);
    default: return jsonError(`Unknown action: ${action}`, 400);
  }
});

// Deno EdgeRuntime shim for non-Deno environments
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };
