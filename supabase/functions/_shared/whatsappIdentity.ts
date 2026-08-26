// Who the sender is — proved, not guessed.
//
// The assistant has always known a phone number and nothing else. That is
// enough to hold a conversation and deliberately not enough to look up an
// order: `bazaar_orders.shipping_phone` is unverified free text a buyer typed
// at checkout, is not unique, and is often somebody else's number. Matching on
// it would read one person's order history to whoever holds their courier's
// phone.
//
// So this module implements the only link that proves anything: a six-digit
// code emailed to the address on the Visionex account, typed back into
// WhatsApp. Control of the mailbox is the proof — the same proof a password
// reset uses. The phone number proves nothing and is used for nothing.
//
// ── What lives here and what does not ───────────────────────────────────────
//
// Here: the words a sender types that mean "my orders", the code, its hash, the
// sentences, and the shape of the answer. All pure, all testable, none of it
// touching the database.
//
// Not here: every decision about *whether* to link. Those are five SQL
// functions in `20260928000000_whatsapp_identities.sql`, so the throttles and
// the attempt counter are enforced by the database in one transaction rather
// than by a webhook that can be invoked twice at once.
//
// ── The one rule that shapes the sentences ──────────────────────────────────
//
// Nothing the assistant says may reveal whether an email address has a Visionex
// account. "A code is on its way" is said to every address, including the ones
// with no account behind them, and a wrong code and a code for a non-existent
// account fail with the same words. Otherwise this becomes a way to test
// whether a person you have the email of is a Visionex customer.

import { say } from "./whatsappStrings.ts";
import type { Language } from "./whatsappCatalog.ts";
import { normaliseAlias } from "./whatsappRouter.ts";
import { foldDigits } from "./whatsappCommands.ts";
import { normaliseEmail } from "./whatsappOnboarding.ts";

export { normaliseEmail };

/**
 * The two states this feature can leave a sender in, named as session steps.
 *
 * Named rather than tracked separately so the engine's own rules apply to them:
 * `#` cancels a half-finished link, `0` leaves it, and the session timeout
 * drops it. Nothing here re-implements any of that.
 */
export const ACCOUNT_EMAIL_STEP = "account_email";
export const ACCOUNT_CODE_STEP = "account_code";

/** The catalog node these steps belong to. */
export const ACCOUNT_FEATURE = "services.orders";

/** How long a code is good for. Mirrors the default in the SQL function. */
export const LINK_CODE_TTL_MINUTES = 10;

/** Wrong codes allowed before the code is destroyed. Mirrors the SQL. */
export const MAX_CODE_ATTEMPTS = 5;

/** Orders read back at once. Three is what "where is my order" usually means. */
export const ORDER_PAGE = 3;

/**
 * What a message about accounts and orders is asking for.
 *
 * `unlink` is tested before `link` and that ordering is not cosmetic: "unlink
 * my account" contains "link my account" as a substring, so a link-first check
 * disconnects nobody and re-links everybody. A test pins it.
 */
export type AccountIntent = "orders" | "link" | "unlink";

/**
 * Possessive, always.
 *
 * "طلبي" is my order; "أبغى أطلب زيت زيتون" is shopping and belongs to the
 * bazaar parser one block further down. The difference between the two is
 * exactly the possessive, so that is what this matches — never the bare verb.
 */
const ORDER_WORDS_AR = [
  "طلبي", "طلباتي", "طلبيتي", "طلبياتي", "شحنتي", "شحناتي", "اوردري",
  "حاله طلبي", "حاله الطلب", "حاله طلبيتي", "تتبع طلبي", "تتبع الطلب",
  "وين طلبي", "وين طلبيتي", "وين شحنتي", "فين طلبي", "اين طلبي",
  "متى يوصل طلبي", "طلبي وصل",
];

const ORDER_WORDS_EN = [
  "my order", "my orders", "order status", "status of my order",
  "track my order", "track order", "where is my order", "where s my order",
  "wheres my order", "my parcel", "my shipment", "my delivery", "my purchase",
  "my purchases",
];

const LINK_WORDS_AR = [
  "اربط حسابي", "ربط حسابي", "اربط الحساب", "ربط الحساب", "اربط حساب",
  "وصل حسابي", "ربط حسابي بفيجنكس",
];

const LINK_WORDS_EN = [
  "link my account", "link account", "link my visionex account",
  "connect my account", "connect account", "verify my account",
];

const UNLINK_WORDS_AR = [
  "الغاء الربط", "الغي الربط", "فك الربط", "افصل حسابي", "الغاء ربط حسابي",
  "انسي حسابي", "احذف حسابي من واتساب", "لا تربط حسابي",
];

const UNLINK_WORDS_EN = [
  "unlink", "unlink my account", "unlink account", "disconnect my account",
  "disconnect account", "forget my account", "remove my account",
];

/**
 * Long enough to hold any of the phrases above with a courtesy around it,
 * short enough that a paragraph mentioning an order in passing is not treated
 * as a request to look one up. The same sixty-character judgement the weather
 * parser makes, for the same reason: "my order never arrived and I want to
 * complain about the whole experience" is a support message, not a lookup.
 */
