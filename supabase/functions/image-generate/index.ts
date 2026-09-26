/**
 * image-generate — AI Media Studio Image Studio generation endpoint
 *
 * Provider: OpenAI DALL·E 3 (reuses existing OPENAI_API_KEY)
 * Auth: user-jwt required
 * Returns: JSON { ok, job_id, asset_id, image_url, revised_prompt, width, height }
 */

import { createClient } from "npm:@supabase/supabase-js@2";

import { maySeeSection, sectionRefusal } from "../_shared/entitlements.ts";
import { chargeDailyLimit } from "../_shared/aiDailyLimit.ts";
import { providerBySlug, recordResult } from "../_shared/providerRouter.ts";
import { providerRoutableIn } from "../_shared/providerRecording.ts";
import { publicMediaFailure } from "../_shared/providerInput.ts";
import { FalError, falGenerateImage } from "../_shared/providers/fal.ts";

// ── Provider Registry recording (Phase 2D) ─────────────────────────────────
//
// The `openai-image` row Phase 2C seeded. Recording only, mirroring
// speech-generate's recordTtsResult(): the gpt-image-1 -> gpt-image-1-mini
// fallback inside generateImage() below stays exactly as it is. It is a
// same-vendor MODEL fallback (the 20261037000000 migration's own reasoning),
// not a provider choice the registry models — openai-image has one row
// because there is genuinely one vendor here, and recordResult() logs what
// that one vendor actually did without gating whether it ran.
async function recordImageResult(params: { slug?: "openai-image" | "fal-image"; ms: number; success: boolean; errorMessage?: string }): Promise<void> {
  try {
    const row = await providerBySlug(params.slug ?? "openai-image");
    if (!row) return;
    await recordResult({
      provider_id: row.id, provider_slug: row.slug, job_type: "image",
      success: params.success, latency_ms: params.ms, error_message: params.errorMessage,
    });
  } catch {
    // Best-effort. The response to the studio must never depend on this.
  }
}

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

// ── The image provider ────────────────────────────────────────────────────────
//
// This function asked for `dall-e-3` until 2026-09-19, and the account's key
// answers "The model 'dall-e-3' does not exist" — the DALL·E family has been
// retired. Every image the studio tried to make failed with a message that
// read like a configuration mistake, and the fault was a model name.
//
// Two consequences beyond the name. The current models answer in base64 and
// never with a link, so `response_format: "url"` and reading `.url` produced
// nothing even where the call succeeded; and they reject `style` outright,
// which would have turned a fixed model name into a 400.

/** The models this account actually has, in preference order. */
const IMAGE_MODELS = ["gpt-image-1", "gpt-image-1-mini"] as const;

/** The shapes the current family accepts. The DALL·E sizes are not among them. */
const SIZES = ["1024x1024", "1024x1536", "1536x1024"] as const;
type ImageSize = (typeof SIZES)[number];

/**
 * A size the model will accept, from whatever the caller asked for.
 *
 * The studio's buttons still say 1024x1792 and 512x512; rejecting those would
 * break a screen over a vocabulary change nobody outside this file caused.
 * Portrait maps to portrait and landscape to landscape.
 */
function normaliseSize(requested: string): ImageSize {
  if ((SIZES as readonly string[]).includes(requested)) return requested as ImageSize;
  const [w, h] = requested.split("x").map((n) => parseInt(n, 10));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w === h) return "1024x1024";
  return h > w ? "1024x1536" : "1536x1024";
}

/** `standard`/`hd` in the old vocabulary; `low`/`medium`/`high` in the new one. */
function normaliseQuality(requested: string): "medium" | "high" {
  return requested === "hd" || requested === "high" ? "high" : "medium";
}

