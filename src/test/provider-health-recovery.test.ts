// Phase 2J-1: the provider lifecycle, in the statuses ph_providers already has.
//
//   inactive, error    administrative — no automation ever changes them.
//   active ⇄ degraded  automatic — failures degrade, successes and passing
//                       probes recover.
//   mock-video         administratively disabled: a demo row nothing implements.
//
// The SQL itself was executed in PGlite when this was written (see the PR):
// three failures degraded a row and one success restored it; the previous
// function body, restored, left it degraded. Here the migration's text and the
// probe rule's own expressions are checked, the latter by evaluating them.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRATION = "20261040000000_provider_health_recovery.sql";
const migration = readFileSync(`supabase/migrations/${MIGRATION}`, "utf8");
const original = readFileSync("supabase/migrations/20260628500000_provider_hub.sql", "utf8");
const hub = readFileSync("supabase/functions/provider-hub/index.ts", "utf8");

const fnBody = (sql: string) => {
  const start = sql.search(/CREATE OR REPLACE FUNCTION (public\.)?ph_record_metric\(/);
  return sql.slice(start, sql.indexOf("$$;", start) + 3);
};

describe("ph_record_metric: automatic recovery, administrative states untouched", () => {
  const next = fnBody(migration);

  it("returns a degraded row to active on a success — and only a degraded row", () => {
    const recovery = next.slice(next.indexOf("IF p_success THEN"));
    expect(recovery).toMatch(/SET status = 'active'[\s\S]*WHERE id = p_provider_id\s+AND status = 'degraded';/);
    expect(recovery).not.toMatch(/status\s*(=|IN)\s*\(?'(inactive|error)'/);
  });

  it("keeps every statement of the previous body, auto-degrade included", () => {
    const statements = fnBody(original)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("--") && !/^CREATE OR REPLACE|RETURNS|LANGUAGE|^\) RETURNS/.test(l));
    for (const line of statements) expect(next, line).toContain(line);
    expect(next).toMatch(/SET status = 'degraded'[\s\S]*consecutive_failures >= 3\s+AND status = 'active';/);
  });

  it("recovers only after the degrade check, so a success can never be degraded by it", () => {
    expect(next.indexOf("SET status = 'degraded'")).toBeLessThan(next.indexOf("IF p_success THEN"));
  });

  it("keeps its security shape: definer, pinned search_path, service_role only", () => {
    expect(next).toContain("SECURITY DEFINER");
    expect(next).toContain("SET search_path = public");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.ph_record_metric(uuid, boolean, integer, numeric) FROM PUBLIC, anon, authenticated;");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.ph_record_metric(uuid, boolean, integer, numeric) TO service_role;");
  });

  it("comes after every migration that was on main before it, with a unique version", () => {
    // Later phases add migrations after it (2K-2 did), so "newest" is not the
    // invariant; ordering after 20261039 and a unique version are.
    const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
    expect(files.indexOf(MIGRATION)).toBeGreaterThan(files.indexOf("20261039000000_openai_video_provider_row.sql"));
    expect(files.filter((f) => f.startsWith("20261040000000_"))).toHaveLength(1);
  });
});

describe("mock-video: administratively disabled, not deleted", () => {
  it("sets it inactive, only from active, so a re-run is a no-op", () => {
    expect(migration).toMatch(/UPDATE public\.ph_providers\s+SET status = 'inactive', updated_at = now\(\)\s+WHERE slug = 'mock-video'\s+AND status = 'active';/);
  });

  it("deletes nothing and leaves mock-tts and mock-vc alone", () => {
    expect(migration).not.toMatch(/\bDELETE\b/);
    expect(migration.replace(/--.*$/gm, "")).not.toMatch(/mock-tts|mock-vc/);
  });

  it("has no implementation a video request could reach", () => {
    const studio = readFileSync("supabase/functions/video-studio/index.ts", "utf8");
    const getProvider = studio.slice(studio.indexOf("function getProvider("), studio.indexOf("// ── Provider registry recording"));
    expect(getProvider).not.toMatch(/mock/i);
    expect(getProvider).toContain('throw new Error(`Unknown video provider: "${requested}". Supported: luma, runpod, fal`);');
  });
});

