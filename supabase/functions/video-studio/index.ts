// Video Studio edge function
// Provider-abstracted text-to-video generation
// Actions: generate | poll | cancel | delete

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

import type { ComputeAdapter } from "../_shared/providers/compute.ts";
import { runpodAdapter, runpodReadiness } from "../_shared/providers/runpod.ts";

import { maySeeSection, sectionRefusal } from "../_shared/entitlements.ts";
import { chargeDailyLimit } from "../_shared/aiDailyLimit.ts";
import { publicMediaFailure } from "../_shared/providerInput.ts";
import { recordProviderOutcome, VIDEO_PROVIDER_SLUG } from "../_shared/providerRecording.ts";
import { observeShadow, shadowEnabled } from "../_shared/providerSelection.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Provider interface ─────────────────────────────────────────────────────────

interface VideoGenerateParams {
  /**
   * Visionex's own key for this request — the `vx_video_jobs` row id, which
   * exists before any provider is called. A vendor's job id cannot serve here:
   * it does not exist until after the call a duplicate would repeat.
   *
   * Required rather than optional, so a future caller cannot omit it and get
   * an unkeyed request. There is one call site and it already has the id.
   */
  idempotencyKey: string;
  prompt:        string;
  negativePrompt?: string;
  style:         string;
  durationSec:   number;
  aspectRatio:   string;
  resolution:    string;
  fps:           number;
  cameraMotion:  string;
  creativity:    number;
  seed?:         number;
  model:         string;
}

interface VideoGenerateResult {
  ok:            boolean;
  providerJobId?: string;
  error?:        string;
}

interface VideoPollResult {
  ok:            boolean;
  state:         "pending" | "processing" | "completed" | "failed";
  progress:      number;
  videoUrl?:     string;
  thumbnailUrl?: string;
  thumbnailMime?: string;
  error?:        string;
}

interface VideoProvider {
  name:           string;
  /**
   * Whether the provider's asset URLs can be handed straight to a browser.
   * False when downloading requires our API key (OpenAI), in which case the
   * asset MUST land in our own storage before the job can be marked complete.
   */
  publicAssetUrls: boolean;
  generateVideo(params: VideoGenerateParams): Promise<VideoGenerateResult>;
  pollJob(providerJobId: string): Promise<VideoPollResult>;
  cancelJob(providerJobId: string): Promise<void>;
  /** Fetch a provider asset, attaching provider auth where it is required. */
  fetchAsset(url: string): Promise<Response>;
}

// Shared prompt shaping: both providers take a single text prompt, so style and
// camera-motion selections have to be folded into it.
const CAMERA_MOTION_PHRASES: Record<string, string> = {
  pan_left: "camera panning left", pan_right: "camera panning right",
  zoom_in: "camera zooming in", zoom_out: "camera zooming out",
  tilt_up: "camera tilting up", tilt_down: "camera tilting down",
  orbit: "camera orbiting", dolly_in: "camera dolly in", dolly_out: "camera dolly out",
};

function buildPrompt(params: VideoGenerateParams): string {
  let prompt = params.prompt;
  if (params.style && params.style !== "realistic" && params.style !== "custom") {
    prompt = `${params.style} style: ${prompt}`;
  }
  const motion = CAMERA_MOTION_PHRASES[params.cameraMotion];
  if (motion) prompt += `, ${motion}`;
  if (params.negativePrompt) prompt += `. Avoid: ${params.negativePrompt}`;
  return prompt;
}

// ── Luma Dream Machine Provider ───────────────────────────────────────────────
//
// The production video provider since OpenAI removed Sora and its Videos API
// on 2026-09-24. Request shape per docs.lumalabs.ai/reference/creategeneration
// (read 2026-09-25): `model` is required and is "ray-2" or "ray-flash-2";
// `duration` is "5s" or "9s"; `resolution` is 540p/720p/1080p/4k. The
// adapter used to send none of the three, so Luma would have refused every
// request the day it became the fallback.

export const LUMA_MODELS = ["ray-2", "ray-flash-2"] as const;
const LUMA_RESOLUTIONS = new Set(["540p", "720p", "1080p", "4k"]);

