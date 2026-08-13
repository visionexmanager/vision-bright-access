import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Gemini production health probe", () => {
  const health = readFileSync("supabase/functions/career-system-health/index.ts", "utf8");

  it("validates the configured key against Google's models endpoint", () => {
    expect(health).toContain("async function checkGemini()");
    expect(health).toContain("generativelanguage.googleapis.com/v1beta/models");
    expect(health).toContain("Gemini key valid and API reachable.");
    expect(health).toContain("results.gemini_key = await checkGemini()");
  });

  it("never returns or logs the secret", () => {
    expect(health).not.toMatch(/detail:\s*apiKey/);
    expect(health).not.toMatch(/console\.(log|error)\([^)]*apiKey/);
  });
});
