// POST — creates a Stripe Checkout session (subscription mode) for a
// company to upgrade to a paid Career Center plan. Auth required; caller
// must own the company or hold the 'billing.manage' permission.
//
// Body: { companyId: string, planId: string, returnUrl?: string }
// Response: { url: string }
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { newTraceId, persistCareerError, recordCareerRequestMetric } from "../_shared/careerLogger.ts";
import { stripePost } from "../_shared/careerStripe.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const traceId = newTraceId();
  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let userId: string | null = null;

  const respond = async (body: unknown, status: number) => {
    await recordCareerRequestMetric(serviceClient, {
      traceId,
      endpoint: "career-billing-checkout",
      method: req.method,
      statusCode: status,
      latencyMs: Date.now() - startedAt,
      userId,
    });
    return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return await respond({ error: "Unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return await respond({ error: "Unauthorized" }, 401);
    userId = user.id;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const companyId = typeof body.companyId === "string" ? body.companyId : null;
    const planId = typeof body.planId === "string" ? body.planId : null;
    if (!companyId || !planId) return await respond({ error: "companyId and planId are required" }, 400);

    const { data: company, error: companyErr } = await serviceClient
      .from("companies")
      .select("id, name, owner_user_id")
      .eq("id", companyId)
      .maybeSingle();
    if (companyErr || !company) return await respond({ error: "Company not found" }, 404);

    const isOwner = company.owner_user_id === user.id;
    const { data: canManageBilling } = await serviceClient.rpc("has_career_permission", {
      _user_id: user.id,
      _permission_key: "billing.manage",
    });
    if (!isOwner && !canManageBilling) return await respond({ error: "Forbidden" }, 403);

    const { data: plan, error: planErr } = await serviceClient
      .from("career_billing_plans")
      .select("id, name, price_monthly_usd")
      .eq("id", planId)
      .eq("is_active", true)
      .maybeSingle();
    if (planErr || !plan) return await respond({ error: "Plan not found" }, 404);
    if (!plan.price_monthly_usd || Number(plan.price_monthly_usd) <= 0) {
      return await respond({ error: "This plan does not require checkout" }, 400);
    }

    const { data: existingSub } = await serviceClient
      .from("career_billing_subscriptions")
      .select("stripe_customer_id")
      .eq("company_id", companyId)
      .maybeSingle();

    const siteUrl = Deno.env.get("SITE_URL") || "https://visionex.app";
    const requestedReturn = typeof body.returnUrl === "string" ? body.returnUrl : siteUrl;
    const returnUrl = requestedReturn.startsWith(siteUrl) ? requestedReturn : siteUrl;

    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("success_url", `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}career_billing=success`);
    form.set("cancel_url", `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}career_billing=cancelled`);
    form.set("client_reference_id", companyId);
    form.set("metadata[company_id]", companyId);
    form.set("metadata[plan_id]", planId);
    if (existingSub?.stripe_customer_id) {
      form.set("customer", existingSub.stripe_customer_id as string);
    } else {
      form.set("customer_email", user.email || "");
    }
    form.set("line_items[0][quantity]", "1");
    form.set("line_items[0][price_data][currency]", "usd");
    form.set("line_items[0][price_data][unit_amount]", String(Math.round(Number(plan.price_monthly_usd) * 100)));
    form.set("line_items[0][price_data][recurring][interval]", "month");
    form.set("line_items[0][price_data][product_data][name]", `VisionEx Career Center — ${plan.name}`);

    const session = await stripePost("checkout/sessions", form);
    return await respond({ url: session.url }, 200);
  } catch (e) {
    await persistCareerError(serviceClient, {
      traceId,
      service: "career-billing-checkout",
      message: e instanceof Error ? e.message : String(e),
      userId,
    });
    console.error("career-billing-checkout error:", e);
    return await respond({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