export function lumaRequestShape(params: Pick<VideoGenerateParams, "model" | "durationSec" | "resolution">) {
  return {
    model:      (LUMA_MODELS as readonly string[]).includes(params.model) ? params.model : "ray-2",
    duration:   params.durationSec >= 7 ? "9s" : "5s",
    resolution: LUMA_RESOLUTIONS.has(params.resolution) ? params.resolution : "720p",
  };
}

class LumaProvider implements VideoProvider {
  name = "luma";
  publicAssetUrls = true;
  private apiKey: string;
  private baseUrl = "https://api.lumalabs.ai/dream-machine/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private get headers() {
    return {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type":  "application/json",
      "Accept":        "application/json",
    };
  }

  async generateVideo(params: VideoGenerateParams): Promise<VideoGenerateResult> {
    // Map aspect_ratio to Luma supported values
    const aspectMap: Record<string, string> = {
      "16:9": "16:9", "9:16": "9:16", "1:1": "1:1",
      "4:3":  "4:3",  "3:4":  "3:4",  "21:9": "21:9", "9:21": "9:21",
    };
    const aspect = aspectMap[params.aspectRatio] ?? "16:9";

    // Luma has no negative-prompt field, so buildPrompt folds it into the text.
    const body: Record<string, unknown> = {
      prompt: buildPrompt(params),
      aspect_ratio: aspect,
      loop: false,
      ...lumaRequestShape(params),
    };

    const res = await fetch(`${this.baseUrl}/generations`, {
      method:  "POST",
      headers: this.headers,
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      return { ok: false, error: err.detail || err.message || "Luma generation failed" };
    }

    const data = await res.json();
    return { ok: true, providerJobId: data.id };
  }

  async pollJob(providerJobId: string): Promise<VideoPollResult> {
    const res = await fetch(`${this.baseUrl}/generations/${providerJobId}`, {
      headers: this.headers,
    });

    if (!res.ok) {
      return { ok: false, state: "failed", progress: 0, error: `Poll HTTP ${res.status}` };
    }

    const data = await res.json();
    const state = data.state as string;

    if (state === "completed" || state === "dreamed") {
      return {
        ok: true,
        state:      "completed",
        progress:   100,
        videoUrl:   data.assets?.video ?? null,
      };
    }

    if (state === "failed") {
      return {
        ok:    false,
        state: "failed",
        progress: 0,
        error: data.failure_reason ?? "Generation failed",
      };
    }

    // pending or processing — estimate progress from created_at age
    const createdAt = data.created_at ? new Date(data.created_at).getTime() : Date.now();
    const ageSeconds = (Date.now() - createdAt) / 1000;
    const estimatedDuration = 90; // ~90s typical for Luma
    const progress = Math.min(85, Math.round((ageSeconds / estimatedDuration) * 100));

    return { ok: true, state: "processing", progress };
  }

  async cancelJob(_providerJobId: string): Promise<void> {
    // Luma doesn't support cancel via API — best-effort no-op
  }

  fetchAsset(url: string): Promise<Response> {
    // Luma returns public CDN URLs — no auth needed.
    return fetch(url);
  }
}

// ── Provider factory ──────────────────────────────────────────────────────────
//
// No mock/fake provider: if the requested provider's API key isn't configured,
// callers must see a clear "not configured" error rather than a fake completed
// job pointing at a canned stock video.

// ── RunPod Serverless ─────────────────────────────────────────────────────────
//
// A third implementation of the interface above, not a second architecture.
// Luma and OpenAI each speak their own vendor; this one speaks RunPod through
// `_shared/providers/runpod.ts`, which is the transport. The domain shape —
// generate, poll, cancel, fetch — stays the one this file already defines, so
// `handleGenerate`, `handlePoll` and the storage path below are untouched.
//
// `publicAssetUrls = false` deliberately, and it is the important line. A
// worker's output URL is a temporary artifact of a container that scales to
// zero; treating it as durable would hand users a link that dies. False routes
// it through the same "download into our storage before completing" path
// OpenAI already uses, which is also what keeps the output owned by Visionex.
class RunPodVideoProvider implements VideoProvider {
  name = "runpod";
  publicAssetUrls = false;

  constructor(private adapter: ComputeAdapter, private allowedHosts: string[]) {}

