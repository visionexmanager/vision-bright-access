import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { PLATFORMS } from "@/lib/publishing/types";
import { defaultAdapters } from "@/lib/publishing/adapters";

// Phase 9, step 1 — the platform vocabulary, before any connection exists.
//
// Structural assertions over the migration, the same method the Phase 8 suite
// uses and for the same reason: what this step claims is a property of the SQL,
// not a behaviour of a caller. The additional thing tested here is *agreement* —
// three separate lists (the CHECK, the Platform union, the admin select) now
// name the same platforms, and a divergence between them is invisible until an
// INSERT fails at the far end of a form the owner already filled in.

const migration = readFileSync(
  "supabase/migrations/20260909000000_social_platform_vocabulary.sql",
  "utf8",
);
const ownerControl = readFileSync("src/pages/admin/OwnerControlCenter.tsx", "utf8");
const english = readFileSync("src/i18n/en.ts", "utf8");

/** The quoted values of one named CHECK constraint in the migration. */
function checkValues(constraint: string): string[] {
  const start = migration.indexOf(`ADD CONSTRAINT ${constraint}`);
  expect(start, `${constraint} must be added by the migration`).toBeGreaterThan(-1);
  const end = migration.indexOf(";", start);
  const body = migration.slice(start, end);
  return [...body.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
}

/** Platforms with an external identity — the two account-side tables. */
const EXTERNAL = ["facebook", "instagram", "threads", "tiktok", "youtube", "x", "linkedin"];
/** Everything the owner can plan for, including what Visionex publishes itself. */
const PLANNABLE = [...EXTERNAL, "website", "newsletter"];

describe("the seven platforms Visionex has an identity on are nameable", () => {
  it("widens all four platform CHECKs and keeps the two vocabularies distinct", () => {
    expect(checkValues("social_accounts_platform_check")).toEqual(EXTERNAL);
    expect(checkValues("social_publications_platform_check")).toEqual(EXTERNAL);
    expect(checkValues("content_proposals_platform_check")).toEqual(PLANNABLE);
    expect(checkValues("content_calendar_platform_check")).toEqual(PLANNABLE);
  });

  it("keeps website and newsletter off the account tables", () => {
    // An account row for either would make claim_due_content_slot() consider a
    // slot for a platform there is nothing to authenticate against.
    for (const constraint of ["social_accounts_platform_check", "social_publications_platform_check"]) {
      expect(checkValues(constraint)).not.toContain("website");
      expect(checkValues(constraint)).not.toContain("newsletter");
    }
  });

  it("only ever widens — every previously storable value is still storable", () => {
    // Phase 8's four, plus Phase 7's two on the planning side. A value dropped
    // here would fail the ALTER against live rows that already hold it.
    for (const platform of ["facebook", "instagram", "tiktok", "youtube"]) {
      expect(checkValues("social_accounts_platform_check")).toContain(platform);
      expect(checkValues("content_proposals_platform_check")).toContain(platform);
    }
    for (const platform of ["website", "newsletter"]) {
      expect(checkValues("content_calendar_platform_check")).toContain(platform);
    }
  });
});

describe("the drop block cannot take the wrong constraint with it", () => {
  it("finds the old CHECKs by constrained column, not by matching their text", () => {
    // content_proposals also has `section IN (…)`. An ILIKE '%platform%' search
    // over pg_get_constraintdef would be one rename away from dropping it, and
    // the section vocabulary would be silently gone.
    expect(migration).toContain("att.attname = 'platform'");
    expect(migration).toContain("att.attnum = ANY (con.conkey)");
    expect(migration).not.toMatch(/pg_get_constraintdef\([^)]*\)\s+ILIKE/i);
  });

  it("names the new constraints so the next migration need not guess", () => {
    for (const table of ["content_proposals", "content_calendar", "social_accounts", "social_publications"]) {
      expect(migration).toContain(`ADD CONSTRAINT ${table}_platform_check`);
    }
  });
});

describe("the three lists agree", () => {
  it("matches the Platform union to the social_accounts CHECK", () => {
    expect([...PLATFORMS]).toEqual(EXTERNAL);
  });

  it("matches the admin select to the content_proposals CHECK", () => {
    const start = ownerControl.indexOf("const PLATFORMS = [");
    expect(start).toBeGreaterThan(-1);
    const list = ownerControl.slice(start, ownerControl.indexOf("] as const", start));
    expect([...list.matchAll(/"([a-z_]+)"/g)].map((match) => match[1])).toEqual(PLANNABLE);
  });

  it("gives every plannable platform a label rather than a raw key", () => {
    for (const platform of PLANNABLE) {
      expect(english, `content.platform.${platform} must be translatable`)
        .toContain(`"content.platform.${platform}":`);
    }
  });

  it("registers a refusing adapter for each new platform", () => {
    const adapters = defaultAdapters();
    for (const platform of EXTERNAL) {
      const adapter = adapters.get(platform as (typeof PLATFORMS)[number]);
      expect(adapter, `${platform} must have an adapter entry`).toBeDefined();
      expect(adapter.readiness(undefined).ready, `${platform} must refuse to publish`).toBe(false);
    }
  });
});

describe("naming a platform is not connecting to it", () => {
  it("adds no credential, no account row and no external call", () => {
    expect(migration).not.toMatch(/INSERT INTO public\.social_accounts/i);
    expect(migration).not.toMatch(/https?:\/\//);
    expect(migration).not.toMatch(/access_token|client_secret|refresh_token/i);
  });

  it("leaves the activation gate exactly where Phase 8 put it", () => {
    // A newly nameable platform must be as unable to publish as a platform that
    // has been nameable all along. The gate is two things — the constraint that
    // refuses `active` without a recorded review, and the claim function's
    // active-account predicate — and this migration redefines neither. Asserting
    // that it declares no function at all is the stronger form of that claim:
    // there is no body here that could have changed either one.
    expect(migration).not.toMatch(/CREATE (OR REPLACE )?FUNCTION/i);
    expect(migration).not.toMatch(/CREATE (OR REPLACE )?TRIGGER/i);
    expect(migration).not.toMatch(/CREATE POLICY|DROP POLICY/i);

    // The review constraint is protected by the column filter above, not by a
    // name check — but it must not be named for dropping here either.
    expect(migration).not.toContain("DROP CONSTRAINT social_accounts_active_requires_review");
  });
});
