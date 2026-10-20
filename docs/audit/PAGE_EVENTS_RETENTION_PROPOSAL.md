# `page_events` retention — proposal and prepared migration (NOT approved, NOT applied)

Status: **draft for approval.** The migration `supabase/migrations/20261074000000_page_events_retention.sql` and its test exist in this PR only so they can be reviewed and tested in isolation. **Merging this PR would deploy the migration and start permanent deletion at the next 03:25 UTC.** Do not merge until you have approved the policy below. No production data has been read or deleted.

## The policy, defined once
**"90 days" means exactly 2,160 elapsed hours (90 × 24), not 90 calendar days.** A row is eligible when `created_at < now() - interval '2160 hours'`, evaluated when the job runs. `created_at` is `timestamptz` (an absolute instant), so the result does not depend on any time zone; calendar arithmetic (`interval '90 days'`) would move the cutoff by an hour across a daylight-saving change (the test prints and asserts that difference). A row exactly on the cutoff instant is kept (strict `<`). A row dated in the future is kept. The same definition is used in the migration, the tests and this file.

## What is deleted
Only rows of `public.page_events` older than the cutoff. No other table, column, user or event type is read or changed, and nothing is selected by content. Each run deletes at most the **10,000 oldest** eligible rows.

## The exact command (also the migration's `cron.schedule` body)
```sql
SET LOCAL statement_timeout = '60s'; SET LOCAL lock_timeout = '5s';
DELETE FROM public.page_events
 WHERE id IN (SELECT id FROM public.page_events
               WHERE created_at < now() - interval '2160 hours'
               ORDER BY created_at LIMIT 10000)
```
Scheduled as job `page-events-retention`, `25 3 * * *` (03:25 UTC daily), modelled on #433 (`20261071000000_prune_cron_run_history.sql`). No function is added, so nothing new is callable through the API. A database without pg_cron prints a warning and does nothing.

## Safety properties (each is asserted by `scripts/sql/page-events-retention-scenarios.mjs`)
- **Restricted to `page_events`:** the test checks every table name in the command.
- **Bounded:** one batch of 10,000, 60 s statement timeout, 5 s lock timeout. A 25,000-row backlog drains as 10,000 + 10,000 + 5,000 + 0 over successive runs.
- **Safe to retry / repeat:** a second run finds nothing older than the cutoff and deletes 0; re-applying the migration re-points the same job (`cron.schedule` upserts by name).
- **Atomic, so no partial runs:** the batch is one statement. The test injects a failure on one row of a 12,001-row backlog: nothing is deleted; after the cause is removed, the next runs finish (10,000, then 2,001, then 0).
- **Aggregate-only output:** the command has no `RETURNING`; the only result is the command tag `DELETE n`, which pg_cron stores in `cron.job_run_details.return_message` with the run status. No path, title, session id or user data is logged. (`cron-run-history-prune` keeps those rows 7 days, or 30 for failures.)
- **Boundary, future timestamps, time zones:** exactly-on-cutoff kept; future row kept; the set of deleted rows is identical under UTC, America/New_York and Pacific/Auckland.
- **No dependants:** no foreign key references the table; no view or rule depends on it; `created_at` is indexed.
- **The SQL in this file is the SQL in the migration**, checked by the script.

