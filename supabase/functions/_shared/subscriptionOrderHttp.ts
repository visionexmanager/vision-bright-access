// The browser-facing half of the subscription-order notices, served by the
// trial-billing function (verify_jwt = false there, because its other caller is
// the cron). The project is at its Edge Function ceiling, so this is a handler
// the existing billing function delegates to, not a function of its own.
//
// Each action checks its own caller:
//
//   owner_new_order  a signed-in user, for THEIR OWN pending order only
//   buyer_decided    a signed-in admin (the admin page, after approve/reject)
//
// Every notice is claimed in the database first, so none of these can tell a
// person twice. The response carries outcomes, never a number, an address or a
// name.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "./cors.ts";
import { notifyBuyerOfDecision, notifyOwnerOfOrder, resendEmailSender } from "./subscriptionOrderNotify.ts";

const REFERENCE = /^VX-[0-9A-F]{6}$/;

export const ORDER_NOTICE_ACTIONS = ["owner_new_order", "buyer_decided"] as const;

export function isOrderNoticeRequest(body: unknown): boolean {
  const action = (body as { action?: unknown } | null)?.action;
  return typeof action === "string" && (ORDER_NOTICE_ACTIONS as readonly string[]).includes(action);
}

export async function handleOrderNoticeRequest(req: Request, body: { action?: unknown; reference?: unknown }): Promise<Response> {
  const cors = getCorsHeaders(req);
  const json = (status: number, payload: unknown) =>
    new Response(JSON.stringify(payload), { status, headers: { ...cors, "Content-Type": "application/json" } });

  const action = typeof body.action === "string" ? body.action : "";
  const reference = typeof body.reference === "string" ? body.reference.trim().toUpperCase() : "";
  if (!REFERENCE.test(reference)) return json(400, { error: "bad_reference" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const whatsapp = { token: Deno.env.get("WHATSAPP_TOKEN"), phoneNumberId: Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") };
  const authHeader = req.headers.get("Authorization") ?? "";

  try {
    // The caller, from their own token.
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json(401, { error: "unauthorized" });

    const { data: order } = await db.from("subscription_orders").select("id, user_id").eq("reference_code", reference).maybeSingle();
    if (!order) return json(404, { error: "not_found" });

    if (action === "owner_new_order") {
      // Only the buyer can ask, and only for their own order.
      if (order.user_id !== user.id) return json(403, { error: "forbidden" });
      return json(200, { outcome: await notifyOwnerOfOrder(db, whatsapp, reference) });
    }

    const { data: isAdmin } = await db.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (isAdmin !== true) return json(403, { error: "forbidden" });
    const outcome = await notifyBuyerOfDecision(db, whatsapp, resendEmailSender(), order.id);
    return json(200, { outcome: typeof outcome === "object" ? { ...outcome } : outcome });
  } catch (e) {
    console.error("[order-notices] failed:", (e as Error)?.name ?? "error");
    return json(200, { outcome: "failed" });
  }
}
