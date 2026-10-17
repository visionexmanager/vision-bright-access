-- ph_get_provider_stats returned a provider's request count, failure count,
-- cost in USD and latency to anyone who knew a provider id: SECURITY DEFINER,
-- no check on the caller, and the default EXECUTE grant to anon and
-- authenticated still stood (20260906 listed ph_record_metric but not this).
-- Provider cost is operator-only data.
--
-- Only caller: supabase/functions/provider-hub (get_metrics), which now calls it
-- with its service-role client after its admin gate. Revoking by catalogue
-- lookup covers every overload and cannot abort a deploy on a mistyped argument list.
DO $$
DECLARE _fn record;
BEGIN
  FOR _fn IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'ph_get_provider_stats'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', _fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', _fn.sig);
  END LOOP;
END $$;
