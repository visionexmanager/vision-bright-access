-- Close public read/write access to the AI Media Studio billing tables.
--
-- 20260628600000_billing_system.sql gave each billing table a correct
-- owner-scoped SELECT policy AND a second policy named "*_service_all":
--
--   CREATE POLICY "wallet_service_all" ON credit_wallets FOR ALL USING (true);
--
-- The name says service role, but the policy says nothing of the kind. With no
-- `TO service_role` clause a policy applies to every role, so `anon` — the
-- publishable key shipped in the browser bundle — satisfied it. Reading a row
-- from credit_wallets with nothing but that public key was confirmed against
-- production. Because `FOR ALL` also supplies the WITH CHECK expression for
-- INSERT and UPDATE, the same policy exposed writes to VX balances.
--
-- Dropping these six policies is sufficient and costs nothing:
--
--   * service_role bypasses RLS entirely, so the only two functions that touch
--     these tables (billing-engine, health-check) are unaffected. billing-engine
--     uses its user-scoped client solely for auth.getUser(); every table access
--     goes through serviceDb().
--   * academy_enroll_course() and create_bazaar_shop() read users_billing from
--     SECURITY DEFINER functions, which are likewise unaffected.
--   * No client-side code queries any of these tables.
--   * The "*_owner_select" policies from the original migration stay in place,
--     so a signed-in user can still read their own row.
--
-- Idempotent: DROP POLICY IF EXISTS is a no-op when the policy is already gone.

DROP POLICY IF EXISTS "trial_service_all"    ON public.trial_status;
DROP POLICY IF EXISTS "wallet_service_all"   ON public.credit_wallets;
DROP POLICY IF EXISTS "sub_service_all"      ON public.user_subscriptions;
DROP POLICY IF EXISTS "txn_service_all"      ON public.credit_transactions;
DROP POLICY IF EXISTS "usage_service_all"    ON public.usage_logs;
DROP POLICY IF EXISTS "ubilling_service_all" ON public.users_billing;

-- Re-assert the owner-scoped SELECT policies. These already exist on any
-- database that ran 20260628600000, but stating them here keeps this migration
-- self-contained: after it runs, each table is guaranteed to allow exactly one
-- thing to a non-service caller — reading their own row.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trial_status' AND policyname = 'trial_owner_select') THEN
    CREATE POLICY "trial_owner_select" ON public.trial_status FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credit_wallets' AND policyname = 'wallet_owner_select') THEN
    CREATE POLICY "wallet_owner_select" ON public.credit_wallets FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_subscriptions' AND policyname = 'sub_owner_select') THEN
    CREATE POLICY "sub_owner_select" ON public.user_subscriptions FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credit_transactions' AND policyname = 'txn_owner_select') THEN
    CREATE POLICY "txn_owner_select" ON public.credit_transactions FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'usage_logs' AND policyname = 'usage_owner_select') THEN
    CREATE POLICY "usage_owner_select" ON public.usage_logs FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users_billing' AND policyname = 'ubilling_owner_select') THEN
    CREATE POLICY "ubilling_owner_select" ON public.users_billing FOR SELECT USING (user_id = auth.uid());
  END IF;
END
$$;

-- Row level security must be on for any of the above to matter. Enabling an
-- already-enabled table is a no-op.
ALTER TABLE public.trial_status        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_wallets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users_billing       ENABLE ROW LEVEL SECURITY;

-- ─── PROVIDER HUB ─────────────────────────────────────────────────────────────
--
-- 20260628500000_provider_hub.sql has the identical defect, and its own comment
-- shows the intent:
--
--   CREATE POLICY "ph_providers_write_service" ON ph_providers
--     FOR ALL USING (true);  -- service_role bypasses RLS
--
-- service_role does bypass RLS — which is exactly why the policy was never
-- needed. As written it granted every role full access, overriding the
-- companion "ph_*_read_auth" policies that were meant to limit reads to signed-in
-- users. Confirmed against production: the publishable key returned the whole
-- ph_providers row, api_key_ref included. That column holds secret *names*, not
-- values, but it maps the platform's key inventory for anyone who asks, and the
-- write side allowed rewriting provider routing.
--
-- Dropping these leaves "ph_*_read_auth" (authenticated read) in force, and the
-- edge functions that write here — provider-hub, and _shared/providerRouter.ts
-- via speech-generate / voice-studio / video-studio — all use the service role.
-- No client-side code queries any ph_* table.

DROP POLICY IF EXISTS "ph_providers_write_service" ON public.ph_providers;
DROP POLICY IF EXISTS "ph_metrics_write_service"   ON public.ph_metrics;
DROP POLICY IF EXISTS "ph_logs_write_service"      ON public.ph_logs;
DROP POLICY IF EXISTS "ph_configs_write_service"   ON public.ph_configs;
DROP POLICY IF EXISTS "ph_failovers_write_service" ON public.ph_failovers;

ALTER TABLE public.ph_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_metrics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_configs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ph_failovers ENABLE ROW LEVEL SECURITY;
