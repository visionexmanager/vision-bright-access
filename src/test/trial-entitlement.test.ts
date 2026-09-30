// The free week is not "every section". This file pins the decision so it cannot
// quietly come back: one explicit trial list, one plan resolution, no client that
// promises a waiver the server will not honour, and the same words in twenty
// languages. The behaviour itself is executed, not just read, in
// scripts/sql/trial-entitlement-scenarios.mjs (PGlite),
// scripts/sql/ai-subscription-gate-concurrency.mjs (real PostgreSQL) and
// scripts/e2e/subscription-gate-harness.ts (the real handlers).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FREE_SECTIONS,
  PAID_PLANS,
  PRICING_PATH,
  SECTIONS,
  TRIAL_SECTIONS,
  TRIAL_WAIVES_PAYMENT,
  planAllows,
  planSections,
} from "@/lib/billing/plans";
import * as plans from "@/lib/billing/plans";

const read = (path: string) => readFileSync(path, "utf8");
const TRIAL_MIGRATION = read("supabase/migrations/20261063000000_trial_is_not_full_access.sql");
const WAIVER_MIGRATION = read("supabase/migrations/20261064000000_trial_stops_waiving_vx.sql");
const code = (sql: string) => sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

describe("free_trial never resolves to all sections", () => {
  it("is exactly TRIAL_SECTIONS, and that is a strict subset of the sections", () => {
    expect([...planSections("free_trial")]).toEqual([...TRIAL_SECTIONS]);
    expect(TRIAL_SECTIONS.length).toBeLessThan(SECTIONS.length);
    expect(planSections("free_trial").length).not.toBe(SECTIONS.length);
  });

  it("opens no section outside the trial list, for every section that exists", () => {
    for (const { key } of SECTIONS) {
      const inTrial = (TRIAL_SECTIONS as readonly string[]).includes(key);
      expect(planAllows("free_trial", key), `free_trial vs ${key}`).toBe(inTrial);
    }
  });

  it("is today the free set only: no AI assistant and no paid section", () => {
    expect([...TRIAL_SECTIONS].sort()).toEqual([...FREE_SECTIONS].sort());
    for (const paid of ["assistant", "academy", "library", "arcade", "marketplace", "kids", "career", "tv", "radio", "messages", "simulations", "mediaStudio", "studio", "professional", "finance"] as const) {
      expect(planAllows("free_trial", paid), paid).toBe(false);
    }
  });

  it("is not derived from the catalogue: nothing maps SECTIONS to the trial", () => {
    const source = read("src/lib/billing/plans.ts");
    const fn = source.slice(source.indexOf("export function planSections"), source.indexOf("export function planAllows"));
    expect(fn).not.toMatch(/SECTIONS\.map/);
    expect(fn).toMatch(/free_trial.*TRIAL_SECTIONS/s);
  });

  it("no longer exports a trial WhatsApp allowance", () => {
    expect("TRIAL_WHATSAPP_DAILY" in plans).toBe(false);
  });

  it("a paid plan opens more than the trial, so subscribing is never a downgrade", () => {
    for (const plan of Object.values(PAID_PLANS)) {
      for (const s of TRIAL_SECTIONS) expect(plan.sections).toContain(s);
    }
  });
});

