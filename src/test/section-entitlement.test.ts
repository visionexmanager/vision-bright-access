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
] as const;

/**
 * Expensive functions that are deliberately NOT gated to a section, and why.
 *
 * Each is reached from more than one section, so gating it to the most
 * expensive one would break the cheaper caller. Fixing that needs a product
 * decision about which section governs, not a guess in a test file — so it is
 * recorded here rather than silently left undone.
 */
const DELIBERATELY_UNGATED: Readonly<Record<string, string>> = {
  "voice-studio": "also called from VisionKids ProjectCard — gating to mediaStudio would break Kids",
  "ocr-scan": "also called from the Library reader's AccessibilityDescribePanel — gating it would break an accessibility feature",
  "speech-generate": "serves Library read-aloud as well as the studio",
  "file-convert": "no verified frontend caller; gating an unverified path risks breaking one that is not obvious",
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
