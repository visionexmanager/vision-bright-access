/**
 * vx-coin-review — Supabase Edge Function
 *
 * Admin approves/rejects a manually-verified VX coin purchase (WishMoney /
 * OMT / PayPal — none of the three have a merchant API/webhook here, so
 * this is the admin-review side of that flow, see
 * supabase/migrations/20260712100000_vx_coin_purchases.sql).
 *
 * The actual DB mutation (crediting VX, updating order status) happens
 * inside approve_vx_coin_order()/reject_vx_coin_order() — SECURITY DEFINER
 * RPCs that check has_role(auth.uid(),'admin') themselves. This function
 * exists only because Postgres can't send email directly: it calls the RPC
 * using the caller's own JWT (so auth.uid() resolves correctly and the
 * RPC's own admin check is the real guard — no separate check needed here),
 * then uses a service-role client only to look up the buyer's email
 * (auth.admin.getUserById — not otherwise queryable) and send a receipt.
 *
 * Email is best-effort: the coins are already credited by the RPC before
 * we attempt to send, so a Resend hiccup must not be reported as a failure.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://visionex.app", "https://www.visionex.app"];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed =
    ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost")
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const BILLING_FROM = "Visionex Billing <billing@visionex.app>";

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: BILLING_FROM, to: [to], subject, html, reply_to: "hello@visionex.app" }),
    });
  } catch (err) {
    console.error("[vx-coin-review] email send failed:", err);
  }
}

function approvedEmailHtml(coins: number, total: number) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#10b981;">✅ تم تأكيد عملية الشحن</h2>
<p>تمت إضافة <strong>${coins.toLocaleString()} VX</strong> إلى رصيدك مقابل ${total} $.</p>
<p><a href="https://visionex.app/coins-store">تحقق من رصيدك</a></p>
<p style="color:#6b7280;font-size:0.85em;">Visionex · <a href="https://visionex.app">visionex.app</a></p>
</body></html>`;
}

function rejectedEmailHtml(coins: number, reason: string | null) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h2 style="color:#ef4444;">تعذّر تأكيد عملية الشحن</h2>
<p>لم نتمكن من تأكيد طلب شحن ${coins.toLocaleString()} VX.</p>
${reason ? `<p><strong>السبب:</strong> ${reason}</p>` : ""}
<p>يرجى التأكد من بيانات التحويل والمحاولة مرة أخرى، أو التواصل معنا على <a href="mailto:hello@visionex.app">hello@visionex.app</a>.</p>
<p style="color:#6b7280;font-size:0.85em;">Visionex · <a href="https://visionex.app">visionex.app</a></p>
</body></html>`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { orderId, action, adminNotes } = await req.json();
    if (!orderId || (action !== "approve" && action !== "reject")) {
      return new Response(JSON.stringify({ error: "orderId and a valid action are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rpcName = action === "approve" ? "approve_vx_coin_order" : "reject_vx_coin_order";
    const { data: order, error: rpcError } = await userClient
      .rpc(rpcName, { _order_id: orderId, _admin_notes: adminNotes ?? null })
      .single();

    if (rpcError) {
      // The RPC's own has_role() check is what actually blocks non-admins —
      // this surfaces that (or "already reviewed"/"not found") as a 400.
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort receipt/notice email — coins are already credited above.
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: authUser } = await serviceClient.auth.admin.getUserById(order.user_id);
    const buyerEmail = authUser?.user?.email;
    if (buyerEmail) {
      if (action === "approve") {
        await sendEmail(buyerEmail, "تم تأكيد شحن عملات VX", approvedEmailHtml(order.coins, Number(order.total_usd)));
      } else {
        await sendEmail(buyerEmail, "تعذّر تأكيد شحن عملات VX", rejectedEmailHtml(order.coins, order.admin_notes));
      }
    }

    return new Response(JSON.stringify({ order }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[vx-coin-review] error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
