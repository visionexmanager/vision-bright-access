# `page_events` — 90-day retention: proposal for approval (nothing here is applied)

Status: **proposal only.** No migration is added, no job is scheduled, no row is deleted. This file exists so you can approve (or change) the exact policy and SQL before anything is written as a migration.

## What is being retained
`public.page_events(id, event_type, page_path, page_title, user_id, session_id, metadata, created_at)`. Written by `PageTracker` (path, title, per-tab random session id; no user id from the client) — and, after the consent-gate PR, only for visitors who accepted analytics. Read by admins only (`AdminAnalytics`). Evidence of size: an earlier read-only observation recorded 357 events / 287 sessions over 7 days (`VISIONEX_PHASE2_ASSESSMENT_AND_PLAN.md`); today's size was not re-read.

## The policy to approve
1. **Raw rows are kept 90 days, then deleted.** Measured on `created_at`.
2. **Nothing is aggregated or archived first** unless you want it (option B below). Today the admin views read raw rows, so older charts will shorten to 90 days.
3. **Deletion is permanent** (no soft delete, no backup copy made by this job).

Options you can choose instead: **A** 90 days raw (proposed) · **B** 90 days raw + a daily aggregate table (`day, page_path, event_type, views, sessions`) kept indefinitely (adds a table and a writer; more to review) · **C** a different period (30 / 180 / 365 days) · **D** no deletion.

## The exact SQL I would put in the migration (modelled on #433, `20261071000000_prune_cron_run_history.sql`)
```sql
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
    $cron$DELETE FROM public.page_events
            WHERE id IN (SELECT id FROM public.page_events
                          WHERE created_at < now() - interval '90 days'
                          ORDER BY created_at LIMIT 10000)$cron$
  );
END
$outer$;
```
- **Batched** (10,000 rows per run) so one run never holds a long lock; at the observed rate (~50 rows a day) a single run clears any backlog, and a very large backlog drains over several nights.
- `created_at` is indexed (`idx_page_events_created_at`), so the sub-select is an index scan.
- No function is added, so nothing new is callable through the API. `cron.schedule` upserts by job name, so re-applying the migration re-points the same job.
- **Rollback:** `SELECT cron.unschedule('page-events-retention')` stops it. Rows already deleted do not come back.

## How I would test it before it is ever applied
Same method as #433: a PGlite script that replays the migrations, inserts `page_events` rows aged 0, 89, 90, 91 and 400 days, runs the exact `DELETE` text pulled from the migration, and asserts only the rows older than 90 days are gone, the 89-day row is kept, other tables are untouched, and a backlog larger than the batch is cleared across repeated runs. Plus the mutation proof (change `90` to `9` and require the test to go red).

## What I need from you
1. Which option (A / B / C / D) and, for C, the number of days.
2. Explicit approval to add the migration. Merging it runs `supabase db push` and starts permanent deletion at the next 03:25 UTC.
3. Whether the privacy policy text should be updated in the same change (I have not reviewed or edited it).

## Not covered
Backups: if production backups hold older `page_events` rows, deleting from the live table does not remove them from a backup. Retention of backups is a separate setting I did not read.
