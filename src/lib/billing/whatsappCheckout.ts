/**
 * Paying for a plan through the owner on WhatsApp.
 *
 * There is no card processor for plans. The checkout files an order, then opens
 * WhatsApp at the owner's number with the order already written, and the owner
 * arranges the payment — OMT, Whish to Whish, or a card link — and approves the
 * order from the admin screen. Approval is the only thing that activates a plan.
 *
 * The message carries the order number, the plan, the price and the way to pay.
 * Never the email or the name: the reference is enough for the owner to find the
 * account in the admin screen, and a wa.me link is a URL other services see.
 */

export const PAYMENT_METHODS = ["omt", "whish", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** The public `site_settings` key holding the number WhatsApp opens. */
export const PAYMENT_WHATSAPP_SETTING = "subscription_payment_whatsapp";

export function checkoutPath(planId: string): string {
  return `/pricing/checkout/${encodeURIComponent(planId)}`;
}

/**
 * The digits wa.me wants, from whatever an admin typed: "+961 70 123 456",
 * "0096170123456", or a jsonb string. Null when it cannot be a phone number,
 * so the page says checkout is unavailable instead of opening a broken chat.
 */
export function normalizeWhatsAppNumber(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
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
