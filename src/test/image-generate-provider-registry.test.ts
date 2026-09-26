// Phase 2D — image-generate now records against the Provider Registry.
//
// image-generate calls Deno.serve() at module scope, so it is asserted
// against as source text, like every other entry point in this suite.
// generateImage()'s own gpt-image-1 -> gpt-image-1-mini fallback loop is
// deliberately untouched — that is a same-vendor model fallback, not a
// provider choice (see 20261037000000_ph_providers_stt_image_types.sql's
// own comment); these tests cover only what changed: the recording wired
// around it.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fn = readFileSync("supabase/functions/image-generate/index.ts", "utf8");

describe("recording is wired to the seeded registry row", () => {
  it("records against openai-image, the exact slug Phase 2C seeded", () => {
    // Since the FAL fallback (2026-09-26) the slug is a parameter; OpenAI is the default.
    expect(fn).toContain('const row = await providerBySlug(params.slug ?? "openai-image");');
    expect(fn).toMatch(/slug\?: "openai-image" \| "fal-image"/);
  });

  it("imports providerBySlug/recordResult from the same router speech-generate uses", () => {
    expect(fn).toContain('import { providerBySlug, recordResult } from "../_shared/providerRouter.ts";');
  });

  it("records job_type image, matching the migration's seeded type", () => {
    expect(fn).toContain('job_type: "image"');
  });
});

describe("the model fallback loop is untouched", () => {
  it("still tries gpt-image-1 before gpt-image-1-mini, unchanged", () => {
    expect(fn).toContain('const IMAGE_MODELS = ["gpt-image-1", "gpt-image-1-mini"] as const;');
    expect(fn).toContain("for (const model of IMAGE_MODELS) {");
  });

  it("recordImageResult is called once per request, around the whole fallback loop, not per model tried", () => {
    // OpenAI: exactly one record in the handler, after its whole model loop.
    // FAL records its own attempt inside generateWithFal, against fal-image.
    const handler = fn.slice(fn.indexOf("Deno.serve("));
    expect((handler.match(/await recordImageResult\(/g) ?? []).length).toBe(1);
    const fal = fn.slice(fn.indexOf("async function generateWithFal"), fn.indexOf("Deno.serve("));
    expect((fal.match(/await recordImageResult\(\{ slug: "fal-image"/g) ?? []).length).toBe(2); // success, failure
  });
});

describe("recording never gates or breaks the generation response", () => {
  it("wraps the registry call in try/catch", () => {
    const rec = fn.slice(fn.indexOf("async function recordImageResult"));
    const body = rec.slice(0, rec.indexOf("\n}\n"));
    expect(body).toMatch(/try\s*\{[\s\S]*\}\s*catch\s*\{/);
  });

  it("skips recording rather than crashing when the registry row is missing", () => {
    const rec = fn.slice(fn.indexOf("async function recordImageResult"));
    const body = rec.slice(0, rec.indexOf("\n}\n"));
    expect(body).toContain("if (!row) return;");
  });

  it("times the actual generateImage() call, not the storage upload or job bookkeeping around it", () => {
    const serve = fn.slice(fn.indexOf("Deno.serve("));
    const handler = serve.slice(serve.indexOf("const startedAt = Date.now();"));
    const between = handler.slice(0, handler.indexOf("const elapsedMs"));
    expect(between).toContain("await generateImage({");
    expect(between).not.toContain("storage");
  });

  it("records failure before the existing failure path runs, success before the existing completion path runs", () => {
    // One record carries either outcome, written before the FAL fallback, the
    // failure response and the storage upload all run.
    const recordAt = fn.indexOf("await recordImageResult({ ms: elapsedMs, success: result.ok");
    const fallbackAt = fn.indexOf('await providerRoutableIn(serviceClient, "fal-image")');
    const failReturnAt = fn.indexOf("return json({ ok: false, error: publicMediaFailure(result.error");
    const uploadAt = fn.indexOf('.from("image-outputs")');
    expect(recordAt).toBeGreaterThan(-1);
    expect(recordAt).toBeLessThan(fallbackAt);
    expect(fallbackAt).toBeLessThan(failReturnAt);
    expect(failReturnAt).toBeLessThan(uploadAt);
  });
});

describe("everything else about this endpoint is untouched", () => {
  it("still ignores a caller-supplied model — the whole reason PR #322-era retired-model bugs happened", () => {
    expect(fn).toContain("const model = IMAGE_MODELS[0];");
    expect(fn).toContain("The caller's `model` is deliberately ignored");
  });

  it("still requires entitlement before reading the body", () => {
    const entAt = fn.indexOf('maySeeSection(serviceClient, user.id, "mediaStudio")');
    const bodyAt = fn.indexOf("await req.json()");
    expect(entAt).toBeGreaterThan(-1);
    expect(entAt).toBeLessThan(bodyAt);
  });

  it("still stores bytes in Visionex's own bucket rather than a provider URL", () => {
    expect(fn).toContain('.from("image-outputs")');
    expect(fn).toContain("createSignedUrl");
  });
});
