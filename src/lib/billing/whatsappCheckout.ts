/**
 * Paying for a plan through the owner.
 *
 * There is no card processor for plans. The checkout files an order for a plan
 * and a number of months, then:
 *  - a card payment opens WhatsApp at the owner's number with the order already
 *    written, and the owner sends a payment link;
 *  - an OMT or Whish transfer is sent to the owner's number, which the page
 *    shows, and the receipt goes to the same number on WhatsApp.
 * The owner approves the order from the admin screen once the money arrived.
 * Approval is the only thing that activates a plan.
 *
 * Messages carry the order number, plan, duration, amount and method. Never
 * the email or the name: the reference is enough for the owner to find the
 * account, and a wa.me link is a URL other services see.
 */

export const PAYMENT_METHODS = ["omt", "whish", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** The durations a plan can be bought for. Mirrors the CHECK in the migration. */
export const PLAN_MONTHS = [1, 3, 6, 12] as const;
export type PlanMonths = (typeof PLAN_MONTHS)[number];

/** The public `site_settings` key holding the owner's number. */
export const PAYMENT_WHATSAPP_SETTING = "subscription_payment_whatsapp";

/** OMT and Whish are sent to a number; a card is paid through a link. */
export function isTransferMethod(method: string): boolean {
  return method === "omt" || method === "whish";
}

export function checkoutPath(planId: string): string {
  return `/pricing/checkout/${encodeURIComponent(planId)}`;
}

/** Monthly price times months, to the cent. */
export function planTotal(monthlyUsd: number, months: number): number {
  return Math.round(monthlyUsd * months * 100) / 100;
}

/**
 * The digits wa.me wants, from whatever an admin typed: "+961 70 750 609",
 * "0096170750609", or a jsonb string. Null when it cannot be a phone number,
 * so the page says checkout is unavailable instead of opening a broken chat.
 */
export function normalizeWhatsAppNumber(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/** The number as a person dials it: "+96170750609". */
export function displayWhatsAppNumber(digits: string): string {
  return `+${digits}`;
}

/** Fill `{name}` placeholders in a translated sentence. Unknown names stay. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : whole,
  );
}

export function paymentWhatsAppLink(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
