/**
 * image-tools-generate — AI Media Studio Image Studio extension
 * Covers: Image-to-Image, AI Upscaler, Background Remover, Image Restoration, AI Avatar.
 * (Text-to-Image stays on image-generate/DALL·E; this function is Replicate-backed.)
 *
 * Provider: Replicate (REPLICATE_API_TOKEN)
 * Auth: user-jwt required
 * Actions: generate | poll (predictions are async — mirrors the video-studio pattern)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

type ImageMode = "img2img" | "upscale" | "bg-remove" | "restore" | "avatar";

// Replicate's "official model" endpoint always runs that model's latest
// version, so no version hash needs to be pinned/maintained here.
const MODEL_PATH: Record<ImageMode, string> = {
  "img2img":   "stability-ai/sdxl",
  "upscale":   "nightmareai/real-esrgan",
  "bg-remove": "851-labs/background-remover",
  "restore":   "tencentarc/gfpgan",
  "avatar":    "stability-ai/sdxl", // avatar = img2img with a stylized prompt
};

function buildReplicateInput(mode: ImageMode, imageUrl: string, prompt: string | undefined): Record<string, unknown> {
  switch (mode) {
    case "img2img":
      return { image: imageUrl, prompt: prompt || "enhance this image, high quality", strength: 0.65 };
    case "avatar":
      return {
        image: imageUrl,
        prompt: prompt
          ? `${prompt}, portrait avatar, high quality digital art`
          : "professional stylized portrait avatar, high quality digital art",
        strength: 0.55,
      };
    case "upscale":
      return { image: imageUrl, scale: 4, face_enhance: true };
    case "bg-remove":
      return { image: imageUrl };
    case "restore":
      return { img: imageUrl, version: "v1.4", scale: 2 };
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function createPrediction(mode: ImageMode, imageUrl: string, prompt: string | undefined): Promise<{ ok: boolean; predictionId?: string; error?: string }> {
  const apiKey = Deno.env.get("REPLICATE_API_TOKEN");
  if (!apiKey) {
    return {
      ok: false,
      error: `REPLICATE_API_TOKEN is not configured in Supabase Edge Function secrets. ` +
        `${mode === "img2img" ? "Image-to-Image" : mode === "upscale" ? "AI Upscaler" : mode === "bg-remove" ? "Background Remover" : mode === "restore" ? "Image Restoration" : "AI Avatar"} requires a Replicate API token — add it in Project Settings → Edge Functions → Secrets.`,
    };
  }

  const res = await fetch(`https://api.replicate.com/v1/models/${MODEL_PATH[mode]}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Prefer: "wait=0", // return immediately with a prediction id; we poll separately
    },
    body: JSON.stringify({ input: buildReplicateInput(mode, imageUrl, prompt) }),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      detail = errJson?.detail ?? errJson?.title ?? detail;
    } catch { /* ignore */ }
    const statusMap: Record<number, string> = {
      401: "REPLICATE_API_TOKEN is invalid or revoked. Update the secret in Supabase dashboard.",
      402: "Replicate account has insufficient credit. Check your Replicate billing.",
      422: `Invalid input for this model: ${detail}`,
      429: "Replicate rate limit reached. Please wait a moment and try again.",
    };
    return { ok: false, error: statusMap[res.status] ?? `Replicate error (${res.status}): ${detail}` };
  }

  const data = await res.json();
  return { ok: true, predictionId: data.id };
}

async function pollPrediction(predictionId: string): Promise<{ ok: boolean; status: string; outputUrl?: string; error?: string }> {
  const apiKey = Deno.env.get("REPLICATE_API_TOKEN");
  if (!apiKey) return { ok: false, status: "failed", error: "REPLICATE_API_TOKEN is not configured." };

  const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return { ok: false, status: "failed", error: `Replicate poll error (HTTP ${res.status})` };

  const data = await res.json();
  const status = data.status as string; // starting | processing | succeeded | failed | canceled

  if (status === "succeeded") {
    const output = Array.isArray(data.output) ? data.output[0] : data.output;
    if (!output || typeof output !== "string") {
      return { ok: false, status: "failed", error: "Replicate returned no output image." };
    }
    return { ok: true, status: "succeeded", outputUrl: output };
  }
  if (status === "failed" || status === "canceled") {
    return { ok: false, status, error: data.error ? String(data.error) : `Replicate prediction ${status}` };
  }
  return { ok: true, status };
}

