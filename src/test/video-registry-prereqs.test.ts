// Phase 2J-0: the prerequisites the Phase 2J design named, none of which
// changes how a video provider is chosen.
//   1. A registry row for Sora, the vendor actually serving video.
//   2. video-studio records each job's outcome against its provider's row.
//   3. A failed job insert no longer returns the database's own wording.
//   4. An admin health probe can no longer switch an inactive provider on.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  recordProviderOutcome,
  VIDEO_PROVIDER_SLUG,
} from "../../supabase/functions/_shared/providerRecording.ts";

const MIGRATION = "20261039000000_openai_video_provider_row.sql";
const migration = readFileSync(`supabase/migrations/${MIGRATION}`, "utf8");
const studio = readFileSync("supabase/functions/video-studio/index.ts", "utf8");
const hub = readFileSync("supabase/functions/provider-hub/index.ts", "utf8");

describe("1. the Sora registry row", () => {
  it("inserts openai-video as an active text_to_video row, re-runnably", () => {
    expect(migration).toMatch(/INSERT INTO public\.ph_providers/);
    expect(migration).toContain("'openai-video'");
    expect(migration).toContain("'text_to_video'");
    expect(migration).toContain("'active'");
    expect(migration).toContain("'sora-2'");
    expect(migration).toContain("ON CONFLICT (slug) DO NOTHING;");
  });

  it("names the secret, never a value, and invents no cost", () => {
    expect(migration).toContain("'OPENAI_API_KEY'");
    expect(migration).not.toMatch(/sk-[A-Za-z0-9]/);
    const values = migration.slice(migration.indexOf("VALUES ("));
    expect(values).toMatch(/ARRAY\['text-to-video', 'async', '720p'\],\s*0,\s*0,/);
  });

  it("is data only: no schema, grant or policy change", () => {
    expect(migration).not.toMatch(/\b(ALTER|CREATE|DROP|GRANT|REVOKE)\b/);
  });

  it("is the newest migration, after every version already on main", () => {
    const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
    expect(files.at(-1)).toBe(MIGRATION);
    expect(files.filter((f) => f.startsWith("20261039000000_"))).toHaveLength(1);
  });
});

describe("2. video-studio records, and still chooses exactly as before", () => {
  it("maps each of its provider names to a registry row", () => {
    expect(VIDEO_PROVIDER_SLUG).toEqual({ openai: "openai-video", luma: "luma-video", runpod: "runpod-video" });
  });

  it("never reads the registry to choose a provider", () => {
    expect(studio).not.toMatch(/resolveProvider|providerRouter|from\("ph_providers"\)/);
    // The environment rule, unchanged: auto means Sora if its key is set, else Luma.
    expect(studio).toContain('if (!requested) requested = openaiKey ? "openai" : lumaKey ? "luma" : "";');
    // RunPod is still explicit-only and behind its own readiness gate.
    expect(studio).toContain("const readiness  = runpodReadiness(endpointId);");
  });

  it("records a rejected submission, a failed render and a finished render — nothing else", () => {
    const calls = [...studio.matchAll(/await recordVideoOutcome\(dbService, provider\.name, \{([^}]*)\}/g)].map((m) => m[1]);
    expect(calls).toHaveLength(3);
    expect(calls.some((c) => c.includes('error: "submit_rejected"'))).toBe(true);
    expect(calls.some((c) => c.includes('error: "generation_failed"'))).toBe(true);
    expect(calls.some((c) => c.includes("success: true"))).toBe(true);
  });

  it("records only short codes and a duration — never the prompt, a URL or provider text", () => {
    const calls = [...studio.matchAll(/await recordVideoOutcome\(dbService, provider\.name, \{([^}]*)\}/g)].map((m) => m[1]);
    for (const c of calls) {
      expect(c).not.toMatch(/prompt|videoUrl|result\.error|pollResult\.error|url/i);
    }
  });

  it("does not record a configuration failure against a provider", () => {
    const poll = studio.slice(studio.indexOf("async function handlePoll"));
    const catchBlock = poll.slice(poll.indexOf("provider = getProvider(job.provider);"), poll.indexOf("const pollResult = await provider.pollJob"));
    expect(catchBlock).not.toContain("recordVideoOutcome");
  });

  it("records through the service client, and generate now receives it", () => {
    expect(studio).toContain("return handleGenerate(body, user.id, db, dbService);");
    expect(studio).toContain('await recordProviderOutcome(dbService, slug, "text_to_video", outcome);');
  });

  it("keeps the generate response exactly as it was", () => {
    expect(studio).toContain("return json({ ok: true, job_id: job.id });");
  });

  it("recordProviderOutcome writes against the named row and swallows failure", async () => {
    const calls: string[] = [];
    const db = {
      from: (t: string) => ({
        select: () => ({ eq: (_c: string, v: string) => ({ maybeSingle: async () => { calls.push(`select:${t}:${v}`); return { data: { id: "r-1", slug: v } }; } }) }),
        insert: async (row: Record<string, unknown>) => { calls.push(`insert:${t}:${row.job_type}:${row.status}`); return {}; },
      }),
      rpc: async (fn: string) => { calls.push(`rpc:${fn}`); return {}; },
    };
    await recordProviderOutcome(db, "luma-video", "text_to_video", { success: false, ms: 5, error: "generation_failed" });
    expect(calls).toEqual(["select:ph_providers:luma-video", "rpc:ph_record_metric", "insert:ph_logs:text_to_video:failure"]);
    const broken = { from() { throw new Error("down"); } };
    await expect(recordProviderOutcome(broken, "openai-video", "text_to_video", { success: true, ms: 1 })).resolves.toBeUndefined();
  });
});

describe("3. a failed job insert is generic to the caller", () => {
  it("returns one sentence and keeps the database detail in the log", () => {
    expect(studio).not.toContain("Failed to create video job: ${detail}");
    expect(studio).not.toContain("Database table 'vx_video_jobs' not found");
    expect(studio).toContain('return jsonError("The video job could not be started. Please try again later.", 500);');
    expect(studio).toContain('console.error("[video-studio] job insert failed:"');
  });
});

describe("4. a health probe never switches a provider on", () => {
  it("keeps an inactive row inactive whatever the probe says", () => {
    expect(hub).toContain('const newStatus = provider.status === "inactive" ? "inactive" : healthy ? "active" : "degraded";');
    expect(hub).not.toContain('const newStatus = healthy ? "active" : "degraded";');
  });
});
