/**
 * library-stripe-webhook — completes the cash side of
 * library-checkout-session. Mirrors bazaar-stripe-webhook's signature
 * verification exactly (HMAC-SHA256 over "{timestamp}.{body}", Web Crypto,
 * constant-time compare).
 *
 * checkout.session.completed: flips the matching pending library_purchases
 * row(s) (found by stripe_checkout_session_id) to 'completed', or — for
 * subscription/donation, which never had a pending row — creates the
 * library_subscriptions/library_donations row directly from the session's
 * metadata (set by library-checkout-session when it created the session).
 * checkout.session.expired: cancels any pending purchase row(s) for that
 * session and releases the reserved coupon redemption, if any.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const encoder = new TextEncoder();

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

async function verifyStripeSignature(body: string, signature: string, secret: string) {
  const parts = signature.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`)));
  return signatures.some((candidate) => secureEqual(candidate, digest));
}

Deno.serve(async (req) => {
  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET_LIBRARY") || Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    if (!webhookSecret || !signature || !(await verifyStripeSignature(body, signature, webhookSecret))) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(body);
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const metadata = session.metadata ?? {};
      const pricingModel = metadata.pricing_model as string | undefined;

      if (pricingModel === "subscription") {
        const currentPeriodEnd = new Date(session.expires_at ? session.expires_at * 1000 : Date.now() + 30 * 86_400_000).toISOString();
        await service.from("library_subscriptions").upsert(
          { user_id: metadata.buyer_id, plan: metadata.plan, status: "active", current_period_end: currentPeriodEnd, stripe_subscription_id: session.subscription ?? null },
          { onConflict: "user_id" }
        );
      } else if (pricingModel === "donation") {
        await service.from("library_donations").insert({
          book_id: metadata.book_id, donor_id: metadata.buyer_id || null,
          amount_usd: (session.amount_total ?? 0) / 100, message: metadata.message || null,
        });
      } else {
        // paid / rental / bundle — flip the pending purchase row(s) created
        // by library-checkout-session, matched by the checkout session id.
        const { data: purchases, error } = await service
          .from("library_purchases")
          .update({ status: "completed", purchased_at: new Date().toISOString(), stripe_payment_intent_id: session.payment_intent || null })
          .eq("stripe_checkout_session_id", session.id)
          .select("id, book_id, buyer_id");
        if (error) throw error;

        if (pricingModel === "rental" && purchases?.[0]) {
          const periodDays = Number(metadata.rental_period_days ?? 14);
          const dueAt = new Date(Date.now() + periodDays * 86_400_000).toISOString();
          await service.from("library_borrowed_books").insert({ user_id: purchases[0].buyer_id, book_id: purchases[0].book_id, due_at: dueAt });
        }

        if (pricingModel === "license" && purchases?.[0]) {
          await service.from("library_licenses").insert({
            book_id: purchases[0].book_id,
            purchaser_id: purchases[0].buyer_id,
            license_type: metadata.license_type || "individual",
            seat_count: Number(metadata.seat_count ?? 1),
            purchase_id: purchases[0].id,
          });
        }

        if (metadata.coupon_id && purchases?.[0]) {
          await service.from("library_coupon_redemptions").update({ purchase_id: purchases[0].id }).eq("coupon_id", metadata.coupon_id).eq("user_id", metadata.buyer_id);
        }
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const metadata = session.metadata ?? {};
      await service.from("library_purchases").update({ status: "cancelled" }).eq("stripe_checkout_session_id", session.id).eq("status", "pending");
      if (metadata.coupon_id) {
        await service.rpc("release_library_coupon", { _coupon_id: metadata.coupon_id, _user_id: metadata.buyer_id });
      }
    }

    if (event.type === "invoice.paid" && event.data.object.subscription) {
      const invoice = event.data.object;
      const periodEnd = invoice.lines?.data?.[0]?.period?.end ? new Date(invoice.lines.data[0].period.end * 1000).toISOString() : new Date(Date.now() + 30 * 86_400_000).toISOString();
      await service.from("library_subscriptions").update({ status: "active", current_period_end: periodEnd }).eq("stripe_subscription_id", invoice.subscription);
    }

    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("library-stripe-webhook error", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
});
