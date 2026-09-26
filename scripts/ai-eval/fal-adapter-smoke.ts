// A real FAL image and video through Visionex's own transport
// (_shared/providers/fal.ts) — the code image-generate and video-studio run.
//
//   deno run --allow-env --allow-net scripts/ai-eval/fal-adapter-smoke.ts
//
// PAID: one FLUX.1 [schnell] image (512×512, billed as one megapixel, about
// $0.003) and one Wan 2.2 5B clip (the shortest it allows, about $0.15), both
// "Commercial use" on fal.ai. It stops at the first refusal, so a locked
// account costs nothing. Printed: pass/fail, codes, byte counts, MIME types —
// never the key, a URL or the prompt's output.

import {
  FAL_VIDEO_MODEL, FalError, falGenerateImage, falResult, falStatus, falSubmit, falVideoInput, falVideoUrl, fetchFalMedia,
} from "../../supabase/functions/_shared/providers/fal.ts";

const key = Deno.env.get("FAL_KEY") ?? "";
const rows: string[] = [];
const report = (name: string, ok: boolean, detail: string) => rows.push(`| ${name} | ${ok ? "PASS" : "FAIL"} | ${detail} |`);
const code = (e: unknown) => (e instanceof FalError ? e.code : (e as Error)?.name ?? "unknown");
let stop = false;

// Image — exactly what image-generate's FAL fallback calls.
{
  const t0 = Date.now();
  try {
    const out = await falGenerateImage({ key, deadlineMs: 120_000 }, { prompt: "A plain blue circle on a white background.", width: 512, height: 512 });
    report("image", out.bytes.byteLength > 0 && out.mime.startsWith("image/"), `${out.model}; ${out.mime}; ${out.bytes.byteLength} bytes; ${Date.now() - t0} ms`);
  } catch (e) {
    report("image", false, `${code(e)}; ${Date.now() - t0} ms`);
    stop = code(e) === "http_403" || code(e) === "http_401" || code(e) === "not_configured";
  }
}

// Video — submit, poll, result, allowlisted download: video-studio's FAL path.
if (stop) {
  report("video", false, "skipped: the account refused the image, so nothing further was submitted");
} else {
  const t0 = Date.now();
  try {
    const id = await falSubmit({ key }, FAL_VIDEO_MODEL, falVideoInput({
      prompt: "A slow pan across a calm blue sea at noon.", aspectRatio: "16:9", resolution: "580p", durationSec: 1,
    }));
    let status = await falStatus({ key }, FAL_VIDEO_MODEL, id);
    while ((status === "queued" || status === "running") && Date.now() - t0 < 360_000) {
      await new Promise((r) => setTimeout(r, 5000));
      status = await falStatus({ key }, FAL_VIDEO_MODEL, id);
    }
    if (status !== "completed") throw new FalError(status === "failed" ? "invalid_response" : "timeout");
    const url = falVideoUrl(await falResult({ key }, FAL_VIDEO_MODEL, id));
    if (!url) throw new FalError("untrusted_result");
    const file = await fetchFalMedia({ timeoutMs: 120_000 }, url, "video/", 200 * 1024 * 1024);
    report("video", file.bytes.byteLength > 0, `${FAL_VIDEO_MODEL}; ${file.mime}; ${file.bytes.byteLength} bytes; ${Date.now() - t0} ms`);
  } catch (e) {
    report("video", false, `${code(e)}; ${Date.now() - t0} ms`);
  }
}

console.log(["## FAL through the Visionex transport (paid)", "", "| check | result | detail |", "| --- | --- | --- |", ...rows].join("\n"));
