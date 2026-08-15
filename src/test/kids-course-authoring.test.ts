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

describe("the review screen makes publishing require reading", () => {
  const screen = readFileSync("src/pages/admin/AdminKidsCourses.tsx", "utf8");

  it("only offers publish inside an opened draft", () => {
    // The publish button must sit after the lesson bodies are rendered, not in
    // the list row. A publish control on the list is how a whole course reaches
    // children from a title alone.
    // The rendered label, not the bare key — "…publish" is a prefix of
    // "…published", which the publish handler's toast uses earlier in the file.
    const listRow = screen.indexOf("aria-expanded={isOpen}");
    const publishButton = screen.indexOf('t("admin.kidsCourses.publish")');
    expect(listRow).toBeGreaterThan(0);
    expect(publishButton).toBeGreaterThan(listRow);
    expect(screen.indexOf("lesson.content")).toBeLessThan(publishButton);
  });

  it("reads only drafts into the queue", () => {
    expect(screen).toContain('.eq("status", "draft")');
  });

  it("is registered behind the admin route guard", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    expect(app).toContain('<Route path="/admin/kids-courses" element={<AdminRoute><AdminKidsCourses /></AdminRoute>} />');
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
