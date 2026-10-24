// Telling people about a subscription order: the owner when it arrives, the
// buyer once it is decided.
//
// Both directions are claimed first (`owner_notified_at`, `buyer_notified_at`),
// so a retry, a second tab, the sweep and the webhook can all call in and a
// person is told once. A claim whose delivery failed everywhere is released, and
// the sweep tries it again. Nothing here logs a number, an address or a name:
// outcomes only.

import { ownerTarget } from "./ownerContentActions.ts";
import { ownerWindowOpen } from "./ownerContent.ts";
import { normalizePhone } from "./ownerControl.ts";
import {
  buyerNotice,
  OWNER_ORDER_TEMPLATE,
  ownerOrderMessage,
  type OrderSummary,
} from "./subscriptionOrderNotices.ts";
import { sendWhatsAppInteractive, sendWhatsAppTemplate, sendWhatsAppText } from "./whatsapp.ts";
import { reminderLanguage, withinServiceWindow } from "./whatsappPlanReminder.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

export interface WhatsAppConfig { token: string | undefined; phoneNumberId: string | undefined }
export interface EmailSender { (to: string, subject: string, html: string): Promise<boolean> }

export type OwnerNoticeOutcome = "interactive" | "text" | "template" | "already" | "not_pending" | "not_found" | "failed" | "off";

const ORDER_COLUMNS =
  "id, user_id, plan_id, months, price_usd, payment_method, reference_code, status, admin_notes, whatsapp_phone, owner_notified_at, buyer_notified_at";

interface OrderRow extends OrderSummary {
  id: string;
  user_id: string;
  status: string;
  admin_notes: string | null;
  whatsapp_phone: string | null;
}

async function planName(db: Db, planId: string): Promise<string | null> {
  const { data } = await db.from("billing_plans").select("name").eq("id", planId).maybeSingle();
  return (data?.name as string | undefined) ?? null;
}

/**
 * Tell the owner a pending order is waiting. Idempotent.
 *
 * Inside the owner's 24-hour window: two buttons (with the same words as text if
 * Meta refuses them). Outside it: the approved template, whose reply
 * («طلبات») opens the window and shows the buttons.
 */