interface ImageGenerateResult {
  ok:             boolean;
  /**
   * True when another provider could succeed where this one failed: the key,
   * the model, the rate limit or the service — not the prompt. A request the
   * provider refused on content grounds is never retried elsewhere.
   */
  retryElsewhere?: boolean;
  /** A short code for the registry and the job row, never a provider sentence. */
  code?:          string;
  mime?:          string;
  /** PNG bytes. The caller stores them; there is no provider URL to keep. */
  bytes?:         Uint8Array;
  revisedPrompt?: string;
  model?:         string;
  error?:         string;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function generateImage(params: {
  prompt: string;
  size: ImageSize;
  quality: "medium" | "high";
}): Promise<ImageGenerateResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return {
      ok:    false,
      error: "OPENAI_API_KEY not configured in Supabase Edge Function secrets. Contact the administrator.",
      retryElsewhere: true,
      code:  "not_configured",
    };
  }

  let lastError = "Image generation failed.";

  for (const model of IMAGE_MODELS) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // No `style`, and no `response_format`: this family rejects the first and
      // ignores the second, always answering in base64.
      body: JSON.stringify({
        model,
        prompt:  params.prompt,
        n:       1,
        size:    params.size,
        quality: params.quality,
      }),
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      let code = "";
      try {
        const errJson = await res.json();
        detail = errJson?.error?.message ?? detail;
        code = errJson?.error?.code ?? errJson?.error?.type ?? "";
      } catch { /* ignore */ }

      // A model this key does not have is the one failure worth trying the
      // next name for — which is exactly how this function broke.
      if (/does not exist|model_not_found/i.test(`${code} ${detail}`)) {
        lastError = `No image model on this key accepted the request (last tried ${model}).`;
        continue;
      }

      const statusMap: Record<number, string> = {
        400: `Invalid request: ${detail}`,
        401: "OPENAI_API_KEY is invalid or revoked. Update the secret in Supabase dashboard.",
        403: "OpenAI API key lacks permission for image generation.",
        429: "OpenAI rate limit reached. Please wait a moment and try again.",
        500: "OpenAI service error — please retry in a few seconds.",
        503: "OpenAI is temporarily unavailable. Please retry shortly.",
      };
      return {
        ok: false,
        error: statusMap[res.status] ?? `OpenAI image error (${res.status}): ${detail}`,
        // 400 is the request (often the content filter); everything else is the provider.
        retryElsewhere: res.status !== 400,
        code: res.status >= 500 ? "http_5xx" : `http_${res.status}`,
      };
    }

    const data = await res.json();
    const image = data.data?.[0];
    if (!image?.b64_json) {
      return { ok: false, error: "OpenAI returned no image. The prompt may have been rejected by content policy.", retryElsewhere: false, code: "content_filtered" };
    }

    return {
      ok:            true,
      mime:          "image/png",
      bytes:         decodeBase64(image.b64_json),
      revisedPrompt: image.revised_prompt ?? params.prompt,
      model,
    };
  }

  return { ok: false, error: lastError, retryElsewhere: true, code: "http_404" };
}

