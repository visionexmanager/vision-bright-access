import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The gate between a language model and a child is a person. These assertions
// pin that gate in place: the generator may only ever write drafts, and only an
// admin may run it. Both are one careless edit away from being lost, and
// neither failure is visible in the UI — a published row simply appears in the
// academy and a child opens it.

const source = readFileSync("supabase/functions/kids-course-generate/index.ts", "utf8");

describe("kids course generation never publishes to children", () => {
  it("writes courses and lessons as drafts", () => {
    expect(source).toContain('status: "draft"');
    expect(source).toContain("published_at: null");
  });

  it("has no code path that publishes", () => {
    expect(source).not.toMatch(/status:\s*["']published["']/);

    // Every value ever assigned to published_at, not just the absence of one
    // pattern: a second write with a timestamp is the failure to catch.
    const written = [...source.matchAll(/published_at:\s*([^,\n]+)/g)].map((m) => m[1].trim());
    expect(written).toEqual(["null"]);
  });

  it("requires an admin, not merely a signed-in user", () => {
    expect(source).toContain('_role: "admin"');
    expect(source).toContain("Admin role required");
  });

  it("keeps jwt verification on", () => {
    // --no-verify-jwt is applied from a list in the deploy script, not from
    // config.toml. This function must never appear there.
    const deployScript = readFileSync("scripts/deploy-changed-supabase-functions.sh", "utf8");
    const noJwtBlock = deployScript.slice(0, deployScript.indexOf("changed_files="));
    expect(noJwtBlock).not.toContain("kids-course-generate");
  });
});

describe("the generator asks for content that is safe to show a child", () => {
  it("instructs the model on accuracy and originality", () => {
    expect(source).toContain("factually correct");
    expect(source).toContain("Do not reproduce copyrighted text");
  });

  it("tries several providers so one outage does not stop authoring", () => {
    for (const provider of ["openai", "groq", "mistral", "gemini"]) {
      expect(source).toContain(`provider: "${provider}"`);
    }
  });
});
