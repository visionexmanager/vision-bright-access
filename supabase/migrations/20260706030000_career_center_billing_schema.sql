-- VisionEx Career Center — SaaS subscription billing (Phase 11).
--
-- Deliberately a SEPARATE schema from the existing AMS billing system
-- (billing_plans/credit_wallets/user_subscriptions, 20260628600000), which
-- is hardcoded around VX-credit-metered AI media generation
-- (vx_credits_monthly, balance_vx, operation_type IN ('tts','voice_cloning',
-- 'text_to_video')). Career Center plans meter completely different things
-- (job-posting caps, candidate-search seats, team seats), so reusing that
-- schema would mean either abusing its unused `limits jsonb` column or
-- forking its credit-ledger functions with domain conditionals. This copies
-- its RLS convention (public plan catalog + owner-select/service-write)
-- without touching any of its tables.
--
-- Billing is scoped to `companies` (the employer side), matching how job
-- postings/team/candidate search are already company-scoped in the core
-- schema — an individual candidate account has no billing subject here.

CREATE TYPE public.career_subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
CREATE TYPE public.career_invoice_status AS ENUM ('paid', 'open', 'void', 'uncollectible');

-- ── Plan catalog (public) ─────────────────────────────────────────────────
CREATE TABLE public.career_billing_plans (
  id text PRIMARY KEY, -- 'free' | 'pro' | 'business' | 'enterprise'
  name text NOT NULL,
  description text,
  -- Nullable: NULL means "custom / contact us" pricing (used by the
  -- enterprise plan below), same null-means-unlimited convention as `limits`.
  price_monthly_usd numeric(10,2) DEFAULT 0,
  price_yearly_usd numeric(10,2),
  -- e.g. {"job_postings_per_month": 3, "candidate_search_seats": 1, "ai_calls_per_month": 50, "team_members": 1}
  -- a null value for a key means unlimited.
  limits jsonb NOT NULL DEFAULT '{}',
  features jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- No RLS — the plan catalog is a public pricing page by design (same
-- convention as the existing billing_plans table).

INSERT INTO public.career_billing_plans (id, name, description, price_monthly_usd, price_yearly_usd, limits, features, sort_order) VALUES
  ('free', 'Free', 'Get started with basic hiring tools.', 0, 0,
    '{"job_postings_per_month": 1, "candidate_search_seats": 0, "ai_calls_per_month": 20, "team_members": 1}',
    '["1 active job posting", "Basic candidate applications", "Limited AI screening"]', 0),
  ('pro', 'Pro', 'For growing teams hiring regularly.', 49, 490,
    '{"job_postings_per_month": 10, "candidate_search_seats": 3, "ai_calls_per_month": 300, "team_members": 5}',
    '["10 active job postings", "AI candidate screening", "Talent search", "5 team seats"]', 1),
  ('business', 'Business', 'For teams with high-volume hiring.', 199, 1990,
    '{"job_postings_per_month": 50, "candidate_search_seats": 15, "ai_calls_per_month": 2000, "team_members": 20}',
    '["50 active job postings", "Advanced AI screening & interviews", "Bias detection", "20 team seats", "Priority support"]', 2),
  ('enterprise', 'Enterprise', 'Unlimited scale with dedicated support.', NULL, NULL,
    '{"job_postings_per_month": null, "candidate_search_seats": null, "ai_calls_per_month": null, "team_members": null}',
    '["Unlimited postings & seats", "Dedicated account manager", "Custom integrations", "SLA-backed support"]', 3);

-- ── Subscriptions (one active row per company) ───────────────────────────
CREATE TABLE public.career_billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.career_billing_plans(id) DEFAULT 'free',
  status public.career_subscription_status NOT NULL DEFAULT 'trialing',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  -- Failed-payment grace window: the plan's limits keep applying (not
  -- downgraded to free) until this passes, per the "grace period handling"
  -- requirement.
  grace_period_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.career_billing_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company owners can view their own subscription"
  ON public.career_billing_subscriptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_user_id = auth.uid()));