describe("one resolution in the database", () => {
  it("trial_sections() is the same list as TRIAL_SECTIONS", () => {
    const list = /FUNCTION public\.trial_sections\(\)[\s\S]*?ARRAY\[([^\]]*)\]/.exec(TRIAL_MIGRATION)?.[1] ?? "";
    expect([...list.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]).sort()).toEqual([...TRIAL_SECTIONS].sort());
  });

  it("user_sections answers the trial from that list, never from the plan row", () => {
    const fn = TRIAL_MIGRATION.slice(TRIAL_MIGRATION.indexOf("FUNCTION public.user_sections"), TRIAL_MIGRATION.indexOf("COMMENT ON FUNCTION public.user_sections"));
    expect(fn).toMatch(/IF _plan = 'free_trial' THEN RETURN public\.trial_sections\(\); END IF;/);
    // The trial branch comes before the row-reading query.
    expect(fn.indexOf("free_trial")).toBeLessThan(fn.lastIndexOf("billing_plans p"));
  });

  it("a paid subscription is resolved BEFORE the trial", () => {
    const fn = TRIAL_MIGRATION.slice(TRIAL_MIGRATION.indexOf("FUNCTION public.plan_for_user"), TRIAL_MIGRATION.indexOf("COMMENT ON FUNCTION public.plan_for_user"));
    expect(fn.indexOf("public.user_subscriptions")).toBeGreaterThan(-1);
    expect(fn.indexOf("public.user_subscriptions")).toBeLessThan(fn.indexOf("trial_expires_at"));
  });

  it("the site, WhatsApp and the AI gate all ask plan_for_user", () => {
    const wa = TRIAL_MIGRATION.slice(TRIAL_MIGRATION.indexOf("FUNCTION public.whatsapp_entitlements"), TRIAL_MIGRATION.indexOf("COMMENT ON FUNCTION public.whatsapp_entitlements"));
    const mine = TRIAL_MIGRATION.slice(TRIAL_MIGRATION.indexOf("FUNCTION public.my_plan_access"), TRIAL_MIGRATION.indexOf("COMMENT ON FUNCTION public.my_plan_access"));
    const gate = read("supabase/migrations/20261062000000_ai_subscription_gate.sql");
    for (const [name, body] of [["whatsapp_entitlements", wa], ["my_plan_access", mine]] as const) {
      expect(body, name).toMatch(/public\.plan_for_user\(/);
      expect(body, `${name} keeps no second copy of the resolution`).not.toMatch(/FROM public\.user_subscriptions|trial_expires_at\s*>\s*now/);
    }
    expect(gate).toMatch(/plan_for_user\(_user_id\) = ANY/);
  });

  it("the WhatsApp trial answer is never 'unlimited' (limit 0) and is not allowed", () => {
    const wa = TRIAL_MIGRATION.slice(TRIAL_MIGRATION.indexOf("FUNCTION public.whatsapp_entitlements"));
    const branch = wa.slice(wa.indexOf("IF _plan_id = 'free_trial'"), wa.indexOf("IF _plan_id IS NOT NULL AND"));
    expect(branch).toMatch(/'allowed', false/);
    expect(branch).toMatch(/'daily_limit', 1/);
    expect(branch).toMatch(/'remaining', 0/);
  });

  it("the plan row stops listing every section and loses its 200-a-day allowance", () => {
    const update = TRIAL_MIGRATION.slice(TRIAL_MIGRATION.lastIndexOf("UPDATE public.billing_plans"));
    expect(update).toMatch(/limits - 'whatsapp_daily_messages'/);
    expect(update).toMatch(/to_jsonb\(public\.trial_sections\(\)\)/);
    expect(update).not.toMatch(/Every section/i);
  });

  it("the trial is not a subscription and the migration says nothing about AI eligibility for it", () => {
    const eligible = read("supabase/migrations/20261062000000_ai_subscription_gate.sql");
    expect(/FUNCTION public\.ai_eligible_plans[\s\S]{0,200}ARRAY\[([^\]]*)\]/.exec(eligible)?.[1]).not.toMatch(/free_trial/);
  });

  it("no later migration re-opens the trial", () => {
    const later = readdirSync("supabase/migrations").filter((f) => f.split("_")[0] > "20261063000000");
    for (const file of later) {
      const sql = code(read(`supabase/migrations/${file}`));
      if (file.startsWith("20261064")) continue; // the waiver removal, checked below
      expect(sql, file).not.toMatch(/free_trial[\s\S]{0,300}'sections'/);
    }
  });
});

