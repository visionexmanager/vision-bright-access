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

**Production count (NOT obtained — blocker).** The only database connection available to this session is the Supabase connector's `execute_sql`, a general raw-SQL tool that sits beside write tools (`apply_migration`, `deploy_edge_function`, …). It is not a read-only connection, and no read-only credential, `psql` or `pg_dump` is present on this machine. Your instruction was to query only over a clearly read-only connection, so **I ran no SQL against production and the number of `page_events` rows older than 365 days is unknown.** The `page_events` table is also read-protected for the public key (admins only), so it could not be counted from outside either. To obtain it, run this once yourself in the Supabase SQL editor (it reads only and deletes nothing):
```sql
SELECT count(*)                       AS would_delete,
       min(created_at)                AS oldest,
       max(created_at)                AS newest_that_would_go,
       now() - interval '8760 hours'  AS cutoff,
       (SELECT count(*) FROM public.page_events) AS table_total
  FROM public.page_events
 WHERE created_at < now() - interval '8760 hours';
```
**The answer is probably 0, but that is an inference, not a measurement.** The migration that creates `page_events` is dated 2026-03-31 (`20260331114241_…sql`), about 203 days before 2026-10-20, and a row cannot be older than its table. If production applied that migration near its date (not verified: the table could have been created earlier by another route), nothing is older than 365 days, the job would delete nothing until rows reach a year of age (around 2027-03-31), and no export would be needed first.

## Export and restore: what exists, what was proven
**Real export mechanism available to this session: none that is safe.** `execute_sql` could return rows, but they would pass through this conversation's transcript, which is the "ordinary log" your instructions prohibit for production data; `pg_dump`/`psql` are not installed and no database credential is held here. So **no production export was made, and no production data is stored anywhere by this work.**

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

**Consequence.** On the evidence available there is **no usable backup of the production database**. Rows deleted by the job would be **irrecoverable** unless a verified export was taken first. The recommendation therefore stands: **a verified export must precede any retention job** — (1) run the count query above and record it; (2) if it is greater than 0, export the eligible rows to a private, encrypted file; (3) check the row count and SHA-256, and reload the file into a scratch database (the rehearsal script is the procedure); (4) only then approve the migration. If the count is 0, no export is needed and the first runs will delete nothing.

## What I need from you
1. Run the count query (or authorise a genuinely read-only credential), and tell me the number.
2. Confirm 365 days = 8,760 elapsed hours.
3. If the count is above 0: make and verify the export as above.
4. Explicit approval to merge. Until then this PR stays a draft and no deletion exists in production.

## Not covered
The privacy-policy wording (not reviewed or changed); the dashboard Backups page and Hetzner snapshots (not read); the production `page_events` count (**unknown**); behaviour of `SET LOCAL` and `return_message` inside real pg_cron (not testable here).