describe("provider-hub's health probe follows the same lifecycle", () => {
  // The real expressions from the source, evaluated — not a paraphrase of them.
  const line = (prefix: string) => {
    const at = hub.indexOf(prefix);
    expect(at, prefix).toBeGreaterThan(0);
    return hub.slice(at, hub.indexOf(";", at) + 1);
  };
  const floor = Number(/const HEALTH_AFTER_PASSING_PROBE = (\d+);/.exec(hub)?.[1]);
  const probe = new Function(
    "provider", "healthy", "HEALTH_AFTER_PASSING_PROBE",
    [line("const automatic ="), line("const newStatus ="), line("const recoveredHealth ="),
      "return { status: newStatus, health: healthy ? recoveredHealth : Math.max(0, provider.health_score - 15) };"].join("\n"),
  ) as (p: { status: string; health_score: number }, healthy: boolean, f: number) => { status: string; health: number };
  const run = (status: string, health_score: number, healthy: boolean) => probe({ status, health_score }, healthy, floor);

  it("a healthy provider stays healthy", () => {
    expect(run("active", 100, true)).toEqual({ status: "active", health: 100 });
  });

  it("a degraded provider recovers on a passing probe, back above the routers' cut-off", () => {
    const r = run("degraded", 0, true);
    expect(r.status).toBe("active");
    expect(r.health).toBeGreaterThan(20);
    expect(floor).toBeGreaterThan(20);
    expect(floor).toBeLessThan(100);
  });

  it("the floor never lowers a healthier score", () => {
    expect(run("active", 90, true).health).toBe(95);
  });

  it("a failing probe degrades an active provider", () => {
    expect(run("active", 100, false)).toEqual({ status: "degraded", health: 85 });
  });

  it("an administratively inactive provider is never reactivated", () => {
    expect(run("inactive", 100, true).status).toBe("inactive");
    expect(run("inactive", 0, false).status).toBe("inactive");
  });

  it("an administrative error marking is left alone too", () => {
    expect(run("error", 30, true).status).toBe("error");
    expect(run("error", 30, false).status).toBe("error");
  });
});

describe("provider selection is unchanged", () => {
  it("both routers still exclude only inactive rows and health at or below 20", () => {
    const router = readFileSync("supabase/functions/_shared/providerRouter.ts", "utf8");
    expect(router).toContain('.neq("status", "inactive")');
    // Since Phase 2J-2 resolveProvider's ranking lives in providerSelection.ts.
    const ranking = readFileSync("supabase/functions/_shared/providerSelection.ts", "utf8");
    expect(router).toContain("return rankProviders(providers as RouterProvider[], prefs);");
    expect(ranking).toContain("p.health_score > 20 &&");
    expect(hub).toContain('p.status !== "inactive" &&');
    expect(hub).toContain("p.health_score > 20 &&");
  });

  it("video-studio still chooses by environment key and never reads the registry", () => {
    const studio = readFileSync("supabase/functions/video-studio/index.ts", "utf8");
    // auto: Luma, or FAL only when Luma has no key and fal-video is routable (2026-09-26).
    expect(studio).toContain('if (!requested) requested = !lumaKey && opts.falRoutable && falKey ? "fal" : "luma";');
    expect(studio).not.toMatch(/resolveProvider|from\("ph_providers"\)/);
  });

  it("speech-generate still maps only real TTS slugs, falling back to OpenAI", () => {
    const speech = readFileSync("supabase/functions/speech-generate/index.ts", "utf8");
    const map = speech.slice(speech.indexOf("SLUG_TO_TTS_PROVIDER"), speech.indexOf("};", speech.indexOf("SLUG_TO_TTS_PROVIDER")));
    expect(map).not.toMatch(/mock/);
    expect(speech).toContain('return "openai";');
  });
});
