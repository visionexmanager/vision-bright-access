// What the owner is shown when a subscription order arrives, and what the buyer
// is told once it is decided.
//
// Pure: the approved templates, the button ids, the wording. The same file feeds
// `scripts/whatsapp-templates.mjs` (what Meta reviews) and the Edge Function
// (what is sent), so the two cannot disagree.
//
// Rules that hold for every message below:
//  - The owner's message names the order, the plan, the months, the price and the
//    way it was paid. Never the buyer's phone, e-mail or name.
//  - The buyer's notice names the plan and the months. Never another person's data.
//  - A tap carries the order's own reference. A bare yes decides nothing.

import type { Tappable } from "./whatsappInteractive.ts";
import { planLabel, type ReminderLanguage } from "./whatsappPlanReminder.ts";

/** Like `MessageTemplate`, with as many example values as the body has variables. */
export interface OrderTemplate {
  name: string;
  category: "UTILITY";
  translations: Record<ReminderLanguage, { body: string; example: string[] }>;
}

// ── Templates (a business may only open a conversation with an approved one) ──

export const OWNER_ORDER_TEMPLATE: OrderTemplate = {
  name: "visionex_owner_order",
  category: "UTILITY",
  translations: {
    ar: {
      body: "مرحبًا من Visionex 👋\nلديك {{1}} طلب اشتراك جديد بانتظار قرارك.\nردّ بكلمة «طلبات» لعرضه والموافقة عليه أو رفضه.",
      example: ["1"],
    },
    en: {
      body: "Hello from Visionex 👋\nYou have {{1}} new subscription order(s) waiting for your decision.\nReply \"orders\" to see them and approve or reject.",
      example: ["1"],
    },
  },
};

export const ORDER_APPROVED_TEMPLATE: OrderTemplate = {
  name: "visionex_order_approved",
  category: "UTILITY",
  translations: {
    ar: {
      body: "مرحبًا من Visionex 👋\nتم تأكيد دفعتك وتفعيل {{1}} لمدة {{2}}. شكرًا لثقتك بنا.\nيمكنك البدء من https://visionex.app",
      example: ["الباقة الاحترافية", "3 أشهر"],
    },
    en: {
      body: "Hello from Visionex 👋\nYour payment is confirmed and your {{1}} is active for {{2}}. Thank you for trusting us.\nGet started at https://visionex.app",
      example: ["Pro plan", "3 months"],
    },
  },
};

export const ORDER_REJECTED_TEMPLATE: OrderTemplate = {
  name: "visionex_order_rejected",
  category: "UTILITY",
  translations: {
    ar: {
      body: "مرحبًا من Visionex 👋\nلم نتمكن من تأكيد طلب اشتراكك في {{1}} لمدة {{2}}.\nللمساعدة ردّ على هذه الرسالة وسنوضح لك السبب.",
      example: ["الباقة الاحترافية", "3 أشهر"],
    },
    en: {
      body: "Hello from Visionex 👋\nWe could not confirm your subscription order for the {{1}} for {{2}}.\nReply to this message and we will explain why.",
      example: ["Pro plan", "3 months"],
    },
  },
};

export const ORDER_TEMPLATES: OrderTemplate[] = [OWNER_ORDER_TEMPLATE, ORDER_APPROVED_TEMPLATE, ORDER_REJECTED_TEMPLATE];

// ── The owner's two buttons ───────────────────────────────────────────────────

export const ORDER_BUTTON_PREFIX = "order:";
const BUTTON_ID = /^order:(approve|reject):(VX-[0-9A-F]{6})$/;

export function orderButtonId(approve: boolean, reference: string): string {
  return `${ORDER_BUTTON_PREFIX}${approve ? "approve" : "reject"}:${reference}`;
}

/** The decision a button id carries, or null for anything that is not exactly one. */
export function parseOrderButton(id: string | null | undefined): { approve: boolean; reference: string } | null {
  const match = BUTTON_ID.exec(id ?? "");
  return match ? { approve: match[1] === "approve", reference: match[2] } : null;
}

export interface OrderSummary {
  reference_code: string;
  plan_id: string;
  plan_name?: string | null;
  months: number;
  price_usd: number | string;
  payment_method: string;
}

const METHOD_AR: Record<string, string> = { omt: "OMT", whish: "Whish", card: "بطاقة" };

export function monthsLabel(months: number, language: ReminderLanguage): string {
  if (language === "en") return `${months} month${months === 1 ? "" : "s"}`;
  if (months === 1) return "شهر";
  if (months === 2) return "شهرين";
  return `${months} ${months >= 3 && months <= 10 ? "أشهر" : "شهرًا"}`;
}

