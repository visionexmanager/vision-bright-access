// OpenAI's image edit, for the Image Studio tools while Replicate is parked.
//
// Replicate serves every image-tool mode when it is switched on
// (providerState.ts). Until then, `gpt-image-1`'s edit endpoint serves the four
// modes it genuinely performs — it redraws the picture from the source and the
// instruction, which is what an image-to-image, an avatar, a restoration and a
// cut-out all are. Upscaling is not among them: the endpoint returns at most
// 1536 px and redraws rather than enlarges, so `upscale` stays Replicate-only
// and is refused, not faked.
//
// A module of its own so the live route contract calls this exact function —
// the same model, size, prompts and transparent background — rather than a
// copy of it (scripts/ai-eval/live-route-contract.ts, "image tool …").

import { meteredFetch } from "../meteredFetch.ts";

export type ImageToolMode = "img2img" | "upscale" | "bg-remove" | "restore" | "avatar";

/** The modes OpenAI's edit endpoint serves here. */
export const OPENAI_MODES: ReadonlySet<ImageToolMode> = new Set<ImageToolMode>(["img2img", "avatar", "bg-remove", "restore"]);
export const OPENAI_EDIT_MODEL = "gpt-image-1";
/** The largest source accepted, well inside the endpoint's own limit. */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
/** The source types the endpoint takes, with the extension its decoder keys on. */
export const SOURCE_TYPES: Readonly<Record<string, string>> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** The instruction for one mode; the caller's own prompt leads where the mode takes one. */
export function openaiEditPrompt(mode: ImageToolMode, prompt: string | undefined): string {
  switch (mode) {
    case "img2img":
      return prompt || "Enhance this image: sharper detail, balanced colour and lighting, high quality. Keep the composition and the subject.";
    case "avatar":
      return prompt
        ? `${prompt}. A portrait avatar in high quality digital art; keep the person recognisable.`
        : "Turn this photo into a professional stylized portrait avatar in high quality digital art. Keep the person recognisable.";
    case "bg-remove":
      return "Remove the background completely. Keep the main subject exactly as it is: same shape, colours and details.";
    case "restore":
      return "Restore this photo: remove scratches, dust, noise and blur, and repair faded colours. Keep every face and detail faithful to the original.";
    case "upscale":
      return "";
  }
}

export type ImageEditResult = { ok: true; bytes: Uint8Array } | { ok: false; error: string };

/**
 * One edit. Resolves with the PNG bytes, or a short reason for
 * publicMediaFailure — never the provider's sentence, which can echo a prompt.
 * `quality` is "medium" in production; the probe asks for "low".
 */
export async function editWithOpenAI(
  mode: ImageToolMode,
  source: Blob,
  prompt: string | undefined,
  opts: { quality?: "low" | "medium"; timeoutMs?: number; read?: (name: string) => string | undefined } = {},
): Promise<ImageEditResult> {
  if (!OPENAI_MODES.has(mode)) return { ok: false, error: `openai edit unsupported ${mode}` };
  const key = (opts.read ?? ((n) => Deno.env.get(n)))("OPENAI_API_KEY")?.trim();
  if (!key) return { ok: false, error: "OPENAI_API_KEY is not configured" };
  const form = new FormData();
  form.append("model", OPENAI_EDIT_MODEL);
  form.append("image", source, `source.${SOURCE_TYPES[source.type] ?? "png"}`);
  form.append("prompt", openaiEditPrompt(mode, prompt));
  form.append("size", "auto");
  form.append("quality", opts.quality ?? "medium");
  form.append("output_format", "png");
  if (mode === "bg-remove") form.append("background", "transparent");
  let res: Response;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), opts.timeoutMs ?? 120_000);
  try {
    res = await meteredFetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: abort.signal,
    });
  } catch (error) {
    const timedOut = abort.signal.aborted || (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"));
    return { ok: false, error: timedOut ? "openai edit timeout" : "openai edit network" };
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, error: /safety|moderation|content.?policy/i.test(detail) ? "content policy" : `openai edit ${res.status}` };
  }
  const body = await res.json().catch(() => null) as { data?: Array<{ b64_json?: string }> } | null;
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) return { ok: false, error: "openai edit empty" };
  return { ok: true, bytes: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) };
}
