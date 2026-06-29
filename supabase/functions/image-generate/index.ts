/**
 * image-generate — AI Media Studio Image Studio generation endpoint
 *
 * Provider: OpenAI DALL·E 3 (reuses existing OPENAI_API_KEY)
 * Auth: user-jwt required
 * Returns: JSON { ok, job_id, asset_id, image_url, revised_prompt, width, height }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
function jsonError(message: string, status = 500, code?: string): Response {
  return json({ ok: false, error: message, code }, status);
}

// ── DALL·E Provider ───────────────────────────────────────────────────────────

interface ImageGenerateParams {
  prompt:      string;
  model:       "dall-e-3" | "dall-e-2";
  size:        "1024x1024" | "1024x1792" | "1792x1024" | "512x512" | "256x256";
  quality:     "standard" | "hd";
  style:       "vivid" | "natural";
  n:           number;
}

interface ImageGenerateResult {
  ok:            boolean;
  imageUrl?:     string;
  revisedPrompt?: string;
  error?:        string;
}

async function generateWithDALLE(params: ImageGenerateParams): Promise<ImageGenerateResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return {
      ok:    false,
      error: "OPENAI_API_KEY not configured in Supabase Edge Function secrets. Contact the administrator.",
    };
  }

  const body: Record<string, unknown> = {
    model:   params.model,
    prompt:  params.prompt,
    n:       params.n,
    size:    params.size,
    quality: params.quality,
    style:   params.style,
    response_format: "url",
  };

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message ?? detail;
    } catch { /* ignore */ }

    const statusMap: Record<number, string> = {
      400: `Invalid request: ${detail}`,
      401: "OPENAI_API_KEY is invalid or revoked. Update the secret in Supabase dashboard.",
      403: "OpenAI API key lacks permission for image generation.",
      429: "OpenAI rate limit reached. Please wait a moment and try again.",
      500: "OpenAI service error — please retry in a few seconds.",
      503: "OpenAI is temporarily unavailable. Please retry shortly.",
    };
    return { ok: false, error: statusMap[res.status] ?? `OpenAI DALL·E error (${res.status}): ${detail}` };
  }

  const data = await res.json();
  const image = data.data?.[0];
  if (!image?.url) {
    return { ok: false, error: "OpenAI returned no image URL. The prompt may have been rejected by content policy." };
  }

  return {
    ok:            true,
    imageUrl:      image.url,
    revisedPrompt: image.revised_prompt ?? params.prompt,
  };
}

// ── Request interface ─────────────────────────────────────────────────────────

interface RequestBody {
  prompt:       string;
  model?:       "dall-e-3" | "dall-e-2";
  size?:        "1024x1024" | "1024x1792" | "1792x1024" | "512x512" | "256x256";
  quality?:     "standard" | "hd";
  style?:       "vivid" | "natural";
  project_id?:  string;
  preset_id?:   string;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader)  return jsonError("Unauthorized: No authorization header provided.", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient    = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return jsonError("Unauthorized: Invalid or expired session. Please sign in again.", 401);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const {
    prompt,
    model      = "dall-e-3",
    size       = "1024x1024",
    quality    = "standard",
    style      = "vivid",
    project_id,
  } = body;

  if (!prompt?.trim())           return jsonError("prompt is required", 400);
  if (prompt.trim().length < 3)  return jsonError("Prompt must be at least 3 characters", 400);
  if (prompt.length > 4000)      return jsonError("Prompt exceeds 4000 character limit", 400);

  // Validate size for DALL-E 3 (different allowed sizes than DALL-E 2)
  const dalle3Sizes = ["1024x1024", "1024x1792", "1792x1024"];
  if (model === "dall-e-3" && !dalle3Sizes.includes(size)) {
    return jsonError(`Invalid size '${size}' for DALL·E 3. Allowed: ${dalle3Sizes.join(", ")}`, 400);
  }

  // Create job record in DB
  const { data: jobRow, error: jobErr } = await serviceClient
    .from("ams_image_jobs")
    .insert({
      user_id:    user.id,
      project_id: project_id ?? null,
      prompt:     prompt.trim(),
      model,
      size,
      quality,
      style,
      status:     "processing",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  // If table doesn't exist yet, still proceed with generation
  // (graceful degradation — job record is best-effort)
  const jobId: string = jobRow?.id ?? crypto.randomUUID();
  if (jobErr) {
    const detail = jobErr.message ?? "";
    if (!detail.includes("does not exist")) {
      console.error("Image job insert failed:", detail);
    }
  }

  // Generate the image
  try {
    const result = await generateWithDALLE({
      prompt:  prompt.trim(),
      model:   model as "dall-e-3" | "dall-e-2",
      size:    size as ImageGenerateParams["size"],
      quality: quality as "standard" | "hd",
      style:   style as "vivid" | "natural",
      n:       1,
    });

    if (!result.ok) {
      if (jobRow) {
        await serviceClient.from("ams_image_jobs").update({
          status:        "failed",
          error_message: result.error,
          completed_at:  new Date().toISOString(),
        }).eq("id", jobId);
      }
      return json({ ok: false, error: result.error, job_id: jobId }, 500);
    }

    // Parse dimensions from size string
    const [widthStr, heightStr] = size.split("x");
    const width  = parseInt(widthStr ?? "1024", 10);
    const height = parseInt(heightStr ?? "1024", 10);

    // Create asset record (best-effort)
    let assetId: string | null = null;
    try {
      const filename = `image_${jobId.slice(0, 8)}.png`;
      const { data: assetRow } = await serviceClient
        .from("ams_assets")
        .insert({
          owner_id:      user.id,
          project_id:    project_id ?? null,
          filename,
          original_name: filename,
          asset_type:    "image",
          mime_type:     "image/png",
          size_bytes:    0,
          public_url:    result.imageUrl!,
          status:        "ready",
          metadata: {
            source:         "image-studio",
            prompt:         prompt.trim(),
            revised_prompt: result.revisedPrompt,
            model,
            size,
            quality,
            style,
            job_id:         jobId,
          },
        })
        .select("id")
        .single();
      assetId = assetRow?.id ?? null;
    } catch { /* non-critical */ }

    // Complete job record (best-effort)
    if (jobRow) {
      await serviceClient.from("ams_image_jobs").update({
        status:         "completed",
        image_url:      result.imageUrl,
        revised_prompt: result.revisedPrompt,
        asset_id:       assetId,
        width,
        height,
        completed_at:   new Date().toISOString(),
      }).eq("id", jobId);
    }

    return json({
      ok:             true,
      job_id:         jobId,
      asset_id:       assetId,
      image_url:      result.imageUrl,
      revised_prompt: result.revisedPrompt,
      width,
      height,
      model,
      size,
      quality,
      style,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Image generation failed unexpectedly";
    console.error("Image generation error:", msg);
    if (jobRow) {
      await serviceClient.from("ams_image_jobs").update({
        status:        "failed",
        error_message: msg,
        completed_at:  new Date().toISOString(),
      }).eq("id", jobId);
    }
    return json({ ok: false, error: msg, job_id: jobId }, 500);
  }
});
