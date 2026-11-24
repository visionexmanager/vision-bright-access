/**
 * The browser's door to account deletion. It lives inside `trial-billing`
 * (which already answers the browser for subscription-order notices) because
 * the project is at its Edge Function ceiling; it checks its own caller.
 *
 *   { action: "account_deletion_status" }
 *   { action: "account_deletion_request", reason_code, reason_text?, confirm_email }
 *   { action: "account_deletion_cancel" }
 *
 * Identity is the verified session. The person must also type their own email
 * address, so an unlocked browser left open is not enough to start an erasure.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "./cors.ts";
import {
  parseDeletionRequest, sendSupportMail, supportNotice, SUPPORT_INBOX, userReceipt,
} from "./accountDeletion.ts";

export const ACCOUNT_DELETION_ACTIONS = [
  "account_deletion_status", "account_deletion_request", "account_deletion_cancel",
] as const;

export function isAccountDeletionRequest(body: unknown): boolean {
  const action = (body as { action?: unknown } | null)?.action;
  return typeof action === "string" && (ACCOUNT_DELETION_ACTIONS as readonly string[]).includes(action);
}

export async function handleAccountDeletionRequest(
  req: Request, body: Record<string, unknown>,
): Promise<Response> {
  const cors = getCorsHeaders(req);
  const json = (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const asUser = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json(401, { error: "unauthorized" });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const action = String(body.action);

  if (action === "account_deletion_status") {
    const { data } = await db.rpc("account_deletion_status", { _user_id: user.id });
    return json(200, { pending: !!data, purge_after: data ?? null });
  }

  if (action === "account_deletion_cancel") {
    const { data } = await db.rpc("cancel_account_deletion", { _user_id: user.id });
    return json(200, { cancelled: data === true });
  }

  const parsed = parseDeletionRequest(body);
  if (!parsed.ok) return json(400, { error: parsed.error });
  if (!user.email || parsed.confirmEmail !== user.email.toLowerCase()) {
    return json(400, { error: "confirm_mismatch" });
  }

  const { data, error } = await db.rpc("request_account_deletion", {
    _user_id: user.id,
    _reason_code: parsed.reasonCode,
    _reason_text: parsed.reasonText,
    _channel: "web",
  });
  if (error) {
    // 'staff_account' is the only refusal the person can act on.
    const staff = String(error.message ?? "").includes("staff_account");
    return json(staff ? 403 : 500, { error: staff ? "staff_account" : "failed" });
  }

  // Tell support and the person once, on the first request only.
  if (data && data.already === false) {
    const n = supportNotice({
      email: user.email, reasonCode: parsed.reasonCode, reasonText: parsed.reasonText,
      channel: "web", purgeAfter: data.purge_after,
    });
    await sendSupportMail(SUPPORT_INBOX, n.subject, n.html, user.email);
    const r = userReceipt({ purgeAfter: data.purge_after });
    await sendSupportMail(user.email, r.subject, r.html);
  }
  return json(200, { pending: true, purge_after: data?.purge_after ?? null });
}