const MAX_INTENT_CHARS = 60;

const containsAny = (haystack: string, needles: string[]): boolean =>
  needles.some((needle) => haystack.includes(needle));

/**
 * What this message is about, or null for everything else.
 *
 * Null is the overwhelmingly common answer and the safe one: the message
 * carries on to the assistant exactly as it did before this feature existed.
 */
export function parseAccountIntent(text: string | null | undefined): AccountIntent | null {
  const value = normaliseAlias(text ?? "");
  if (!value || value.length > MAX_INTENT_CHARS) return null;

  // Unlink first. See the note on AccountIntent.
  if (containsAny(value, UNLINK_WORDS_AR) || containsAny(value, UNLINK_WORDS_EN)) return "unlink";
  if (containsAny(value, LINK_WORDS_AR) || containsAny(value, LINK_WORDS_EN)) return "link";
  if (containsAny(value, ORDER_WORDS_AR) || containsAny(value, ORDER_WORDS_EN)) return "orders";
  return null;
}

/**
 * Six digits and nothing else.
 *
 * Only ever consulted while a code is actually outstanding, so a stray "123456"
 * from somebody who is not linking anything is not intercepted. Arabic-Indic
 * and Persian digits are folded first — ٣ and 3 are the same key to the person
 * pressing it, and a code that only works on a Latin keypad works for half this
 * audience.
 */
export function readLinkCode(text: string | null | undefined): string | null {
  // Spaces, dashes and the bidirectional marks a right-to-left keyboard slips
  // in around digits are removed: "12 34 56" and a mark-wrapped "١٢٣٤٥٦" are
  // both somebody typing the six digits they were sent.
  // Escaped rather than pasted: LRM, RLM and ALM are invisible in an editor,
  // and a reviewer cannot check a character they cannot see.
  const value = foldDigits((text ?? "").trim()).replace(/[\s\u200e\u200f\u061c-]/g, "");
  return /^\d{6}$/.test(value) ? value : null;
}

/**
 * A code, from the platform's cryptographic generator.
 *
 * Rejection sampling rather than `% 1000000`: the modulo of a 32-bit draw makes
 * the low codes very slightly likelier, which is a real bias in a space of a
 * million and free to avoid.
 */
export function generateLinkCode(random: () => number = cryptoRandom): string {
  const limit = 4_294_000_000; // largest multiple of 1e6 under 2^32
  let draw = random();
  while (draw >= limit) draw = random();
  return String(draw % 1_000_000).padStart(6, "0");
}

function cryptoRandom(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0];
}

/**
 * What the database stores instead of the code.
 *
 * Keyed with `WHATSAPP_APP_SECRET` — which the webhook already refuses to start
 * without — so the stored value cannot be reversed by anybody holding a copy of
 * the table, and cannot be precomputed either: a six-digit space is a table of
 * a million rows to anyone who knows the digest is a bare SHA-256.
 */
export async function hashLinkCode(code: string, secret: string): Promise<string> {
  if (!secret) throw new Error("a signing secret is required to hash a link code");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(code));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** What the SQL says came back, so the webhook never invents a fifth outcome. */
export type LinkRequestStatus = "sent" | "cooldown" | "throttled" | "already_linked";
export type LinkConfirmResult = "verified" | "invalid" | "expired" | "locked" | "none";

/** One order, as the lookup returns it. No address, no email, by construction. */
export interface OrderSummary {
  reference: string;
  status: string;
  createdAt: string;
  itemCount: number;
  firstItem: string | null;
  totalVx: number | null;
  totalUsd: number | null;
  shopName: string | null;
}

/**
 * The lookup's rows, as this module's shape.
 *
 * Defensive rather than trusting: a row missing a column, a null where a number
 * was expected, or a payload that is not an array at all resolves to something
 * printable instead of throwing inside the reply builder. The customer is asking
 * where their parcel is; a `TypeError` is not an answer to that.
 */
export function readOrders(rows: unknown): OrderSummary[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, unknown>;
    const reference = typeof value.reference === "string" ? value.reference : "";
    const status = typeof value.status === "string" ? value.status : "";
    if (!reference || !status) return [];
    return [{
      reference,
      status,
      createdAt: typeof value.created_at === "string" ? value.created_at : "",
      itemCount: Number(value.item_count ?? 0) || 0,
      firstItem: typeof value.first_item === "string" ? value.first_item : null,
      totalVx: value.total_vx === null || value.total_vx === undefined ? null : Number(value.total_vx),
      totalUsd: value.total_usd === null || value.total_usd === undefined ? null : Number(value.total_usd),
      shopName: typeof value.shop_name === "string" ? value.shop_name : null,
    }];
  });
}

const STATUS_KEYS = {
  pending: "orderPending",
  paid: "orderPaid",
  processing: "orderProcessing",
  shipped: "orderShipped",
  completed: "orderCompleted",
  cancelled: "orderCancelled",
  refunded: "orderRefunded",
  payment_failed: "orderPaymentFailed",
} as const;

/**
 * The status, in words the sender's language actually uses.
 *
 * An unknown status falls back to the raw value rather than to silence: a new
 * state added to the check constraint later should read oddly, not vanish.
 */