  async generateVideo(params: VideoGenerateParams): Promise<VideoGenerateResult> {
    const job = await this.adapter.submit({
      operation: "generateVideo",
      // Named fields only. The client's request reached here through
      // handleGenerate, which already validated and bounded each one; nothing
      // is forwarded wholesale, so a caller cannot smuggle a worker argument
      // the studio never offered.
      input: {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt ?? "",
        duration_sec: params.durationSec,
        aspect_ratio: params.aspectRatio,
        resolution: params.resolution,
        fps: params.fps,
        seed: params.seed ?? null,
      },
      idempotencyKey: params.idempotencyKey,
      timeoutMs: 60_000,
    });

    if (job.error || !job.providerJobId) {
      return { ok: false, error: job.error?.message ?? "The video could not be started." };
    }
    return { ok: true, providerJobId: job.providerJobId };
  }

  async pollJob(providerJobId: string): Promise<VideoPollResult> {
    const job = await this.adapter.poll(providerJobId);

    if (job.status === "queued")  return { ok: true, state: "pending", progress: 5 };
    if (job.status === "running") return { ok: true, state: "processing", progress: 50 };

    if (job.status !== "completed") {
      // cancelled, failed and timed_out all land here. The message is the
      // normalized one — never the worker's, which can name a container, a
      // model or a quota.
      return { ok: true, state: "failed", progress: 0, error: job.error?.message ?? "The video could not be completed." };
    }

    const url = this.videoUrlFrom(job.output);
    if (!url) {
      // A completed job whose output we cannot read is a failure, not a
      // success with a missing file: marking it complete would settle the
      // reservation for something the user never receives.
      return { ok: true, state: "failed", progress: 0, error: "That finished but the result could not be read." };
    }
    return { ok: true, state: "completed", progress: 100, videoUrl: url };
  }

  async cancelJob(providerJobId: string): Promise<void> {
    await this.adapter.cancel(providerJobId);
  }

  /**
   * Fetch the worker's output, with the host checked again at the last moment.
   *
   * `videoUrlFrom` already refused anything off the allowlist, but this is the
   * call that actually leaves the network, and a server-side fetch of a
   * caller-influenced URL is the shape of an SSRF. Checking twice costs a
   * string comparison.
   */
  async fetchAsset(url: string): Promise<Response> {
    if (!this.isAllowed(url)) {
      throw new Error("The video could not be retrieved.");
    }
    return fetch(url);
  }

  /**
   * The one output shape this provider accepts.
   *
   * A worker could return anything; only `{ video_url }` over https, on a host
   * this deployment has allow-listed, is treated as a result. Everything else
   * — a data URI, a file path, an http URL, a link-local address, a host we do
   * not know — reads as no output at all, which fails the job and releases the
   * reservation rather than handing a user something unverified.
   */
  private videoUrlFrom(output: unknown): string | null {
    if (!output || typeof output !== "object") return null;
    const candidate = (output as Record<string, unknown>).video_url;
    if (typeof candidate !== "string" || !candidate) return null;
    return this.isAllowed(candidate) ? candidate : null;
  }

  private isAllowed(raw: string): boolean {
    let url: URL;
    try { url = new URL(raw); } catch { return false; }
    if (url.protocol !== "https:") return false;
    // An empty allowlist means nothing is accepted. Failing closed is right
    // here: an unconfigured deployment should not fetch arbitrary hosts.
    return this.allowedHosts.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
  }
}

//
// "auto" (the client default) is Luma: since 2026-09-24 it is the only
// provider that can serve a request. OpenAI Sora is retired and refused by
// name, so a template saved against it gets a sentence instead of a 404.

