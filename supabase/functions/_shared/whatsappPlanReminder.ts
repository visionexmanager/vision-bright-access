// The WhatsApp message a subscriber gets the day before their plan ends.
//
// Pure — the template Meta approves, the language it is sent in, the date and
// the words — so trial-billing only fetches rows and sends them, and so the
// template `scripts/whatsapp-templates.mjs` submits and the variables the
// server fills can never disagree: both read this file.
//
// A business may only start a WhatsApp conversation with an approved template.
// Inside the 24-hour window after somebody last wrote, free text is allowed as
// well, which is the fallback while a template is still in Meta's review.

/** How far ahead of the end a plan is reminded. */
export const REMINDER_WINDOW_HOURS = 24;

/** Meta's customer-service window: free text is refused once it has passed. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ReminderLanguage = "ar" | "en";

export interface TemplateTranslation {
  /** The approved body. `{{1}}` is the plan, `{{2}}` when it ends. */
  body: string;
  /** Example values Meta's review requires, in variable order. */
  example: [string, string];
}

export interface MessageTemplate {
  name: string;
  category: "UTILITY";
  translations: Record<ReminderLanguage, TemplateTranslation>;
}

export const PLAN_REMINDER_TEMPLATE: MessageTemplate = {
  name: "visionex_plan_ending",
  category: "UTILITY",
  translations: {
    ar: {
      body: "مرحبًا من Visionex 👋\nتنتهي {{1}} يوم {{2}}.\nلتجديد اشتراكك أو تغيير باقتك ادخل إلى https://visionex.app/pricing أو ردّ على هذه الرسالة وسنساعدك.",
      example: ["باقة الأعمال", "الثلاثاء، 15 أيلول في 9:00 م"],
    },
    en: {
      body: "Hello from Visionex 👋\nYour {{1}} ends on {{2}}.\nTo renew your subscription or change your plan, go to https://visionex.app/pricing or reply to this message and we will help you.",
      example: ["Business plan", "Tuesday 15 September at 21:00"],
    },
  },
};

/** One row of `plan_expiry_reminders`. */
export interface PlanReminderRow {
  kind: "subscription" | "trial";
  user_id: string;
  subscription_id: string | null;
  plan_id: string;
  plan_name: string | null;
  ends_at: string;
  wa_phone: string | null;
  wa_language: string | null;
  wa_last_message_at: string | null;
  needs_notice: boolean;
  needs_whatsapp: boolean;
}

/**
 * The template translation to send.
 *
 * Templates exist in Arabic and English. Somebody whose conversation with the
 * assistant is in Arabic — or who never wrote to it, which in this market means
 * Arabic more often than not — gets Arabic; every other language gets English.
 */
export function reminderLanguage(conversationLanguage: string | null | undefined): ReminderLanguage {
  if (!conversationLanguage || conversationLanguage === "ar") return "ar";
  return "en";
}

const PLAN_LABELS: Record<ReminderLanguage, Record<string, string>> = {
  ar: {
    kids: "باقة الأطفال",
    basic: "الباقة الأساسية",
    pro: "الباقة الاحترافية",
    business: "باقة الأعمال",
    free_trial: "تجربتك المجانية",
  },
  en: {
    kids: "Kids plan",
    basic: "Basic plan",
    pro: "Pro plan",
    business: "Business plan",
    free_trial: "free week",
  },
};

/** "باقة الأعمال" / "Business plan", and a plan this file does not know by its name. */
export function planLabel(planId: string, planName: string | null, language: ReminderLanguage): string {
  const known = PLAN_LABELS[language][planId];
  if (known) return known;
  const name = (planName ?? planId).trim();
  return language === "ar" ? `باقة ${name}` : `${name} plan`;
}

/** When it ends, in Beirut time, with Latin digits so a number reads the same on every phone. */
export function formatEndsAt(iso: string, language: ReminderLanguage): string {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-LB" : "en-GB", {
    timeZone: "Asia/Beirut",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    numberingSystem: "latn",
  }).format(new Date(iso));
}

/** The template's variables, in the order the approved body declares them. */
export function reminderVariables(
  row: Pick<PlanReminderRow, "plan_id" | "plan_name" | "ends_at">,
  language: ReminderLanguage,
): [string, string] {
  return [planLabel(row.plan_id, row.plan_name, language), formatEndsAt(row.ends_at, language)];
}

/** The same message as free text, for inside the service window. */
export function reminderText(
  row: Pick<PlanReminderRow, "plan_id" | "plan_name" | "ends_at">,
  language: ReminderLanguage,
): string {
  const [plan, endsAt] = reminderVariables(row, language);
  return PLAN_REMINDER_TEMPLATE.translations[language].body
    .replace("{{1}}", plan)
    .replace("{{2}}", endsAt);
}

/** The in-app notification: both languages, because it is read on the site. */
export const REMINDER_NOTICE_TITLE = "⏳ ينتهي اشتراكك خلال 24 ساعة — Your plan ends within 24 hours";

export function reminderNotice(row: Pick<PlanReminderRow, "plan_id" | "plan_name" | "ends_at">): string {
  return `${reminderText(row, "ar")}\n\n${reminderText(row, "en")}`;
}

/** Whether free text would still be accepted by Meta. */
export function withinServiceWindow(lastMessageAt: string | null | undefined, nowMs: number): boolean {
  const at = typeof lastMessageAt === "string" ? Date.parse(lastMessageAt) : NaN;
  if (!Number.isFinite(at)) return false;
  const age = nowMs - at;
  return age >= 0 && age < SERVICE_WINDOW_MS;
}
