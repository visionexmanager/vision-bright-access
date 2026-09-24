// kids-story-generate and kids-drawing-to-art both generated cover art
// through a direct, inlined call to "dall-e-3" — a model already confirmed
// retired (see content-media.test.ts's "asks for a model that exists" block,
// which caught the same failure in image-generate). Both entry points call
// Deno.serve() at module scope, so — like image-generate before it — they
// are asserted against as source text rather than imported.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const story = readFileSync("supabase/functions/kids-story-generate/index.ts", "utf8");
const drawing = readFileSync("supabase/functions/kids-drawing-to-art/index.ts", "utf8");

describe("kids-story-generate's cover art", () => {
  it("no longer names the retired model anywhere", () => {
    expect(story).not.toMatch(/dall-e/i);
  });

  it("generates through the shared, proven image layer instead of a direct fetch", () => {
    expect(story).toContain('import { generateImage } from "../_shared/contentMedia.ts";');
    expect(story).not.toContain("https://api.openai.com/v1/images/generations");
  });

  it("keeps the best-effort contract: a failure returns null, never throws", () => {
    // The story itself must still be returned even when the cover fails —
    // this was always true and must stay true with the new provider call.
    // Phase 2H added the service client it records the outcome through.
    expect(story).toContain("async function generateCoverImage(prompt: string, db: RecordingDb): Promise<string | null>");
    expect(story).toContain("result.ok ? result.url ?? null : null");
    expect(story).toMatch(/catch\s*\{\s*return null;\s*\}/);
  });

  it("keeps the response field name the frontend and the database expect", () => {
    // src/features/visionkids/services/stories/aiStories.ts persists this
    // exact field into kids_ai_stories.cover_image_url.
    expect(story).toContain("coverImageUrl,");
  });
});

describe("kids-drawing-to-art's stylized art", () => {
  it("no longer names the retired model anywhere", () => {
    expect(drawing).not.toMatch(/dall-e/i);
  });

  it("generates through the shared, proven image layer instead of a direct fetch", () => {
    expect(drawing).toContain('import { generateImage } from "../_shared/contentMedia.ts";');
    expect(drawing).not.toContain("https://api.openai.com/v1/images/generations");
  });

  it("keeps refusing the request with 502 when no image comes back", () => {
    // Unlike the story cover, this path has always treated a missing image as
    // a hard failure rather than a best-effort omission — that must not change.
    expect(drawing).toContain('if (!imageUrl) return json({ error: "Could not generate the stylized image right now" }, 502, cors);');
  });

  it("keeps the response field name the frontend expects", () => {
    // src/features/visionkids/services/studio/drawingToArt.ts reads this
    // exact field and renders it directly as an <img src>.
    expect(drawing).toContain("return json({ description: result.description, imageUrl }, 200, cors);");
  });
});
