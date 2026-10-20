-- page_events retention: delete rows older than 2,160 elapsed hours, nightly, in batches.
--
-- PROPOSAL, NOT APPROVED FOR DEPLOYMENT. Merging this file runs it in production
-- (`supabase db push`) and starts permanent deletion at the next 03:25 UTC. See
-- docs/audit/PAGE_EVENTS_RETENTION_PROPOSAL.md.
--
-- Policy, defined once: "90 days" here means exactly 2,160 elapsed hours (90 x 24),
-- measured on `created_at` (timestamptz, an absolute instant) against `now()` when the
-- job runs. It is NOT 90 calendar days: across a daylight-saving change the two differ
-- by an hour, and a retention cutoff must not depend on a time zone. A row exactly on
-- the cutoff instant is kept (strict `<`); a row dated in the future is kept.
--
-- Scope. Only `public.page_events`. No other table, column, user or event type is
-- looked at; nothing is selected by content.
--
-- Bounded and retryable. Each run deletes at most 10,000 of the oldest matching rows
-- inside one statement, with a 60 s statement timeout and a 5 s lock timeout. A run is
-- atomic: if it fails or times out it deletes nothing, and the next night's run does
-- the same work. A backlog larger than a batch drains over several nights. Running it
-- twice, or re-applying this migration, is harmless: `cron.schedule` upserts by job
-- name, and a second run finds nothing older than the cutoff.
--
-- What it reports. The statement has no RETURNING clause, so no row, path, title,
-- session id or count by user leaves the table. The only output is the command tag
-- ("DELETE <n>") that pg_cron stores in cron.job_run_details.return_message together
-- with the run's status: an aggregate operational result, which the
-- `cron-run-history-prune` job (20261071) keeps for 7 days (30 for failures).
--
-- No function is added, so nothing new is callable through the API. A database without
-- pg_cron says so in the migration output instead of failing.
--
-- Rollback / stop: SELECT cron.unschedule('page-events-retention');
-- Deleted rows do NOT come back; see the proposal for backup and recovery options.
DO $outer$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'pg_cron could not be installed (%): page_events is NOT pruned in this database.', SQLERRM;
    RETURN;
  END;

  PERFORM cron.schedule(
    'page-events-retention',
    '25 3 * * *',
    $cron$SET LOCAL statement_timeout = '60s'; SET LOCAL lock_timeout = '5s';
DELETE FROM public.page_events
 WHERE id IN (SELECT id FROM public.page_events
               WHERE created_at < now() - interval '2160 hours'
               ORDER BY created_at LIMIT 10000)$cron$
  );
END
$outer$;
