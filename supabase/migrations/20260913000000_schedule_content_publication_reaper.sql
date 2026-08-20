-- Phase 9, step 8 — schedule the reaper, now that there is something to reap.
--
-- 20260907000000_social_publishing_recovery.sql created
-- reap_stale_content_publications() and deliberately did not schedule it,
-- saying so in a comment and naming the condition for doing it later:
--
--   "nothing can stall while there is no worker […] The PR that introduces the
--    worker should schedule it in the same change"
--
-- The worker arrives in this change, so the condition is met. This is that
-- schedule, at the cadence and under the job name that comment proposed.
--
-- ── What the reaper is for ─────────────────────────────────────────────────
--
-- A publication row is CLAIMED between the claim and the record. If the worker
-- dies in that window — the Edge Function times out, the runtime is recycled,
-- the deploy replaces it mid-call — the row stays CLAIMED forever and its slot
-- is neither published nor returned to the queue. Nothing else in the system
-- notices, because a stuck row is not due and not failed; it is simply absent.
--
-- The reaper resolves those rows on the evidence the database has:
--
--   dispatched_at IS NULL      the external call never started, so the slot
--                              returns to its retry budget.
--   dispatched_at IS NOT NULL  the call had started and the outcome is not
--                              knowable, so the slot is parked for a human.
--
-- Fifteen minutes is the function's own default staleness threshold and is
-- comfortably longer than the worker's 60-second adapter timeout, so a healthy
-- in-flight attempt is never reaped out from under itself.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- pg_cron upserts by job name, so re-running this migration re-points the same
-- job rather than accumulating duplicates. That matters here: deploy.yml runs
-- `db push --include-all` on every deploy, so this statement executes again on
-- every release.
SELECT cron.schedule(
  'reap-stale-content-publications',
  '*/5 * * * *',
  $$SELECT public.reap_stale_content_publications()$$
);

-- Runs more often than the publisher (every 15 minutes) on purpose. The
-- publisher creates the rows that can get stuck; sweeping at least as often as
-- they are created keeps the worst case at one cycle rather than growing.
--
-- No job is scheduled for publishing itself. That is driven by a GitHub Actions
-- schedule calling the social-publish function, because publishing needs
-- outbound HTTP with secrets, and the alternative — pg_net plus the service key
-- and CRON_SECRET stored inside the database to call an Edge Function from
-- Postgres — puts two credentials in a table to save one workflow file.

-- The signature is (interval, int), not (interval): 20260908000000 dropped the
-- one-argument version and recreated it with a _limit. Naming the old one here
-- fails the whole migration with 42883, and because the CLI runs each file in a
-- transaction that takes the CREATE EXTENSION and the schedule down with it.
COMMENT ON FUNCTION public.reap_stale_content_publications(interval, int) IS
  'Resolves publication rows left CLAIMED by a worker that died mid-attempt: undispatched attempts return to the retry budget, dispatched ones are parked for a human. Scheduled as the pg_cron job reap-stale-content-publications every 5 minutes by 20260913000000.';
