-- Fix: billing_plans, billing_rules, career_billing_plans were created without RLS,
-- leaving them writable by anon/authenticated via PostgREST (Supabase security advisor: rls_disabled_in_public).
-- These are read-only catalog tables (prices/limits/costs) — public read, no client writes.

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_plans_public_read" ON public.billing_plans FOR SELECT USING (true);

ALTER TABLE public.billing_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_rules_public_read" ON public.billing_rules FOR SELECT USING (true);

ALTER TABLE public.career_billing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "career_billing_plans_public_read" ON public.career_billing_plans FOR SELECT USING (true);
