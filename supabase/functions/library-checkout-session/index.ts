/**
 * library-checkout-session — every Library pricing model that isn't a
 * plain VX one-time book purchase with no coupon (library-purchase-book,
 * untouched, still handles that simpler case). Handles: a coupon-discounted
 * or cash (Stripe) purchase of a single book, rentals, bundles,
 * subscriptions, and donations — each in both VX (completes synchronously,
 * via the existing spend_vx RPC) and cash (creates a Stripe Checkout
 * Session; completion happens in library-stripe-webhook) forms.
 *
 * Trust model, same as library-purchase-book: price is ALWAYS resolved
 * server-side (regional price -> coupon discount -> base price), never
 * trusted from the client. Coupon redemption is reserved atomically via
 * reserve_library_coupon() before either debiting VX or creating a Stripe
 * session, and released via release_library_coupon() if the cash session
 * later expires without paying (see library-stripe-webhook).
 *
 * Auth: user-jwt required.
 * Input: JSON { book_id?, bundle_id?, payment_method: "vx"|"cash",
 *   pricing_model: "paid"|"rental"|"bundle"|"subscription"|"donation",
 *   coupon_code?, country_code?, plan?: "monthly"|"yearly",
 *   amount_usd?, amount_vx?, message? }
 * Returns: JSON { ok, completed? } (VX) or { ok, checkoutUrl } (cash)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface RequestBody {
  book_id?: string;
  bundle_id?: string;
  payment_method: "vx" | "cash";
  pricing_model: "paid" | "rental" | "bundle" | "subscription" | "donation" | "license";
  coupon_code?: string;
  country_code?: string;
  plan?: "monthly" | "yearly";
  amount_usd?: number;
  amount_vx?: number;
  message?: string;
  /** Gift purchase (pricing_model "paid" only) — the recipient's email;
   *  resolved to a user id server-side via find_user_id_by_email(), never
   *  trusted/looked-up from the client (profiles has no public email
   *  lookup by design). */
  recipient_email?: string;
  gift_message?: string;
  /** License purchase only. */
  license_type?: "individual" | "corporate" | "educational" | "family";
  seat_count?: number;
}

// Subscription pricing has no dynamic plans table (a genuine scope
// simplification, not an oversight) — two fixed tiers, defined once here.
const SUBSCRIPTION_PRICING = {
  monthly: { usd: 4.99, vx: 500, days: 30 },
  yearly: { usd: 49.99, vx: 5000, days: 365 },
};

// deno-lint-ignore no-explicit-any
type AnyClient = any;

async function resolveCoupon(userClient: AnyClient, code: string | undefined, bookId: string | undefined): Promise<{ id: string; discount_type: string; discount_value: number } | null> {
  if (!code) return null;
  const { data, error } = await userClient
    .from("library_coupons")
    .select("id, discount_type, discount_value, book_id, is_active, valid_from, valid_until")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (error || !data || !data.is_active) return null;
  if (data.book_id && data.book_id !== bookId) return null;
  if (data.valid_from && new Date(data.valid_from) > new Date()) return null;
  if (data.valid_until && new Date(data.valid_until) < new Date()) return null;
  return data;
}

function applyDiscount(amountUsd: number, amountVx: number | null, coupon: { discount_type: string; discount_value: number } | null): { usd: number; vx: number | null } {
  if (!coupon) return { usd: amountUsd, vx: amountVx };
  if (coupon.discount_type === "percent") {
    const factor = Math.max(0, 1 - coupon.discount_value / 100);
    return { usd: Math.round(amountUsd * factor * 100) / 100, vx: amountVx != null ? Math.round(amountVx * factor) : null };
  }
  if (coupon.discount_type === "fixed_usd") return { usd: Math.max(0, amountUsd - coupon.discount_value), vx: amountVx };
  if (coupon.discount_type === "fixed_vx") return { usd: amountUsd, vx: amountVx != null ? Math.max(0, amountVx - coupon.discount_value) : null };
  return { usd: amountUsd, vx: amountVx };
}

