// FAL — the transport for image and video generation on fal.ai.
//
// One vendor, one dialect, no billing and no routing: callers (image-generate,
// video-studio) decide *whether* FAL serves a request — only when its registry
// row is active — and meter the request as one unit, exactly as they do for
// OpenAI and Luma. This file only speaks FAL's queue API and refuses anything
// it cannot verify. Same layering as providers/runpod.ts.
//
// Contract (fal.ai/docs, verified 2026-09-26):
//   submit  POST https://queue.fal.run/{endpoint}          Authorization: Key <FAL_KEY>
//   status  GET  https://queue.fal.run/{app}/requests/{id}/status
//   result  GET  https://queue.fal.run/{app}/requests/{id}
//   cancel  PUT  https://queue.fal.run/{app}/requests/{id}/cancel
// where {app} is the endpoint's first two segments ("fal-ai/wan" for
// "fal-ai/wan/v2.2-5b/text-to-video"). Statuses: IN_QUEUE, IN_PROGRESS, COMPLETED.
//
// Every URL this file requests is built here from a constant endpoint id and
// a request id that must look like one. The status_url/response_url FAL sends
// back are never followed, and a result file is fetched only over https from
// FAL's media CDN — so neither a caller nor a provider response can point a
// server-side fetch anywhere else.
//
// Pure: no Deno, no environment. The key and fetch arrive as arguments.

export const FAL_QUEUE_BASE = "https://queue.fal.run";

/**
 * The models Visionex may send work to, and why each one may or may not.
 * Only a model whose fal.ai page says "Commercial use" is `commercial: true`,
 * and only those can be selected. A model that works but is "Research only"
 * stays listed with `commercial: false` so the refusal is explicit, not silent.
 */
export const FAL_MODELS = {
  "fal-ai/flux/schnell": { kind: "image", commercial: true, note: "FLUX.1 [schnell]; fal.ai: Commercial use" },
  "fal-ai/wan/v2.2-5b/text-to-video": { kind: "video", commercial: true, note: "Wan 2.2 5B; fal.ai: Commercial use" },
  "fal-ai/ltx-video": { kind: "video", commercial: false, note: "fal.ai: Research only — blocked until commercial licensing is verified" },
} as const;

export type FalEndpoint = keyof typeof FAL_MODELS;
export const FAL_IMAGE_MODEL: FalEndpoint = "fal-ai/flux/schnell";
export const FAL_VIDEO_MODEL: FalEndpoint = "fal-ai/wan/v2.2-5b/text-to-video";

/** Short, closed codes — the only thing about a failure that is recorded or logged. */
export type FalErrorCode =
  | "not_configured" | "not_commercial" | "http_400" | "http_401" | "http_403" | "http_404"
  | "http_422" | "http_429" | "http_4xx" | "http_5xx" | "timeout" | "network"
  | "invalid_response" | "untrusted_result" | "content_filtered" | "too_large";

export class FalError extends Error {
  constructor(readonly code: FalErrorCode) {
    super(`fal: ${code}`);
    this.name = "FalError";
  }
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface FalOptions {
  key: string | undefined | null;
  fetch?: Fetch;
  /** Per-HTTP-call ceiling. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** AbortSignal.timeout where the runtime has it; the same thing by hand where it does not. */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === "function") return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), ms);
  return controller.signal;
}

/** "fal-ai/wan/v2.2-5b/text-to-video" → "fal-ai/wan". */
export function falAppId(endpoint: string): string {
  return endpoint.split("/").slice(0, 2).join("/");
}

/** https, and a host on FAL's media CDN (fal.media or a subdomain). Anything else is refused. */
export function isFalMediaUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  return url.hostname === "fal.media" || url.hostname.endsWith(".fal.media");
}

function codeForStatus(status: number): FalErrorCode {
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 422 || status === 429) {
    return `http_${status}` as FalErrorCode;
  }
  if (status >= 500) return "http_5xx";
  return "http_4xx";
}

