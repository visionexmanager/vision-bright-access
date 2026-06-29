// Video Studio edge function
// Provider-abstracted text-to-video generation
// Actions: generate | poll | cancel | delete

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Provider interface ─────────────────────────────────────────────────────────

interface VideoGenerateParams {
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
  error?:        string;
}

interface VideoProvider {
  name:           string;
  generateVideo(params: VideoGenerateParams): Promise<VideoGenerateResult>;
  pollJob(providerJobId: string): Promise<VideoPollResult>;
  cancelJob(providerJobId: string): Promise<void>;
}

// ── Luma Dream Machine Provider ───────────────────────────────────────────────

class LumaProvider implements VideoProvider {
  name = "luma";
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
      "4:3":  "4:3",  "3:4":  "3:4",  "21:9": "21:9",
    };
    const aspect = aspectMap[params.aspectRatio] ?? "16:9";

    // Build prompt with style prefix if not realistic
    let prompt = params.prompt;
    if (params.style && params.style !== "realistic" && params.style !== "custom") {
      prompt = `${params.style} style: ${prompt}`;
    }
    if (params.cameraMotion && params.cameraMotion !== "static") {
      const motionMap: Record<string, string> = {
        pan_left: "camera panning left", pan_right: "camera panning right",
        zoom_in: "camera zooming in", zoom_out: "camera zooming out",
        tilt_up: "camera tilting up", tilt_down: "camera tilting down",
        orbit: "camera orbiting", dolly_in: "camera dolly in", dolly_out: "camera dolly out",
      };
      prompt += `, ${motionMap[params.cameraMotion] ?? ""}`;
    }

    const body: Record<string, unknown> = {
      prompt,
      aspect_ratio: aspect,
      loop: false,
    };

    if (params.negativePrompt) {
      // Luma doesn't support negative prompts directly, we append "avoid: ..."
      body.prompt = `${prompt}. Avoid: ${params.negativePrompt}`;
    }

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
        thumbnailUrl: null,
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
}

// ── Mock Provider ─────────────────────────────────────────────────────────────

class MockVideoProvider implements VideoProvider {
  name = "mock";

  async generateVideo(_params: VideoGenerateParams): Promise<VideoGenerateResult> {
    // Return a fake job ID — polling will simulate progress
    const mockId = `mock-${crypto.randomUUID()}`;
    return { ok: true, providerJobId: mockId };
  }

  async pollJob(providerJobId: string): Promise<VideoPollResult> {
    // Check how many times we've been polled by reading DB job created_at
    // For simplicity: simulate completion after ~15 seconds
    const mockVideoUrl =
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
    const mockThumb =
      "https://peach.blender.org/wp-content/uploads/bbb-splash.png";

    // We'll signal completion on every poll for demo purposes
    // In production this would check real provider state
    return {
      ok: true,
      state: "completed",
      progress: 100,
      videoUrl: mockVideoUrl,
      thumbnailUrl: mockThumb,
    };
  }

  async cancelJob(_providerJobId: string): Promise<void> { /* no-op */ }
}

// ── Provider factory ──────────────────────────────────────────────────────────

function getProvider(name?: string): VideoProvider {
  const lumaKey = Deno.env.get("LUMA_API_KEY");
  if (name === "luma" && lumaKey) return new LumaProvider(lumaKey);
  // Add more providers here: RunwayML, Kling, Pika, Sora, etc.
  return new MockVideoProvider();
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleGenerate(
  body: Record<string, unknown>,
  userId: string,
  db: ReturnType<typeof createClient>
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

  const provider = getProvider(providerName as string ?? "luma");

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
      provider_model:  provider_model ?? "dream-machine",
      status:          "preparing",
      progress:        5,
    })
    .select()
    .single();

  if (jobErr) {
    const detail = (jobErr as any)?.message ?? "unknown";
    const msg = detail.includes("does not exist")
      ? "Database table 'vx_video_jobs' not found. Run Supabase migrations to set up the Video Studio schema."
      : `Failed to create video job: ${detail}`;
    return jsonError(msg, 500);
  }

  // Increment template use_count if used
  if (template_id) {
    await (db as any).rpc("vx_use_template", { p_template_id: template_id });
  }

  // Submit to provider
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
  });

  if (!result.ok) {
    await (db as any).from("vx_video_jobs").update({
      status: "failed", error_message: result.error,
    }).eq("id", job.id);
    return json({ ok: false, job_id: job.id, error: result.error });
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

  return json({ ok: true, job_id: job.id, provider_job_id: result.providerJobId });
}

async function handlePoll(
  body: Record<string, unknown>,
  userId: string,
  db: ReturnType<typeof createClient>,
  dbService: ReturnType<typeof createClient>
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

  const provider = getProvider(job.provider);
  const pollResult = await provider.pollJob(job.provider_job_id);

  if (!pollResult.ok || pollResult.state === "failed") {
    await (db as any).from("vx_video_jobs").update({
      status:        "failed",
      error_message: pollResult.error ?? "Provider reported failure",
      completed_at:  new Date().toISOString(),
    }).eq("id", job_id);
    return json({ ok: true, status: "failed", error: pollResult.error });
  }

  if (pollResult.state === "completed" && pollResult.videoUrl) {
    // Download and store in Supabase Storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const startTime   = job.started_at ? new Date(job.started_at).getTime() : Date.now();
    const genTime     = Date.now() - startTime;

    let storagePath: string | null = null;
    let thumbPath: string | null   = null;
    let fileSize                   = 0;

    // Attempt to download and re-upload to our storage
    try {
      await (db as any).from("vx_video_jobs").update({
        status: "uploading", progress: 90,
      }).eq("id", job_id);

      const videoRes = await fetch(pollResult.videoUrl);
      if (videoRes.ok) {
        const videoBlob = await videoRes.blob();
        fileSize        = videoBlob.size;
        const ext       = "mp4";
        storagePath     = `${userId}/${job_id}/video.${ext}`;

        const dbS = createClient(supabaseUrl, serviceKey);
        await (dbS as any).storage.from("video-outputs").upload(storagePath, videoBlob, {
          contentType: "video/mp4",
          upsert:      true,
        });

        // Thumbnail if available
        if (pollResult.thumbnailUrl) {
          const thumbRes = await fetch(pollResult.thumbnailUrl);
          if (thumbRes.ok) {
            const thumbBlob = await thumbRes.blob();
            thumbPath = `${userId}/${job_id}/thumb.jpg`;
            await (dbS as any).storage.from("video-outputs").upload(thumbPath, thumbBlob, {
              contentType: "image/jpeg",
              upsert:      true,
            });
          }
        }
      }
    } catch (_e) {
      // Storage upload failed — still mark complete with provider URL
      storagePath = null;
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
  db: ReturnType<typeof createClient>
): Promise<Response> {
  const { job_id } = body as { job_id: string };

  const { data: job } = await (db as any)
    .from("vx_video_jobs")
    .select("provider, provider_job_id, status")
    .eq("id", job_id)
    .eq("user_id", userId)
    .single();

  if (job?.provider_job_id) {
    const provider = getProvider(job.provider);
    await provider.cancelJob(job.provider_job_id).catch(() => null);
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
  db: ReturnType<typeof createClient>
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

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }

  const action = body.action as string;

  switch (action) {
    case "generate": return handleGenerate(body, user.id, db);
    case "poll":     return handlePoll(body, user.id, db, dbService);
    case "cancel":   return handleCancel(body, user.id, db);
    case "delete":   return handleDelete(body, user.id, db);
    default:         return jsonError(`Unknown action: ${action}`, 400);
  }
});