async function createStripeSession(opts: {
  mode: "payment" | "subscription";
  amountUsd: number;
  productName: string;
  metadata: Record<string, string>;
  customerEmail: string;
  recurringDays?: number;
}): Promise<{ id: string; url: string } | { error: string }> {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return { error: "Cash checkout is not configured" };

  const siteUrl = Deno.env.get("SITE_URL") || "https://visionex.app";
  const form = new URLSearchParams();
  form.set("mode", opts.mode);
  form.set("success_url", `${siteUrl}/library?checkout=success`);
  form.set("cancel_url", `${siteUrl}/library?checkout=cancelled`);
  form.set("customer_email", opts.customerEmail);
  for (const [key, value] of Object.entries(opts.metadata)) form.set(`metadata[${key}]`, value);

  if (opts.mode === "subscription") {
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "usd");
    form.set("line_items[0][price_data][unit_amount]", String(Math.round(opts.amountUsd * 100)));
    form.set("line_items[0][price_data][product_data][name]", opts.productName);
    form.set("line_items[0][price_data][recurring][interval]", opts.recurringDays && opts.recurringDays > 60 ? "year" : "month");
  } else {
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "usd");
    form.set("line_items[0][price_data][unit_amount]", String(Math.round(opts.amountUsd * 100)));
    form.set("line_items[0][price_data][product_data][name]", opts.productName);
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const session = await res.json();
  if (!res.ok) return { error: session?.error?.message || "Stripe checkout failed" };
  return { id: session.id, url: session.url };
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
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
        return await handlePaid(body, user, userClient, serviceClient, cors);
      case "rental":
        return await handleRental(body, user, userClient, serviceClient, cors);
      case "bundle":
        return await handleBundle(body, user, userClient, serviceClient, cors);
      case "subscription":
        return await handleSubscription(body, user, userClient, serviceClient, cors);
      case "donation":
        return await handleDonation(body, user, userClient, serviceClient, cors);
      case "license":
        return await handleLicense(body, user, userClient, serviceClient, cors);
      default:
        return json({ error: `Unsupported pricing_model "${body.pricing_model}"` }, 400, cors);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("library-checkout-session error:", msg);
    return json({ error: msg }, 500, cors);
  }
});

async function resolveBookPrice(userClient: AnyClient, bookId: string, countryCode: string | undefined, useRentalPrice: boolean) {
  const { data: book, error } = await userClient
    .from("library_books")
    .select("id, title, is_free, price_vx, price_usd, rental_price_vx, rental_price_usd, rental_period_days, publish_status")
    .eq("id", bookId)
    .maybeSingle();
  if (error) throw error;
  if (!book) throw new Error("Book not found");
  if (book.publish_status !== "published") throw new Error("This book isn't published yet");

  let usd = useRentalPrice ? book.rental_price_usd : book.price_usd;
  let vx = useRentalPrice ? book.rental_price_vx : book.price_vx;

  if (countryCode) {
    const { data: regional } = await userClient.from("library_regional_prices").select("price_usd, price_vx").eq("book_id", bookId).eq("country_code", countryCode.toUpperCase()).maybeSingle();
    if (regional) {
      usd = regional.price_usd;
      vx = regional.price_vx ?? vx;
    }
  }
  return { book, usd: Number(usd ?? 0), vx: vx != null ? Number(vx) : null };
}

