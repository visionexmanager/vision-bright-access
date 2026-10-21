import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { GRAPH_BASE } from "../_shared/meta.ts";

// Who may cause which notification, and how often (cost-aware access policy).
//
//   * The platform itself (bearer = the service role: the Stripe webhook) may send any
//     event, unlimited.
//   * A signed-in user may send message, add_to_cart, wishlist, review, dispute, report
//     and order_paid. order_paid is accepted only for an order that user really has
//     with that shop in the last 30 minutes, and order_status / low_stock are refused:
//     before this, anyone could tell any seller an order had been paid.
//   * Every user-triggered notification is claimed through bazaar_notify_claim
//     (20261081): duplicates, per-user and per-shop ceilings, decided atomically. E-mail
//     and WhatsApp (which cost money and reach a person) are sent only when the claim
//     grants them; the in-app notification is the floor.
//   * The text is bounded and stripped of control characters, and the buyer is named by
//     a supplied name or display name, never by e-mail address.

type BazaarEventType =
  | "message" | "add_to_cart" | "wishlist" | "dispute" | "review" | "report"
  | "order_paid" | "order_status" | "low_stock";

interface NotifyPayload {
  shopId: string;
  productId?: string;
  eventType: BazaarEventType;
  buyerName?: string;
  message?: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}

const EVENT_LABELS: Record<BazaarEventType, string> = {
  message: "New buyer message",
  add_to_cart: "Product added to cart",
  wishlist: "Product saved",
  dispute: "New buyer support case",
  review: "New product review",
  report: "Product report",
  order_paid: "New paid order",
  order_status: "Order status changed",
  low_stock: "Low stock alert",
};

const INTERNAL_ONLY_EVENTS = new Set<BazaarEventType>(["order_status", "low_stock"]);
const PAID_ORDER_STATUSES = ["paid", "processing", "shipped", "completed"];

/** Bounded single-line text: control characters become spaces, runs collapse, then it is cut. */
function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  let out = "";
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    out += code < 32 || code === 127 ? " " : ch;
  }
  return out.replace(/\s{2,}/g, " ").trim().slice(0, max);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    const isInternal = authHeader === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
    if (!user && !isInternal) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json() as NotifyPayload;
    if (!payload || typeof payload.shopId !== "string" || !payload.eventType || !EVENT_LABELS[payload.eventType]) {
      return new Response(JSON.stringify({ error: "Invalid notification payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: shop, error: shopError } = await serviceClient
      .from("bazaar_shops")
      .select("id, owner_id, name, email_notifications, whatsapp_notifications, whatsapp_number, order_notifications, message_notifications, review_notifications, low_stock_notifications")
      .eq("id", payload.shopId)
      .maybeSingle();

    if (shopError) throw shopError;
    if (!shop) {
      return new Response(JSON.stringify({ error: "Shop not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user && shop.owner_id === user.id) {
      return new Response(JSON.stringify({ skipped: true, reason: "owner_event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorisation of the event itself, before anything is read or sent.
    let claimKey: string | null = null;
    if (!isInternal) {
      if (INTERNAL_ONLY_EVENTS.has(payload.eventType)) {
        return new Response(JSON.stringify({ error: "not_allowed" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (payload.eventType === "order_paid") {
        const { data: order } = await serviceClient
          .from("bazaar_orders")
          .select("id")
          .eq("buyer_id", user!.id)
          .eq("shop_id", shop.id)
          .in("status", PAID_ORDER_STATUSES)
          .gt("created_at", new Date(Date.now() - 30 * 60_000).toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!order) {
          return new Response(JSON.stringify({ error: "no_recent_order" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        claimKey = String(order.id);
      }
    }

    let productName = "";
    if (payload.productId) {
      const { data: product } = await serviceClient
        .from("bazaar_products")
        .select("name")
        .eq("id", payload.productId)
        .maybeSingle();
      productName = product?.name ?? "";
    }

    const eventEnabled =
      (payload.eventType === "message" && shop.message_notifications !== false)
      || (payload.eventType === "review" && shop.review_notifications !== false)
      || ((payload.eventType === "order_paid" || payload.eventType === "order_status") && shop.order_notifications !== false)
      || (payload.eventType === "low_stock" && shop.low_stock_notifications !== false)
      || !["message", "review", "order_paid", "order_status", "low_stock"].includes(payload.eventType);
    if (!eventEnabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "event_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The atomic limit. Platform calls are not claimed; a user's are, and a claim that cannot be
    // made fails closed (nothing is sent) rather than open.
    let external = true;
    if (!isInternal) {
      const { data: claim, error: claimError } = await serviceClient.rpc("bazaar_notify_claim", {
        _user_id: user!.id,
        _shop_id: shop.id,
        _event_type: payload.eventType,
        _product_id: typeof payload.productId === "string" ? payload.productId : null,
        _key: claimKey,
      });
      if (claimError || !claim || typeof claim !== "object") {
        return new Response(JSON.stringify({ error: "unavailable" }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if ((claim as { allowed?: unknown }).allowed !== true) {
        return new Response(JSON.stringify({ skipped: true, reason: String((claim as { reason?: unknown }).reason ?? "limited") }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      external = (claim as { external?: unknown }).external === true;
    }

    let buyer = clean(payload.buyerName, 60);
    if (!buyer && user) {
      const { data: profile } = await serviceClient.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
      buyer = clean(profile?.display_name, 60);
    }
    if (!buyer) buyer = "A buyer";
    const messageText = clean(payload.message, 600);
    const title = `${EVENT_LABELS[payload.eventType]} · ${shop.name}`;
    const bodyParts = [
      `${buyer} interacted with ${productName || "your shop"}.`,
      messageText ? `Message: ${messageText}` : "",
    ].filter(Boolean);
    const body = bodyParts.join(" ");

    await serviceClient.from("notifications").insert({
      user_id: shop.owner_id,
      title,
      body,
      type: payload.eventType === "dispute" || payload.eventType === "report" ? "warning" : "info",
      sent_by: user?.id || null,
    });

    const result = { inApp: true, email: "skipped", whatsapp: "skipped", external };

    if (external && shop.email_notifications !== false) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      const owner = await serviceClient.auth.admin.getUserById(shop.owner_id);
      const ownerEmail = owner.data.user?.email;

      if (RESEND_API_KEY && ownerEmail) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: Deno.env.get("RESEND_FROM") || "Visionex <no-reply@visionex.app>",
            to: [ownerEmail],
            subject: title,
            html: `
              <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
                <h2>${escapeHtml(title)}</h2>
                <p>${escapeHtml(body)}</p>
                <p style="color:#6b7280;font-size:13px">You are receiving this because seller notifications are enabled for your VXBazaar shop.</p>
              </div>
            `,
          }),
        });
        result.email = res.ok ? "sent" : "failed";
      }
    }

    if (external && shop.whatsapp_notifications && shop.whatsapp_number) {
      // WHATSAPP_TOKEN, not WHATSAPP_ACCESS_TOKEN. Both names existed and both
      // meant the same Cloud API credential, so configuring one silently left
      // the other send path dead. WHATSAPP_TOKEN is the canonical name because
      // the webhook already uses it and a test asserts it.
      const token = Deno.env.get("WHATSAPP_TOKEN");
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
      if (token && phoneNumberId) {
        const cleanPhone = String(shop.whatsapp_number).replace(/[^\d]/g, "");
        const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: cleanPhone,
            type: "text",
            text: { preview_url: false, body: `${title}\n${body}` },
          }),
        });
        result.whatsapp = res.ok ? "sent" : "failed";
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("bazaar-notify-seller error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
