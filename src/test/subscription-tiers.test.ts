import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FREE_SECTIONS,
  SECTIONS,
  TIERS,
  TIER_ORDER,
  TRIAL_DAYS,
  cheapestTierFor,
  planAllows,
  planSections,
  sectionForPath,
  type SectionKey,
} from "@/lib/billing/plans";

// Two copies of the tier lists exist on purpose: the database owns them so an
// admin can move a section between tiers with an UPDATE, and the client owns
// them so a route can be gated before any network call returns. Two copies
// that drift are worse than one, so this file reads the migration and compares.

const MIGRATION = "supabase/migrations/20261012000000_subscription_tiers.sql";
const sql = readFileSync(MIGRATION, "utf8");
const english = readFileSync("src/i18n/en.ts", "utf8");
const edgeFunction = readFileSync("supabase/functions/trial-billing/index.ts", "utf8");

/**
 * The statement that seeds a plan: the INSERT tuple for a tier, and the UPDATE
 * for `free_trial`, whose id appears in its WHERE clause at the *end*.
 */
function planStatement(planId: string): string {
  const insert = sql.indexOf(`('${planId}', '`);
  if (insert >= 0) return sql.slice(insert);
  const where = sql.indexOf(`WHERE id = '${planId}'`);
  return sql.slice(sql.lastIndexOf("UPDATE public.billing_plans SET", where), where);
}

/** The `jsonb_build_array('news','community',…)` a plan row is seeded with. */
function sectionsInMigration(planId: string): string[] {
  const row = planStatement(planId);
  const array = row.slice(row.indexOf("'sections', jsonb_build_array("));
  const inner = array.slice(array.indexOf("(") + 1, array.indexOf(")"));
  return [...inner.matchAll(/'([A-Za-z]+)'/g)].map((match) => match[1]);
}

function whatsappLimitInMigration(planId: string): number {
  const row = planStatement(planId);
  return Number(/'whatsapp_daily_messages',\s*(\d+)/.exec(row)?.[1]);
}

describe("the free week", () => {
  it("is seven days, in the catalogue and in the database", () => {
    expect(TRIAL_DAYS).toBe(7);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.trial_period_days[\s\S]{0,200}SELECT 7/);
  });

  it("opens every section, so nothing is hidden during the trial", () => {
    expect([...planSections("free_trial")].sort()).toEqual(SECTIONS.map((s) => s.key).sort());
    expect(sectionsInMigration("free_trial").sort()).toEqual(SECTIONS.map((s) => s.key).sort());
  });

  it("warns a day before it ends, not three", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.trial_ending_soon");
    expect(edgeFunction).toContain('.rpc("trial_ending_soon", { _hours: 24 })');
    // The old three-day window is gone rather than left behind next to the new one.
    expect(edgeFunction).not.toContain("3 * 24 * 60 * 60 * 1000");
  });

  it("only lists accounts that have not already been warned", () => {
    const fn = sql.slice(sql.indexOf("FUNCTION public.trial_ending_soon"));
    expect(fn).toContain("p.trial_billing_warned_at IS NULL");
    expect(fn).toContain("p.trial_expires_at > now()");
  });
});

