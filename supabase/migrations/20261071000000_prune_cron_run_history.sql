-- Prune pg_cron's own run history.
--
-- `cron.job_run_details` gets a row for every execution of every job and nothing
-- removed them: the two 5-minute jobs alone write ~4,000 rows a day, and by the
-- 2026-10-17 audit the table was ~58 MB of a ~134 MB database. This keeps
-- succeeded runs for 7 days and everything else (failed, or any status) for 30,
-- so recent failures stay available for diagnosis.
--
-- Scope: the table is pg_cron's bookkeeping, not user data. No function is added
-- (so nothing new is callable through the API): the job runs the DELETE itself,
-- as pg_cron's owner. `cron.schedule` upserts on the job name, so re-running the
-- migration re-points the same job. A database without pg_cron says so in the
-- migration output instead of failing.
DO $outer$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'pg_cron could not be installed (%): cron run history is NOT pruned in this database.', SQLERRM;
    RETURN;
  END;

  PERFORM cron.schedule(
    'cron-run-history-prune',
    '40 3 * * *',
    $cron$DELETE FROM cron.job_run_details
            WHERE end_time < now() - interval '30 days'
               OR (status = 'succeeded' AND end_time < now() - interval '7 days')$cron$
  );
END
$outer$;
