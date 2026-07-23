/**
 * library-crypto-webhook — completes the crypto side of
 * library-crypto-checkout. Verifies Coinbase Commerce's HMAC-SHA256
 * signature (X-CC-Webhook-Signature, hex-encoded, over the raw body) using
 * COINBASE_COMMERCE_WEBHOOK_SECRET — same Web Crypto HMAC approach as
 * library-stripe-webhook's verifyStripeSignature, just a different
 * header/secret and no timestamp component (Coinbase's scheme has none).
 *
 * charge:confirmed: flips the matching pending library_purchases row(s)
 *   (found by crypto_charge_id) to 'completed', or inserts the
 *   library_donations row directly for a donation charge (metadata carries
 *   everything needed — no custom_id workaround required, unlike PayPal).
 * charge:failed / charge:delayed (delayed treated as still-pending, not
 *   cancelled — crypto confirmations can legitimately take a while):
 *   only charge:failed cancels the pending purchase row(s) and releases
 *   the reserved coupon.
 *
 * REQUIRES (unconfigured in this sandbox — cannot be exercised end-to-end
 * here): COINBASE_COMMERCE_API_KEY, COINBASE_COMMERCE_WEBHOOK_SECRET.
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

async function verifyCoinbaseSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
  return secureEqual(signature, digest);
}

Deno.serve(async (req: Request) => {
  try {
    const webhookSecret = Deno.env.get("COINBASE_COMMERCE_WEBHOOK_SECRET");
    const signature = req.headers.get("x-cc-webhook-signature");
    const body = await req.text();
    if (!webhookSecret || !signature || !(await verifyCoinbaseSignature(body, signature, webhookSecret))) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(body);
    const charge = event.event?.data;
    const metadata = charge?.metadata ?? {};
    const chargeId = charge?.id as string | undefined;
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (event.event?.type === "charge:confirmed" && chargeId) {
      if (metadata.pricing_model === "donation") {
        const paidAmount = charge.payments?.[0]?.value?.local?.amount ?? charge.pricing?.local?.amount;
        await service.from("library_donations").insert({
          book_id: metadata.book_id,
          donor_id: metadata.buyer_id || null,
          amount_usd: Number(paidAmount ?? 0),
          message: metadata.message || null,
        });
      } else {
        const { data: purchases, error } = await service
          .from("library_purchases")
          .update({ status: "completed", purchased_at: new Date().toISOString() })
          .eq("crypto_charge_id", chargeId)
          .select("id, book_id, buyer_id");
        if (error) throw error;

        if (metadata.pricing_model === "rental" && purchases?.[0]) {
          const { data: book } = await service.from("library_books").select("rental_period_days").eq("id", purchases[0].book_id).maybeSingle();
          const periodDays = Number(book?.rental_period_days ?? 14);
          const dueAt = new Date(Date.now() + periodDays * 86_400_000).toISOString();
          await service.from("library_borrowed_books").insert({ user_id: purchases[0].buyer_id, book_id: purchases[0].book_id, due_at: dueAt });
        }

        if (metadata.coupon_id && purchases?.[0]) {
          await service.from("library_coupon_redemptions").update({ purchase_id: purchases[0].id }).eq("coupon_id", metadata.coupon_id).eq("user_id", metadata.buyer_id);
        }
      }
    }

    if (event.event?.type === "charge:failed" && chargeId) {
      const { data: purchases } = await service.from("library_purchases").update({ status: "cancelled" }).eq("crypto_charge_id", chargeId).eq("status", "pending").select("id");
      if (metadata.coupon_id && purchases?.[0]) {
        await service.rpc("release_library_coupon", { _coupon_id: metadata.coupon_id, _user_id: metadata.buyer_id });
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("library-crypto-webhook error", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
});
