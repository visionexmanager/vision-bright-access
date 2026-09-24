-- Phase 2K-2: provider registry retention.
--
-- Nothing has ever deleted from `ph_logs` or `ph_provider_audit`. Both grow at
-- the rate of real work: `ph_logs` by a row per recorded execution (TTS, STT,
-- image, video, shadow), and `ph_provider_audit` by a row per `ph_record_metric`
-- call, because every health/latency update to `ph_providers` fires the audit
-- trigger. Recording chat later would multiply both.
--
-- ── The approved policy, fixed here and nowhere else ────────────────────────
--
--   ph_logs              every row older than 30 days — success, failure and
--                        shadow alike
--   ph_provider_audit    automatic, metric-only UPDATE rows older than 30 days
--                        everything else is kept permanently:
--                          · administrative edits (made in a session: actor set)
--                          · any change to status — degrade, recover, disable
--                          · configuration, priority, keys-by-name, models
--                          · health probes (they also set last_health_check)
--                          · INSERT and DELETE rows
--   ph_metrics, ph_configs.metrics_retention_hours   untouched (a later phase)
--
-- ── How "metric-only" is decided, from the trigger's own payload ─────────────
--
-- `ph_audit_provider_change()` (20261022000000) writes, for an UPDATE, the
-- sorted list of columns whose value changed (`updated_at` excluded, and a write
-- that changed nothing else is not recorded), and `auth.uid()` as `actor_id` —
-- null for the service role, set for an admin's session. `ph_record_metric`
-- (20261040000000) updates exactly five columns in one statement and changes
-- `status` in *separate* statements, so a degrade or a recover is always its
-- own `{status}` row. A row is metric-only when:
--
--   operation = 'UPDATE' AND actor_id IS NULL
--   AND changed is non-empty AND every changed column is one of
--   health_score, avg_latency_ms, success_rate, consecutive_failures,
--   last_failure_at
--
-- Anything that fails any of those conditions is kept.
--
-- ── Safety ──────────────────────────────────────────────────────────────────
--
-- The function takes no arguments: the tables, the predicates and the 30 days
-- are constants below, so no caller can widen, shorten or redirect it. It runs
-- as its caller (SECURITY INVOKER) — pg_cron runs it as the owner, and
-- service_role already holds ALL on both tables — and execution is revoked from
-- PUBLIC, anon and authenticated, then granted to service_role. Work is bounded:
-- at most 10 batches of 5,000 rows per table per run, so a backlog drains over
-- several nights instead of in one long transaction. It reads the database
-- clock once and uses that cutoff for both tables. It returns counts and the
-- cutoff, nothing from any row.

CREATE INDEX IF NOT EXISTS ph_logs_created_idx ON public.ph_logs (created_at);

CREATE OR REPLACE FUNCTION public.ph_prune_registry_logs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _retention      CONSTANT interval := interval '30 days';
  _cutoff         CONSTANT timestamptz := now() - _retention;
  _batch_size     CONSTANT integer := 5000;
  _max_batches    CONSTANT integer := 10;
  _metric_columns CONSTANT text[] := ARRAY['avg_latency_ms', 'consecutive_failures', 'health_score', 'last_failure_at', 'success_rate'];
  _logs_deleted   bigint := 0;
  _audit_deleted  bigint := 0;
  _n              integer;
  _i              integer;
BEGIN
  FOR _i IN 1.._max_batches LOOP
    DELETE FROM public.ph_logs
     WHERE id IN (
       SELECT id FROM public.ph_logs
        WHERE created_at < _cutoff
        ORDER BY created_at
        LIMIT _batch_size
     );
    GET DIAGNOSTICS _n = ROW_COUNT;
    _logs_deleted := _logs_deleted + _n;
    EXIT WHEN _n < _batch_size;
  END LOOP;

  FOR _i IN 1.._max_batches LOOP
    DELETE FROM public.ph_provider_audit
     WHERE id IN (
       SELECT id FROM public.ph_provider_audit
        WHERE created_at < _cutoff
          AND operation = 'UPDATE'
          AND actor_id IS NULL
          AND changed IS NOT NULL
          AND cardinality(changed) > 0
          AND changed <@ _metric_columns
        ORDER BY created_at
        LIMIT _batch_size
     );
    GET DIAGNOSTICS _n = ROW_COUNT;
    _audit_deleted := _audit_deleted + _n;
    EXIT WHEN _n < _batch_size;
  END LOOP;

  RETURN jsonb_build_object(
    'ph_logs_deleted', _logs_deleted,
    'ph_provider_audit_deleted', _audit_deleted,
    'cutoff', _cutoff
  );
END;
$$;

COMMENT ON FUNCTION public.ph_prune_registry_logs() IS
  'Provider registry retention (Phase 2K-2). Fixed policy: ph_logs older than 30 days; ph_provider_audit automatic metric-only UPDATE rows older than 30 days; all other audit rows kept. No arguments. Bounded: 10 x 5,000 rows per table per run. service_role and pg_cron only.';

REVOKE ALL ON FUNCTION public.ph_prune_registry_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ph_prune_registry_logs() TO service_role;

-- 03:30 daily, the project's cleanup slot. `cron.schedule` upserts on the job
-- name, so a re-run re-points the same job. A database without pg_cron still
-- gets the function; it says so in the migration output rather than silently.
DO $outer$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'pg_cron could not be installed (%): provider registry retention is NOT scheduled in this database. ph_prune_registry_logs() still works when called by hand.', SQLERRM;
    RETURN;
  END;

  PERFORM cron.schedule(
    'provider-registry-prune',
    '30 3 * * *',
    $cron$SELECT public.ph_prune_registry_logs()$cron$
  );
END
$outer$;