describe("the three tiers", () => {
  it("prices at five, seven and ten dollars", () => {
    expect(TIER_ORDER.map((tier) => TIERS[tier].price)).toEqual([5, 7, 10]);
    for (const tier of TIER_ORDER) {
      const row = sql.slice(sql.indexOf(`('${tier}', '`));
      expect(row.slice(0, 400)).toContain(`\n    ${TIERS[tier].price}, ${TIERS[tier].vxMonthly},`);
    }
  });

  it("nests, so an upgrade never takes a section away", () => {
    for (const [cheaper, dearer] of [["bronze", "silver"], ["silver", "gold"]] as const) {
      const missing = TIERS[cheaper].sections.filter((s) => !TIERS[dearer].sections.includes(s));
      expect(missing, `${dearer} drops sections that ${cheaper} opens`).toEqual([]);
    }
  });

  it("opens the free sections on every tier, and without one", () => {
    for (const tier of TIER_ORDER) {
      for (const section of FREE_SECTIONS) expect(planAllows(tier, section)).toBe(true);
    }
    for (const section of FREE_SECTIONS) {
      expect(planAllows("none", section)).toBe(true);
      expect(planAllows(null, section)).toBe(true);
    }
  });

  it("closes the paid sections for an account with no plan", () => {
    for (const paid of ["mediaStudio", "finance", "kids", "academy"] as SectionKey[]) {
      expect(planAllows("none", paid)).toBe(false);
    }
  });

  it("matches the section lists the migration seeds", () => {
    for (const tier of TIER_ORDER) {
      expect(sectionsInMigration(tier).sort(), `${tier} sections drifted`)
        .toEqual([...TIERS[tier].sections].sort());
    }
  });

  it("matches the WhatsApp allowances the migration seeds", () => {
    for (const tier of TIER_ORDER) {
      expect(whatsappLimitInMigration(tier), `${tier} allowance drifted`)
        .toBe(TIERS[tier].whatsappDaily);
    }
    // Zero is the table's existing convention for "no ceiling", which the
    // entitlement reader already understands — Gold, and nothing cheaper.
    expect(TIERS.gold.whatsappDaily).toBe(0);
    expect(TIERS.bronze.whatsappDaily).toBeGreaterThan(0);
    expect(TIERS.silver.whatsappDaily).toBeGreaterThan(TIERS.bronze.whatsappDaily);
  });

  it("names the cheapest tier that opens a section", () => {
    expect(cheapestTierFor("academy")).toBe("bronze");
    expect(cheapestTierFor("kids")).toBe("silver");
    expect(cheapestTierFor("mediaStudio")).toBe("gold");
  });
});

describe("resolving a route to a section", () => {
  it("prefers the longest match, so the studio is not the library", () => {
    expect(sectionForPath("/library/studio/books/42")).toBe("studio");
    expect(sectionForPath("/library/books/42")).toBe("library");
  });

  it("never matches half a path segment", () => {
    expect(sectionForPath("/newsletter")).toBeNull();
    expect(sectionForPath("/news")).toBe("news");
    expect(sectionForPath("/academy-extra")).toBeNull();
  });

  it("ignores a trailing slash and letter case", () => {
    expect(sectionForPath("/games/")).toBe("arcade");
    expect(sectionForPath("/Games/2048")).toBe("arcade");
  });

  it("leaves everything it does not name open", () => {
    for (const path of ["/", "/dashboard", "/pricing", "/settings", "/login", "/legal", ""]) {
      expect(sectionForPath(path)).toBeNull();
    }
  });

  it("maps the sections that live under /services", () => {
    expect(sectionForPath("/services/live-tv/search")).toBe("tv");
    expect(sectionForPath("/services/live-radio")).toBe("radio");
    expect(sectionForPath("/services/ai-media-studio/video")).toBe("mediaStudio");
    // The services index itself is a directory, not a paid section.
    expect(sectionForPath("/services")).toBeNull();
  });
});

describe("naming a section to a reader", () => {
  it("has a translation key for every section, in English", () => {
    for (const section of SECTIONS) {
      expect(english, `${section.key} has no English label`).toContain(`"${section.labelKey}":`);
    }
  });

  it("names every tier", () => {
    for (const tier of TIER_ORDER) expect(english).toContain(`"plans.tier.${tier}":`);
  });
});

describe("an unreadable plan", () => {
  it("falls back to the free sections rather than to nothing", () => {
    expect([...planSections("something-else")]).toEqual([...FREE_SECTIONS]);
    expect([...planSections(undefined)]).toEqual([...FREE_SECTIONS]);
  });
});