function getProvider(name?: string): VideoProvider {
  const lumaKey   = Deno.env.get("LUMA_API_KEY");

  let requested = name && name !== "auto" ? name : "";
  // "auto" never resolves to RunPod. It is chosen explicitly or not at all:
  // an execution target that can be selected by default is one that starts
  // serving traffic the day its key is added, which is the opposite of a
  // staged rollout.
  if (!requested) requested = "luma";

  if (requested === "runpod") {
    // Configuration comes from the server, never from the caller. The client
    // may ask for the RunPod *provider*; it may not say which endpoint, which
    // hosts are trusted, or what the timeout is.
    const endpointId = Deno.env.get("RUNPOD_VIDEO_ENDPOINT_ID") ?? null;
    const readiness  = runpodReadiness(endpointId);
    if (!readiness.ready) {
      // The normalized sentence, not the reason. "Disabled" and "not
      // configured" are different to an operator and identical to a user.
      throw new Error(readiness.reason?.message ?? "This service is not available yet.");
    }
    const allowedHosts = (Deno.env.get("RUNPOD_VIDEO_ASSET_HOSTS") ?? "")
      .split(",").map((h) => h.trim()).filter(Boolean);
    return new RunPodVideoProvider(
      runpodAdapter({ endpointId: endpointId!, apiKey: Deno.env.get("RUNPOD_API_KEY")! }),
      allowedHosts,
    );
  }

  if (requested === "openai") {
    throw new Error("OpenAI Sora was retired on 2026-09-24. Video runs on Luma (LUMA_API_KEY).");
  }

  if (requested === "luma") {
    if (!lumaKey) {
      throw new Error(
        "LUMA_API_KEY is not configured in Supabase Edge Function secrets. " +
        "Add it in Project Settings → Edge Functions → Secrets."
      );
    }
    return new LumaProvider(lumaKey);
  }

  // Add more providers here: RunwayML, Kling, Pika, Veo, etc.
  throw new Error(`Unknown video provider: "${requested}". Supported: luma, runpod`);
}

// ── Provider registry recording (Phase 2J-0) ────────────────────────────────
//
// Recording only. The provider was already chosen by getProvider() from the
// environment; this writes what it then did, against its registry row, so the
// registry finally sees the vendor serving production video. Nothing here is
// read back to choose anything. Best-effort: recordProviderOutcome never
// throws, and only short codes are written — never the prompt, a URL or a
// provider's own sentence.
async function recordVideoOutcome(
  dbService: SupabaseClient,
  providerName: string,
  outcome: { success: boolean; ms: number; error?: string },
): Promise<void> {
  const slug = VIDEO_PROVIDER_SLUG[providerName];
  if (!slug) return;
  await recordProviderOutcome(dbService, slug, "text_to_video", outcome);
}

