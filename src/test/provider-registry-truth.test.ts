import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The provider registry says what can actually run (20261060). The Provider
// Hub listed Luma video and two demo providers as active; none can serve.
// Executed in PGlite by scripts/sql/provider-registry-truth-scenarios.mjs.

const SQL = readFileSync("supabase/migrations/20261060000000_provider_registry_truth.sql", "utf8").replace(/--[^\n]*/g, "");
const parked = readFileSync("supabase/functions/_shared/providerState.ts", "utf8");

describe("20261060 provider registry truth", () => {
  it("marks luma-video inactive, only while it claims active, and says why", () => {
    expect(SQL).toMatch(/SET status\s+= 'inactive'[\s\S]*?'LUMA_API_KEY not set; parked in providerState\.ts[\s\S]*?WHERE slug = 'luma-video'\s+AND status = 'active';/);
    // It is parked in code for the same reason, so the two agree.
    expect(parked).toContain('["luma", "no LUMA_API_KEY');
  });

  it("marks the two demo rows inactive", () => {
    expect(SQL).toMatch(/WHERE slug IN \('mock-tts', 'mock-vc'\)\s+AND status = 'active';/);
  });

  it("touches nothing else: no other row, no billing, no grant", () => {
    const updates = SQL.match(/UPDATE public\.ph_providers/g) ?? [];
    expect(updates).toHaveLength(2);
    expect(SQL).not.toMatch(/INSERT|DELETE|GRANT|REVOKE|billing|vx_|price|user_points/i);
    expect(SQL).not.toMatch(/slug = 'openai|slug = 'mistral|slug = 'groq|slug = 'gemini/);
  });

  it("no code routes by these rows' status, so this changes what is reported, not what runs", () => {
    const video = readFileSync("supabase/functions/video-studio/index.ts", "utf8");
    expect(video).not.toContain('providerRoutableIn(dbService, "luma-video")');
    expect(readFileSync("supabase/functions/speech-generate/index.ts", "utf8")).toContain('return "openai";');
  });
});