// deno-lint-ignore no-explicit-any
async function handlePaid(body: RequestBody, user: any, userClient: AnyClient, serviceClient: AnyClient, cors: Record<string, string>) {
  if (!body.book_id) return json({ error: "book_id is required" }, 400, cors);
  const { book, usd, vx } = await resolveBookPrice(userClient, body.book_id, body.country_code, false);

  // Gift purchases skip the "already owned" short-circuit below (a buyer
  // can own a book AND gift it to someone else) — only checked when there's
  // no recipient.
  const recipientEmail = body.recipient_email?.trim().toLowerCase() || null;
  if (!recipientEmail) {
    const { data: existing } = await userClient.from("library_purchases").select("id").eq("book_id", book.id).eq("buyer_id", user.id).in("status", ["paid", "completed"]).maybeSingle();
    if (existing) return json({ ok: true, completed: true, alreadyOwned: true }, 200, cors);
  }

  let recipientUserId: string | null = null;
  if (recipientEmail) {
    if (recipientEmail === user.email?.toLowerCase()) return json({ error: "You can't gift a book to yourself" }, 400, cors);
    const { data: resolvedId } = await serviceClient.rpc("find_user_id_by_email", { _email: recipientEmail });
    recipientUserId = resolvedId ?? null;
  }
  const giftFields = recipientEmail
    ? { recipient_email: recipientEmail, recipient_user_id: recipientUserId, gifted_by: user.id, gift_message: body.gift_message ?? null }
    : {};

  const coupon = await resolveCoupon(userClient, body.coupon_code, body.book_id);
  if (coupon) {
    const reserved = await serviceClient.rpc("reserve_library_coupon", { _coupon_id: coupon.id, _user_id: user.id });
    if (!reserved.data) return json({ error: "This coupon isn't valid or has already been used" }, 400, cors);
  }
  const discounted = applyDiscount(usd, vx, coupon);

  if (body.payment_method === "vx") {
    if (discounted.vx == null || discounted.vx <= 0) return json({ error: "This book isn't available for VX purchase" }, 400, cors);
    try {
      const { data: spent, error: spendErr } = await userClient.rpc("spend_vx", { _amount: discounted.vx, _item_type: "library_book", _item_id: book.id, _item_name: book.title });
      if (spendErr) throw spendErr;
      if (!spent) {
        if (coupon) await serviceClient.rpc("release_library_coupon", { _coupon_id: coupon.id, _user_id: user.id });
        return json({ error: "Insufficient VX balance" }, 402, cors);
      }
      const { data: purchase, error: insertErr } = await serviceClient
        .from("library_purchases")
        .insert({ buyer_id: user.id, book_id: book.id, payment_method: "vx", amount_vx: discounted.vx, status: "completed", purchased_at: new Date().toISOString(), ...giftFields })
        .select("id").single();
      if (insertErr) throw insertErr;
      if (coupon) await serviceClient.from("library_coupon_redemptions").update({ purchase_id: purchase.id }).eq("coupon_id", coupon.id).eq("user_id", user.id);
      return json({ ok: true, completed: true }, 200, cors);
    } catch (err) {
      if (coupon) await serviceClient.rpc("release_library_coupon", { _coupon_id: coupon.id, _user_id: user.id });
      throw err;
    }
  }

  const session = await createStripeSession({
    mode: "payment", amountUsd: discounted.usd, productName: book.title, customerEmail: user.email ?? "",
    metadata: { pricing_model: "paid", book_id: book.id, buyer_id: user.id, coupon_id: coupon?.id ?? "" },
  });
  if ("error" in session) {
    if (coupon) await serviceClient.rpc("release_library_coupon", { _coupon_id: coupon.id, _user_id: user.id });
    return json({ error: session.error }, 502, cors);
  }
  const { error: insertErr } = await serviceClient
    .from("library_purchases")
    .insert({ buyer_id: user.id, book_id: book.id, payment_method: "cash", amount_usd: discounted.usd, status: "pending", stripe_checkout_session_id: session.id, ...giftFields });
  if (insertErr) throw insertErr;
  return json({ ok: true, checkoutUrl: session.url }, 200, cors);
}

