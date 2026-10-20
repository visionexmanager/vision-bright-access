# `page_events` — 90-day retention: proposal for approval (nothing here is applied)

Status: **proposal only.** No migration is added, no job is scheduled, no row is deleted. This file exists so you can approve (or change) the exact policy and SQL before anything is written as a migration.

## What is being retained
`public.page_events(id, event_type, page_path, page_title, user_id, session_id, metadata, created_at)`. Written by `PageTracker` (path, title, per-tab random session id; no user id from the client) — and, after the consent-gate PR, only for visitors who accepted analytics. Read by admins only (`AdminAnalytics`). Evidence of size: an earlier read-only observation recorded 357 events / 287 sessions over 7 days (`VISIONEX_PHASE2_ASSESSMENT_AND_PLAN.md`); today's size was not re-read.

## The policy to approve
1. **Raw rows are kept 90 days (2,160 hours), then deleted.** Measured on `created_at`.
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
                          WHERE created_at < now() - interval '2160 hours'
                          ORDER BY created_at LIMIT 10000)$cron$
  );
END
$outer$;
```
- **Batched** (10,000 rows per run) so one run never holds a long lock; at the observed rate (~50 rows a day) a single run clears any backlog, and a very large backlog drains over several nights.
- `created_at` is indexed (`idx_page_events_created_at`), so the sub-select is an index scan.
- No function is added, so nothing new is callable through the API. `cron.schedule` upserts by job name, so re-applying the migration re-points the same job.
- **Rollback:** `SELECT cron.unschedule('page-events-retention')` stops it. Rows already deleted do not come back.

## Exactly which rows, and how the cutoff is calculated
- **Selected:** every `page_events` row whose `created_at` is strictly earlier than `now() - interval '2160 hours'`, evaluated when the job runs (03:25 UTC daily). Nothing else: no other column, table, user or event type is considered, and no row is selected by content.
- **Cutoff:** 2,160 *absolute hours* (90 × 24), not "90 calendar days". `created_at` is `timestamptz`, an absolute instant, so the comparison does not depend on any time zone. (`interval '90 days'` is calendar arithmetic and, in a DST zone, differs from 2,160 hours by one hour; the tested script prints that difference and asserts it, which is why the hours form is proposed.)
- **Boundary:** strict `<`. A row exactly on the cutoff instant is kept; one a minute older is deleted. A row dated in the future (clock skew) is kept.
- **Batching:** the oldest 10,000 matching rows per run (`ORDER BY created_at LIMIT 10000`), so a large backlog drains over several nights and no run holds a long lock.
- **Time zone of the job:** irrelevant to the result (shown above); the schedule itself is read by pg_cron in UTC.

## Does anything depend on historical events?
Searched `src`, `supabase/functions`, `scripts` and every migration:
- **Reader 1:** `supabase/functions/analytics-insights/index.ts:63` reads `page_events` for the **last 30 days** only (`gte("created_at", thirtyDaysAgo)`, limit 1000). Unaffected by a 90-day window.
- **Reader 2:** `src/pages/admin/AdminDatabase.tsx` lists the table in the generic admin table browser. It shows whatever rows exist.
- **Writer:** `src/components/PageTracker.tsx` (insert only).
- **Database objects:** no foreign key references it and no view or rule depends on it (asserted in the script). No trigger, function or cron job reads it.
- **Not found in code but possible:** any external export or manual query an owner runs; I cannot see those.
Conclusion: nothing in the repository needs data older than 30 days; a 90-day window keeps 3× what the only analytical reader uses.

## Dry run
**On synthetic data (done):** `scripts/sql/page-events-retention-scenarios.mjs` replays the migrations in PGlite, inserts 8 rows aged from "now" to 400 days (plus one a minute inside the line and one a minute past it), prints the report below, then runs the exact statement above. Result: 3 would be deleted and 3 were; the 5 younger rows and the future-dated row were kept; a second run deleted 0; no other table changed; the deleted set was identical under UTC, America/New_York and Pacific/Auckland; a 25,000-row backlog drained as 10,000 + 10,000 + 5,000 + 0; and changing the cutoff turns the test red. It also asserts that the SQL in this file is the SQL that was tested.

**On production (not done — I do not query production).** The read-only report for you, or any session you authorise, to run once before approving; it deletes nothing:
```sql
SELECT count(*)                      AS would_delete,
       min(created_at)               AS oldest,
       max(created_at)               AS newest_that_would_go,
       now() - interval '2160 hours' AS cutoff,
       (SELECT count(*) FROM public.page_events) AS table_total
  FROM public.page_events
 WHERE created_at < now() - interval '2160 hours';
```
Per event type and per month, if wanted: the same `WHERE` with `GROUP BY event_type` or `GROUP BY date_trunc('month', created_at)`. At the earlier observed rate (357 events in 7 days) I would expect about 4,600 rows in the last 90 days and few or none older, but that is an expectation, not a measurement.

## How it is tested
The script above (same method as #433), run in CI once it is wired to a workflow when you approve. Wiring it to CI and writing the migration are both left for your approval.

## What I need from you
1. Which option (A / B / C / D) and, for C, the number of days.
2. Explicit approval to add the migration. Merging it runs `supabase db push` and starts permanent deletion at the next 03:25 UTC.
3. Whether the privacy policy text should be updated in the same change (I have not reviewed or edited it).

## Not covered
Backups: if production backups hold older `page_events` rows, deleting from the live table does not remove them from a backup. Retention of backups is a separate setting I did not read.