export async function notifyOwnerOfOrder(
  db: Db,
  whatsapp: WhatsAppConfig,
  reference: string,
  now: Date = new Date(),
): Promise<OwnerNoticeOutcome> {
  const { data: order } = await db.from("subscription_orders").select(ORDER_COLUMNS).eq("reference_code", reference).maybeSingle();
  if (!order) return "not_found";
  if (order.status !== "pending") return "not_pending";
  if (order.owner_notified_at) return "already";
  if (!whatsapp.token || !whatsapp.phoneNumberId) return "failed";

  const target = await ownerTarget(db);
  if (!target.ok) return "off";

  // The claim: only one caller gets the row back.
  const { data: claimed } = await db
    .from("subscription_orders")
    .update({ owner_notified_at: now.toISOString() })
    .eq("id", order.id)
    .eq("status", "pending")
    .is("owner_notified_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) return "already";

  const release = async (): Promise<OwnerNoticeOutcome> => {
    await db.from("subscription_orders").update({ owner_notified_at: null }).eq("id", order.id);
    return "failed";
  };

  if (ownerWindowOpen(target.lastInboundAt, now)) {
    const message = ownerOrderMessage({ ...(order as OrderRow), plan_name: await planName(db, order.plan_id) });
    const tapped = await sendWhatsAppInteractive({
      phoneNumberId: whatsapp.phoneNumberId,
      token: whatsapp.token,
      to: target.to,
      interactive: message.interactive as unknown as Record<string, unknown>,
    });
    if (tapped) return "interactive";
    const text = await sendWhatsAppText({ phoneNumberId: whatsapp.phoneNumberId, token: whatsapp.token, to: target.to, body: message.text });
    if (text) return "text";
  }

  const { count } = await db.from("subscription_orders").select("id", { count: "exact", head: true }).eq("status", "pending");
  const sent = await sendWhatsAppTemplate({
    phoneNumberId: whatsapp.phoneNumberId,
    token: whatsapp.token,
    to: target.to,
    template: OWNER_ORDER_TEMPLATE.name,
    language: "ar",
    variables: [String(Math.max(1, count ?? 1))],
  });
  return sent ? "template" : await release();
}

interface ConversationRow { wa_phone: string; language: string | null; last_message_at: string | null }

export interface BuyerNoticeReport { app: boolean; email: boolean; whatsapp: "text" | "template" | "none" }

/**
 * Tell the buyer how the order was decided: in the app, by e-mail and on the
 * WhatsApp number they gave. Idempotent; each channel is best-effort and the
 * in-app notice is the floor.
 */
export async function notifyBuyerOfDecision(
  db: Db,
  whatsapp: WhatsAppConfig,
  sendEmail: EmailSender,
  orderId: string,
  now: Date = new Date(),
): Promise<BuyerNoticeReport | "already" | "not_decided" | "not_found"> {
  const { data: order } = await db.from("subscription_orders").select(ORDER_COLUMNS).eq("id", orderId).maybeSingle();
  if (!order) return "not_found";
  if (order.status !== "approved" && order.status !== "rejected") return "not_decided";
  if (order.buyer_notified_at) return "already";

  const { data: claimed } = await db
    .from("subscription_orders")
    .update({ buyer_notified_at: now.toISOString() })
    .eq("id", order.id)
    .is("buyer_notified_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) return "already";

  const approved = order.status === "approved";
  const name = await planName(db, order.plan_id);
  const summary = { plan_id: order.plan_id, plan_name: name, months: order.months };
  const report: BuyerNoticeReport = { app: false, email: false, whatsapp: "none" };

  // Arabic is the default; a conversation held in another language gets English.
  const phone = normalizePhone(order.whatsapp_phone);
  let conversation = null as ConversationRow | null;
  if (phone && phone.length >= 8) {
    const { data: rows } = await db
      .from("whatsapp_conversations")
      .select("wa_phone, language, last_message_at")
      .like("wa_phone", `%${phone.slice(-8)}`)
      .limit(5);
    conversation = ((rows ?? []) as ConversationRow[]).find((row) => normalizePhone(row.wa_phone) === phone) ?? null;
  }
  const language = reminderLanguage(conversation?.language ?? null);
  const notice = buyerNotice(summary, approved, order.admin_notes, language);

  try {
    const { error } = await db.rpc("system_insert_notification", {
      _user_id: order.user_id,
      _title: notice.inAppTitle,
      _body: buyerNotice(summary, approved, order.admin_notes, "ar").text + "\n\n" + buyerNotice(summary, approved, order.admin_notes, "en").text,
      _type: approved ? "success" : "warning",
    });
    report.app = !error;
  } catch { /* the other channels still go */ }

  try {
    const { data: authUser } = await db.auth.admin.getUserById(order.user_id);
    const email = authUser?.user?.email as string | undefined;
    if (email) report.email = await sendEmail(email, notice.emailSubject, notice.emailHtml);
  } catch { /* best effort */ }

  if (phone && phone.length >= 8 && whatsapp.token && whatsapp.phoneNumberId) {
    const to = conversation?.wa_phone ?? phone;
    if (withinServiceWindow(conversation?.last_message_at, now.getTime())) {
      const ok = await sendWhatsAppText({ phoneNumberId: whatsapp.phoneNumberId, token: whatsapp.token, to, body: notice.text });
      if (ok) report.whatsapp = "text";
    }
    if (report.whatsapp === "none") {
      const ok = await sendWhatsAppTemplate({
        phoneNumberId: whatsapp.phoneNumberId,
        token: whatsapp.token,
        to,
        template: notice.template.name,
        language,
        variables: notice.variables,
      });
      if (ok) report.whatsapp = "template";
    }
  }

  // Nothing at all got through: release the claim so the sweep tries again.
  if (!report.app && !report.email && report.whatsapp === "none") {
    await db.from("subscription_orders").update({ buyer_notified_at: null }).eq("id", order.id);
  }
  return report;
}

/** The safety net: owners and buyers whose notice never went out. Counts only. */
export async function sweepOrderNotices(
  db: Db,
  whatsapp: WhatsAppConfig,
  sendEmail: EmailSender,
  now: Date = new Date(),
): Promise<{ owner: number; buyer: number }> {
  const result = { owner: 0, buyer: 0 };
  const tooFresh = new Date(now.getTime() - 2 * 60_000).toISOString();
  const recent = new Date(now.getTime() - 3 * 86_400_000).toISOString();

  const { data: pending } = await db
    .from("subscription_orders")
    .select("reference_code")
    .eq("status", "pending")
    .is("owner_notified_at", null)
    .lt("created_at", tooFresh)
    .gt("created_at", recent)
    .limit(10);
  for (const row of (pending ?? []) as Array<{ reference_code: string }>) {
    const outcome = await notifyOwnerOfOrder(db, whatsapp, row.reference_code, now);
    if (outcome === "interactive" || outcome === "text" || outcome === "template") result.owner++;
  }

  const { data: decided } = await db
    .from("subscription_orders")
    .select("id")
    .in("status", ["approved", "rejected"])
    .is("buyer_notified_at", null)
    .gt("reviewed_at", recent)
    .limit(20);
  for (const row of (decided ?? []) as Array<{ id: string }>) {
    const outcome = await notifyBuyerOfDecision(db, whatsapp, sendEmail, row.id, now);
    if (typeof outcome === "object") result.buyer++;
  }
  return result;
}

/** Resend, from the billing address. False when the key is not set or the send is refused. */
export function resendEmailSender(): EmailSender {
  return async (to, subject, html) => {
    const key = Deno.env.get("RESEND_API_KEY") ?? "";
    if (!key) return false;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Visionex Billing <billing@visionex.app>", to: [to], subject, html, reply_to: "hello@visionex.app" }),
    });
    return res.ok;
  };
}

/** After a decision by reference (the owner's tap or slash command): tell the buyer. */
export async function notifyBuyerByReference(db: Db, whatsapp: WhatsAppConfig, reference: string): Promise<void> {
  try {
    const { data } = await db.from("subscription_orders").select("id").eq("reference_code", reference).maybeSingle();
    if (data?.id) await notifyBuyerOfDecision(db, whatsapp, resendEmailSender(), data.id);
  } catch (e) {
    console.error("[order-notify] buyer notice failed:", (e as Error)?.name ?? "error");
  }
}