// ── FAL, the second image provider ───────────────────────────────────────────
//
// Tried only when OpenAI failed for a reason another vendor could fix, and
// only while the `fal-image` registry row is active AND production-eligible —
// both admin decisions taken after a real smoke test (providerRoutableIn,
// which fails closed). Its model is FLUX.1 [schnell], marked "Commercial use"
// on fal.ai; the transport, host allowlist and error codes live in
// _shared/providers/fal.ts. Its bytes land in the same bucket as OpenAI's, so
// the user never receives a FAL link. The request's daily-limit unit was
// charged once, before either provider ran; falling back charges nothing more.
async function generateWithFal(params: { prompt: string; size: ImageSize }): Promise<ImageGenerateResult> {
  const [width, height] = params.size.split("x").map((n) => parseInt(n, 10));
  const startedAt = Date.now();
  try {
    const out = await falGenerateImage({ key: Deno.env.get("FAL_KEY"), deadlineMs: 60_000 }, { prompt: params.prompt, width, height });
    await recordImageResult({ slug: "fal-image", ms: Date.now() - startedAt, success: true });
    return { ok: true, bytes: out.bytes, mime: out.mime, model: out.model, revisedPrompt: params.prompt };
  } catch (e) {
    const code = e instanceof FalError ? e.code : "unknown";
    await recordImageResult({ slug: "fal-image", ms: Date.now() - startedAt, success: false, errorMessage: code });
    return { ok: false, error: code === "content_filtered" ? "content policy" : `fal ${code}`, retryElsewhere: false, code };
  }
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

  // Signed in is not the same as entitled. The AI Media Studio is a Business
  // section, and until this check existed a valid session on any plan reached
  // the generator. Asked before the body is read, so an unentitled caller
  // cannot spend a provider call, a VX reservation or a storage write on the
  // way to being refused.
  const entitled = await maySeeSection(serviceClient, user.id, "mediaStudio");
  if (!entitled.allowed) return sectionRefusal("mediaStudio", entitled.unavailable);

  // Per-user daily ceiling, before the body is read or a provider called (Phase 2F-2).
  const limited = await chargeDailyLimit(serviceClient, user.id, "image-generate", CORS);
  if (limited) return limited;

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const {
    prompt,
    size       = "1024x1024",
    quality    = "standard",
    // Recorded on the job and echoed back, but never sent: this family rejects
    // it. Callers still pass it, and dropping it from the record would lose the
    // only trace of what the operator chose.
    style      = "vivid",
    project_id,
  } = body;
  // The caller's `model` is deliberately ignored. Every name it can carry names
  // a retired model, and honouring one would reinstate the bug this fixes.
  const model = IMAGE_MODELS[0];

  if (!prompt?.trim())           return jsonError("prompt is required", 400);
  if (prompt.trim().length < 3)  return jsonError("Prompt must be at least 3 characters", 400);
  if (prompt.length > 4000)      return jsonError("Prompt exceeds 4000 character limit", 400);

  // The caller's vocabulary is translated rather than refused: the studio's
  // buttons predate this model family and a 400 here would be a screen broken
  // by a rename.
  const wantedSize = normaliseSize(size);
  const wantedQuality = normaliseQuality(quality);

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
    const startedAt = Date.now();
    let result = await generateImage({
      prompt:  prompt.trim(),
      size:    wantedSize,
      quality: wantedQuality,
    });
    const elapsedMs = Date.now() - startedAt;
    // The registry keeps a short code, never the provider's sentence.
    await recordImageResult({ ms: elapsedMs, success: result.ok, ...(result.ok ? {} : { errorMessage: result.code ?? "unknown" }) });

    if (!result.ok && result.retryElsewhere && await providerRoutableIn(serviceClient, "fal-image")) {
      result = await generateWithFal({ prompt: prompt.trim(), size: wantedSize });
    }

    if (!result.ok) {
      if (jobRow) {
        await serviceClient.from("ams_image_jobs").update({
          status:        "failed",
          error_message: result.code ?? "failed",
          completed_at:  new Date().toISOString(),
        }).eq("id", jobId);
      }
      // A fixed sentence: no vendor, secret name or status code reaches the studio (Phase 2F-3).
      return json({ ok: false, error: publicMediaFailure(result.error, "image", "image-generate"), job_id: jobId }, 500);
    }

    // Parse dimensions from the size actually asked of the model.
    const [widthStr, heightStr] = wantedSize.split("x");
    const width  = parseInt(widthStr ?? "1024", 10);
    const height = parseInt(heightStr ?? "1024", 10);

    // ── Where the picture lives ────────────────────────────────────────
    //
    // The old code handed back OpenAI's own link, which expires within the
    // hour — so an image saved to a project was a dead URL by the afternoon.
    // The current models return no link at all, so the bytes are stored in
    // the studio's own bucket, under the owner's folder as its policies
    // require, and the caller gets a signed URL for them.
    const objectPath = `${user.id}/${jobId}.png`;
    const { error: uploadErr } = await serviceClient.storage
      .from("image-outputs")
      .upload(objectPath, result.bytes!, { contentType: result.mime ?? "image/png", upsert: true });
    if (uploadErr) {
      console.error("Image upload failed:", uploadErr.message);
      if (jobRow) {
        await serviceClient.from("ams_image_jobs").update({
          status: "failed", error_message: "Storage upload failed", completed_at: new Date().toISOString(),
        }).eq("id", jobId);
      }
      return json({ ok: false, error: "The image was generated but could not be saved.", job_id: jobId }, 500);
    }

    const { data: signed } = await serviceClient.storage
      .from("image-outputs")
      .createSignedUrl(objectPath, 60 * 60 * 24 * 7);
    const imageUrl = signed?.signedUrl ?? null;
    if (!imageUrl) {
      return json({ ok: false, error: "The image was saved but could not be linked.", job_id: jobId }, 500);
    }

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
          size_bytes:    result.bytes!.byteLength,
          public_url:    imageUrl,
          status:        "ready",
          metadata: {
            source:         "image-studio",
            prompt:         prompt.trim(),
            revised_prompt: result.revisedPrompt,
            model:          result.model ?? model,
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
        image_url:      imageUrl,
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
      image_url:      imageUrl,
      revised_prompt: result.revisedPrompt,
      width,
      height,
      model:          result.model ?? model,
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
