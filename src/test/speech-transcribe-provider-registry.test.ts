// Phase 2D — speech-transcribe now records against the Provider Registry.
//
// speech-transcribe calls Deno.serve() at module scope, so — like every other
// entry point in this suite — it is asserted against as source text rather
// than imported. The actual multi-provider fallback behavior it depends on
// (_shared/voice/stt.ts's transcribe()) is already exhaustively covered by
// voice-stt.test.ts and is deliberately untouched by this phase; these tests
// cover only what changed: the recording wired on top of it.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fn = readFileSync("supabase/functions/speech-transcribe/index.ts", "utf8");

describe("recording is wired to the seeded registry rows", () => {
  it("maps groq and openai to the exact slugs Phase 2C seeded", () => {
    expect(fn).toContain('const STT_SLUG: Record<SttProviderName, string> = { groq: "groq-stt", openai: "openai-stt" };');
  });

  it("imports providerBySlug/recordResult from the same router speech-generate uses", () => {
    expect(fn).toContain('import { providerBySlug, recordResult } from "../_shared/providerRouter.ts";');
  });
});

describe("only real attempts are recorded", () => {
  it("excludes no_key skips — no network call means no health signal to log", () => {
    const rec = fn.slice(fn.indexOf("async function recordSttAttempts"));
    expect(rec).toContain('attempts.filter((a) => a.failure.reason !== "no_key")');
  });

  it("records job_type stt, matching the migration's seeded type", () => {
    expect(fn).toContain('job_type: "stt"');
  });
});

describe("recording never gates or breaks the transcription response", () => {
  it("wraps every registry call in try/catch", () => {
    const rec = fn.slice(fn.indexOf("async function recordSttAttempts"), fn.indexOf("// ── Helpers"));
    expect(rec).toMatch(/try\s*\{[\s\S]*\}\s*catch\s*\{/);
  });

  it("skips recording rather than crashing when the registry row is missing or the type was never seeded", () => {
    const rec = fn.slice(fn.indexOf("async function recordSttAttempts"), fn.indexOf("// ── Helpers"));
    expect(rec).toContain("if (!row) continue;");
    expect(rec).toContain("if (row) {");
  });

  it("records on both the success and failure path, before returning or throwing", () => {
    const caller = fn.slice(fn.indexOf("async function transcribeWithWhisper"));
    const body = caller.slice(0, caller.indexOf("\n}\n"));
    expect(body).toMatch(/await recordSttAttempts\(heard\.attempts\);\s*\n\s*throw new Error/);
    expect(body).toContain("await recordSttAttempts(heard.attempts, { provider: heard.provider, ms: heard.ms });");
  });

  it("still throws the same describeSttFailure sentence a caller already expects", () => {
    // The response contract (error text, status mapping) is untouched —
    // recording is added alongside it, not instead of it.
    expect(fn).toContain("throw new Error(describeSttFailure(heard.failure));");
  });
});

describe("everything else about this endpoint is untouched", () => {
  it("keeps the 25 MB limit, the job table, and the response shape", () => {
    expect(fn).toContain("const MAX_BYTES = 25 * 1024 * 1024;");
    expect(fn).toContain('.from("ams_transcription_jobs")');
    expect(fn).toContain("transcript_text:   result.text,");
  });

  it("still requires a user JWT before anything else", () => {
    const authAt = fn.indexOf('if (!authHeader) return json({ error: "Unauthorized" }');
    const bodyAt = fn.indexOf("await req.json()");
    expect(authAt).toBeGreaterThan(-1);
    expect(authAt).toBeLessThan(bodyAt);
  });
});
