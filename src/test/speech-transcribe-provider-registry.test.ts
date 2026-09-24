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
// Phase 2I moved the recorder into the shared module so WhatsApp's voice notes
// record through the same code; the guarantees below follow it there.
const recording = readFileSync("supabase/functions/_shared/providerRecording.ts", "utf8");
const rec = recording.slice(recording.indexOf("export async function recordSttAttempts"));

describe("recording is wired to the seeded registry rows", () => {
  it("maps groq and openai to the exact slugs Phase 2C seeded", () => {
    expect(recording).toContain('export const STT_PROVIDER_SLUG: Record<SttProviderName, string> = { groq: "groq-stt", openai: "openai-stt" };');
  });

  it("records through the one shared implementation providerRouter also delegates to", () => {
    expect(fn).toContain('import { recordSttAttempts, type RecordingDb } from "../_shared/providerRecording.ts";');
    expect(rec).toContain("providerBySlugIn(db,");
    expect(rec).toContain("recordResultIn(db,");
    expect(fn).not.toContain("async function recordSttAttempts");
  });
});

describe("only real attempts are recorded", () => {
  it("excludes no_key skips — no network call means no health signal to log", () => {
    expect(rec).toContain('attempts.filter((a) => a.failure.reason !== "no_key")');
  });

  it("records job_type stt, matching the migration's seeded type", () => {
    expect(rec).toContain('job_type: "stt"');
  });
});

describe("recording never gates or breaks the transcription response", () => {
  it("wraps every registry call in try/catch", () => {
    expect(rec).toMatch(/try\s*\{[\s\S]*\}\s*catch\s*\{/);
  });

  it("skips recording rather than crashing when the registry row is missing or the type was never seeded", () => {
    expect(rec).toContain("if (!row) continue;");
    expect(rec).toContain("if (row) {");
  });

  it("records on both the success and failure path, before returning or throwing", () => {
    const caller = fn.slice(fn.indexOf("async function transcribeWithWhisper"));
    const body = caller.slice(0, caller.indexOf("\n}\n"));
    expect(body).toMatch(/await recordSttAttempts\(db, heard\.attempts\);\s*\n\s*throw new Error/);
    expect(body).toContain("await recordSttAttempts(db, heard.attempts, { provider: heard.provider, ms: heard.ms });");
    expect(fn).toContain("await transcribeWithWhisper(serviceClient, bytes, filename, mime_type, language_hint);");
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
