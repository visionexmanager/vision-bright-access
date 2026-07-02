# Billing (SaaS subscriptions)

## Why a separate schema from the existing billing system

This repo already has a working billing system (`billing_plans` /
`credit_wallets` / `user_subscriptions`, `20260628600000_billing_system.sql`
+ the `billing-engine` Edge Function) — but it's hardcoded around
VX-credit-metered AI media generation (`vx_credits_monthly`, `balance_vx`,
operation types `tts`/`voice_cloning`/`text_to_video`). Career Center plans
meter completely different things (job-posting caps, candidate-search
seats, team seats), so `career_billing_*`
(`20260706030000_career_center_billing_schema.sql`) is a deliberately
separate, company-scoped schema rather than a fork of that credit-ledger
logic. It copies its RLS convention (public plan catalog,
owner-select/service-write on everything else).

## Schema

- `career_billing_plans` — public catalog: `free` / `pro` / `business` /
  `enterprise`, each with a `limits jsonb` (job postings/month, candidate
  search seats, AI calls/month, team members — `null` = unlimited) and a
  `features jsonb` list for pricing-page copy.
- `career_billing_subscriptions` — one row per company (`UNIQUE company_id`),
  `status` (trialing/active/past_due/canceled/incomplete),
  `stripe_customer_id`/`stripe_subscription_id`, `current_period_end`,
  `grace_period_ends_at` (failed-payment grace window — status stays
  whatever it was, not force-downgraded, until this passes).
- `career_billing_invoices` — synced from Stripe `invoice.paid` events.
- `career_usage_counters` + `increment_career_usage()` /
  `check_career_usage_allowed()` — per-company, per-metric, per-calendar-
  month counters. `job_postings` is auto-incremented via a trigger on
  `jobs` INSERT (`20260706070000_career_center_usage_triggers.sql`);
  `candidate_searches`/`ai_calls` are ready but not auto-wired (no
  candidate-search endpoint exists yet, and AI calls are keyed to
  individual users, not companies — see that migration's header comment).
- **Enforcement is not automatic.** `check_career_usage_allowed()` exists
  for whichever endpoint wants to show an upgrade prompt before blocking an
  action — this phase doesn't wire a hard block anywhere, since a silent
  DB-level rejection is a worse UX than a clear "upgrade to post more jobs"
  message.

## Edge Functions

- **`career-billing-checkout`** — POST `{ companyId, planId }`, auth
  required (company owner or `billing.manage` permission). Creates a Stripe
  Checkout session in `mode=subscription` using inline `price_data` (no
  pre-created Stripe Price objects needed — same technique as the existing
  `bazaar-checkout` function). Returns `{ url }` to redirect to.
- **`career-billing-webhook`** — verifies the Stripe signature (same HMAC
  algorithm as `bazaar-stripe-webhook`, reused via
  `_shared/careerStripe.ts`), handles `checkout.session.completed`,
  `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`,
  `customer.subscription.deleted`.

## Required secrets

| Secret | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | Already used by the Bazaar checkout functions — reused, not duplicated. |
| `CAREER_STRIPE_WEBHOOK_SECRET` | **New, separate** from whatever secret backs `bazaar-stripe-webhook` — Stripe issues one signing secret per registered webhook endpoint, and Career Center needs its own endpoint URL registered in the Stripe Dashboard. |

## Not built (out of scope for this phase)

A pricing/upgrade UI — rule 18 says no UI changes. `career-billing-checkout`
returns a plain redirect URL any future frontend can call.