// deno-lint-ignore no-explicit-any
async function handleRental(body: RequestBody, user: any, userClient: AnyClient, serviceClient: AnyClient, cors: Record<string, string>) {
  if (!body.book_id) return json({ error: "book_id is required" }, 400, cors);
  const { book, usd, vx } = await resolveBookPrice(userClient, body.book_id, body.country_code, true);
  const periodDays = book.rental_period_days ?? 14;

  const coupon = await resolveCoupon(userClient, body.coupon_code, body.book_id);
  if (coupon) {
    const reserved = await serviceClient.rpc("reserve_library_coupon", { _coupon_id: coupon.id, _user_id: user.id });
    if (!reserved.data) return json({ error: "This coupon isn't valid or has already been used" }, 400, cors);
  }
  const discounted = applyDiscount(usd, vx, coupon);

  if (body.payment_method === "vx") {
    if (discounted.vx == null || discounted.vx <= 0) return json({ error: "This book isn't available for VX rental" }, 400, cors);
    try {
      const { data: spent, error: spendErr } = await userClient.rpc("spend_vx", { _amount: discounted.vx, _item_type: "library_book_rental", _item_id: book.id, _item_name: book.title });
      if (spendErr) throw spendErr;
      if (!spent) {
        if (coupon) await serviceClient.rpc("release_library_coupon", { _coupon_id: coupon.id, _user_id: user.id });
        return json({ error: "Insufficient VX balance" }, 402, cors);
      }
      await serviceClient.from("library_purchases").insert({ buyer_id: user.id, book_id: book.id, payment_method: "vx", amount_vx: discounted.vx, status: "completed", purchased_at: new Date().toISOString() });
      const dueAt = new Date(Date.now() + periodDays * 86_400_000).toISOString();
      const { error: borrowErr } = await serviceClient.from("library_borrowed_books").insert({ user_id: user.id, book_id: book.id, due_at: dueAt });
      if (borrowErr) throw borrowErr;
      return json({ ok: true, completed: true }, 200, cors);
    } catch (err) {
      if (coupon) await serviceClient.rpc("release_library_coupon", { _coupon_id: coupon.id, _user_id: user.id });
      throw err;
    }
  }

  const session = await createStripeSession({
    mode: "payment", amountUsd: discounted.usd, productName: `${book.title} (${periodDays}-day rental)`, customerEmail: user.email ?? "",
    metadata: { pricing_model: "rental", book_id: book.id, buyer_id: user.id, rental_period_days: String(periodDays), coupon_id: coupon?.id ?? "" },
  });
  if ("error" in session) {
    if (coupon) await serviceClient.rpc("release_library_coupon", { _coupon_id: coupon.id, _user_id: user.id });
    return json({ error: session.error }, 502, cors);
  }
  await serviceClient.from("library_purchases").insert({ buyer_id: user.id, book_id: book.id, payment_method: "cash", amount_usd: discounted.usd, status: "pending", stripe_checkout_session_id: session.id });
  return json({ ok: true, checkoutUrl: session.url }, 200, cors);
}

