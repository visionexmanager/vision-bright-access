/**
 * Account deletion — the parts shared by the account_deletion_* actions of `trial-billing` (a
 * person asks, from the site or from WhatsApp) and the daily purge in
 * `trial-billing`.
 *
 * The rules, in one place:
 *   - The person has 14 days to change their mind; the database sets the date.
 *   - The reason goes to the support inbox, and the person gets a receipt.
 *   - When the date arrives the auth account is deleted. If other tables refuse
 *     that (an order, a purchase or an audit row still points at the account),
 *     the account is ANONYMISED instead: the email is replaced, the sign-in is
 *     banned and the profile and WhatsApp link are scrubbed. Money and audit
 *     history are kept, without a person attached.
 *   - Nothing here logs an address, a reason or a name. Counts only.
 */

export const REASON_CODES = [
  "not_using", "privacy", "too_expensive", "missing_features",
  "found_alternative", "bad_experience", "other",
] as const;
export type ReasonCode = typeof REASON_CODES[number];

export const SUPPORT_INBOX = "support@visionex.app";
export const GRACE_DAYS = 14;
const REASON_TEXT_MAX = 1000;

export type ParsedRequest =
  | { ok: true; reasonCode: ReasonCode; reasonText: string | null; confirmEmail: string }
  | { ok: false; error: "bad_reason" | "reason_too_long" | "confirm_required" };

/** Reads the body of a "delete my account" request. Never throws. */
export function parseDeletionRequest(body: unknown): ParsedRequest {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const code = typeof b.reason_code === "string" ? b.reason_code : "";
  if (!(REASON_CODES as readonly string[]).includes(code)) return { ok: false, error: "bad_reason" };
  const text = typeof b.reason_text === "string" ? b.reason_text.trim() : "";
  if (text.length > REASON_TEXT_MAX) return { ok: false, error: "reason_too_long" };
  const confirmEmail = typeof b.confirm_email === "string" ? b.confirm_email.trim().toLowerCase() : "";
  if (!confirmEmail) return { ok: false, error: "confirm_required" };
  return { ok: true, reasonCode: code as ReasonCode, reasonText: text || null, confirmEmail };
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const REASON_LABEL: Record<ReasonCode, string> = {
  not_using: "Not using it any more",
  privacy: "Privacy concerns",
  too_expensive: "Too expensive",
  missing_features: "Missing features",
  found_alternative: "Found an alternative",
  bad_experience: "Bad experience",
  other: "Other",
};

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** The message that reaches the support inbox. */
export function supportNotice(p: {
  email: string; reasonCode: ReasonCode; reasonText: string | null;
  channel: string; purgeAfter: string;
}): { subject: string; html: string } {
  return {
    subject: `Account deletion requested — ${REASON_LABEL[p.reasonCode]}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6">
      <h2>Account deletion requested</h2>
      <p><b>Account:</b> ${escapeHtml(p.email)}</p>
      <p><b>Channel:</b> ${escapeHtml(p.channel)}</p>
      <p><b>Reason:</b> ${escapeHtml(REASON_LABEL[p.reasonCode])}</p>
      ${p.reasonText ? `<p><b>Details:</b></p><blockquote>${escapeHtml(p.reasonText)}</blockquote>` : ""}
      <p><b>Deleted on:</b> ${formatDate(p.purgeAfter)} unless the person cancels first.</p>
    </div>`,
  };
}

/** The receipt the person gets. Arabic and English, because the account language is not known here. */
export function userReceipt(p: { purgeAfter: string }): { subject: string; html: string } {
  const d = formatDate(p.purgeAfter);
  return {
    subject: "Visionex — account deletion requested / تم استلام طلب حذف حسابك",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7">
      <p>We received your request to delete your Visionex account. It will be deleted permanently on <b>${d}</b>.
      Until then you can change your mind: sign in and choose <b>Settings → Delete my account → Cancel deletion</b>.</p>
      <p>Signing in does not cancel the request; only the cancel button does.</p>
      <hr/>
      <p dir="rtl" style="text-align:right">استلمنا طلبك بحذف حسابك في Visionex. سيُحذف نهائياً بتاريخ <b>${d}</b>.
      يمكنك التراجع قبل ذلك: سجّل الدخول ثم اختر <b>الإعدادات ← حذف حسابي ← إلغاء الحذف</b>.</p>
      <p dir="rtl" style="text-align:right">تسجيل الدخول وحده لا يلغي الطلب، فقط زر الإلغاء.</p>
    </div>`,
  };
}

export function userDeletedNotice(): { subject: string; html: string } {
  return {
    subject: "Visionex — your account was deleted / تم حذف حسابك",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.7">
      <p>Your Visionex account has been deleted. You are welcome to create a new one at any time.</p>
      <p dir="rtl" style="text-align:right">تم حذف حسابك في Visionex. يمكنك إنشاء حساب جديد متى شئت.</p></div>`,
  };
}

/** Resend, from the support address. False when the key is not set or the send is refused. */
export async function sendSupportMail(
  to: string, subject: string, html: string, replyTo?: string,
): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Visionex Support <support@visionex.app>",
        to: [to], subject, html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// deno-lint-ignore no-explicit-any
type Db = any;

export interface PurgeResult { due: number; deleted: number; anonymized: number; failed: number }

/**
 * Erases every account whose 14 days are over. Safe to run any number of times:
 * a request is finished once, and a failure leaves it pending for tomorrow.
 */
export async function purgeDueAccounts(db: Db, limit = 20): Promise<PurgeResult> {
  const out: PurgeResult = { due: 0, deleted: 0, anonymized: 0, failed: 0 };
  const { data, error } = await db.rpc("due_account_deletions", { _limit: limit });
  if (error || !Array.isArray(data)) return { ...out, failed: 1 };
  out.due = data.length;

  for (const row of data as Array<{ request_id: string; user_id: string }>) {
    try {
      const { data: found } = await db.auth.admin.getUserById(row.user_id);
      const email: string | null = found?.user?.email ?? null;

      // The mark first: a failure below must never leave an address free to
      // claim a second free week.
      const begun = await db.rpc("begin_account_purge", { _request_id: row.request_id });
      if (begun.error) { out.failed++; continue; }

      const del = await db.auth.admin.deleteUser(row.user_id);
      let outcome: "completed" | "anonymized" | null = null;
      if (!del.error) {
        outcome = "completed";
      } else {
        // Something that must be kept still points at the account. Remove the
        // person from it instead of the row.
        await db.from("whatsapp_identities").delete().eq("user_id", row.user_id);
        await db.from("profiles").update({ display_name: "Deleted user", avatar_url: null }).eq("user_id", row.user_id);
        const anon = await db.auth.admin.updateUserById(row.user_id, {
          email: `deleted-${row.user_id}@deleted.invalid`,
          phone: "",
          ban_duration: "876000h",
          user_metadata: {},
        });
        if (!anon.error) outcome = "anonymized";
      }

      if (!outcome) { out.failed++; continue; }
      await db.rpc("finish_account_purge", { _request_id: row.request_id, _outcome: outcome });
      if (outcome === "completed") out.deleted++; else out.anonymized++;

      if (email) {
        const n = userDeletedNotice();
        await sendSupportMail(email, n.subject, n.html);
      }
    } catch {
      out.failed++;
    }
  }
  return out;
}
