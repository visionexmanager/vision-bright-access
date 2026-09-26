// OpenRouter, NVIDIA NIM, Bytez and FAL are registered, inactive, and
// unreachable from production (provider audit, 2026-09-26).
//
// Each authenticates and each is blocked outside this repository (see the
// migration header and docs/ai-provider-readiness.md). These tests pin the
// three things that keep a blocked provider from ever serving a user: its row
// is inactive, no code path names it, and its key is not synced to the Edge
// Function runtime.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FILE = "supabase/migrations/20261050000000_ph_providers_blocked_external_rows.sql";
const sql = readFileSync(FILE, "utf8");
const code = sql.replace(/--.*$/gm, "");

const ROWS = [
  ["openrouter-chat", "chat", "OPENROUTER_API_KEY", "account"],
  ["nvidia-nim-chat", "chat", "NVIDIA_NIM_API_KEY", "licence"],
  ["bytez-chat", "chat", "BYTEZ_API_KEY", "account"],
  ["fal-image", "image", "FAL_KEY", "account"],
  ["fal-video", "text_to_video", "FAL_KEY", "account"],
] as const;

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []);
}

describe("the migration", () => {
  it("registers exactly the five rows, every one inactive and marked production-ineligible with its blocker", () => {
    const inserted = [...code.matchAll(/\('[^']+', '([a-z-]+)', '([a-z_]+)', '([a-z]+)', 90, '([A-Z_]+)'/g)]
      .map((m) => [m[1], m[2], m[3], m[4]]);
    expect(inserted).toEqual(ROWS.map(([slug, type, key]) => [slug, type, "inactive", key]));
    expect(code.match(/'production_eligible', false/g)).toHaveLength(5);
    for (const [, , , kind] of ROWS) expect(code).toContain(`'blocker_kind', '${kind}'`);
  });

  it("is re-runnable and never overwrites an admin's row", () => {
    expect(code).toMatch(/ON CONFLICT \(slug\) DO NOTHING;\s*$/);
    expect(code).not.toMatch(/\bUPDATE\b|\bDELETE\b|\bDROP\b|\bTRUNCATE\b/i);
  });

  it("invents no cost and no provider-level capability", () => {
    expect(code).not.toMatch(/cost_per_request/);
    expect(code.match(/ARRAY\[\]::text\[\]/g)).toHaveLength(5);
  });
});

describe("no production path can reach them", () => {
  const functions = filesUnder("supabase/functions");

  it("no Edge Function reads their keys or calls their APIs", () => {
    for (const f of functions) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/OPENROUTER_API_KEY|NVIDIA_NIM_API_KEY|BYTEZ_API_KEY|FAL_KEY/);
      expect(src, f).not.toMatch(/openrouter\.ai|integrate\.api\.nvidia\.com|api\.bytez\.com|fal\.run|queue\.fal/);
    }
  });

  it("the chat/vision chains cannot name them: the adapter's provider union excludes them", () => {
    const ai = readFileSync("supabase/functions/_shared/aiProvider.ts", "utf8");
    const union = ai.match(/export type AIProvider = ([^;]+);/)?.[1] ?? "";
    expect(union).not.toMatch(/openrouter|nvidia|nim|bytez|fal/i);
  });

  it("the deploy does not sync the three chat keys into the Edge Function runtime", () => {
    const deploy = readFileSync(".github/workflows/deploy.yml", "utf8");
    const loop = deploy.match(/for name in ([^;]+); do/)?.[1] ?? "";
    expect(loop.length).toBeGreaterThan(100);
    for (const k of ["OPENROUTER_API_KEY", "NVIDIA_NIM_API_KEY", "BYTEZ_API_KEY"]) expect(loop.split(/\s+/)).not.toContain(k);
  });
});
