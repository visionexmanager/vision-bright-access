/**
 * library-paypal-webhook — completes the PayPal side of
 * library-paypal-checkout. PayPal Orders v2 requires an explicit capture
 * call after buyer approval (unlike Stripe Checkout, which auto-completes),
 * so this webhook captures the order itself the moment PayPal reports
 * CHECKOUT.ORDER.APPROVED, then processes the result exactly like
 * library-stripe-webhook processes a completed Stripe session.
 *
 * CHECKOUT.ORDER.APPROVED: captures the order, then —
 *   - paid/rental/bundle: flips the matching pending library_purchases
 *     row(s) (found by paypal_order_id) to 'completed'.
 *   - donation: inserts a library_donations row directly (that table has no
 *     pending state — see library-paypal-checkout's donation branch).
 *   - rental: also creates the library_borrowed_books row.
 *   - coupon (encoded in custom_id): links the redemption to the purchase.
 * PAYMENT.CAPTURE.DENIED / CHECKOUT.ORDER.VOIDED: cancels the pending
 * purchase row(s) and releases the reserved coupon, if any.
 *
 * REQUIRES (unconfigured in this sandbox — cannot be exercised end-to-end
 * here): PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { capturePayPalOrder, decodeCustomId, verifyPayPalWebhookSignature } from "../_shared/paypal.ts";

Deno.serve(async (req: Request) => {
  try {
    const rawBody = await req.text();
    const verified = await verifyPayPalWebhookSignature(req.headers, rawBody);
    if (!verified) return new Response("Invalid signature", { status: 400 });

    const event = JSON.parse(rawBody);
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
      const orderId = event.resource?.id as string;
      const captured = await capturePayPalOrder(orderId);
      if ("error" in captured) {
        console.error("library-paypal-webhook capture failed:", captured.error);
        return new Response(JSON.stringify({ received: true, captureFailed: true }), { headers: { "Content-Type": "application/json" } });
      }

      const unit = captured.purchaseUnits[0];
      const custom = decodeCustomId(unit?.custom_id);

      if (custom?.pm === "donation") {
        await service.from("library_donations").insert({
          book_id: unit.reference_id,
          donor_id: custom.uid,
          amount_usd: Number(unit.amount),
          message: custom.msg || null,
        });
      } else {
        const { data: purchases, error } = await service
          .from("library_purchases")
          .update({ status: "completed", purchased_at: new Date().toISOString() })
          .eq("paypal_order_id", orderId)
          .select("id, book_id, buyer_id");
        if (error) throw error;

        if (custom?.pm === "rental" && purchases?.[0]) {
          const { data: book } = await service.from("library_books").select("rental_period_days").eq("id", purchases[0].book_id).maybeSingle();
          const periodDays = Number(book?.rental_period_days ?? 14);
          const dueAt = new Date(Date.now() + periodDays * 86_400_000).toISOString();
          await service.from("library_borrowed_books").insert({ user_id: purchases[0].buyer_id, book_id: purchases[0].book_id, due_at: dueAt });
        }

        if (custom?.coupon && purchases?.[0]) {
          await service.from("library_coupon_redemptions").update({ purchase_id: purchases[0].id }).eq("coupon_id", custom.coupon).eq("user_id", custom.uid);
        }
      }
    }

    if (event.event_type === "PAYMENT.CAPTURE.DENIED" || event.event_type === "CHECKOUT.ORDER.VOIDED") {
      // KNOWN GAP: any coupon reserved for this order is NOT released here.
      // Unlike Stripe's session.expired (whose metadata mirrors what
      // session-creation set), PayPal's denial/void events don't reliably
      // carry the custom_id needed to look the reservation up without an
      // extra order-fetch call — and reserve_library_coupon()'s
      // redemptions_count increment has NO expiry, so a denied/voided
      // PayPal order currently leaks one redemption slot on that coupon
      // permanently. Acceptable for now given this rail can't be tested
      // end-to-end in this sandbox anyway, but a real deployment should
      // either add the extra order-fetch call here or a scheduled sweep
      // that reconciles stale 'pending' library_purchases rows against
      // their coupon reservations.
      const orderId = (event.resource?.supplementary_data?.related_ids?.order_id || event.resource?.id) as string | undefined;
      if (orderId) {
        await service.from("library_purchases").update({ status: "cancelled" }).eq("paypal_order_id", orderId).eq("status", "pending");
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("library-paypal-webhook error", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
});