// deno-lint-ignore no-explicit-any
async function handleBundle(body: RequestBody, user: any, userClient: AnyClient, serviceClient: AnyClient, cors: Record<string, string>) {
  if (!body.bundle_id) return json({ error: "bundle_id is required" }, 400, cors);
  const { data: bundle, error: bundleErr } = await userClient.from("library_bundles").select("id, title, price_usd, price_vx, is_active").eq("id", body.bundle_id).maybeSingle();
  if (bundleErr) throw bundleErr;
  if (!bundle || !bundle.is_active) return json({ error: "Bundle not found or inactive" }, 404, cors);
  const { data: bundleBooks, error: booksErr } = await userClient.from("library_bundle_books").select("book_id").eq("bundle_id", bundle.id);
  if (booksErr) throw booksErr;
  const bookIds = (bundleBooks ?? []).map((b: { book_id: string }) => b.book_id);
  if (bookIds.length === 0) return json({ error: "This bundle has no books" }, 400, cors);

  const usd = Number(bundle.price_usd ?? 0);
  const vx = bundle.price_vx != null ? Number(bundle.price_vx) : null;

  if (body.payment_method === "vx") {
    if (vx == null || vx <= 0) return json({ error: "This bundle isn't available for VX purchase" }, 400, cors);
    const { data: spent, error: spendErr } = await userClient.rpc("spend_vx", { _amount: vx, _item_type: "library_bundle", _item_id: bundle.id, _item_name: bundle.title });
    if (spendErr) throw spendErr;
    if (!spent) return json({ error: "Insufficient VX balance" }, 402, cors);

    const perBook = Math.round((vx / bookIds.length) * 100) / 100;
    const rows = bookIds.map((bookId: string) => ({ buyer_id: user.id, book_id: bookId, bundle_id: bundle.id, payment_method: "vx", amount_vx: perBook, status: "completed", purchased_at: new Date().toISOString() }));
    const { error: insertErr } = await serviceClient.from("library_purchases").insert(rows);
    if (insertErr) throw insertErr;
    return json({ ok: true, completed: true }, 200, cors);
  }

  const session = await createStripeSession({ mode: "payment", amountUsd: usd, productName: bundle.title, customerEmail: user.email ?? "", metadata: { pricing_model: "bundle", bundle_id: bundle.id, buyer_id: user.id } });
  if ("error" in session) return json({ error: session.error }, 502, cors);
  const perBookUsd = Math.round((usd / bookIds.length) * 100) / 100;
  const rows = bookIds.map((bookId: string) => ({ buyer_id: user.id, book_id: bookId, bundle_id: bundle.id, payment_method: "cash", amount_usd: perBookUsd, status: "pending", stripe_checkout_session_id: session.id }));
  const { error: insertErr } = await serviceClient.from("library_purchases").insert(rows);
  if (insertErr) throw insertErr;
  return json({ ok: true, checkoutUrl: session.url }, 200, cors);
}

// deno-lint-ignore no-explicit-any
async function handleSubscription(body: RequestBody, user: any, userClient: AnyClient, serviceClient: AnyClient, cors: Record<string, string>) {
  const plan = body.plan ?? "monthly";
  const pricing = SUBSCRIPTION_PRICING[plan];

  if (body.payment_method === "vx") {
    const { data: spent, error: spendErr } = await userClient.rpc("spend_vx", { _amount: pricing.vx, _item_type: "library_subscription", _item_id: plan, _item_name: `Library ${plan} subscription` });
    if (spendErr) throw spendErr;
    if (!spent) return json({ error: "Insufficient VX balance" }, 402, cors);
    const currentPeriodEnd = new Date(Date.now() + pricing.days * 86_400_000).toISOString();
    const { error: subErr } = await serviceClient.from("library_subscriptions").upsert({ user_id: user.id, plan, status: "active", current_period_end: currentPeriodEnd }, { onConflict: "user_id" });
    if (subErr) throw subErr;
    return json({ ok: true, completed: true }, 200, cors);
  }

  const session = await createStripeSession({
    mode: "subscription", amountUsd: pricing.usd, productName: `Library ${plan} subscription`, customerEmail: user.email ?? "",
    recurringDays: pricing.days, metadata: { pricing_model: "subscription", plan, buyer_id: user.id },
  });
  if ("error" in session) return json({ error: session.error }, 502, cors);
  return json({ ok: true, checkoutUrl: session.url }, 200, cors);
}