describe("the trial stops waiving VX on things it does not include", () => {
  it("the bazaar shop and paid Academy course no longer read any trial flag", () => {
    const sql = code(WAIVER_MIGRATION);
    expect(sql).not.toMatch(/trial|is_in_trial|trial_ends_at/i);
    expect(sql).toMatch(/spend_vx\(/i);
    expect(sql).toMatch(/academy_enroll_course/);
    expect(sql).toMatch(/create_bazaar_shop/i);
  });

  it("keeps their grants: authenticated only, nothing for anon", () => {
    expect(WAIVER_MIGRATION).toMatch(/revoke all on function public\.create_bazaar_shop[\s\S]*from public/i);
    expect(WAIVER_MIGRATION).toMatch(/REVOKE ALL ON FUNCTION public\.academy_enroll_course\(uuid\) FROM PUBLIC/);
    expect(code(WAIVER_MIGRATION)).not.toMatch(/\bto anon|\bto public/i);
  });
});

describe("the browser does not promise what the server will not honour", () => {
  it("the payment waiver is one constant and it is false", () => {
    expect(TRIAL_WAIVES_PAYMENT).toBe(false);
  });

  it("every client that read 'on the trial' as 'free' goes through that constant", () => {
    const consumers = [
      "src/hooks/useVXWallet.ts", "src/hooks/useTVSubscription.ts", "src/hooks/useRadioSubscription.ts",
      "src/hooks/useSimulationBilling.ts", "src/pages/VXBazaar.tsx", "src/pages/SimulationRunner.tsx",
      "src/pages/simulations/VehicleDiagnosticsSimulation.tsx", "src/pages/simulations/MarineVesselSimulation.tsx",
      "src/pages/services/LiveTV.tsx", "src/pages/services/LiveRadio.tsx", "src/pages/community/VoiceRoom.tsx",
    ];
    for (const file of consumers) {
      const src = read(file);
      expect(src, file).toContain("TRIAL_WAIVES_PAYMENT && isOnTrial");
      const uses = src.split("\n").filter((l) => /\bisOnTrial\b/.test(l) && !/useTrial\(\)/.test(l) && !/TRIAL_WAIVES_PAYMENT && isOnTrial/.test(l));
      expect(uses, `${file} still reads isOnTrial directly`).toEqual([]);
    }
  });

  it("free access is admin-only", () => {
    const src = read("src/hooks/useFreeAccess.ts");
    expect(src).toMatch(/hasFreeAccess: isAdmin,/);
    expect(src).not.toMatch(/isOnTrial/);
  });

  it("the trial banner shows only to an account that is ON the trial plan", () => {
    expect(read("src/components/TrialBanner.tsx")).toMatch(/access\?\.trialActive !== true/);
  });
});

describe("what a trial user sees", () => {
  it("the refusal names the trial and the Subscribe button leads to the plans page", () => {
    const src = read("src/components/SubscriptionGateNotice.tsx");
    expect(src).toMatch(/access\?\.trialActive === true/);
    expect(src).toContain("subscriptionGate.trialMessage");
    expect(src).toContain("subscriptionGate.subscribe");
    expect(src).toMatch(/navigate\(PRICING_PATH\)/);
    expect(src).toContain("common.dismiss");
    expect(PRICING_PATH).toBe("/pricing");
  });

  it("it stays on the current page: the notice never navigates by itself", () => {
    const src = read("src/components/SubscriptionGateNotice.tsx");
    const navigations = src.match(/navigate\(/g) ?? [];
    expect(navigations.length).toBe(1); // only inside the action's onClick
    expect(src).toMatch(/onClick: \(\) => navigate\(PRICING_PATH\)/);
  });

  it("is mounted where it can read the signed-in account", () => {
    const app = read("src/App.tsx");
    expect(app.indexOf("<AuthProvider>")).toBeLessThan(app.indexOf("<SubscriptionGateNotice />"));
  });

  it("the plan gate says the section is not in the trial, not that the week has ended", () => {
    const src = read("src/components/PlanGate.tsx");
    expect(src).toMatch(/onTrial \? "planGate\.notInTrial" : "planGate\.trialOver"/);
  });
});

describe("the same words in every language", () => {
  const LOCALES = ["ar", "bn", "de", "en", "es", "fa", "fr", "hi", "id", "it", "ja", "ko", "nl", "pl", "pt", "ru", "tr", "ur", "vi", "zh"];
  const KEYS = ["subscriptionGate.trialMessage", "subscriptionGate.subscribe", "planGate.notInTrial",
    "trial.weekActive", "trial.endsTomorrow", "trial.endsToday", "home.pointsDesc", "home.step1d", "home.highlight.trial"];
  const valueOf = (locale: string, key: string): string | undefined => {
    for (const file of [`src/i18n/${locale}.ts`, `src/i18n/chunks/${locale}.ts`]) {
      if (!existsSync(file)) continue;
      const m = new RegExp(`^  "${key.replace(/\./g, "\\.")}": (".*"),$`, "m").exec(read(file));
      if (m) return JSON.parse(m[1]) as string;
    }
    return undefined;
  };

  it("all nine strings exist in all twenty locales", () => {
    for (const locale of LOCALES) for (const key of KEYS) {
      expect(valueOf(locale, key), `${locale} ${key}`).toBeTruthy();
    }
  });

  it("the days placeholder survives translation", () => {
    for (const locale of LOCALES) expect(valueOf(locale, "trial.weekActive"), locale).toContain("{days}");
  });

  it("no locale still says the free week opens every section, or promises 'all features'", () => {
    for (const locale of LOCALES) for (const key of ["trial.weekActive", "trial.endsTomorrow", "trial.endsToday", "home.pointsDesc", "home.step1d"]) {
      const value = valueOf(locale, key) ?? "";
      expect(value, `${locale} ${key}`).not.toMatch(/every section is open|access to all features|30-day|30 días|30 Tage|30 jours/i);
    }
  });

  it("the English wording is the agreed one", () => {
    expect(valueOf("en", "subscriptionGate.trialMessage")).toBe(
      "This service is not included in your current trial. Subscribe to a VisionEX plan to unlock this service.");
    expect(valueOf("en", "subscriptionGate.subscribe")).toBe("Subscribe");
  });
});
