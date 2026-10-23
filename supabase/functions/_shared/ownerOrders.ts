// Subscription orders, confirmed from the owner's WhatsApp.
//
// A subscriber pays the owner (OMT, Whish, or a card link) and an order waits in
// `subscription_orders` until the owner has seen the money. The admin page has
// always been the way to confirm it; this is the same decision from the phone.
//
// Three deliberate limits:
//  - Only a slash command with the order's own reference (VX-AB12CD) decides
//    anything. A bare «موافق» never does: it decides content proposals, and an
//    order is money.
//  - It decides nothing itself. `owner_review_subscription_order` calls the same
//    approve/reject functions as the admin page, so what an approval grants is
//    defined in one place.
//  - A reply names the plan and the months, never the buyer's phone or email.

import { ownerActorId } from "./ownerContentActions.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

export type OrderCommand =
  | { kind: "list" }
  | { kind: "decide"; approve: boolean; reference: string; note: string | null };

const REFERENCE = /\bVX-?([0-9A-F]{6})\b/i;
const LIST_WORDS = /^(orders?|الطلبات|طلبات|طلبات الاشتراك|اشتراكات)$/i;
const APPROVE_WORDS = /(approve|confirm|accept|وافق|موافق|أوافق|اوافق|تأكيد|تاكيد|أكّد|اكد|أكد)/i;
const REJECT_WORDS = /(reject|decline|deny|ارفض|رفض|مرفوض)/i;

/** The order reference in its stored form, or null. */
export function orderReference(text: string): string | null {
  const match = REFERENCE.exec(text);
  return match ? `VX-${match[1].toUpperCase()}` : null;
}

/**
 * `body` is the owner's message after the slash. Null means "not about orders",
 * and the caller carries on with every other owner command as before.
 */
export function parseOrderCommand(body: string): OrderCommand | null {
  const text = (body ?? "").trim();
  if (!text) return null;
  if (LIST_WORDS.test(text)) return { kind: "list" };

  const reference = orderReference(text);
  if (!reference) return null;
  const rest = text.replace(REFERENCE, " ").replace(/\s+/g, " ").trim();
  // Reject first: "don't approve" must not approve.
  const approve = REJECT_WORDS.test(rest) ? false : APPROVE_WORDS.test(rest) ? true : null;
  if (approve === null) return null;

  const note = rest.replace(REJECT_WORDS, " ").replace(APPROVE_WORDS, " ").replace(/\s+/g, " ").trim();
  return { kind: "decide", approve, reference, note: note ? note.slice(0, 500) : null };
}

export interface PendingOrder {
  reference_code: string;
  plan_id: string;
  months: number;
  price_usd: number | string;
  payment_method: string;
  created_at: string;
}

const METHOD_AR: Record<string, string> = { omt: "OMT", whish: "Whish", card: "بطاقة" };

export function formatOrderList(rows: PendingOrder[]): string {
  if (rows.length === 0) return "لا توجد طلبات اشتراك بانتظار التأكيد.";
  return [
    `*طلبات الاشتراك بانتظار التأكيد (${rows.length})*`,
    "",
    ...rows.map((r) =>
      `• ${r.reference_code} — ${r.plan_id} × ${r.months} شهر — $${Number(r.price_usd).toFixed(2)} — ${METHOD_AR[r.payment_method] ?? r.payment_method}`
    ),
    "",
    "للتأكيد بعد وصول المبلغ:  /approve VX-XXXXXX",
    "للرفض:  /reject VX-XXXXXX السبب",
  ].join("\n");
}

export async function listPendingOrders(db: Db): Promise<PendingOrder[]> {
  const { data } = await db
    .from("subscription_orders")
    .select("reference_code, plan_id, months, price_usd, payment_method, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(15);
  return (data ?? []) as PendingOrder[];
}

interface ReviewResult { ok?: boolean; error?: string; status?: string; plan?: string; months?: number }

export function formatOrderOutcome(reference: string, approve: boolean, result: ReviewResult | null): string {
  if (!result?.ok) {
    if (result?.error === "not_found") return `لا يوجد طلب بالمرجع ${reference}.`;
    if (result?.error === "already_reviewed") {
      return `الطلب ${reference} سبق البتّ فيه (${result.status === "approved" ? "مقبول" : "مرفوض"}).`;
    }
    if (result?.error === "no_admin") return "لا يوجد حساب مدير لتسجيل القرار باسمه.";
    return "تعذّر تسجيل القرار. جرّب مرة أخرى.";
  }
  return approve
    ? `✅ تم تفعيل الاشتراك للطلب ${reference} — ${result.plan} × ${result.months} شهر. وصل المشترك إشعار.`
    : `❌ رُفض الطلب ${reference}. وصل المشترك إشعار.`;
}

/** Apply the decision. Every failure is a sentence; a database error never reaches the chat. */
export async function decideOrder(db: Db, command: Extract<OrderCommand, { kind: "decide" }>): Promise<string> {
  const actor = await ownerActorId(db);
  if (!actor) return formatOrderOutcome(command.reference, command.approve, { ok: false, error: "no_admin" });
  const { data, error } = await db.rpc("owner_review_subscription_order", {
    _reference: command.reference,
    _approve: command.approve,
    _actor_id: actor,
    _note: command.note ? `${command.note} (via WhatsApp)` : "via WhatsApp",
  });
  if (error) {
    // The code only: the message can quote the statement.
    console.error("[owner-orders] decision failed:", error.code ?? "unknown");
    return formatOrderOutcome(command.reference, command.approve, null);
  }
  return formatOrderOutcome(command.reference, command.approve, data as ReviewResult);
}
