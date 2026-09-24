// Follow-up to Phase 2G: three weaknesses in `library-generate-narration`.
//   1. The daily limit failed open — a limiter error let the request through.
//   2. `dialect` and `emotion` went into the provider instructions unbounded.
//   3. The final catch returned raw error text (provider, database, storage).
// Everything else about narration — model, voice, speed, instructions wording,
// chunking, format, storage — must be exactly as before.

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chargeDailyLimit } from "../../supabase/functions/_shared/aiDailyLimit.ts";
import { boundedText } from "../../supabase/functions/_shared/providerInput.ts";

const src = readFileSync("supabase/functions/library-generate-narration/index.ts", "utf8");
const handler = src.slice(src.indexOf("Deno.serve("));

afterEach(() => vi.restoreAllMocks());

describe("1. the daily limit fails closed", () => {
  it("uses the shared limiter under this function's own name", () => {
    expect(handler).toContain('chargeDailyLimit(serviceClient, user.id, "library-generate-narration", cors)');
    expect(handler).toContain("if (limited) return limited;");
  });

  it("no longer carries the fail-open inline check", () => {
    expect(src).not.toContain('rpc("check_ai_rate_limit"');
    expect(src).not.toContain("allowed === false");
  });

  it("charges after the owner/admin gate and before the chapter is read or synthesised", () => {
    const gate = handler.indexOf('rpc("is_library_book_owner"');
    const charge = handler.indexOf("chargeDailyLimit(");
    expect(gate).toBeGreaterThan(0);
    expect(charge).toBeGreaterThan(gate);
    expect(charge).toBeLessThan(handler.indexOf('.from("library_chapters")'));
    expect(charge).toBeLessThan(handler.indexOf("synthesizeSegment("));
  });

  it("refuses with a 429 when the limiter errors, throws or says no", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const rpc of [
      async () => ({ data: null, error: { code: "PGRST301" } }),
      async () => { throw new Error("connection reset"); },
      async () => ({ data: false, error: null }),
    ]) {
      const res = await chargeDailyLimit({ rpc }, "user-1", "library-generate-narration", {});
      expect(res?.status).toBe(429);
    }
    const ok = await chargeDailyLimit({ rpc: async () => ({ data: true, error: null }) }, "user-1", "library-generate-narration", {});
    expect(ok).toBeNull();
  });
});

describe("2. dialect and emotion are bounded", () => {
  it("caps both at 60 characters through the shared helper", () => {
    expect(src).toContain("const MAX_STYLE_CHARS = 60;");
    expect(src).toContain("const dialect = boundedText(rawDialect, MAX_STYLE_CHARS);");
    expect(src).toContain("const emotion = boundedText(rawEmotion, MAX_STYLE_CHARS);");
    expect(src).not.toMatch(/\$\{dialect\.trim\(\)\}|\$\{emotion\.trim\(\)\}/);
  });

  it("boundedText cuts a long value and drops anything that is not a string", () => {
    expect(boundedText("x".repeat(5000), 60)).toHaveLength(60);
    expect(boundedText("  Levantine  ", 60)).toBe("Levantine");
    for (const value of [undefined, null, 7, { a: 1 }, ["Levantine"]]) expect(boundedText(value, 60)).toBe("");
  });

  it("keeps the instructions wording exactly as it was", () => {
    for (const line of [
      '"Narrate this audiobook chapter clearly and naturally, like a professional audiobook narrator."',
      "` Use a ${dialect} accent.`",
      "` Speak with a ${emotion} tone.`",
      '" Use natural pauses between sentences and paragraphs."',
    ]) {
      expect(src, line).toContain(line);
    }
  });
});

describe("3. errors are generic to the caller and detailed in the log", () => {
  const catchBlock = handler.slice(handler.lastIndexOf("} catch (err) {"));

  it("returns one fixed sentence from the catch", () => {
    expect(catchBlock).toContain('json({ error: "Narration could not be generated. Please try again later." }, 500, cors)');
    expect(catchBlock).not.toContain("json({ error: msg }");
  });

  it("still logs the detail server-side", () => {
    expect(catchBlock).toContain('console.error("library-generate-narration error:", msg);');
  });

  it("logs provider failures with their detail too", () => {
    expect(src).toContain("describeTtsFailure(result.failure)");
  });
});

describe("unchanged: the narration itself", () => {
  it("keeps model, format, voices, speed clamp, chunking and storage", () => {
    for (const fragment of [
      'model: "gpt-4o-mini-tts"',
      'format: "mp3"',
      "const CHUNK_TARGET_CHARS = 3900;",
      "const MAX_CHAPTER_CHARS = 48000;",
      'const ALLOWED_VOICES = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer", "coral"]);',
      'male: "onyx"',
      'female: "nova"',
      'neutral: "fable"',
      "Math.min(2, Math.max(0.5, body.speed ?? 1))",
      '.from("library-audiobooks")',
      'contentType: "audio/mpeg"',
      '.from("library_audiobook_chapters")',
      "is_ai_generated: true",
    ]) {
      expect(src, fragment).toContain(fragment);
    }
  });

  it("does not touch VX", () => {
    expect(src).not.toMatch(/vx_|user_points|spend_?vx/i);
  });
});
