// Stripe webhook for Career Center subscription billing. Verifies the
// signature manually (same algorithm as bazaar-stripe-webhook), then
// updates career_billing_subscriptions/career_billing_invoices — the only
// writer of those tables, since neither has a client INSERT/UPDATE policy.
//
// Configure this endpoint's URL in the Stripe Dashboard webhook settings
// and set STRIPE_WEBHOOK_SECRET (a separate secret from the one used by
// bazaar-stripe-webhook, since Stripe issues one signing secret per
// registered endpoint) as a Supabase Edge Function secret.
import { createClient } from "npm:@supabase/supabase-js@2";
import { newTraceId, persistCareerError } from "../_shared/careerLogger.ts";
import { stripeGet, verifyStripeSignature } from "../_shared/careerStripe.ts";

Deno.serve(async (req) => {
  const traceId = newTraceId();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const webhookSecret = Deno.env.get("CAREER_STRIPE_WEBHOOK_SECRET");
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    if (!webhookSecret || !signature || !(await verifyStripeSignature(body, signature, webhookSecret))) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(body);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription") break;
        const companyId = session.metadata?.company_id;
        const planId = session.metadata?.plan_id;
        if (!companyId || !planId || !session.subscription) break;

        const stripeSub = await stripeGet(`subscriptions/${session.subscription}`);
        await service.from("career_billing_subscriptions").upsert({
          company_id: companyId,
          plan_id: planId,
          status: "active",
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          current_period_start: new Date(Number(stripeSub.current_period_start) * 1000).toISOString(),
          current_period_end: new Date(Number(stripeSub.current_period_end) * 1000).toISOString(),
          cancel_at_period_end: Boolean(stripeSub.cancel_at_period_end),
          grace_period_ends_at: null,
        }, { onConflict: "company_id" });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription as string | undefined;
        if (!stripeSubId) break;
        const { data: sub } = await service
          .from("career_billing_subscriptions")
          .select("id, company_id")
          .eq("stripe_subscription_id", stripeSubId)
          .maybeSingle();
        if (!sub) break;

        await service.from("career_billing_invoices").upsert({
          company_id: sub.company_id,
          subscription_id: sub.id,
          stripe_invoice_id: invoice.id,
          amount_cents: invoice.amount_paid ?? invoice.total ?? 0,
          currency: invoice.currency ?? "usd",
          status: "paid",
          invoice_pdf_url: invoice.invoice_pdf ?? null,
          period_start: invoice.period_start ? new Date(Number(invoice.period_start) * 1000).toISOString() : null,
          period_end: invoice.period_end ? new Date(Number(invoice.period_end) * 1000).toISOString() : null,
        }, { onConflict: "stripe_invoice_id" });

        await service.from("career_billing_subscriptions")
          .update({ status: "active", grace_period_ends_at: null })
          .eq("id", sub.id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const stripeSubId = invoice.subscription as string | undefined;
        if (!stripeSubId) break;
        await service.from("career_billing_subscriptions")
          .update({ status: "past_due", grace_period_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
          .eq("stripe_subscription_id", stripeSubId);
        break;
      }

      case "customer.subscription.updated": {
        const stripeSub = event.data.object;
        await service.from("career_billing_subscriptions")
          .update({
            current_period_end: new Date(Number(stripeSub.current_period_end) * 1000).toISOString(),
            cancel_at_period_end: Boolean(stripeSub.cancel_at_period_end),
            status: stripeSub.status === "active" ? "active" : stripeSub.status === "past_due" ? "past_due" : "active",
          })
          .eq("stripe_subscription_id", stripeSub.id);
        break;
      }

      case "customer.subscription.deleted": {
        const stripeSub = event.data.object;
        await service.from("career_billing_subscriptions")
          .update({ status: "canceled", plan_id: "free", cancel_at_period_end: false })
          .eq("stripe_subscription_id", stripeSub.id);
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    await persistCareerError(service, {
      traceId,
      service: "career-billing-webhook",
      message: e instanceof Error ? e.message : String(e),
    });
    console.error("career-billing-webhook error:", e);
    return new Response("Webhook processing failed", { status: 500 });
  }
});