interface GenerateBody {
  action:      "generate";
  mode:        ImageMode;
  image_url:   string;      // source image (already uploaded, e.g. a Supabase Storage public URL)
  prompt?:     string;
  project_id?: string;
}
interface PollBody {
  action: "poll";
  job_id: string;
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient    = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  let body: GenerateBody | PollBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // ── Poll an existing job ──────────────────────────────────────────────────
  if (body.action === "poll") {
    const { job_id } = body;
    const { data: jobRow, error } = await serviceClient
      .from("ams_image_jobs")
      .select("*")
      .eq("id", job_id)
      .eq("user_id", user.id)
      .single();
    if (error || !jobRow) return json({ error: "Job not found" }, 404);

    if (jobRow.status === "completed" || jobRow.status === "failed") {
      return json({ ok: true, status: jobRow.status, image_url: jobRow.image_url, error: jobRow.error_message });
    }
    if (!jobRow.provider_job_id) {
      return json({ ok: true, status: jobRow.status });
    }

    const poll = await pollPrediction(jobRow.provider_job_id);
    if (!poll.ok) {
      await serviceClient.from("ams_image_jobs").update({
        status: "failed", error_message: poll.error, completed_at: new Date().toISOString(),
      }).eq("id", job_id);
      return json({ ok: true, status: "failed", error: poll.error });
    }
    if (poll.status === "succeeded" && poll.outputUrl) {
      let assetId: string | null = null;
      try {
        const filename = `image_${job_id.slice(0, 8)}.png`;
        const { data: assetRow } = await serviceClient.from("ams_assets").insert({
          owner_id: user.id, project_id: jobRow.project_id ?? null,
          filename, original_name: filename, asset_type: "image",
          mime_type: "image/png", size_bytes: 0, public_url: poll.outputUrl, status: "ready",
          metadata: { source: "image-studio", mode: jobRow.mode, job_id },
        }).select("id").single();
        assetId = assetRow?.id ?? null;
      } catch { /* non-critical */ }

      await serviceClient.from("ams_image_jobs").update({
        status: "completed", image_url: poll.outputUrl, asset_id: assetId,
        provider_job_id: null, completed_at: new Date().toISOString(),
      }).eq("id", job_id);
      return json({ ok: true, status: "completed", image_url: poll.outputUrl, asset_id: assetId });
    }

    return json({ ok: true, status: "processing" });
  }

  // ── Start a new job ────────────────────────────────────────────────────────
  const { mode, image_url, prompt, project_id } = body;
  const VALID_MODES: ImageMode[] = ["img2img", "upscale", "bg-remove", "restore", "avatar"];
  if (!VALID_MODES.includes(mode)) {
    return json({ error: `Unsupported mode "${mode}". Use one of: ${VALID_MODES.join(", ")}` }, 400);
  }
  if (!image_url?.trim()) return json({ error: "image_url is required (upload the source image first)" }, 400);

  const { data: jobRow, error: jobErr } = await serviceClient
    .from("ams_image_jobs")
    .insert({
      user_id: user.id, project_id: project_id ?? null,
      prompt: prompt ?? null, mode, source_image_url: image_url,
      provider: "replicate", status: "processing", started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (jobErr || !jobRow) {
    const detail = jobErr?.message ?? "unknown reason";
    const msg = detail.includes("does not exist") || detail.includes("column")
      ? "Database schema for Image Studio tools is out of date. Run the latest Supabase migrations."
      : `Failed to create image job: ${detail}`;
    return json({ error: msg, code: "DB_ERROR" }, 500);
  }
  const jobId: string = jobRow.id;

  const result = await createPrediction(mode, image_url, prompt);
  if (!result.ok) {
    await serviceClient.from("ams_image_jobs").update({
      status: "failed", error_message: result.error, completed_at: new Date().toISOString(),
    }).eq("id", jobId);
    return json({ ok: false, job_id: jobId, error: result.error }, 503);
  }

  await serviceClient.from("ams_image_jobs").update({
    provider_job_id: result.predictionId,
  }).eq("id", jobId);

  return json({ ok: true, job_id: jobId, status: "processing" });
});