## Does anything depend on historical events?
Searched `src`, `supabase/functions`, `scripts` and every migration:
- `supabase/functions/analytics-insights/index.ts:63` reads only the **last 30 days** (limit 1000).
- `src/pages/admin/AdminDatabase.tsx` lists the table in the generic admin table browser.
- `src/components/PageTracker.tsx` only inserts (and, since #464, only after analytics consent).
- No trigger, function or cron job reads it. Nothing in the repository needs data older than 30 days; 90 days keeps three times what the only analytical reader uses. I cannot see external exports or manual owner queries.

## Dry run
**Synthetic (done, in the test):** 8 rows aged from "now" to 400 days → report `would_delete = 3`; running the command deletes exactly those 3.
**Production (not done — I do not query production).** Read-only; deletes nothing; run once before approving:
```sql
SELECT count(*)                      AS would_delete,
       min(created_at)               AS oldest,
       max(created_at)               AS newest_that_would_go,
       now() - interval '2160 hours' AS cutoff,
       (SELECT count(*) FROM public.page_events) AS table_total
  FROM public.page_events
 WHERE created_at < now() - interval '2160 hours';
```
(`GROUP BY event_type` or `GROUP BY date_trunc('month', created_at)` for a breakdown.) The earlier observation of 357 events in 7 days suggests a few thousand rows in the window and few or none older — an expectation, not a measurement.

## Failures and partial runs
| Situation | What happens | What to do |
|---|---|---|
| Statement fails or times out | The statement is atomic: **nothing is deleted** that night; `cron.job_run_details.status = 'failed'` with the error text | Fix the cause; the next night repeats the same work. Nothing to repair |
| Lock wait > 5 s | Fails with a lock timeout, deletes nothing | Same |
| Backlog > 10,000 | Drains over several nights | None; or run the `cron.schedule` command by hand in the SQL editor to speed it up |
| Job missing / pg_cron not installed | Warning in the migration output; nothing is pruned | Install pg_cron, re-apply |
| Policy was wrong (deleted too much) | Deleted rows are gone from the live table | See recovery; **stop the job first** with `SELECT cron.unschedule('page-events-retention');` |
| `SET LOCAL` not applied by pg_cron | Only a warning is raised; the 10,000-row batch bound still holds, the two timeouts do not | **Unverified here** (PGlite has no pg_cron); check the first run's `return_message` and duration |

## What backups actually exist (evidence, 2026-10-20) — and what that means
| Question | Evidence | Status |
|---|---|---|
| Supabase plan | `get_organization` (account metadata, no database query), 2026-10-20: `plan: free`, `tier: tier_free`. Same as the 2026-10-17 lookup in `VISIONEX_DISASTER_RECOVERY_REPORT.md` | **Verified** |
| Managed Supabase backups | Supabase documents scheduled backups for paid plans only; the dashboard page *Database → Backups* is the authority and has **not been read** | **Not verified in this account** (documentation says none on Free) |
| A backup job in this repo | None: `.github/workflows` has no backup/dump/restore workflow (listed 2026-10-20); the DR report grep found only the unrelated ISP-service script | **Verified: none** |
| A restore ever tested | No runbook run, workflow, test or report records one (DR report, still true) | **Verified: no evidence** |
| Hetzner snapshots | Not queried | **Unknown** |

**Consequence.** On the evidence available, there is **no usable backup of the production database**, and no restore has ever been demonstrated. Rows deleted by the job would be **irrecoverable**: every `page_events` row older than the cutoff (path, title, random session id, event type, timestamp, any `metadata`, optional user id) would be gone with no way back except an export taken *before* the first run. Nothing else is touched. Which rows those are is not known: the production count has not been read.

**How rows could be restored.** Only from (a) an export made before deletion (re-insert with `INSERT … SELECT` / `COPY` into `public.page_events` — safe because the table has no foreign keys and ids are uuids), or (b) a platform backup if one turns out to exist: restore it into a *scratch* project and copy the rows back, because a whole-project restore would also roll back every other table. A synthetic restore (what the DR report calls a "drill") proves the procedure but is not proof that a particular backup is restorable.

**Recommendation: a verified export should precede any retention job.** Concretely: (1) owner runs the dry-run query below and records the count; (2) exports the eligible rows to a private file (CSV from the SQL editor, or `pg_dump --data-only --table public.page_events` limited by the same `WHERE` via `COPY (SELECT … ) TO`); (3) verifies the export by comparing the row count and re-loading it into a scratch database; (4) only then approves the migration. A shorter route that costs nothing is to start with a longer window (for example 365 days) so the first runs delete little or nothing.

## Backup and recovery options (deleting is permanent in the live table)
Options, none of which exists today (see the evidence above):
1. **Before enabling:** the owner can export the eligible rows (the dry-run `WHERE`, as CSV from the SQL editor or `pg_dump --table public.page_events`) and keep the file somewhere private. These rows hold page paths, titles and a random per-tab session id, so the file is personal-adjacent data and should be treated and expired accordingly.
2. **Platform backups (not available on the Free plan per Supabase documentation; paid plan = recurring cost, not chosen here):** if a plan includes daily backups or point-in-time recovery, deleted rows remain in backups until that backup's own retention expires. Restoring one table selectively is not supported by a whole-project restore; it would mean restoring into a scratch project and copying rows back. Deletion from the live table does **not** remove rows from older backups, which matters if the aim is erasure.
3. **Keep aggregates:** if long-term trends matter, a daily aggregate table (`day, page_path, event_type, views, sessions`) written before the delete would preserve them without raw rows. Not built; it adds a table and a writer, so it is a separate decision.
4. **Phase in:** start with a longer window (for example 365 days) and shorten later, which makes a mistake cheaper.

## What I need from you
1. Confirm the definition (2,160 elapsed hours) and the period (90 days, or another).
2. Whether you want options 1 or 3 above first.
3. Explicit approval to merge. Until then this PR stays a draft and no deletion exists in production.

## Not covered
The privacy-policy wording (not reviewed or changed); the dashboard Backups page and Hetzner snapshots (not read); the production `page_events` count (**unknown**: no approved read-only database access was used, no SQL was run against production); behaviour of `SET LOCAL` and `return_message` inside real pg_cron (not testable here).
