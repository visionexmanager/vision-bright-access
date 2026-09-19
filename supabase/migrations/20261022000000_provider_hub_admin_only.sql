-- Phase 0 — the provider inventory is an admin's view, not a signed-in user's.
--
-- `ph_providers` has been readable by every authenticated account since it was
-- created: `ph_providers_read_auth` is `FOR SELECT USING (auth.role() =
-- 'authenticated')`. That row carries `api_key_ref` — the *name* of each
-- secret, which maps the platform's entire key inventory — plus
-- `cost_per_request`, and `ph_logs`/`ph_metrics` carry `cost_usd` and
-- `total_cost_usd` per job. A customer could read what every generation costs
-- Visionex and work backwards to the margin on their own plan.
--
-- The comment on 20260829 already recorded that the row "maps the platform's
-- key inventory for anyone who asks". That migration removed the write policy
-- and left the read. This removes the read.
--
-- Nothing legitimate breaks. Every writer is an Edge Function holding the
-- service role, which bypasses RLS; the only reader that is not is the admin
-- Provider Hub screen, whose operator is an admin by definition.

-- ── Reads become admin-only ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "ph_providers_read_auth" ON public.ph_providers;
DROP POLICY IF EXISTS "ph_metrics_read_auth"   ON public.ph_metrics;
DROP POLICY IF EXISTS "ph_logs_read_auth"      ON public.ph_logs;
DROP POLICY IF EXISTS "ph_configs_read_auth"   ON public.ph_configs;
DROP POLICY IF EXISTS "ph_failovers_read_auth" ON public.ph_failovers;

DO $$
DECLARE
  _table text;
BEGIN
  FOREACH _table IN ARRAY ARRAY['ph_providers', 'ph_metrics', 'ph_logs', 'ph_configs', 'ph_failovers']
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((select public.has_role(auth.uid(), ''admin'')))',
      _table || '_read_admin', _table
    );
  END LOOP;
END $$;

-- `(select …)` around has_role is deliberate: an unwrapped call is re-evaluated
-- per row, and ph_logs grows a row per generation.

-- Belt as well as braces. RLS is the gate, but a table grant is what decides
-- whether the request reaches the gate at all, and these tables hold nothing a
-- browser role should be able to address directly.
REVOKE ALL ON TABLE public.ph_providers, public.ph_metrics, public.ph_logs,
                    public.ph_configs, public.ph_failovers
  FROM anon;
GRANT SELECT ON TABLE public.ph_providers, public.ph_metrics, public.ph_logs,
                      public.ph_configs, public.ph_failovers
  TO authenticated;
GRANT ALL ON TABLE public.ph_providers, public.ph_metrics, public.ph_logs,
                   public.ph_configs, public.ph_failovers
  TO service_role;

-- ── Every provider change is recorded, whoever makes it ─────────────────────
--
-- A trigger rather than a line in the Edge Function. The function is one way
-- in; the service role is another, and a migration is a third. An audit that
-- only sees the polite path is an audit of politeness.
--
-- `api_key_ref` is recorded because *which secret a provider uses* is exactly
-- the kind of change worth being able to reconstruct. It is a name, never a
-- value, and this table is admin-read like the one it watches.

CREATE TABLE IF NOT EXISTS public.ph_provider_audit (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id  uuid,
  provider_slug text,
  operation    text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  -- Null when the writer held the service role rather than a session, which is
  -- the honest answer: a cron or a migration has no actor.
  actor_id     uuid,
  before       jsonb,
  after        jsonb,
  changed      text[],
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ph_provider_audit_provider_idx
  ON public.ph_provider_audit(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ph_provider_audit_created_idx
  ON public.ph_provider_audit(created_at DESC);

COMMENT ON TABLE public.ph_provider_audit IS
  'Every write to ph_providers, from any path. Holds secret NAMES (api_key_ref), never values. Admin-read, service-write.';

ALTER TABLE public.ph_provider_audit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename = 'ph_provider_audit' AND policyname = 'ph_provider_audit_read_admin') THEN
    CREATE POLICY "ph_provider_audit_read_admin"
      ON public.ph_provider_audit FOR SELECT TO authenticated
      USING ((select public.has_role(auth.uid(), 'admin')));
  END IF;
END $$;

REVOKE ALL ON TABLE public.ph_provider_audit FROM anon;
GRANT SELECT ON TABLE public.ph_provider_audit TO authenticated;
GRANT ALL ON TABLE public.ph_provider_audit TO service_role;

CREATE OR REPLACE FUNCTION public.ph_audit_provider_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _before jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  _after  jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  _changed text[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(array_agg(key ORDER BY key), '{}')
      INTO _changed
      FROM jsonb_each(_after)
     WHERE _before -> key IS DISTINCT FROM value
       -- updated_at moves on every write and says nothing about intent.
       AND key <> 'updated_at';
    -- A write that changed nothing but the timestamp is not worth a row.
    IF _changed = '{}' THEN RETURN NEW; END IF;
  END IF;

  INSERT INTO public.ph_provider_audit
    (provider_id, provider_slug, operation, actor_id, before, after, changed)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.slug, OLD.slug),
    TG_OP,
    auth.uid(),
    _before,
    _after,
    _changed
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS ph_providers_audit ON public.ph_providers;
CREATE TRIGGER ph_providers_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.ph_providers
  FOR EACH ROW EXECUTE FUNCTION public.ph_audit_provider_change();
