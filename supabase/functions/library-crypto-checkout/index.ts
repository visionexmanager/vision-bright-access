/**
 * library-crypto-checkout — Coinbase Commerce equivalent of
 * library-checkout-session's cash (Stripe) path, for buyers who want to pay
 * with cryptocurrency. Covers paid/rental/bundle/donation — subscriptions
 * are NOT supported (Coinbase Commerce has no recurring-charge concept;
 * use Stripe for subscriptions). VX purchases never need this function.
 *
 * Unlike PayPal, Coinbase Commerce charges support a real metadata object
 * (no 127-char custom_id workaround needed) — book_id/buyer_id/
 * pricing_model/coupon_id/message travel there directly and come back
 * verbatim on the webhook event.
 *
 * Price is always resolved server-side — the client only ever sends
 * book_id/bundle_id, never an amount.
 *
 * REQUIRES (not configured in this sandbox — cannot be tested end-to-end
 * here; a real Coinbase Commerce merchant account is needed):
 *   COINBASE_COMMERCE_API_KEY
 *
 * Auth: user-jwt required.
 * Input: JSON { book_id?, bundle_id?, pricing_model: "paid"|"rental"|"bundle"|"donation",
 *   coupon_code?, country_code?, amount_usd?, message? }
 * Returns: JSON { ok, checkoutUrl }
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  book_id?: string;
  bundle_id?: string;
  pricing_model: "paid" | "rental" | "bundle" | "donation";
  coupon_code?: string;
  country_code?: string;
  amount_usd?: number;
  message?: string;
}

// deno-lint-ignore no-explicit-any
type AnyClient = any;

async function createCoinbaseCharge(opts: { amountUsd: number; name: string; description: string; metadata: Record<string, string> }): Promise<{ id: string; hostedUrl: string } | { error: string }> {
  const apiKey = Deno.env.get("COINBASE_COMMERCE_API_KEY");
  if (!apiKey) return { error: "Crypto checkout is not configured" };

  const siteUrl = Deno.env.get("SITE_URL") || "https://visionex.app";
  const res = await fetch("https://api.commerce.coinbase.com/charges", {
    method: "POST",
    headers: { "X-CC-Api-Key": apiKey, "X-CC-Version": "2018-03-22", "Content-Type": "application/json" },
    body: JSON.stringify({
      name: opts.name,
      description: opts.description,
      pricing_type: "fixed_price",
      local_price: { amount: opts.amountUsd.toFixed(2), currency: "USD" },
      metadata: opts.metadata,
      redirect_url: `${siteUrl}/library?checkout=success&rail=crypto`,
      cancel_url: `${siteUrl}/library?checkout=cancelled&rail=crypto`,
    }),
  });
  const charge = await res.json();
  if (!res.ok) return { error: charge?.error?.message || "Coinbase Commerce charge creation failed" };
  return { id: charge.data.id, hostedUrl: charge.data.hosted_url };
}

async function resolveCoupon(userClient: AnyClient, code: string | undefined, bookId: string | undefined) {
  if (!code) return null;
  const { data } = await userClient
    .from("library_coupons")
    .select("id, discount_type, discount_value, book_id, is_active, valid_from, valid_until")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (!data || !data.is_active) return null;
  if (data.book_id && data.book_id !== bookId) return null;
  if (data.valid_from && new Date(data.valid_from) > new Date()) return null;
  if (data.valid_until && new Date(data.valid_until) < new Date()) return null;
  return data;
}

function applyDiscount(amountUsd: number, coupon: { discount_type: string; discount_value: number } | null): number {
  if (!coupon) return amountUsd;
  if (coupon.discount_type === "percent") return Math.round(amountUsd * Math.max(0, 1 - coupon.discount_value / 100) * 100) / 100;
  if (coupon.discount_type === "fixed_usd") return Math.max(0, amountUsd - coupon.discount_value);
  return amountUsd;
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  try {
    switch (body.pricing_model) {
      case "paid":
      case "rental": {
        if (!body.book_id) return json({ error: "book_id is required" }, 400, cors);
        const useRentalPrice = body.pricing_model === "rental";
        const { data: book, error } = await userClient
          .from("library_books")
          .select("id, title, price_usd, rental_price_usd, rental_period_days, publish_status")
          .eq("id", body.book_id).maybeSingle();
        if (error) throw error;
        if (!book || book.publish_status !== "published") return json({ error: "Book not found" }, 404, cors);

        let usd = Number((useRentalPrice ? book.rental_price_usd : book.price_usd) ?? 0);
        if (body.country_code) {
          const { data: regional } = await userClient.from("library_regional_prices").select("price_usd").eq("book_id", body.book_id).eq("country_code", body.country_code.toUpperCase()).maybeSingle();
          if (regional) usd = Number(regional.price_usd);
        }
        const coupon = await resolveCoupon(userClient, body.coupon_code, body.book_id);
        if (coupon) {
          const reserved = await serviceClient.rpc("reserve_library_coupon", { _coupon_id: coupon.id, _user_id: user.id });
          if (!reserved.data) return json({ error: "This coupon isn't valid or has already been used" }, 400, cors);
        }
        const finalUsd = applyDiscount(usd, coupon);

        const charge = await createCoinbaseCharge({
          amountUsd: finalUsd, name: book.title, description: useRentalPrice ? `${book.title} (${book.rental_period_days ?? 14}-day rental)` : book.title,
          metadata: { pricing_model: body.pricing_model, book_id: book.id, buyer_id: user.id, coupon_id: coupon?.id ?? "" },
        });
        if ("error" in charge) {
          if (coupon) await serviceClient.rpc("release_library_coupon", { _coupon_id: coupon.id, _user_id: user.id });
          return json({ error: charge.error }, 502, cors);
        }

        const { error: insertErr } = await serviceClient.from("library_purchases").insert({
          buyer_id: user.id, book_id: book.id, payment_method: "crypto", amount_usd: finalUsd, status: "pending", crypto_charge_id: charge.id,
        });
        if (insertErr) throw insertErr;
        return json({ ok: true, checkoutUrl: charge.hostedUrl }, 200, cors);
      }
      case "bundle": {
        if (!body.bundle_id) return json({ error: "bundle_id is required" }, 400, cors);
        const { data: bundle, error: bundleErr } = await userClient.from("library_bundles").select("id, title, price_usd, is_active").eq("id", body.bundle_id).maybeSingle();
        if (bundleErr) throw bundleErr;
        if (!bundle || !bundle.is_active) return json({ error: "Bundle not found or inactive" }, 404, cors);
        const usd = Number(bundle.price_usd ?? 0);

        const charge = await createCoinbaseCharge({ amountUsd: usd, name: bundle.title, description: bundle.title, metadata: { pricing_model: "bundle", bundle_id: bundle.id, buyer_id: user.id } });
        if ("error" in charge) return json({ error: charge.error }, 502, cors);

        const { data: bundleBooks } = await userClient.from("library_bundle_books").select("book_id").eq("bundle_id", bundle.id);
        const bookIds = (bundleBooks ?? []).map((b: { book_id: string }) => b.book_id);
        if (bookIds.length === 0) return json({ error: "This bundle has no books" }, 400, cors);
        const perBookUsd = Math.round((usd / bookIds.length) * 100) / 100;
        const rows = bookIds.map((bookId: string) => ({ buyer_id: user.id, book_id: bookId, bundle_id: bundle.id, payment_method: "crypto", amount_usd: perBookUsd, status: "pending", crypto_charge_id: charge.id }));
        const { error: insertErr } = await serviceClient.from("library_purchases").insert(rows);
        if (insertErr) throw insertErr;
        return json({ ok: true, checkoutUrl: charge.hostedUrl }, 200, cors);
      }
      case "donation": {
        if (!body.book_id) return json({ error: "book_id is required" }, 400, cors);
        const { data: book, error } = await userClient.from("library_books").select("id, title, suggested_donation_usd").eq("id", body.book_id).maybeSingle();
        if (error) throw error;
        if (!book) return json({ error: "Book not found" }, 404, cors);
        const amountUsd = body.amount_usd ?? Number(book.suggested_donation_usd ?? 5);

        // No pending row here — library_donations models a completed
        // donation only; the webhook inserts it directly on confirmation,
        // same as the Stripe/PayPal donation paths.
        const charge = await createCoinbaseCharge({
          amountUsd, name: `Donation — ${book.title}`, description: `Donation — ${book.title}`,
          metadata: { pricing_model: "donation", book_id: book.id, buyer_id: user.id, message: body.message ?? "" },
        });
        if ("error" in charge) return json({ error: charge.error }, 502, cors);
        return json({ ok: true, checkoutUrl: charge.hostedUrl }, 200, cors);
      }
      default:
        return json({ error: `Unsupported pricing_model "${body.pricing_model}"` }, 400, cors);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-crypto-checkout error:", msg);
    return json({ error: msg }, 500, cors);
  }
});