/** Interactive message with two buttons and, for a client Meta refuses it for, the same words as text. */
export function ownerOrderMessage(order: OrderSummary): Tappable {
  const plan = planLabel(order.plan_id, order.plan_name ?? null, "ar");
  const method = METHOD_AR[order.payment_method] ?? order.payment_method;
  const lines = [
    "*طلب اشتراك جديد*",
    `المرجع: ${order.reference_code}`,
    `${plan} — ${monthsLabel(order.months, "ar")}`,
    `المبلغ: $${Number(order.price_usd).toFixed(2)} عبر ${method}`,
    "",
    "اضغط «موافقة» بعد وصول المبلغ، أو «رفض».",
  ];
  return {
    interactive: {
      type: "button",
      body: { text: lines.join("\n").slice(0, 1024) },
      action: {
        buttons: [
          { type: "reply", reply: { id: orderButtonId(true, order.reference_code), title: "موافقة" } },
          { type: "reply", reply: { id: orderButtonId(false, order.reference_code), title: "رفض" } },
        ],
      },
    },
    text: [
      ...lines.slice(0, 4),
      "",
      `للموافقة:  /approve ${order.reference_code}`,
      `للرفض:  /reject ${order.reference_code}`,
    ].join("\n"),
  };
}

/** "طلبات" on its own, said by the owner after the template: show what is waiting. */
export function isBareOrdersReply(text: string): boolean {
  return /^(?:orders?|الطلبات|طلبات|طلبات الاشتراك|اشتراكات)[\s.!؟?]*$/iu.test((text ?? "").trim());
}

// ── The buyer's notice ────────────────────────────────────────────────────────

export interface BuyerNotice {
  inAppTitle: string;
  text: string;
  emailSubject: string;
  emailHtml: string;
  /** Template variables, in the order the approved body declares them. */
  variables: [string, string];
  template: OrderTemplate;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** A note the owner typed: one bounded line, no markup, no control characters. */
export function cleanNote(note: string | null | undefined): string {
  return (note ?? "").replace(/\(via WhatsApp\)/gi, " ").replace(/via WhatsApp/gi, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
}

export function buyerNotice(
  order: Pick<OrderSummary, "plan_id" | "plan_name" | "months">,
  approved: boolean,
  note: string | null | undefined,
  language: ReminderLanguage,
): BuyerNotice {
  const template = approved ? ORDER_APPROVED_TEMPLATE : ORDER_REJECTED_TEMPLATE;
  const plan = planLabel(order.plan_id, order.plan_name ?? null, language);
  const months = monthsLabel(order.months, language);
  const cleaned = approved ? "" : cleanNote(note);
  const base = template.translations[language].body.replace("{{1}}", plan).replace("{{2}}", months);
  const reason = cleaned ? (language === "ar" ? `\nالسبب: ${cleaned}` : `\nReason: ${cleaned}`) : "";
  const text = base + reason;

  const ar = approved
    ? { subject: "تم تفعيل اشتراكك في Visionex", title: "✅ تم تفعيل اشتراكك" }
    : { subject: "بخصوص طلب اشتراكك في Visionex", title: "تعذّر تأكيد طلب اشتراكك" };
  const en = approved
    ? { subject: "Your Visionex subscription is active", title: "✅ Your subscription is active" }
    : { subject: "About your Visionex subscription order", title: "We could not confirm your order" };
  const arText = template.translations.ar.body.replace("{{1}}", planLabel(order.plan_id, order.plan_name ?? null, "ar")).replace("{{2}}", monthsLabel(order.months, "ar")) +
    (cleaned && !approved ? `\nالسبب: ${cleaned}` : "");
  const enText = template.translations.en.body.replace("{{1}}", planLabel(order.plan_id, order.plan_name ?? null, "en")).replace("{{2}}", monthsLabel(order.months, "en")) +
    (cleaned && !approved ? `\nReason: ${cleaned}` : "");
  const paragraph = (value: string) => `<p>${escapeHtml(value).replace(/\n/g, "<br>")}</p>`;

  return {
    inAppTitle: `${ar.title} — ${en.title}`,
    text,
    emailSubject: `${ar.subject} — ${en.subject}`,
    emailHtml: `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<div dir="rtl" lang="ar"><h2>${escapeHtml(ar.title)}</h2>${paragraph(arText)}</div>
<hr>
<div dir="ltr" lang="en"><h2>${escapeHtml(en.title)}</h2>${paragraph(enText)}</div>
<p style="color:#6b7280;font-size:0.85em;">Visionex · <a href="https://visionex.app">visionex.app</a></p>
</body></html>`,
    variables: [plan, months],
    template,
  };
}
