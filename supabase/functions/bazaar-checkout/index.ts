import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

type CheckoutItem = { productId: string; quantity: number };

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Cash checkout is not configured" }, 503, corsHeaders);

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401, corsHeaders);

    const payload = await req.json() as {
      shopId: string;
      items: CheckoutItem[];
      buyerNote?: string;
      returnUrl?: string;
    };
    if (!payload.shopId || !Array.isArray(payload.items) || payload.items.length === 0) {
      return json({ error: "Invalid cart" }, 400, corsHeaders);
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const ids = [...new Set(payload.items.map((item) => item.productId))];
    const { data: products, error: productsError } = await service
      .from("bazaar_products")
      .select("id, shop_id, name, description, image, product_type, price_usd, accepts_cash, in_stock, stock_qty")
      .in("id", ids);
    if (productsError) throw productsError;
    if (!products || products.length !== ids.length) {
      return json({ error: "One or more products are unavailable" }, 409, corsHeaders);
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    let verifiedTotalUsd = 0;
    let needsShipping = false;
    const stripeItems: Array<{ name: string; description: string; image?: string; cents: number; quantity: number }> = [];
    for (const requested of payload.items) {
      const product = productMap.get(requested.productId);
      const quantity = Math.max(1, Math.min(99, Math.floor(Number(requested.quantity) || 1)));
      if (
        !product || product.shop_id !== payload.shopId || !product.accepts_cash ||
        !product.in_stock || !product.price_usd || Number(product.stock_qty) < quantity
      ) {
        return json({ error: `${product?.name || "Product"} is unavailable for cash checkout` }, 409, corsHeaders);
      }
      const price = Number(product.price_usd);
      verifiedTotalUsd += price * quantity;
      needsShipping ||= product.product_type === "physical";
      stripeItems.push({
        name: product.name,
        description: product.description || "",
        image: product.image || undefined,
        cents: Math.round(price * 100),
        quantity,
      });
    }

    const { data: shop, error: shopError } = await service
      .from("bazaar_shops")
      .select("id, owner_id, stripe_account_id, stripe_onboarding_complete")
      .eq("id", payload.shopId)
      .single();
    if (shopError) throw shopError;
    if (shop.owner_id === user.id) return json({ error: "You cannot purchase from your own shop" }, 400, corsHeaders);
    if (!shop.stripe_onboarding_complete || !shop.stripe_account_id) {
      return json({ error: "This seller has not enabled secure cash payouts yet" }, 409, corsHeaders);
    }

    const normalizedItems = payload.items.map((item) => ({
      product_id: item.productId,
      quantity: Math.max(1, Math.min(99, Math.floor(Number(item.quantity) || 1))),
    }));
    const { data: orderResult, error: orderError } = await service.rpc("create_bazaar_cash_order", {
      _buyer_id: user.id,
      _shop_id: payload.shopId,
      _items: normalizedItems,
      _buyer_note: payload.buyerNote?.trim() || null,
    });
    if (orderError) throw orderError;
    const orderId = orderResult.order_id as string;
    const totalUsd = Number(orderResult.total_usd);
    if (Math.abs(totalUsd - verifiedTotalUsd) > 0.001) {
      await service.rpc("release_bazaar_cash_order", { _order_id: orderId });
      throw new Error("The cart price changed. Please try again.");
    }

    const siteUrl = Deno.env.get("SITE_URL") || "https://visionex.app";
    const requestedReturn = payload.returnUrl || siteUrl;
    const returnUrl = requestedReturn.startsWith(siteUrl) ? requestedReturn : siteUrl;
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}bazaar_payment=success&order_id=${orderId}`);
    form.set("cancel_url", `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}bazaar_payment=cancelled`);
    form.set("client_reference_id", orderId);
    form.set("metadata[order_id]", orderId);
    form.set("metadata[shop_id]", payload.shopId);
    form.set("customer_email", user.email || "");
    form.set("billing_address_collection", "required");
    form.set("phone_number_collection[enabled]", "true");
    if (needsShipping) {
      ["US", "CA", "GB", "SA", "AE", "KW", "QA", "BH", "OM", "EG", "JO", "DE", "FR", "ES", "IT", "TR", "IN", "PK", "AU", "JP"].forEach((country, index) => {
        form.set(`shipping_address_collection[allowed_countries][${index}]`, country);
      });
    }
    stripeItems.forEach((item, index) => {
      form.set(`line_items[${index}][quantity]`, String(item.quantity));
      form.set(`line_items[${index}][price_data][currency]`, "usd");
      form.set(`line_items[${index}][price_data][unit_amount]`, String(item.cents));
      form.set(`line_items[${index}][price_data][product_data][name]`, item.name);
      if (item.description) form.set(`line_items[${index}][price_data][product_data][description]`, item.description.slice(0, 500));
      if (item.image?.startsWith("https://")) {
        form.set(`line_items[${index}][price_data][product_data][images][0]`, item.image);
      }
    });
    form.set("payment_intent_data[transfer_data][destination]", shop.stripe_account_id);
    form.set("payment_intent_data[application_fee_amount]", String(Math.round(totalUsd * 100 * 0.08)));

    let stripeResponse: Response;
    try {
      stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      });
    } catch (error) {
      await service.rpc("release_bazaar_cash_order", { _order_id: orderId });
      throw error;
    }
    const session = await stripeResponse.json();
    if (!stripeResponse.ok) {
      await service.rpc("release_bazaar_cash_order", { _order_id: orderId });
      throw new Error(session?.error?.message || "Stripe checkout failed");
    }

    await service.from("bazaar_orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", orderId);

    return json({ checkoutUrl: session.url, orderId }, 200, corsHeaders);
  } catch (error) {
    console.error("bazaar-checkout error", error);
    return json({ error: error instanceof Error ? error.message : "Checkout failed" }, 500, corsHeaders);
  }
});
