# `page_events` retention (365 days) — proposal and prepared migration (NOT approved, NOT applied)

Status: **draft for approval.** The migration `supabase/migrations/20261074000000_page_events_retention.sql` and its tests exist in this PR only so they can be reviewed and tested in isolation. **Merging this PR would deploy the migration and start permanent deletion at the next 03:25 UTC.** Do not merge until you have approved the policy below and the export step. No production data has been read or deleted by this work.

## The policy, defined once
**"365 days" means exactly 8,760 elapsed hours (365 × 24), not 365 calendar days.** A row is eligible when `created_at < now() - interval '8760 hours'`, evaluated when the job runs. `created_at` is `timestamptz` (an absolute instant), so the result does not depend on any time zone; calendar arithmetic (`interval '365 days'`) can move the cutoff by an hour when the window starts and ends in different daylight-saving states (the test prints and asserts that difference). A row exactly on the cutoff instant is kept (strict `<`). A row dated in the future is kept. The same definition is used in the migration, the tests and this file. (An earlier draft of this PR used 90 days / 2,160 hours; it was changed to 365 days at the owner's direction.)

## What is deleted
Only rows of `public.page_events` older than the cutoff. No other table, column, user or event type is read or changed, and nothing is selected by content. Each run deletes at most the **10,000 oldest** eligible rows.

## The exact command (also the migration's `cron.schedule` body)
```sql
SET LOCAL statement_timeout = '60s'; SET LOCAL lock_timeout = '5s';
DELETE FROM public.page_events
 WHERE id IN (SELECT id FROM public.page_events
               WHERE created_at < now() - interval '8760 hours'
               ORDER BY created_at LIMIT 10000)
```
Scheduled as job `page-events-retention`, `25 3 * * *` (03:25 UTC daily), modelled on #433 (`20261071000000_prune_cron_run_history.sql`). No function is added, so nothing new is callable through the API. A database without pg_cron prints a warning and does nothing. **Not executed anywhere in production.**

## Safety properties (each is asserted by `scripts/sql/page-events-retention-scenarios.mjs`)
- **Restricted to `page_events`:** the test checks every table name in the command.
- **Bounded:** one batch of 10,000, 60 s statement timeout, 5 s lock timeout. A 25,000-row backlog drains as 10,000 + 10,000 + 5,000 + 0 over successive runs.
- **Safe to retry / repeat:** a second run finds nothing older than the cutoff and deletes 0; re-applying the migration re-points the same job (`cron.schedule` upserts by name).
- **Atomic, so no partial runs:** the batch is one statement. The test injects a failure on one row of a 12,001-row backlog: nothing is deleted; after the cause is removed, the next runs finish (10,000, then 2,001, then 0).
- **Aggregate-only output:** no `RETURNING`; the only result is the command tag `DELETE n`, stored by pg_cron in `cron.job_run_details.return_message` with the run status. No path, title, session id or user data is logged. (`cron-run-history-prune` keeps those rows 7 days, or 30 for failures.)
- **Boundary, future timestamps, time zones:** exactly-on-cutoff kept; future row kept; the set of deleted rows is identical under UTC, America/New_York and Pacific/Auckland.
- **No dependants:** no foreign key references the table; no view or rule depends on it; `created_at` is indexed.
- **The SQL in this file is the SQL in the migration**, checked by the script.

## Does anything depend on historical events?
Searched `src`, `supabase/functions`, `scripts` and every migration:
- `supabase/functions/analytics-insights/index.ts:63` reads only the **last 30 days** (limit 1000).
- `src/pages/admin/AdminDatabase.tsx` lists the table in the generic admin table browser.
- `src/components/PageTracker.tsx` only inserts (and, since #464, only after analytics consent).
- No trigger, function or cron job reads it. Nothing in the repository needs data older than 30 days; 365 days keeps about twelve times what the only analytical reader uses. I cannot see external exports or manual owner queries.

## Dry run
**Synthetic (done, in the tests):** rows aged from "now" to 800 days, plus one a minute inside and one a minute past the line → report `would_delete = 3`; running the command deletes exactly those 3.

**Production dry run (MEASURED, read-only, 2026-10-20).** Environment: the one Supabase project in the account, `nnyxtaftwispowolajpl` (`visionexmanager's Project`, region eu-west-1, Postgres 17, created 2026-04-17, status ACTIVE_HEALTHY), which is the project the live site `visionex.app` calls (its REST host is `nnyxtaftwispowolajpl.supabase.co`). The only connection available was the Supabase connector's `execute_sql`, which is a general raw-SQL tool and is **not** read-only by itself, so the query was wrapped in `BEGIN READ ONLY; … COMMIT;` and returned `current_setting('transaction_read_only')` in the same row: the database itself refused any write inside that transaction, and it reported `on`. The statement was the aggregate below and nothing else; no row was selected, no data left the database except these six values.

| Value | Result |
|---|---|
| `transaction_read_only` (verification) | `on` |
| `would_delete` (rows older than 8,760 elapsed hours) | **0** |
| `oldest` | NULL (no eligible row) |
| `newest_that_would_go` | NULL (no eligible row) |
| `cutoff` | `2025-10-20 16:28:00.916304+00` |
| `table_total` | **7,970** |

Query executed at about 2026-10-20 16:28:00Z (the cutoff is the execution instant minus 8,760 hours); the tool did not report a duration. The result agrees with the independent fact that the project itself was created on 2026-04-17, 186 days earlier, so no row can be older than 365 days. **The job, if applied, would delete nothing until rows reach a year of age (earliest around 2027-04-17 for the oldest rows, depending on when collection began).**

To repeat it yourself (reads only, deletes nothing):
```sql
BEGIN READ ONLY;
SELECT current_setting('transaction_read_only') AS txn_read_only,
       count(*)                       AS would_delete,
       min(created_at)                AS oldest,
       max(created_at)                AS newest_that_would_go,
       now() - interval '8760 hours'  AS cutoff,
       (SELECT count(*) FROM public.page_events) AS table_total
  FROM public.page_events
 WHERE created_at < now() - interval '8760 hours';
COMMIT;
```

## Export and restore: what exists, what was proven
**A production export was NOT needed and was NOT made:** the dry run found 0 eligible rows, so there is nothing to export, and making an export of rows that will not be deleted would only create an unnecessary copy of production data. For the record, the mechanism that was available to this session was unsafe for exports anyway. `execute_sql` could return rows, but they would pass through this conversation's transcript, which is the "ordinary log" your instructions prohibit for production data; `pg_dump`/`psql` are not installed and no database credential is held here. So **no production export was made, and no production data is stored anywhere by this work.**

**Mechanisms you can use** (all need your access, none costs anything): (a) Supabase dashboard → SQL editor → run the `SELECT * … WHERE created_at < <cutoff>` query → *Export → CSV*; (b) `psql "<connection string>" -c "\copy (SELECT * FROM public.page_events WHERE created_at < now() - interval '8760 hours' ORDER BY id) TO 'page_events_eligible.csv' CSV HEADER"`; (c) `pg_dump --data-only --table=public.page_events` (dumps the whole table, not only eligible rows).

**Procedure rehearsed on synthetic data** (`scripts/sql/page-events-export-restore-rehearsal.mjs`, in CI; every row is generated, nothing is production): export the eligible rows to NDJSON + a manifest (row count, SHA-256 of the file, a logical MD5 computed in the database over every row ordered by id); rebuild the table's schema in a second, empty database from the source catalog; verify the file's SHA-256 against the manifest, load it, and compare count, logical checksum, id set, time range and null counts; show that a flipped byte, a missing row and a double load are each caught; then delete with the migration's own command and restore from the file, ending with a source identical to the original. The export file lives in a private temporary directory outside the repository and is removed at the end; only counts and checksums are printed. **This proves the procedure and the checks, not that a real production export exists or restores.**

**Retaining a real export securely** (when you make one): it holds page paths, titles, random per-tab session ids and timestamps, so treat it as personal-adjacent data: store it in a private, access-controlled location (not GitHub, not an issue/PR, not a shared drive), encrypt it at rest (for example `age` or `gpg --symmetric`), keep the SHA-256 and row count beside it, and set an expiry — an export kept forever defeats the purpose of retention. Whether you can retain it securely is your decision; I have not seen your storage.

## Failures and partial runs
| Situation | What happens | What to do |
|---|---|---|
| Statement fails or times out | The statement is atomic: **nothing is deleted** that night; `cron.job_run_details.status = 'failed'` with the error text | Fix the cause; the next night repeats the same work. Nothing to repair |
| Lock wait > 5 s | Fails with a lock timeout, deletes nothing | Same |
| Backlog > 10,000 | Drains over several nights | None; or run the command by hand in the SQL editor to speed it up |
| Job missing / pg_cron not installed | Warning in the migration output; nothing is pruned | Install pg_cron, re-apply |
| Policy was wrong (deleted too much) | Deleted rows are gone from the live table | **Stop the job first** with `SELECT cron.unschedule('page-events-retention');`, then restore from the export |
| `SET LOCAL` not applied by pg_cron | Only a warning is raised; the 10,000-row batch bound still holds, the two timeouts do not | **Unverified here** (PGlite has no pg_cron); check the first run's `return_message` and duration |

## Backups: evidence (2026-10-20) and consequence
| Question | Evidence | Status |
|---|---|---|
| Supabase plan | `get_organization` (account metadata, no database query), 2026-10-20: `plan: free`, `tier: tier_free`; same as the 2026-10-17 lookup in `VISIONEX_DISASTER_RECOVERY_REPORT.md` | **Verified** |
| Managed Supabase backups | Supabase documents scheduled backups for paid plans only; the dashboard *Database → Backups* page has **not been read** | **Not verified in this account** |
| A backup job in this repo | None: `.github/workflows` has no backup/dump/restore workflow | **Verified: none** |
| A restore ever tested on production | No runbook run, workflow, test or report records one | **Verified: no evidence** |
| Hetzner snapshots | Not queried | **Unknown** |

**Consequence.** On the evidence available there is **no usable backup of the production database**, and no restore has been tested on production. Rows deleted by the job would be **irrecoverable** unless a verified export was taken first. Today that has no effect, because **0 rows are eligible** and the job would delete nothing. The rule for later is unchanged: **before the first night on which the count becomes greater than 0** (re-run the query above), export the eligible rows to a private, encrypted file, check its row count and SHA-256, and reload it into a scratch database (the rehearsal script is the procedure). A cheap guard is to run the dry run again shortly before approving the merge, and to re-check it periodically afterwards.

## What I need from you
1. Confirm 365 days = 8,760 elapsed hours.
2. Decide whether to merge a job that currently deletes nothing, or to hold the migration until the count is above 0 (holding avoids a job whose behaviour in real pg_cron is unverified; merging early means the guard rails are in place before the first rows age out).
3. Either way, run the dry run again right before approving, and make a verified export if it is then above 0.
4. Explicit approval to merge. Until then this PR stays a draft and no deletion exists in production.

## Not covered
The privacy-policy wording (not reviewed or changed); the dashboard Backups page and Hetzner snapshots (not read); behaviour of `SET LOCAL` and `return_message` inside real pg_cron (not testable here).