function requireCommercial(endpoint: string): FalEndpoint {
  const model = (FAL_MODELS as Record<string, { commercial: boolean }>)[endpoint];
  if (!model?.commercial) throw new FalError("not_commercial");
  return endpoint as FalEndpoint;
}

async function falFetch(opts: FalOptions, url: string, init: RequestInit = {}): Promise<unknown> {
  if (!opts.key) throw new FalError("not_configured");
  const doFetch = opts.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(url, {
      ...init,
      headers: { Authorization: `Key ${opts.key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: timeoutSignal(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (e) {
    throw new FalError(e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError") ? "timeout" : "network");
  }
  if (!res.ok) {
    // The body can name the account ("User is locked…"); it is read by nobody.
    await res.body?.cancel().catch(() => undefined);
    throw new FalError(codeForStatus(res.status));
  }
  try {
    return await res.json();
  } catch {
    throw new FalError("invalid_response");
  }
}

// ── Queue primitives ─────────────────────────────────────────────────────────

/** Submit a job; returns FAL's request id. Only commercially usable endpoints. */
export async function falSubmit(opts: FalOptions, endpoint: string, input: Record<string, unknown>): Promise<string> {
  const ep = requireCommercial(endpoint);
  const data = await falFetch(opts, `${FAL_QUEUE_BASE}/${ep}`, { method: "POST", body: JSON.stringify(input) }) as { request_id?: unknown };
  if (typeof data?.request_id !== "string" || !REQUEST_ID.test(data.request_id)) throw new FalError("invalid_response");
  return data.request_id;
}

export type FalStatus = "queued" | "running" | "completed" | "failed";

export async function falStatus(opts: FalOptions, endpoint: string, requestId: string): Promise<FalStatus> {
  if (!REQUEST_ID.test(requestId)) throw new FalError("invalid_response");
  const data = await falFetch(opts, `${FAL_QUEUE_BASE}/${falAppId(requireCommercial(endpoint))}/requests/${requestId}/status`) as { status?: unknown };
  switch (data?.status) {
    case "IN_QUEUE": return "queued";
    case "IN_PROGRESS": return "running";
    case "COMPLETED": return "completed";
    default: return "failed";
  }
}

export async function falResult(opts: FalOptions, endpoint: string, requestId: string): Promise<Record<string, unknown>> {
  if (!REQUEST_ID.test(requestId)) throw new FalError("invalid_response");
  const data = await falFetch(opts, `${FAL_QUEUE_BASE}/${falAppId(requireCommercial(endpoint))}/requests/${requestId}`);
  if (!data || typeof data !== "object") throw new FalError("invalid_response");
  return data as Record<string, unknown>;
}

export async function falCancel(opts: FalOptions, endpoint: string, requestId: string): Promise<void> {
  if (!REQUEST_ID.test(requestId)) return;
  try {
    await falFetch(opts, `${FAL_QUEUE_BASE}/${falAppId(requireCommercial(endpoint))}/requests/${requestId}/cancel`, { method: "PUT" });
  } catch {
    // Best-effort, like every provider's cancel.
  }
}

// ── Image ────────────────────────────────────────────────────────────────────

export interface FalImageResult {
  bytes: Uint8Array;
  mime: string;
  model: FalEndpoint;
}


/**
 * One image from FLUX.1 [schnell], as bytes the caller stores in its own
 * bucket — never a FAL link handed to a browser. Bounded end to end by
 * `deadlineMs`; a job that outlives it is cancelled and reported as a timeout.
 */
export async function falGenerateImage(
  opts: FalOptions & { deadlineMs?: number; pollMs?: number },
  params: { prompt: string; width: number; height: number },
): Promise<FalImageResult> {
  const endpoint = FAL_IMAGE_MODEL;
  const requestId = await falSubmit(opts, endpoint, {
    prompt: params.prompt,
    image_size: { width: params.width, height: params.height },
    num_images: 1,
    num_inference_steps: 4,
    enable_safety_checker: true,
    output_format: "png",
  });
  const deadline = Date.now() + (opts.deadlineMs ?? 60_000);
  for (;;) {
    const status = await falStatus(opts, endpoint, requestId);
    if (status === "completed") break;
    if (status === "failed") throw new FalError("invalid_response");
    if (Date.now() >= deadline) {
      await falCancel(opts, endpoint, requestId);
      throw new FalError("timeout");
    }
    await sleep(opts.pollMs ?? 1000);
  }
  const result = await falResult(opts, endpoint, requestId);
  const flagged = result.has_nsfw_concepts;
  if (Array.isArray(flagged) && flagged.some(Boolean)) throw new FalError("content_filtered");
  const url = (result.images as Array<{ url?: unknown }> | undefined)?.[0]?.url;
  if (!isFalMediaUrl(url)) throw new FalError("untrusted_result");
  return { ...(await fetchFalMedia(opts, url, "image/", MAX_IMAGE_BYTES)), model: endpoint };
}

/** Download a FAL CDN file: allowlisted host, expected type, bounded size. */
export async function fetchFalMedia(
  opts: Pick<FalOptions, "fetch" | "timeoutMs">,
  url: string,
  typePrefix: "image/" | "video/",
  maxBytes: number,
): Promise<{ bytes: Uint8Array; mime: string }> {
  if (!isFalMediaUrl(url)) throw new FalError("untrusted_result");
  const doFetch = opts.fetch ?? fetch;
  let res: Response;
  try {
    // No Authorization header: CDN files are public, and the key never leaves for another host.
    res = await doFetch(url, { redirect: "error", signal: timeoutSignal(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS) });
  } catch (e) {
    throw new FalError(e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError") ? "timeout" : "network");
  }
  if (!res.ok) throw new FalError(codeForStatus(res.status));
  const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!mime.startsWith(typePrefix)) throw new FalError("invalid_response");
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new FalError("too_large");
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0) throw new FalError("invalid_response");
  if (bytes.byteLength > maxBytes) throw new FalError("too_large");
  return { bytes, mime };
}

// ── Video ────────────────────────────────────────────────────────────────────

/** Wan 2.2 accepts these three shapes; everything else maps to the nearest. */
export function falVideoInput(params: { prompt: string; negativePrompt?: string; aspectRatio: string; resolution: string; durationSec: number; seed?: number }): Record<string, unknown> {
  const aspect = params.aspectRatio === "9:16" || params.aspectRatio === "1:1" ? params.aspectRatio : "16:9";
  const fps = 24;
  // 17–161 frames at 24 fps: about 0.7 s to 6.7 s.
  const frames = Math.min(161, Math.max(17, Math.round((params.durationSec || 5) * fps)));
  return {
    prompt: params.prompt,
    ...(params.negativePrompt ? { negative_prompt: params.negativePrompt } : {}),
    resolution: params.resolution === "720p" || params.resolution === "1080p" || params.resolution === "4k" ? "720p" : "580p",
    aspect_ratio: aspect,
    num_frames: frames,
    frames_per_second: fps,
    enable_safety_checker: true,
    ...(Number.isInteger(params.seed) ? { seed: params.seed } : {}),
  };
}

/** The video file's URL from a completed Wan result, or null when it is not a FAL CDN https link. */
export function falVideoUrl(result: Record<string, unknown>): string | null {
  const url = (result.video as { url?: unknown } | undefined)?.url;
  return isFalMediaUrl(url) ? url : null;
}

/** Visionex's stored provider job id: "<endpoint>|<request id>", checked on the way back in. */
export function encodeFalJobId(endpoint: FalEndpoint, requestId: string): string {
  return `${endpoint}|${requestId}`;
}

export function decodeFalJobId(value: string): { endpoint: FalEndpoint; requestId: string } | null {
  const [endpoint, requestId, extra] = value.split("|");
  if (extra !== undefined || !requestId || !REQUEST_ID.test(requestId)) return null;
  const model = (FAL_MODELS as Record<string, { kind: string; commercial: boolean }>)[endpoint];
  if (!model?.commercial || model.kind !== "video") return null;
  return { endpoint: endpoint as FalEndpoint, requestId };
}
