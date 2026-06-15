import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

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
    if (!payload.shopId || !payload.eventType || !EVENT_LABELS[payload.eventType]) {
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

    const buyer = payload.buyerName || user?.email || "A buyer";
    const title = `${EVENT_LABELS[payload.eventType]} · ${shop.name}`;
    const bodyParts = [
      `${buyer} interacted with ${productName || "your shop"}.`,
      payload.message ? `Message: ${payload.message}` : "",
    ].filter(Boolean);
    const body = bodyParts.join(" ");

    await serviceClient.from("notifications").insert({
      user_id: shop.owner_id,
      title,
      body,
      type: payload.eventType === "dispute" || payload.eventType === "report" ? "warning" : "info",
      sent_by: user?.id || null,
    });

    const result = { inApp: true, email: "skipped", whatsapp: "skipped" };

    if (shop.email_notifications !== false) {
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
                <h2>${title}</h2>
                <p>${body}</p>
                <p style="color:#6b7280;font-size:13px">You are receiving this because seller notifications are enabled for your VXBazaar shop.</p>
              </div>
            `,
          }),
        });
        result.email = res.ok ? "sent" : "failed";
      }
    }

    if (shop.whatsapp_notifications && shop.whatsapp_number) {
      const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
      if (token && phoneNumberId) {
        const cleanPhone = String(shop.whatsapp_number).replace(/[^\d]/g, "");
        const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
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
