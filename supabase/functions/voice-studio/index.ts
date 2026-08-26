// Voice Studio edge function
// Handles: create profile, start training, cancel training, profile management
// Provider abstraction: ElevenLabsVoiceProvider | MockVoiceProvider

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

import {
  deletionOutcome,
  mayStartCloning,
  safeProviderReason,
  sampleRetentionFrom,
  type ProviderDeletion,
} from "../_shared/voice/consent.ts";
import {
  drainLimit,
  drainRetentionBatch,
  type ExpiredSampleBatchRow,
  type StorageRemoval,
} from "../_shared/voice/retention.ts";

/**
 * A Supabase client, as this file actually uses one.
 *
 * `StudioClient` looks stricter but is not: every call below
 * already goes through `(db as any)` because the generated database types do
 * not cover the `vs_*` tables, and the annotation only made `deno check` reject
 * the real client for having different generic defaults. Naming what is true is
 * better than a type nothing honours.
 */
// deno-lint-ignore no-explicit-any
type StudioClient = any;

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
  deleteVoice(providerVoiceId: string): Promise<ProviderDeletion>;
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

  /**
   * Destroy the voice at the provider, and say whether it worked.
   *
   * This used to return `void` and its only caller swallowed the rejection, so
   * "deleted" was reported whether or not anything had been. A copy of somebody's
   * voice surviving a deletion they asked for is the worst failure this system
   * has, and it must never be silent.
   *
   * A 404 is `absent`, not a failure: the voice is not there, which is the
   * outcome the caller wanted. Everything else is a failure with a reason that
   * has been stripped of anything resembling a credential.
   */
  async deleteVoice(providerVoiceId: string): Promise<ProviderDeletion> {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(providerVoiceId)}`, {
        method: "DELETE",
        headers: { "xi-api-key": this.apiKey },
      });
      if (response.status === 404) return { outcome: "absent" };
      if (!response.ok) {
        // The status, never the body: an error body can echo a request header.
        return { outcome: "failed", reason: safeProviderReason(`HTTP ${response.status}`) };
      }
      return { outcome: "deleted" };
    } catch (error) {
      return { outcome: "failed", reason: safeProviderReason(error) };
    }
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
  db: StudioClient,
  dbService: StudioClient
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

  // ── Consent, before anything reaches the provider ─────────────────────────
  //
  // Checked here and not only in the interface, because the interface is not
  // the boundary: this line is what stands between a request and a permanent
  // copy of a real person's voice at a third party. The same rule is enforced
  // again by the database, which will not let such a profile become 'ready'.
  const gate = mayStartCloning({
    consentStatus: String(profile.consent_status ?? "pending"),
    lifecycleState: String(profile.lifecycle_state ?? "active"),
    sampleCount: accepted.length,
  });
  if (gate.gate === "refused") {
    const message: Record<string, string> = {
      consent_missing: "Consent has not been given for this voice. Record consent before cloning.",
      consent_revoked: "Consent for this voice has been withdrawn. It cannot be cloned.",
      already_deleted: "This voice is being deleted or has been deleted.",
      no_samples: "No accepted audio samples",
    };
    return jsonError(message[gate.refusal], gate.refusal === "no_samples" ? 422 : 403);
  }

  // ── The meter ─────────────────────────────────────────────────────────────
  //
  // Each call uploads a dataset and creates a permanent voice at ElevenLabs.
  // 'voice-studio-clone' has its own limit inside the existing
  // `check_ai_rate_limit` — five a day — rather than a second rate limiter.
  const { data: allowed, error: limitError } = await (dbService as any)
    .rpc("check_ai_rate_limit", { _user_id: userId, _function_name: "voice-studio-clone" });
  if (limitError || allowed === false) {
    // Fail closed. A meter that cannot answer is not a reason to clone for free.
    if (limitError) console.error("[voice-studio] quota check failed:", (limitError as any)?.code ?? "unknown");
    return jsonError("Daily voice-cloning limit reached. Please try again tomorrow.", 429);
  }

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
  db: StudioClient
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
      // The recordings stop being kept ninety days after the clone exists. The
      // clone is what they were uploaded for; keeping them past that is holding
      // a person's voice for no reason anybody could give them.
      samples_retain_until: sampleRetentionFrom(new Date()).toISOString(),
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
  db: StudioClient
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

/**
 * Withdraw consent.
 *
 * Separate from deletion because they are different acts with the same urgency:
 * revoking stops the voice being used immediately — the WhatsApp resolver
 * re-checks consent on every reply — and then removes the copy and the
 * recordings. Somebody who changes their mind should not have to also find a
 * delete button to make it stop.
 */
async function handleRevokeConsent(
  body: Record<string, unknown>,
  userId: string,
  db: StudioClient
): Promise<Response> {
  const { profile_id } = body as { profile_id: string };
  if (!profile_id) return jsonError("profile_id required", 400);

  // RLS already restricts this to the owner; the explicit user_id filter makes
  // that visible at the call site rather than only in a policy file.
  const { error } = await (db as any)
    .from("vs_voice_profiles")
    .update({
      consent_status: "revoked",
      consent_revoked_at: new Date().toISOString(),
      whatsapp_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile_id)
    .eq("user_id", userId);

  if (error) return jsonError("Could not withdraw consent", 500);

  // The voice has already stopped being usable. Now remove what remains.
  return handleDeleteProfile(body, userId, db);
}

/**
 * Delete a voice: the copy at the provider, the recordings, then the row.
 *
 * In that order, and reported honestly. The previous version deleted the row
 * first, never touched storage, and swallowed the provider's answer — so a
 * caller was told "ok" while the clone still existed at ElevenLabs and every
 * recording sat in the bucket with nothing left pointing at it.
 *
 * When either half fails the profile is left in 'error' with a reason, and the
 * caller is told. A row that still exists can be retried; a row deleted after a
 * failed provider call is an orphan nobody will ever find again.
 */
async function handleDeleteProfile(
  body: Record<string, unknown>,
  userId: string,
  db: StudioClient
): Promise<Response> {
  const { profile_id } = body as { profile_id: string };
  if (!profile_id) return jsonError("profile_id required", 400);

  const { data: profile } = await (db as any)
    .from("vs_voice_profiles")
    .select("id, provider_voice_id, provider")
    .eq("id", profile_id)
    .eq("user_id", userId)
    .single();

  if (!profile) return jsonError("Profile not found", 404);

  // Visible before the work starts, so a deletion interrupted half way is not
  // mistaken for a healthy voice.
  await (db as any)
    .from("vs_voice_profiles")
    .update({ lifecycle_state: "deleting", updated_at: new Date().toISOString() })
    .eq("id", profile_id)
    .eq("user_id", userId);

  // ── The provider ──────────────────────────────────────────────────────────
  let providerResult: ProviderDeletion = { outcome: "absent" };
  if (profile.provider_voice_id && profile.provider === "elevenlabs") {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    providerResult = apiKey
      ? await new ElevenLabsVoiceProvider(apiKey).deleteVoice(profile.provider_voice_id)
      : { outcome: "failed", reason: "ELEVENLABS_API_KEY is not configured, so the voice could not be removed" };
  }

  // ── The recordings ────────────────────────────────────────────────────────
  const samplesRemoved = await removeSamples(db, profile_id, userId);

  const outcome = deletionOutcome({ provider: providerResult, samplesRemoved });
  if (outcome.deletion === "incomplete") {
    // The row stays. Something of this person still exists somewhere, and a
    // deleted row would make that unfindable.
    await (db as any)
      .from("vs_voice_profiles")
      .update({
        lifecycle_state: "error",
        provider_delete_error: outcome.reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile_id)
      .eq("user_id", userId);
    console.error("[voice-studio] deletion incomplete:", outcome.reason);
    return json({ ok: false, error: outcome.reason, state: "error" }, 502);
  }

  const voiceId = `user-${userId.slice(0, 8)}-${profile_id.slice(0, 8)}`;
  await (db as any).from("ams_voices").delete().eq("id", voiceId);

  // Only now, with both copies confirmed gone. The cascade takes the datasets,
  // the jobs and the logs; `whatsapp_identities.voice_profile_id` is ON DELETE
  // SET NULL, so any sender pointed at this voice falls back to the default.
  await (db as any).from("vs_voice_profiles").delete().eq("id", profile_id).eq("user_id", userId);

  return json({ ok: true, provider: providerResult.outcome });
}

/**
 * Remove every stored recording for a profile, and say whether they are gone.
 *
 * Storage lives outside Postgres, so the cascade that removes `vs_voice_datasets`
 * rows would leave every object behind — audio of a real person, in a bucket,
 * with nothing referencing it. The rows are deleted only after the objects are,
 * because the rows are the only record of what to delete.
 */
async function removeSamples(
  db: StudioClient,
  profileId: string,
  userId: string
): Promise<boolean> {
  const { data: rows, error } = await (db as any)
    .from("vs_voice_datasets")
    .select("id, storage_path")
    .eq("profile_id", profileId)
    .eq("user_id", userId);

  if (error) return false;
  const paths = (rows ?? [])
    .map((row: Record<string, unknown>) => row.storage_path)
    .filter((path: unknown): path is string => typeof path === "string" && path.length > 0);

  // One removal helper, shared with the retention drainer, so "already gone
  // counts as deleted" is decided once. No filename is logged: a path in this
  // bucket is `<user id>/<file>`.
  const removed = await removeStorageObjects(db, paths);
  if (removed.removal === "failed") {
    console.error("[voice-studio] storage removal failed for", paths.length, "sample(s)");
    return false;
  }

  const { error: rowError } = await (db as any)
    .from("vs_voice_datasets")
    .delete()
    .eq("profile_id", profileId)
    .eq("user_id", userId);
  if (rowError) return false;

  await (db as any)
    .from("vs_voice_profiles")
    .update({ samples_deleted_at: new Date().toISOString(), sample_count: 0 })
    .eq("id", profileId)
    .eq("user_id", userId);

  return true;
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

// ── Retention drainer ─────────────────────────────────────────────────────────
//
// The recordings someone uploaded stop being kept ninety days after the clone
// they were uploaded for exists. `vs_expired_sample_batch` is the queue — a
// predicate, not a marked column — and this is the only thing that empties it.
//
// ── Why it lives here and not in a new function ──────────────────────────────
//
// `removeSamples` already exists in this file and already does the hard part
// correctly. A second Edge Function would duplicate it, and the project is near
// its function ceiling.
//
// ── Why it is not a public endpoint ──────────────────────────────────────────
//
// CRON_SECRET, checked before anything else and failing closed when unset —
// the same posture `social-publish` takes, for the same reason: an
// unauthenticated request here deletes people's recordings. The user-JWT path
// below is untouched and cannot reach this handler; `drain_retention` is not in
// its switch.
//
// ── Idempotency ──────────────────────────────────────────────────────────────
//
// A profile leaves the queue only when `samples_deleted_at` is set, and that is
// written only after Storage confirmed removal. Re-running is therefore free:
// finished profiles no longer match the predicate, and an interrupted one is
// simply picked up again. Storage's `remove` is itself idempotent — deleting an
// object that is already gone is not an error, which is what makes "already
// missing" the same outcome as "deleted".
async function handleDrainRetention(
  body: Record<string, unknown>,
  db: StudioClient
): Promise<Response> {
  const { data: batch, error } = await (db as any)
    .rpc("vs_expired_sample_batch", { _limit: drainLimit(body.limit) });
  if (error) {
    // A code, never the message: a Postgres error can echo a value back.
    console.error("[voice-studio] retention queue unreadable:", (error as any)?.code ?? "unknown");
    return json({ ok: false, error: "queue_unreadable" }, 503);
  }

  const report = await drainRetentionBatch((batch ?? []) as ExpiredSampleBatchRow[], {
    remove: (paths) => removeStorageObjects(db, paths),
    markDeleted: async (profileId) => {
      await (db as any).rpc("vs_mark_samples_deleted", { _profile_id: profileId });
    },
    markFailed: async (profileId, reason) => {
      await (db as any).rpc("vs_mark_samples_delete_failed", { _profile_id: profileId, _reason: reason });
    },
  });

  // Three counts. No profile id, no path, no filename, no user — this response
  // is echoed into a public CI log.
  return json({ ok: true, ...report });
}

/**
 * Remove objects from the voice bucket, treating "already gone" as success.
 *
 * Supabase Storage does not fail on a missing key, which is what makes the
 * whole drain safe to repeat. An empty list is trivially successful: a profile
 * whose dataset rows were already cleaned still has to leave the queue, and
 * refusing to mark it would leave it retried forever.
 *
 * Shared with `removeSamples`, so "already gone counts as deleted" is decided
 * in one place rather than twice.
 */
async function removeStorageObjects(
  db: StudioClient,
  paths: string[]
): Promise<StorageRemoval> {
  if (paths.length === 0) return { removal: "removed" };
  try {
    const { error } = await (db as any).storage.from("voice-datasets").remove(paths);
    if (error) {
      return {
        removal: "failed",
        reason: safeProviderReason((error as any)?.message ?? "storage refused the removal"),
      };
    }
    return { removal: "removed" };
  } catch (e) {
    return { removal: "failed", reason: safeProviderReason(e) };
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonError("Unauthorized", 401);

  // ── The scheduled caller ────────────────────────────────────────────────
  //
  // Handled before the user path and returning from inside it, so the two can
  // never be confused. CRON_SECRET fails closed: unset means this branch
  // answers nobody, which is the right posture for a handler that deletes
  // recordings. A user JWT can never reach it — the comparison below is against
  // a secret that is not in any bundle — and `drain_retention` is absent from
  // the user switch, so neither can impersonate the other.
  let cronBody: Record<string, unknown> = {};
  try { cronBody = await req.clone().json(); } catch { /* empty body */ }
  if (cronBody.action === "drain_retention") {
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!cronSecret) return json({ ok: false, error: "not_configured" }, 503);
    if (authHeader !== `Bearer ${cronSecret}`) return jsonError("Unauthorized", 401);

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    if (!serviceKey || !supabaseUrl) return json({ ok: false, error: "not_configured" }, 503);

    // Its own client. Deleting storage objects across every user is exactly
    // what service_role is for, and exactly what a user session must never do.
    return handleDrainRetention(cronBody, createClient(supabaseUrl, serviceKey));
  }

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
    case "revoke_consent":  return handleRevokeConsent(body, user.id, db);
    default: return jsonError(`Unknown action: ${action}`, 400);
  }
});

// Deno EdgeRuntime shim for non-Deno environments
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };
