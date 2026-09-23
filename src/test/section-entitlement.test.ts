// Plan enforcement on the side the caller does not control.
//
// `PlanGate` decides what a route renders. That is not a permission check: a
// valid session on any plan could call a Business-only Edge Function directly
// and be served. `user_has_section` is the second answer, in SQL, and these
// pin the pieces that make it worth having.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { FREE_SECTIONS, SECTIONS } from "@/lib/billing/plans";

const migration = readFileSync(
  "supabase/migrations/20261031000000_section_entitlement_server_side.sql", "utf8");
const helper = readFileSync("supabase/functions/_shared/entitlements.ts", "utf8");
const imageGenerate = readFileSync("supabase/functions/image-generate/index.ts", "utf8");

/** The file's own prose explains what it no longer allows, so negatives run against code. */
const code = (src: string) =>
  src.split("\n").filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("--")).join("\n");

describe("the free set has one definition, in two places", () => {
  it("free_sections() lists exactly what plans.ts lists", () => {
    const sql = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION public.free_sections"));
    const declared = sql.match(/ARRAY\[([^\]]*)\]/)![1]
      .split(",").map((s) => s.trim().replace(/'/g, "")).filter(Boolean);
    expect(declared).toEqual([...FREE_SECTIONS]);
  });

  it("every section the helper names is a real section", () => {
    const union = helper.slice(helper.indexOf("export type Section ="), helper.indexOf(";", helper.indexOf("export type Section =")));
    const named = union.match(/"([a-zA-Z]+)"/g)!.map((s) => s.replace(/"/g, ""));
    expect(named.sort()).toEqual(SECTIONS.map((s) => s.key).sort());
  });
});

describe("only the server may ask", () => {
  it("revokes the resolvers from both browser roles", () => {
    for (const fn of ["plan_for_user(uuid)", "user_sections(uuid)", "user_has_section(uuid, text)"]) {
      const sig = fn.replace(/[()]/g, "\\$&");
      // REVOKE FROM PUBLIC does not cover anon and authenticated — they hold
      // their own grants — so both names have to appear.
      expect(migration, `${fn} is not revoked`)
        .toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${sig}\\s+FROM PUBLIC, anon, authenticated;`));
      expect(migration, `${fn} is not granted to the service role`)
        .toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${sig}\\s+TO service_role;`));
    }
  });

  it("keeps free_sections() reachable by a signed-in account", () => {
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.free_sections\(\) TO authenticated, service_role;/);
  });
});

describe("an unknown plan falls to the free set, never to everything", () => {
  it("says so in the fallback, not just in a comment", () => {
    const fn = migration.slice(migration.indexOf("FUNCTION public.user_sections"));
    expect(fn).toContain("RETURN COALESCE(_sections, public.free_sections());");
    expect(code(fn)).not.toContain("RETURN _sections;\nEND");
  });

  it("treats a deactivated plan as no plan", () => {
    const fn = migration.slice(migration.indexOf("FUNCTION public.plan_for_user"));
    expect(fn).toContain("AND is_active");
    expect(fn).toContain("RETURN 'none';");
  });
});

/**
 * The AI Media Studio endpoints, each of which says so in its own header.
 *
 * The section is read off the code rather than guessed: `image-tools-generate`
 * calls itself "AI Media Studio Image Studio extension", `text-tools-generate`
 * the "Text Tools Studio endpoint", `document-generate` the "Document Studio
 * endpoint", and `video-studio` is the studio's text-to-video generator. The
 * studio lives at /services/ai-media-studio, which `sectionForPath` resolves to
 * `mediaStudio`, which only Business opens.
 */
const MEDIA_STUDIO = [
  "image-generate",
  "image-tools-generate",
  "text-tools-generate",
  "document-generate",
  "video-studio",
  // Added after tracing real call sites rather than headers. `voice-studio` is
  // reached only from the studio's VoiceStudio page and VoiceProfileDetail —
  // VisionKids' ProjectCard entry is a route-slug map, and the Kids voice page
  // calls `text-to-speech` and `speech-transcribe` instead. `speech-generate`
  // has exactly one caller, SpeechStudio; it does not serve Library read-aloud.
  "voice-studio",
  "speech-generate",
] as const;

/** The File Studio's server-side converter. `/services/file-studio` is `professional`. */
const PROFESSIONAL = ["file-convert"] as const;

/**
 * Deliberately NOT gated, and why.
 *
 * `ocr-scan` appears in no SECTIONS entry, so `/services/ocr-scan` resolves to
 * no section and is free by construction — and the Library reader's
 * AccessibilityDescribePanel calls it to describe an image for somebody who
 * cannot see it. Gating it would put an accessibility feature behind a paid
 * plan. It carries a 20/day ceiling instead.
 */
const DELIBERATELY_UNGATED: Readonly<Record<string, string>> = {
  "ocr-scan": "free by construction — in no SECTIONS entry — and called by the Library reader's accessibility panel; rate-limited at 20/day instead",
};

describe("the Business-only generators check before they work", () => {
  for (const fn of MEDIA_STUDIO) {
    const src = readFileSync(`supabase/functions/${fn}/index.ts`, "utf8");

    it(`${fn} asks about the media studio`, () => {
      expect(src).toContain('maySeeSection(');
      expect(src).toContain('"mediaStudio"');
      expect(src).toContain("sectionRefusal(");
    });

    it(`${fn} asks after the session is verified and before the body is read`, () => {
      const auth = src.indexOf("auth.getUser()");
      const gate = src.indexOf("maySeeSection(");
      const body = src.indexOf("await req.json()");
      expect(auth, "no session check at all").toBeGreaterThan(-1);
      expect(gate, "gate runs before the session is verified").toBeGreaterThan(auth);
      if (body > -1) expect(gate, "gate runs after the body is read").toBeLessThan(body);
    });

    it(`${fn} uses a service client, because the resolver is revoked from a session`, () => {
      expect(src).not.toContain("maySeeSection(userClient");
      expect(src).toMatch(/maySeeSection\((serviceClient|dbService)/);
    });
  }
});

describe("the File Studio's converter checks the professional section", () => {
  const src = readFileSync("supabase/functions/file-convert/index.ts", "utf8");

  it("asks about professional, not mediaStudio", () => {
    expect(src).toContain('maySeeSection(serviceClient, user.id, "professional")');
    expect(src).toContain('sectionRefusal("professional"');
    expect(src).not.toContain('"mediaStudio"');
  });

  it("asks after the session is verified and before the body is read", () => {
    const auth = src.indexOf("auth.getUser()");
    const gate = src.indexOf("maySeeSection(");
    const body = src.indexOf("await req.json()");
    expect(gate).toBeGreaterThan(auth);
    expect(gate).toBeLessThan(body);
  });

  it("counts against the shared rate limiter rather than a new one", () => {
    expect(src).toContain('_function_name: "file-convert"');
    expect(src).toContain('db.rpc("check_ai_rate_limit"'.replace("db", "serviceClient"));
    expect(src).toContain("429");
  });
});

describe("voice-studio gates people without gating the cron", () => {
  const src = readFileSync("supabase/functions/voice-studio/index.ts", "utf8");

  it("handles drain_retention before the entitlement check", () => {
    const cron = src.indexOf('cronBody.action === "drain_retention"');
    const gate = src.indexOf("maySeeSection(");
    expect(cron, "no cron branch").toBeGreaterThan(-1);
    expect(gate, "the gate runs before the cron branch — the sweep would be asked for a subscription")
      .toBeGreaterThan(cron);
  });

  it("returns from inside the cron branch, so it can never fall through", () => {
    const cron = src.indexOf('cronBody.action === "drain_retention"');
    const gate = src.indexOf("maySeeSection(");
    const between = src.slice(cron, gate);
    expect(between).toContain("return handleDrainRetention(");
  });

  it("still authenticates the cron with CRON_SECRET, failing closed", () => {
    expect(src).toContain('Deno.env.get("CRON_SECRET")');
    expect(src).toContain('if (!cronSecret) return json({ ok: false, error: "not_configured" }, 503);');
    expect(src).toContain("if (authHeader !== `Bearer ${cronSecret}`) return jsonError(\"Unauthorized\", 401);");
  });
});

describe("speech-generate is gated and metered", () => {
  const src = readFileSync("supabase/functions/speech-generate/index.ts", "utf8");

  it("counts against the shared limiter under its own name", () => {
    expect(src).toContain('_function_name: "speech-generate"');
    expect(src).toContain("429");
  });

  it("keeps the 4,096-character cap as well as the ceiling", () => {
    expect(src).toContain("text.length > 4096");
  });
});

describe("the rate-limit ceilings are the ones the audit chose", () => {
  const migration = readFileSync(
    "supabase/migrations/20261035000000_rate_limits_speech_and_convert.sql", "utf8");

  it("adds twenty for speech-generate and ten for file-convert", () => {
    expect(migration).toMatch(/WHEN 'speech-generate'\s+THEN 20/);
    expect(migration).toMatch(/WHEN 'file-convert'\s+THEN 10/);
  });

  it("leaves every existing ceiling where it was", () => {
    for (const [fn, limit] of [["ocr-scan", 20], ["voice-studio-clone", 5], ["ai-chat", 60],
                               ["generate-diet-plan", 10], ["enrich-product", 50]] as const) {
      expect(migration, fn).toMatch(new RegExp(`WHEN '${fn}'\\s+THEN ${limit}`));
    }
    expect(migration).toContain("ELSE 30");
  });

  it("extends the existing counter rather than building a second one", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.check_ai_rate_limit");
    expect(migration).toContain("public.ai_usage_log");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID, TEXT) TO service_role;");
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.check_ai_rate_limit\(UUID, TEXT\) FROM PUBLIC, anon, authenticated;/);
  });
});

describe("the two JWT lists cannot drift apart for voice-studio", () => {
  const script = readFileSync("scripts/deploy-changed-supabase-functions.sh", "utf8");
  const toml = readFileSync("supabase/config.toml", "utf8");

  it("voice-studio is exempt in both, because the cron uses a secret and not a JWT", () => {
    // The script is what the deploy applies; config.toml is what `functions
    // serve` reads locally. An exemption in one and not the other is how the
    // retention cron would start failing on a redeploy nobody connected to it.
    expect(script, "missing from the deploy script").toMatch(/^\s*\[voice-studio\]=1/m);
    const section = toml.slice(toml.indexOf("[functions.voice-studio]"));
    expect(section.slice(0, section.indexOf("\n[") + 1 || undefined))
      .toMatch(/verify_jwt\s*=\s*false/);
  });

  it("and the exemption is still narrow — the gate is in the function, not absent", () => {
    const src = readFileSync("supabase/functions/voice-studio/index.ts", "utf8");
    expect(src).toContain("auth.getUser()");
    expect(src).toContain("maySeeSection(");
  });
});

describe("what is deliberately left ungated is written down", () => {
  it("names a reason for every one, and none of them is gated by accident", () => {
    for (const [fn, reason] of Object.entries(DELIBERATELY_UNGATED)) {
      expect(reason.length, `${fn} has no stated reason`).toBeGreaterThan(20);
      const src = readFileSync(`supabase/functions/${fn}/index.ts`, "utf8");
      // If one of these ever does get a gate, this fails and the list is
      // updated on purpose rather than drifting out of date.
      expect(src, `${fn} is now gated — move it out of DELIBERATELY_UNGATED`)
        .not.toContain("maySeeSection(");
    }
  });
});

describe("the refusal tells a customer what to do and nothing else", () => {
  it("is 403 with an upgrade link, not 402", () => {
    expect(helper).toContain('error: "plan_required"');
    expect(helper).toContain("https://visionex.app/pricing");
    expect(helper).toContain("status: unavailable ? 503 : 403");
  });

  it("names no plan, no provider, no cost", () => {
    const refusal = code(helper).slice(code(helper).indexOf("export function sectionRefusal"));
    for (const leak of ["plan_for_user", "base_cost", "actual_cost", "openai", "vx_price", "provider"]) {
      expect(refusal, leak).not.toContain(leak);
    }
  });

  it("refuses when the lookup fails, rather than allowing", () => {
    // The rendering path falls back to the free sections so nobody is locked
    // out of the news. This path is the other way round on purpose.
    expect(helper).toContain("if (error) return { allowed: false, unavailable: true };");
  });
});
