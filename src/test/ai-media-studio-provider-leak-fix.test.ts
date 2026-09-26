// Phase 2B — two findings from the provider-routing audit, closed.
//
// (1) /services/ai-media-studio/diagnostics showed any signed-in account
//     which provider keys exist, are missing, or are invalid — the same
//     information provider-hub was already fixed to require an admin for
//     (see provider-hub-admin-only.test.ts). Diagnostics was never brought
//     up to the same standard.
//
// (2) vx_video_jobs.provider_job_id and vs_training_jobs.provider_job_id —
//     the vendor's own job/training id — reached the browser two ways: a
//     client-side `select("*")`, and video-studio's own generate response
//     returning it directly. _shared/providers/compute.ts's ComputeJob
//     already states the rule this violates: "never returned to a browser
//     or a WhatsApp reply." provider/provider_model are left alone — both
//     studios already let a user choose their engine before generating, so
//     showing it back is the product's own existing design, not a leak.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("src/App.tsx", "utf8");
const videoStudioFn = readFileSync("supabase/functions/video-studio/index.ts", "utf8");
const videoStudioService = readFileSync("src/services/ai-media-studio/videoStudioService.ts", "utf8");
const voiceStudioService = readFileSync("src/services/ai-media-studio/voiceStudioService.ts", "utf8");
const videoStudioTypes = readFileSync("src/lib/types/video-studio.ts", "utf8");
const voiceStudioTypes = readFileSync("src/lib/types/voice-studio.ts", "utf8");
const edgeFunctionTypes = readFileSync("src/lib/api/edgeFunctions.ts", "utf8");

describe("diagnostics is reached from an admin route, not a signed-in one", () => {
  it("uses AdminRoute, matching provider-hub right above it", () => {
    const route = app.slice(app.indexOf("/services/ai-media-studio/diagnostics"));
    const line = route.slice(0, route.indexOf("/>"));
    expect(line).toContain("<AdminRoute>");
    expect(line).not.toContain("<AuthGuard>");
  });
});

describe("a vendor's job id never reaches the browser", () => {
  it("video-studio's generate response no longer carries provider_job_id", () => {
    const fn = videoStudioFn.slice(videoStudioFn.indexOf("async function handleGenerate"));
    const body = fn.slice(0, fn.indexOf("\nasync function handlePoll"));
    expect(body).not.toContain("provider_job_id: result.providerJobId");
    expect(body).toContain("return json({ ok: true, job_id: job.id });");
  });

  it("videoStudioService selects named columns, not the whole row", () => {
    expect(videoStudioService).not.toMatch(/from\("vx_video_jobs"\)\s*\.select\("\*"\)/);
    const at = videoStudioService.indexOf("const VIDEO_JOB_COLUMNS");
    const list = videoStudioService.slice(at, videoStudioService.indexOf("].join", at));
    expect(list).not.toContain('"provider_job_id"');
    // The columns that ARE legitimate to show back stay — the user chose
    // them before generating.
    expect(list).toContain('"provider"');
    expect(list).toContain('"provider_model"');
  });

  it("voiceStudioService selects named columns, not the whole row", () => {
    const trainingSelect = voiceStudioService.slice(voiceStudioService.indexOf('from("vs_training_jobs")'));
    expect(trainingSelect.slice(0, 60)).not.toContain('.select("*")');
    const at = voiceStudioService.indexOf("const TRAINING_JOB_COLUMNS");
    const list = voiceStudioService.slice(at, voiceStudioService.indexOf("].join", at));
    expect(list).not.toContain('"provider_job_id"');
    expect(list).toContain('"provider"');
  });

  it("and the client types no longer claim to have it", () => {
    expect(videoStudioTypes).not.toMatch(/^\s+provider_job_id:/m);
    expect(voiceStudioTypes).not.toMatch(/^\s+provider_job_id:/m);
    expect(edgeFunctionTypes).not.toMatch(/^\s+provider_job_id\?:/m);
  });
});

describe("document and text-tool job failures do not echo the database (provider audit, 2026-09-26)", () => {
  for (const fn of ["document-generate", "text-tools-generate"]) {
    it(`${fn} answers a failed job insert with a fixed sentence and logs only the code`, () => {
      const src = readFileSync(`supabase/functions/${fn}/index.ts`, "utf8");
      expect(src).not.toMatch(/jobErr\?\.message/);
      expect(src).not.toMatch(/\$\{detail\}/);
      expect(src).toContain(`console.error("[${fn}] job insert failed:", jobErr?.code ?? "unknown");`);
    });
  }
});