export function orderStatusLabel(status: string, language: Language): string {
  const key = STATUS_KEYS[status as keyof typeof STATUS_KEYS];
  return key ? say(key, language) : status;
}

/**
 * The money, in whichever currency the order was actually placed in.
 *
 * Never both, and never a converted figure: the schema stores one or the other
 * and inventing an exchange rate to read aloud would be inventing a price.
 */
export function formatOrderTotal(order: OrderSummary): string | null {
  if (order.totalVx !== null && order.totalVx !== undefined) return `${order.totalVx} VX`;
  if (order.totalUsd !== null && order.totalUsd !== undefined) {
    return `$${Number(order.totalUsd).toFixed(2)}`;
  }
  return null;
}

/**
 * A date somebody can place, without a time nobody asked for.
 *
 * `Intl` rather than a hand-written month table: twenty languages of month
 * names is twenty chances to be wrong about a calendar, and the runtime already
 * ships the right answer for all of them.
 */
export function formatOrderDate(iso: string, language: Language): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(language, { day: "numeric", month: "long" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * The orders, as a message.
 *
 * One block per order, and the status on its own line because that is the line
 * the sender is listening for. The reference comes last: it matters only when
 * they need to quote it to somebody, and leading with eight characters of hex
 * makes a screen reader spell out gibberish before saying anything useful.
 */
export function formatOrders(params: { language: Language; orders: OrderSummary[] }): string {
  const { language, orders } = params;
  if (orders.length === 0) return say("ordersNone", language);

  const lines: string[] = [say("ordersHeading", language), ""];

  for (const order of orders) {
    const what = order.firstItem
      ? order.itemCount > 1
        ? `${order.firstItem} (+${order.itemCount - 1})`
        : order.firstItem
      : say("ordersItemsUnknown", language);
    lines.push(`• *${what}*`);
    lines.push(`  ${orderStatusLabel(order.status, language)}`);

    const parts = [formatOrderDate(order.createdAt, language), order.shopName, formatOrderTotal(order)]
      .filter((part): part is string => !!part);
    if (parts.length > 0) lines.push(`  ${parts.join(" · ")}`);
    lines.push(`  ${say("orderReference", language)} ${order.reference}`);
    lines.push("");
  }

  lines.push(say("ordersFooter", language));
  return lines.join("\n").trim();
}

/**
 * The email that carries the code.
 *
 * Plain and short on purpose. It is read by somebody who asked for it thirty
 * seconds ago on another device, and the only thing it has to do is present six
 * digits unambiguously — which is why they are on their own line, spaced, and
 * not wrapped in a button, a tracking pixel or a marketing footer.
 *
 * The warning line is the important one: it is the only notice the *owner* of
 * the mailbox gets if somebody else typed their address into WhatsApp.
 */
export function linkCodeEmail(params: { code: string; language: Language }): {
  subject: string;
  html: string;
  text: string;
} {
  const { code, language } = params;
  const subject = say("linkEmailSubject", language);
  const intro = say("linkEmailIntro", language);
  const warning = say("linkEmailWarning", language);
  const dir = language === "ar" || language === "fa" || language === "ur" ? "rtl" : "ltr";

  const html = [
    `<div dir="${dir}" style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#111">`,
    `<p>${escapeHtml(intro)}</p>`,
    `<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:24px 0">${escapeHtml(code)}</p>`,
    `<p style="color:#555;font-size:14px">${escapeHtml(warning)}</p>`,
    `</div>`,
  ].join("");

  return { subject, html, text: `${intro}\n\n${code}\n\n${warning}` };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sends it, or reports honestly that it could not.
 *
 * Resend, because `RESEND_API_KEY` and `RESEND_FROM` are already synced to every
 * edge function by `deploy.yml` and `bazaar-notify-seller` already sends this
 * way. No new provider, no new secret, and no new edge function — which matters
 * when the project is at 92 of 100.
 *
 * The code never reaches a log line here, in any branch. A failure logs the
 * status and nothing else.
 */
export async function sendLinkCodeEmail(params: {
  to: string;
  code: string;
  language: Language;
  read?: (name: string) => string | undefined;
  fetcher?: typeof fetch;
}): Promise<boolean> {
  const read = params.read ?? denoEnv;
  const key = (read("RESEND_API_KEY") ?? "").trim();
  if (!key) {
    console.warn("[whatsapp] link code not sent: no email provider configured");
    return false;
  }
  const from = (read("RESEND_FROM") ?? "").trim() || "Visionex <no-reply@visionex.app>";
  const { subject, html, text } = linkCodeEmail({ code: params.code, language: params.language });

  try {
    const response = await (params.fetcher ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from, to: [params.to], subject, html, text }),
    });
    if (!response.ok) {
      console.error("[whatsapp] link code email rejected:", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[whatsapp] link code email failed:", error instanceof Error ? error.name : "unknown");
    return false;
  }
}

const denoEnv = (name: string): string | undefined =>
  (globalThis as { Deno?: { env?: { get(key: string): string | undefined } } }).Deno?.env?.get(name);