// deno-lint-ignore no-explicit-any
async function handleDonation(body: RequestBody, user: any, userClient: AnyClient, serviceClient: AnyClient, cors: Record<string, string>) {
  if (!body.book_id) return json({ error: "book_id is required" }, 400, cors);
  const { data: book, error } = await userClient.from("library_books").select("id, title, suggested_donation_usd").eq("id", body.book_id).maybeSingle();
  if (error) throw error;
  if (!book) return json({ error: "Book not found" }, 404, cors);

  const amountUsd = body.amount_usd ?? Number(book.suggested_donation_usd ?? 5);

  if (body.payment_method === "vx") {
    if (!body.amount_vx || body.amount_vx <= 0) return json({ error: "amount_vx is required for a VX donation" }, 400, cors);
    const { data: spent, error: spendErr } = await userClient.rpc("spend_vx", { _amount: body.amount_vx, _item_type: "library_donation", _item_id: book.id, _item_name: book.title });
    if (spendErr) throw spendErr;
    if (!spent) return json({ error: "Insufficient VX balance" }, 402, cors);
    const { error: insertErr } = await serviceClient.from("library_donations").insert({ book_id: book.id, donor_id: user.id, amount_vx: body.amount_vx, message: body.message ?? null });
    if (insertErr) throw insertErr;
    return json({ ok: true, completed: true }, 200, cors);
  }

  const session = await createStripeSession({
    mode: "payment", amountUsd, productName: `Donation — ${book.title}`, customerEmail: user.email ?? "",
    metadata: { pricing_model: "donation", book_id: book.id, buyer_id: user.id, message: body.message ?? "" },
  });
  if ("error" in session) return json({ error: session.error }, 502, cors);
  return json({ ok: true, checkoutUrl: session.url }, 200, cors);
}

// deno-lint-ignore no-explicit-any
async function handleLicense(body: RequestBody, user: any, userClient: AnyClient, serviceClient: AnyClient, cors: Record<string, string>) {
  if (!body.book_id) return json({ error: "book_id is required" }, 400, cors);
  const seatCount = Math.min(Math.max(body.seat_count ?? 1, 1), 500);
  const licenseType = body.license_type ?? "individual";
  const { book, usd, vx } = await resolveBookPrice(userClient, body.book_id, body.country_code, false);

  const totalUsd = usd * seatCount;
  const totalVx = vx != null ? vx * seatCount : null;

  async function createLicense(purchaseId: string | null) {
    const { error: licenseErr } = await serviceClient
      .from("library_licenses")
      .insert({ book_id: book.id, purchaser_id: user.id, license_type: licenseType, seat_count: seatCount, purchase_id: purchaseId });
    if (licenseErr) throw licenseErr;
  }

  if (body.payment_method === "vx") {
    if (totalVx == null || totalVx <= 0) return json({ error: "This book isn't available for a VX license purchase" }, 400, cors);
    const { data: spent, error: spendErr } = await userClient.rpc("spend_vx", { _amount: totalVx, _item_type: "library_book_license", _item_id: book.id, _item_name: `${book.title} (${seatCount}-seat license)` });
    if (spendErr) throw spendErr;
    if (!spent) return json({ error: "Insufficient VX balance" }, 402, cors);

    const { data: purchase, error: insertErr } = await serviceClient
      .from("library_purchases")
      .insert({ buyer_id: user.id, book_id: book.id, payment_method: "vx", amount_vx: totalVx, status: "completed", purchased_at: new Date().toISOString() })
      .select("id").single();
    if (insertErr) throw insertErr;
    await createLicense(purchase.id);
    return json({ ok: true, completed: true }, 200, cors);
  }

  const session = await createStripeSession({
    mode: "payment", amountUsd: totalUsd, productName: `${book.title} (${seatCount}-seat ${licenseType} license)`, customerEmail: user.email ?? "",
    metadata: { pricing_model: "license", book_id: book.id, buyer_id: user.id, seat_count: String(seatCount), license_type: licenseType },
  });
  if ("error" in session) return json({ error: session.error }, 502, cors);
  const { error: insertErr } = await serviceClient
    .from("library_purchases")
    .insert({ buyer_id: user.id, book_id: book.id, payment_method: "cash", amount_usd: totalUsd, status: "pending", stripe_checkout_session_id: session.id });
  if (insertErr) throw insertErr;
  // The license row itself is created by library-stripe-webhook once
  // payment actually completes (mirrors how every other cash path here
  // defers its side effects to the webhook) — see that function's
  // pricing_model switch.
  return json({ ok: true, checkoutUrl: session.url }, 200, cors);
}