// ── Registry shadow mode (Phase 2J-2) ──────────────────────────────────────
//
// Off unless PROVIDER_REGISTRY_SHADOW=true. When on, an "auto" request also
// asks, after its job exists and in the background, what the registry would
// have chosen — and writes that down beside what getProvider() actually chose.
// Nothing here is awaited or read back: the provider, the request sent to it,
// the response and the job are exactly what they would be with it off.
function shadowAutoChoice(
  dbService: SupabaseClient,
  actualProvider: string,
  jobId: string,
): void {
  if (!shadowEnabled()) return;
  try {
    const observation = observeShadow(dbService, {
      service:       "video-studio",
      jobType:       "text_to_video",
      routingMode:   "auto",
      actualSlug:    VIDEO_PROVIDER_SLUG[actualProvider] ?? null,
      correlationId: jobId,
    }).catch(() => undefined);
    (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(observation);
  } catch {
    // Telemetry never reaches the request.
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleGenerate(
  body: Record<string, unknown>,
  userId: string,
  db: SupabaseClient,
  dbService: SupabaseClient,
): Promise<Response> {
  const {
    prompt, negative_prompt, style, duration_sec, aspect_ratio,
    resolution, fps, camera_motion, creativity, seed, project_id,
    audio_asset_id, audio_mode, template_id, provider: providerName,
    provider_model, title,
  } = body as Record<string, unknown>;

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return jsonError("Prompt is required", 400);
  }
  // Bounded before it reaches a provider (Phase 2F-3).
  if (prompt.length > 4000 || (typeof negative_prompt === "string" && negative_prompt.length > 2000)) {
    return jsonError("The prompt is too long. Please shorten it and try again.", 400);
  }

  // Resolve the provider before touching the DB — fail fast with a clear
  // "not configured" message instead of creating a job that can never succeed.
  let provider: VideoProvider;
  try {
    provider = getProvider((providerName as string) || "auto");
  } catch (err) {
    // Which provider, which secret and the caller's own provider string stay
    // in the log; the caller is told only that video is unavailable (Phase 2F-3).
    return jsonError(publicMediaFailure(err, "video", "video-studio"), 503);
  }

  // A model saved against a different provider (e.g. a template built on Luma)
  // must not leak through to the provider actually running the job.
  // Templates saved before 2026-09-24 still name sora-2; those, and anything
  // else Luma does not offer, run on ray-2.
  const requestedModel = typeof provider_model === "string" ? provider_model.trim() : "";
  const resolvedModel  = provider.name === "luma"
    ? lumaRequestShape({ model: requestedModel, durationSec: 5, resolution: "720p" }).model
    : requestedModel || "default";

  // Create job record
  const { data: job, error: jobErr } = await (db as any)
    .from("vx_video_jobs")
    .insert({
      user_id:         userId,
      project_id:      project_id ?? null,
      title:           title ?? null,
      prompt:          (prompt as string).trim(),
      negative_prompt: negative_prompt ?? null,
      style:           style ?? "realistic",
      duration_sec:    duration_sec ?? 5,
      aspect_ratio:    aspect_ratio ?? "16:9",
      resolution:      resolution ?? "720p",
      fps:             fps ?? 24,
      camera_motion:   camera_motion ?? "static",
      creativity:      creativity ?? 5.0,
      seed:            seed ?? null,
      audio_asset_id:  audio_asset_id ?? null,
      audio_mode:      audio_mode ?? "none",
      template_id:     template_id ?? null,
      provider:        provider.name,
      provider_model:  resolvedModel,
      status:          "preparing",
      progress:        5,
    })
    .select()
    .single();

  if (jobErr) {
    // The database's own wording stays in the log (Phase 2J-0): it named a
    // table, a column or a constraint to whoever sent the request.
    console.error("[video-studio] job insert failed:", (jobErr as any)?.code ?? "unknown", (jobErr as any)?.message ?? "");
    return jsonError("The video job could not be started. Please try again later.", 500);
  }

  // Increment template use_count if used
  if (template_id) {
    await (db as any).rpc("vx_use_template", { p_template_id: template_id });
  }

  // Observation only, in the background; see shadowAutoChoice.
  if (!providerName || providerName === "auto") shadowAutoChoice(dbService, provider.name, job.id);

  // Submit to provider
  const submitStarted = Date.now();
  const result = await provider.generateVideo({
    prompt:          job.prompt,
    negativePrompt:  job.negative_prompt ?? undefined,
    style:           job.style,
    durationSec:     job.duration_sec,
    aspectRatio:     job.aspect_ratio,
    resolution:      job.resolution,
    fps:             job.fps,
    cameraMotion:    job.camera_motion,
    creativity:      job.creativity,
    seed:            job.seed ?? undefined,
    model:           job.provider_model,
    idempotencyKey:  job.id,
  });

  if (!result.ok) {
    await recordVideoOutcome(dbService, provider.name, {
      success: false, ms: Date.now() - submitStarted, error: "submit_rejected",
    });
    const failure = publicMediaFailure(result.error, "video", "video-studio");
    await (db as any).from("vx_video_jobs").update({
      status: "failed", error_message: failure,
    }).eq("id", job.id);
    return json({ ok: false, job_id: job.id, error: failure });
  }

  // Update with provider job ID
  const estimatedComplete = new Date(Date.now() + 120_000).toISOString(); // +2 min estimate
  await (db as any).from("vx_video_jobs").update({
    status:           "generating",
    progress:         10,
    provider_job_id:  result.providerJobId,
    started_at:       new Date().toISOString(),
    estimated_complete: estimatedComplete,
  }).eq("id", job.id);

  // The vendor's own job id is internal plumbing — _shared/providers/compute.ts's
  // ComputeJob deliberately keeps it out of any response a browser receives.
  // This older, pre-RunPod path returned it anyway; brought in line here.
  return json({ ok: true, job_id: job.id });
}

async function handlePoll(
  body: Record<string, unknown>,
  userId: string,
  db: SupabaseClient,
  dbService: SupabaseClient
): Promise<Response> {
  const { job_id } = body as { job_id: string };
  if (!job_id) return jsonError("job_id required", 400);

  const { data: job, error } = await (db as any)
    .from("vx_video_jobs")
    .select("*")
    .eq("id", job_id)
    .eq("user_id", userId)
    .single();

  if (error || !job) return jsonError("Job not found", 404);
  if (!["generating", "preparing", "rendering", "optimizing"].includes(job.status)) {
    return json({ ok: true, status: job.status, progress: job.progress, video_url: job.video_url });
  }
  if (!job.provider_job_id) return json({ ok: true, status: job.status, progress: job.progress });

  let provider: VideoProvider;
  try {
    provider = getProvider(job.provider);
  } catch (err) {
    const msg = publicMediaFailure(err, "video", "video-studio");
    await (db as any).from("vx_video_jobs").update({
      status: "failed", error_message: msg, completed_at: new Date().toISOString(),
    }).eq("id", job_id);
    return json({ ok: true, status: "failed", error: msg });
  }
  const pollResult = await provider.pollJob(job.provider_job_id);

  if (!pollResult.ok || pollResult.state === "failed") {
    await recordVideoOutcome(dbService, provider.name, {
      success: false,
      ms: job.started_at ? Date.now() - new Date(job.started_at).getTime() : 0,
      error: "generation_failed",
    });
    const failure = publicMediaFailure(pollResult.error, "video", "video-studio");
    await (db as any).from("vx_video_jobs").update({
      status:        "failed",
      error_message: failure,
      completed_at:  new Date().toISOString(),
    }).eq("id", job_id);
    return json({ ok: true, status: "failed", error: failure });
  }

  if (pollResult.state === "completed" && pollResult.videoUrl) {
    // Download and store in Supabase Storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const startTime   = job.started_at ? new Date(job.started_at).getTime() : Date.now();
    const genTime     = Date.now() - startTime;

    // The provider produced the video; whether storing it then works is ours.
    await recordVideoOutcome(dbService, provider.name, { success: true, ms: genTime });

    let storagePath: string | null = null;
    let thumbPath: string | null   = null;
    let fileSize                   = 0;

    // Attempt to download and re-upload to our storage
    try {
      await (db as any).from("vx_video_jobs").update({
        status: "uploading", progress: 90,
      }).eq("id", job_id);

      // fetchAsset attaches provider auth where the download needs it.
      const videoRes = await provider.fetchAsset(pollResult.videoUrl);
      if (videoRes.ok) {
        const videoBlob = await videoRes.blob();
        fileSize        = videoBlob.size;
        const ext       = "mp4";
        storagePath     = `${userId}/${job_id}/video.${ext}`;

        const dbS = createClient(supabaseUrl, serviceKey);
        const { error: uploadErr } = await (dbS as any).storage
          .from("video-outputs")
          .upload(storagePath, videoBlob, {
            contentType: "video/mp4",
            upsert:      true,
          });
        if (uploadErr) {
          console.error("Video upload error:", uploadErr.message);
          storagePath = null;
        }

        // Thumbnail if available
        if (storagePath && pollResult.thumbnailUrl) {
          const thumbRes = await provider.fetchAsset(pollResult.thumbnailUrl);
          if (thumbRes.ok) {
            const thumbBlob = await thumbRes.blob();
            const thumbMime = pollResult.thumbnailMime ?? "image/jpeg";
            const thumbExt  = thumbMime === "image/webp" ? "webp" : "jpg";
            thumbPath = `${userId}/${job_id}/thumb.${thumbExt}`;
            const { error: thumbErr } = await (dbS as any).storage
              .from("video-outputs")
              .upload(thumbPath, thumbBlob, { contentType: thumbMime, upsert: true });
            if (thumbErr) thumbPath = null;
          }
        }
      }
    } catch (_e) {
      console.error("Video download/upload failed:", _e);
      storagePath = null;
    }

    // Providers with private assets (OpenAI) hand us URLs that need our API key
    // and expire within the hour, so there is no usable fallback URL to store.
    // Fail loudly instead of saving a link that 401s in the user's browser.
    if (!storagePath && !provider.publicAssetUrls) {
      const msg = "The video was generated but could not be saved to storage. " +
                  "Check the 'video-outputs' bucket and try again.";
      await (db as any).from("vx_video_jobs").update({
        status: "failed", error_message: msg, completed_at: new Date().toISOString(),
      }).eq("id", job_id);
      return json({ ok: true, status: "failed", error: msg });
    }

    // Create asset record
    let assetId: string | null = null;
    try {
      const title    = job.title ?? `Video — ${new Date().toLocaleDateString()}`;
      const filename = `video_${job_id.slice(0, 8)}.mp4`;
      const { data: asset, error: assetErr } = await (dbService as any)
        .from("ams_assets")
        .insert({
          owner_id:      userId,
          project_id:    job.project_id ?? null,
          filename,
          original_name: title,
          asset_type:    "video",
          status:        "ready",
          storage_path:  storagePath ?? null,
          public_url:    storagePath ? null : pollResult.videoUrl,
          size_bytes:    fileSize,
          mime_type:     "video/mp4",
          metadata: {
            prompt:       job.prompt,
            style:        job.style,
            duration_sec: job.duration_sec,
            aspect_ratio: job.aspect_ratio,
            resolution:   job.resolution,
            provider:     job.provider,
            video_job_id: job_id,
          },
        })
        .select("id")
        .single();
      if (assetErr) console.error("Asset insert error:", assetErr.message);
      assetId = asset?.id ?? null;
    } catch (_e) {
      console.error("Asset creation failed (non-critical):", _e);
    }

    await (db as any).from("vx_video_jobs").update({
      status:           "completed",
      progress:         100,
      storage_path:     storagePath,
      video_url:        storagePath ? null : pollResult.videoUrl,  // use provider URL if no storage
      thumbnail_url:    pollResult.thumbnailUrl ?? null,
      thumbnail_path:   thumbPath,
      file_size_bytes:  fileSize || null,
      asset_id:         assetId,
      completed_at:     new Date().toISOString(),
      generation_time_ms: genTime,
    }).eq("id", job_id);

    return json({
      ok: true,
      status:       "completed",
      progress:     100,
      video_url:    storagePath ? null : pollResult.videoUrl,
      storage_path: storagePath,
      asset_id:     assetId,
    });
  }

  // Still in progress
  const newStatus = pollResult.state === "processing" ? "rendering" : "generating";
  const progress  = Math.max(job.progress, pollResult.progress ?? 50);
  await (db as any).from("vx_video_jobs").update({
    status: newStatus, progress,
  }).eq("id", job_id);

  return json({ ok: true, status: newStatus, progress });
}

async function handleCancel(
  body: Record<string, unknown>,
  userId: string,
  db: SupabaseClient
): Promise<Response> {
  const { job_id } = body as { job_id: string };

  const { data: job } = await (db as any)
    .from("vx_video_jobs")
    .select("provider, provider_job_id, status")
    .eq("id", job_id)
    .eq("user_id", userId)
    .single();

  if (job?.provider_job_id) {
    try {
      const provider = getProvider(job.provider);
      await provider.cancelJob(job.provider_job_id);
    } catch {
      // Best-effort — cancellation should never block marking the job cancelled below.
    }
  }

  await (db as any).from("vx_video_jobs")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", job_id)
    .eq("user_id", userId);

  return json({ ok: true });
}

async function handleDelete(
  body: Record<string, unknown>,
  userId: string,
  db: SupabaseClient
): Promise<Response> {
  const { job_id } = body as { job_id: string };

  const { data: job } = await (db as any)
    .from("vx_video_jobs")
    .select("storage_path, thumbnail_path")
    .eq("id", job_id)
    .eq("user_id", userId)
    .single();

  // Remove storage files
  if (job?.storage_path || job?.thumbnail_path) {
    const paths = [job.storage_path, job.thumbnail_path].filter(Boolean);
    await (db as any).storage.from("video-outputs").remove(paths);
  }

  await (db as any).from("vx_video_jobs").delete().eq("id", job_id).eq("user_id", userId);
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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonError("Unauthorized", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const db        = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const dbService = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: authErr } = await db.auth.getUser();
  if (authErr || !user) return jsonError("Unauthorized", 401);

  // Signed in is not entitled. The AI Media Studio is a Business section,
  // and a valid session on any plan reached this generator until now. Asked
  // before the body is read, so an unentitled caller cannot spend a provider
  // call, a VX reservation or a job row on the way to being refused.
  const entitled = await maySeeSection(dbService, user.id, "mediaStudio");
  if (!entitled.allowed) return sectionRefusal("mediaStudio", entitled.unavailable);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }

  const action = body.action as string;

  switch (action) {
    case "generate": {
      // Only submitting a job is charged against the daily ceiling — the most
      // expensive thing Visionex submits. Poll, cancel and delete are free
      // (Phase 2F-2).
      const limited = await chargeDailyLimit(dbService, user.id, "video-studio", CORS);
      if (limited) return limited;
      return handleGenerate(body, user.id, db, dbService);
    }
    case "poll":     return handlePoll(body, user.id, db, dbService);
    case "cancel":   return handleCancel(body, user.id, db);
    case "delete":   return handleDelete(body, user.id, db);
    default:         return jsonError(`Unknown action: ${action}`, 400);
  }
});
