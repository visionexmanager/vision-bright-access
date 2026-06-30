import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

async function stripeRequest(path: string, params: URLSearchParams, key: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Stripe request failed");
  return data;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Stripe Connect is not configured" }, 503, corsHeaders);
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401, corsHeaders);

    const { shopId, returnUrl } = await req.json() as { shopId: string; returnUrl?: string };
    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: shop, error } = await service.from("bazaar_shops")
      .select("id, owner_id, stripe_account_id")
      .eq("id", shopId)
      .single();
    if (error) throw error;
    if (shop.owner_id !== user.id) return json({ error: "Forbidden" }, 403, corsHeaders);

    let accountId = shop.stripe_account_id;
    if (!accountId) {
      const params = new URLSearchParams();
      params.set("type", "express");
      params.set("email", user.email || "");
      params.set("metadata[shop_id]", shop.id);
      const account = await stripeRequest("accounts", params, stripeKey);
      accountId = account.id;
      await service.from("bazaar_shops").update({ stripe_account_id: accountId }).eq("id", shop.id);
    }

    const accountResponse = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    const account = await accountResponse.json();
    if (!accountResponse.ok) throw new Error(account?.error?.message || "Unable to check Stripe account");
    if (account.charges_enabled && account.details_submitted) {
      await service.from("bazaar_shops")
        .update({ stripe_onboarding_complete: true })
        .eq("id", shop.id);
      return json({ complete: true }, 200, corsHeaders);
    }

    const siteUrl = Deno.env.get("SITE_URL") || "https://visionex.app";
    const safeReturn = returnUrl?.startsWith(siteUrl) ? returnUrl : `${siteUrl}/bazaar`;
    const linkParams = new URLSearchParams();
    linkParams.set("account", accountId);
    linkParams.set("refresh_url", safeReturn);
    linkParams.set("return_url", `${safeReturn}${safeReturn.includes("?") ? "&" : "?"}stripe_connect=complete`);
    linkParams.set("type", "account_onboarding");
    const link = await stripeRequest("account_links", linkParams, stripeKey);

    return json({ url: link.url }, 200, corsHeaders);
  } catch (error) {
    console.error("bazaar-stripe-connect error", error);
    return json({ error: error instanceof Error ? error.message : "Stripe Connect failed" }, 500, corsHeaders);
  }
});