CREATE POLICY "Admins can view all subscriptions"
  ON public.career_billing_subscriptions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No client INSERT/UPDATE/DELETE policy: subscriptions are only ever
-- written by the Stripe webhook / billing Edge Functions on the
-- service-role client, so a user can never grant themselves a plan.

CREATE TRIGGER trg_career_billing_subscriptions_updated_at BEFORE UPDATE ON public.career_billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.career_set_updated_at();

CREATE INDEX idx_career_billing_subscriptions_company ON public.career_billing_subscriptions(company_id);
CREATE INDEX idx_career_billing_subscriptions_stripe_customer ON public.career_billing_subscriptions(stripe_customer_id);

-- ── Invoices ──────────────────────────────────────────────────────────────
CREATE TABLE public.career_billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.career_billing_subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id text UNIQUE,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status public.career_invoice_status NOT NULL DEFAULT 'open',
  invoice_pdf_url text,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.career_billing_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company owners can view their own invoices"
  ON public.career_billing_invoices FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_user_id = auth.uid()));

CREATE POLICY "Admins can view all invoices"
  ON public.career_billing_invoices FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_career_billing_invoices_company ON public.career_billing_invoices(company_id);

-- ── Usage counters (drives plan-limit enforcement) ───────────────────────
CREATE TABLE public.career_usage_counters (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  metric text NOT NULL, -- 'job_postings' | 'candidate_searches' | 'ai_calls'
  period_start date NOT NULL,
  period_end date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, metric, period_start)
);

ALTER TABLE public.career_usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company owners can view their own usage"
  ON public.career_usage_counters FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_user_id = auth.uid()));

CREATE POLICY "Admins can view all usage"
  ON public.career_usage_counters FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Increments this month's counter for a metric, creating the period row on
-- first use. SECURITY DEFINER so it can be called from an Edge Function
-- regardless of which client (anon-scoped or service-role) invokes it.
CREATE OR REPLACE FUNCTION public.increment_career_usage(_company_id uuid, _metric text, _amount integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _period_start date := date_trunc('month', now())::date;
  _period_end date := (date_trunc('month', now()) + interval '1 month' - interval '1 day')::date;
  _new_count integer;
BEGIN
  INSERT INTO public.career_usage_counters (company_id, metric, period_start, period_end, count)
  VALUES (_company_id, _metric, _period_start, _period_end, _amount)
  ON CONFLICT (company_id, metric, period_start)
  DO UPDATE SET count = career_usage_counters.count + _amount
  RETURNING count INTO _new_count;
  RETURN _new_count;
END;
$$;

-- Compares this month's usage against the company's active plan limit for a
-- metric. A NULL limit (or 'enterprise'-style null in `limits`) means
-- unlimited. Companies with no subscription row default to the 'free' plan.
CREATE OR REPLACE FUNCTION public.check_career_usage_allowed(_company_id uuid, _metric text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan_id text;
  _limit_key text;
  _limit numeric;
  _period_start date := date_trunc('month', now())::date;
  _current_count integer;
BEGIN
  SELECT COALESCE(s.plan_id, 'free') INTO _plan_id
  FROM public.companies c
  LEFT JOIN public.career_billing_subscriptions s
    ON s.company_id = c.id AND s.status IN ('trialing', 'active', 'past_due')
  WHERE c.id = _company_id;

  _limit_key := CASE _metric
    WHEN 'job_postings' THEN 'job_postings_per_month'
    WHEN 'candidate_searches' THEN 'candidate_search_seats'
    WHEN 'ai_calls' THEN 'ai_calls_per_month'
    ELSE _metric
  END;

  SELECT (limits ->> _limit_key)::numeric INTO _limit
  FROM public.career_billing_plans
  WHERE id = COALESCE(_plan_id, 'free');

  IF _limit IS NULL THEN
    RETURN true; -- unlimited (enterprise, or key not present)
  END IF;

  SELECT COALESCE(count, 0) INTO _current_count
  FROM public.career_usage_counters
  WHERE company_id = _company_id AND metric = _metric AND period_start = _period_start;

  RETURN COALESCE(_current_count, 0) < _limit;
END;
$$;
