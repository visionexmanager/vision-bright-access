import { createClient } from "npm:@supabase/supabase-js@2";

const encoder = new TextEncoder();

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function verifyStripeSignature(body: string, signature: string, secret: string) {
  const parts = signature.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`)));
  return signatures.some((candidate) => secureEqual(candidate, digest));
}

Deno.serve(async (req) => {
  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    if (!webhookSecret || !signature || !(await verifyStripeSignature(body, signature, webhookSecret))) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(body);
    if (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") {
      const session = event.data.object;
      const orderId = session.metadata?.order_id || session.client_reference_id;
      if (orderId) {
        const service = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { error } = await service.rpc("finalize_bazaar_cash_order", {
          _order_id: orderId,
          _checkout_session_id: session.id,
          _payment_intent_id: session.payment_intent || "",
        });
        if (error) throw error;
        const customer = session.customer_details || {};
        await service.from("bazaar_orders").update({
          shipping_name: customer.name || null,
          shipping_email: customer.email || null,
          shipping_phone: customer.phone || null,
          shipping_address: customer.address || null,
        }).eq("id", orderId);
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/bazaar-notify-seller`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            shopId: session.metadata?.shop_id,
            eventType: "order_paid",
            message: `Cash order ${orderId.slice(0, 8)} has been paid.`,
          }),
        });
      }
    }
    if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const orderId = session.metadata?.order_id || session.client_reference_id;
      if (orderId) {
        const service = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { error } = await service.rpc("release_bazaar_cash_order", { _order_id: orderId });
        if (error) throw error;
      }
    }
    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("bazaar-stripe-webhook error", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
});
