import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FREE_SECTIONS, KIDS_PLAN, PAID_PLAN_ORDER, PAID_PLANS, planAllows } from "@/lib/billing/plans";
import {
  formatEndsAt,
  planLabel,
  PLAN_REMINDER_TEMPLATE,
  REMINDER_WINDOW_HOURS,
  reminderLanguage,
  reminderNotice,
  reminderText,
  reminderVariables,
  withinServiceWindow,
} from "../../supabase/functions/_shared/whatsappPlanReminder";

// A plan for children beside the three tiers, and a WhatsApp message the day
// before any plan ends. The template is what Meta approves, so its shape is
// pinned here: a body Meta would reject means no reminder reaches anybody.

const read = (path: string) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20261014000000_kids_plan_and_expiry_reminders.sql");
const trialBilling = read("supabase/functions/trial-billing/index.ts");

const row = { plan_id: "business", plan_name: "Business", ends_at: "2026-09-15T18:00:00Z" };

describe("the Kids plan", () => {
  it("costs three dollars and opens VisionKids, and nothing a tier sells", () => {
    expect(KIDS_PLAN.price).toBe(3);
    expect([...KIDS_PLAN.sections].sort()).toEqual([...FREE_SECTIONS, "kids"].sort());
    for (const other of ["assistant", "academy", "arcade", "library", "marketplace"] as const) {
      expect(planAllows("kids", other), other).toBe(false);
    }
    expect(planAllows("kids", "kids")).toBe(true);
  });

  it("is the cheapest paid plan, and every tier above it still has VisionKids except Basic", () => {
    expect(PAID_PLAN_ORDER[0]).toBe("kids");
    const prices = PAID_PLAN_ORDER.map((plan) => PAID_PLANS[plan].price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(planAllows("pro", "kids")).toBe(true);
    expect(planAllows("business", "kids")).toBe(true);
  });

  it("matches what the migration seeds", () => {
    const tuple = migration.slice(migration.indexOf("('kids', 'Kids'"));
    expect(tuple).toMatch(/^\('kids', 'Kids', '[^']+',\s*3, 0, false/);
    const array = tuple.slice(tuple.indexOf("jsonb_build_array(") + "jsonb_build_array(".length);
    const seeded = [...array.slice(0, array.indexOf(")")).matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
    expect(seeded.sort()).toEqual([...KIDS_PLAN.sections].sort());
    expect(Number(/'whatsapp_daily_messages',\s*(\d+)/.exec(tuple)?.[1])).toBe(KIDS_PLAN.whatsappDaily);
  });

  it("has a name in every language", () => {
    for (const locale of ["en", "ar", "ur", "hi", "id", "ja", "it", "ko", "nl", "pl", "vi", "bn", "fa", "es", "de", "pt", "zh", "tr", "fr", "ru"]) {
      expect(read(`src/i18n/${locale}.ts`), locale).toContain('"plans.tier.kids":');
    }
  });
});

describe("the reminder template", () => {
  it("is a utility template Meta can approve, in Arabic and English", () => {
    expect(PLAN_REMINDER_TEMPLATE.name).toMatch(/^[a-z0-9_]{1,512}$/);
    expect(PLAN_REMINDER_TEMPLATE.category).toBe("UTILITY");
    for (const language of ["ar", "en"] as const) {
      const { body, example } = PLAN_REMINDER_TEMPLATE.translations[language];
      expect(body.match(/\{\{1\}\}/g), language).toHaveLength(1);
      expect(body.match(/\{\{2\}\}/g), language).toHaveLength(1);
      expect(body.match(/\{\{\d+\}\}/g), language).toHaveLength(2);
      // Meta refuses a body that begins or ends with a variable.
      expect(body.trim().startsWith("{{"), language).toBe(false);
      expect(body.trim().endsWith("}}"), language).toBe(false);
      expect(body.length, language).toBeLessThan(1024);
      expect(body, language).toContain("https://visionex.app/pricing");
      expect(example, language).toHaveLength(2);
    }
  });

  it("is filled completely, in the order the body declares", () => {
    for (const language of ["ar", "en"] as const) {
      const text = reminderText(row, language);
      expect(text, language).not.toMatch(/\{\{|\}\}/);
      const [plan, endsAt] = reminderVariables(row, language);
      expect(text.indexOf(plan), language).toBeLessThan(text.indexOf(endsAt));
    }
    expect(reminderText(row, "en")).toContain("Your Business plan ends on");
    expect(reminderText(row, "ar")).toContain("تنتهي باقة الأعمال");
  });

  it("says when in Beirut time, with digits every phone reads", () => {
    // 18:00 UTC is 21:00 in Beirut in September.
    const en = formatEndsAt(row.ends_at, "en");
    expect(en).toContain("15 September");
    expect(en).toMatch(/\b(21:00|9:00)\b/);
    const ar = formatEndsAt(row.ends_at, "ar");
    expect(ar).toMatch(/15/);
    expect(ar).toMatch(/\b(21:00|9:00)\b/);
    // Never the Arabic-Indic digits: a date is read the same way on every phone.
    expect(ar).not.toMatch(/[٠-٩]/);
  });

  it("names every plan, and one it has never heard of", () => {
    expect(planLabel("kids", "Kids", "ar")).toBe("باقة الأطفال");
    expect(planLabel("kids", "Kids", "en")).toBe("Kids plan");
    expect(planLabel("free_trial", "Free week", "en")).toBe("free week");
    expect(planLabel("platinum", "Platinum", "en")).toBe("Platinum plan");
    expect(planLabel("platinum", "Platinum", "ar")).toBe("باقة Platinum");
  });

  it("speaks Arabic unless the conversation is in another language", () => {
    expect(reminderLanguage(null)).toBe("ar");
    expect(reminderLanguage("ar")).toBe("ar");
    expect(reminderLanguage("en")).toBe("en");
    expect(reminderLanguage("fr")).toBe("en");
  });

  it("puts both languages in the in-app notice", () => {
    const notice = reminderNotice(row);
    expect(notice).toContain(reminderText(row, "ar"));
    expect(notice).toContain(reminderText(row, "en"));
  });

  it("knows when Meta would still accept free text", () => {
    const now = Date.parse("2026-09-15T12:00:00Z");
    expect(withinServiceWindow("2026-09-15T01:00:00Z", now)).toBe(true);
    expect(withinServiceWindow("2026-09-14T11:59:00Z", now)).toBe(false);
    expect(withinServiceWindow(null, now)).toBe(false);
    expect(withinServiceWindow("not a date", now)).toBe(false);
    expect(withinServiceWindow("2026-09-15T13:00:00Z", now)).toBe(false);
  });
});

describe("who is reminded, and how", () => {
  it("lists people only to the service role", () => {
    for (const role of ["PUBLIC", "anon", "authenticated"]) {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.plan_expiry_reminders(integer) FROM ${role};`);
    }
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.plan_expiry_reminders(integer) TO service_role;");
  });

  it("prefers the number somebody proved, then the one they gave for a paid order", () => {
    const fn = migration.slice(migration.indexOf("FUNCTION public.plan_expiry_reminders"));
    expect(fn).toContain("i.verified_at IS NOT NULL");
    expect(fn).toContain("o.status = 'approved' AND o.whatsapp_phone IS NOT NULL");
    expect(fn.indexOf("1 AS rank")).toBeLessThan(fn.indexOf("2, o.reviewed_at"));
  });

  it("replaces the checkout function rather than leaving an ambiguous overload", () => {
    expect(migration).toContain("DROP FUNCTION IF EXISTS public.create_subscription_order(text, text, integer);");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.create_subscription_order(text, text, integer, text) TO authenticated, service_role;");
    expect(migration).toContain("CHECK (whatsapp_phone IS NULL OR whatsapp_phone ~ '^[0-9]{8,15}$')");
  });

  it("seeds the OMT recipient", () => {
    expect(migration).toContain(`SELECT 'subscription_payment_omt_name', '"Mohammad Abboud"'::jsonb`);
  });

  it("is sent by trial-billing every hour, template first and free text only inside the window", () => {
    expect(trialBilling).toContain('.rpc("plan_expiry_reminders", { _hours: REMINDER_WINDOW_HOURS })');
    expect(REMINDER_WINDOW_HOURS).toBe(24);
    const template = trialBilling.indexOf("sendWhatsAppTemplate({");
    const text = trialBilling.indexOf("sendWhatsAppText({");
    expect(template).toBeGreaterThan(-1);
    expect(text).toBeGreaterThan(template);
    expect(trialBilling.slice(template, text)).toContain("withinServiceWindow(row.wa_last_message_at, Date.now())");
    expect(trialBilling).toContain('if (task === "reminders")');

    const cron = read(".github/workflows/subscription-reminders-cron.yml");
    expect(cron).toMatch(/cron: "\d+ \* \* \* \*"/);
    expect(cron).toContain(`-d '{"task":"reminders"}'`);
  });

  it("never prints a person into a public log", () => {
    const block = trialBilling.slice(trialBilling.indexOf("// ── 0."), trialBilling.indexOf('if (task === "reminders")'));
    expect(block).not.toMatch(/errors\.push\(`[^`]*\$\{/);
    const cron = read(".github/workflows/subscription-reminders-cron.yml");
    expect(cron).not.toMatch(/cat response\.json|--fail-with-body/);
    expect(cron).toContain("jq -c '{reminded, whatsapp, whatsappFailed, errors: (.errors | length)}'");
  });

  it("asks for the number at checkout", () => {
    const checkout = read("src/pages/PlanCheckout.tsx");
    expect(checkout).toContain("normalizeWhatsAppNumber(phone)");
    expect(checkout).toContain('autoComplete="tel"');
    expect(read("src/services/subscriptionOrders.ts")).toContain("_whatsapp_phone: whatsappPhone");
  });
});
