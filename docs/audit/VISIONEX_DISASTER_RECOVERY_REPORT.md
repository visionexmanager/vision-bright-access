# Visionex — disaster recovery report

Date: 2026-10-17 · Assessment only: no backup was created, no restore run, no plan or setting changed.
Labels: **[V]** verified in this repo or by a read-only production query on 2026-10-17 (aggregates only — no user records were read) · **[D]** stated by Supabase/Hetzner public documentation, *not* verified against this account · **[I]** inference · **[R]** recommendation / proposed target.

## 1. Conclusion

**Production has no verified backup of its database or its uploaded files.** [V]+[I] The Supabase organisation is on the Free plan; the repository contains no job that exports the database; the existing recovery document describes paid-tier backups that this plan does not appear to include. Treat the data as having a single copy until a backup has been produced *and restored once*.

What *is* recoverable from git today: the schema, functions and policies (343 files in `supabase/migrations/`), the Edge Function source (`supabase/functions/`), the SPA, workflows and infrastructure config. What is **not**: any row of data, any uploaded file, auth users/password hashes, and every secret value.

## 2. Evidence

| Question | Finding | Evidence |
|---|---|---|
| Supabase plan | Free | [V] Supabase organisation lookup via the project connector → `plan: free`, `tier_free`. Consistent with HTTP 402 "Pro Plans and up" from the Management API (workflow run 39052467400) |
| Managed backups on this plan | None expected | [D] Supabase documents scheduled backups for paid plans only. **Not verified in this account** — the dashboard page *Database → Backups* shows the truth and takes one minute (see §7) |
| Repo backup job for the main database | **None** | [V] `grep -rIl "pg_dump\|supabase db dump\|db dump"` over `.github scripts infra infrastructure server services` returns only `services/isp-management/deploy/scripts/backup.sh` (a different, isolated service) |
| Existing DR document | Out of date for this plan | [V] `infrastructure/DISASTER_RECOVERY.md`: "Handled by Supabase… daily automated backups on every paid project tier… verify the project's plan has PITR enabled". It never records which plan, never a backup time, never a restore test. Also assumes Career Center buckets only |
| Scheduled backups elsewhere | None found | [V] workflows list (`ls .github/workflows`) has no backup/dump workflow. `data-hub-storage.yml` + `scripts/datahub/datahub.sh` manage downloadable *datasets* on the Hetzner persistent disk, not database backups |
| Hetzner-level snapshots/backups | **Unknown** | Not queried (no Hetzner API access used). Hetzner offers server backups/snapshots as optional features [D]; whether enabled is visible only in the Hetzner Console |
| Data size | Small | [V] database 134 MB; storage 15 objects / 28 MB in 35 buckets (24 public). 58 MB of the database is `cron.job_run_details` (pg_cron history, see §6) |
| Users | 20 auth users | [V] count only |
| Restore ever tested | **No evidence** | [V] no runbook, workflow, test or report records a restore |
| Secrets recoverable from backups | No | [V] 41 GitHub Actions secrets (names only listed); Supabase function secrets are held separately. Neither can be exported from the repo — losing the accounts means re-issuing every provider key |

### What each backup would need to cover
| Asset | In git? | Needs backup? | Note |
|---|---|---|---|
| Schema, RLS, functions, cron definitions | Yes (migrations) | Re-creatable | Replaying 343 migrations onto a new project is itself untested end-to-end on the real platform |
| Table data, `auth.users` (incl. password hashes) | No | **Yes** | Contains personal data → encryption mandatory |
| Storage objects | No | **Yes** (28 MB) | [D] Supabase database backups do not include Storage object files, only their metadata |
| Auth configuration (providers, redirect URLs, templates, rate limits) | No | Export + document | Readable through the Management API |
| Edge Function secrets, GitHub secrets, provider keys | No | Offline inventory (names + where to re-issue), never values in the repo | |
| Hetzner server config (nginx, Docker volumes, Data Hub) | Partly (`infra/`, `services/*`) | Snapshot or documented rebuild | Not verified |
| Domain/DNS, Meta/WhatsApp app, Stripe/PayPal accounts | No | Document ownership & recovery contacts | Account-level, owner only |

## 3. Questions from the brief that cannot be answered yet
- *Where is each backup stored / encrypted / who can access it / most recent verifiable backup time / retention?* — **No backup exists to answer for.** Nothing to verify.
- *Could backups be lost if the production server or primary account were compromised?* — Today the question is moot (single copy). For the proposals below the answer is given per option.
- *Which recovery steps require a paid plan?* — see option 3.

## 4. Options

Proposed targets below are **[R]** and unvalidated; they become real only after a successful restore drill.

### Option 1 — no new cost (existing GitHub, Hetzner disk, owner's PC)
- **Mechanism:** a scheduled GitHub Actions workflow runs `pg_dump` (schema + data, including `auth`, via the Supabase connection pooler using the existing `SUPABASE_DB_PASSWORD` secret) and a Storage export through the API with the existing service-role secret; compresses; encrypts with `age` to a **public key** kept in the repo (the private key stays with you, offline); copies the ciphertext by SSH to a dedicated directory on the Hetzner persistent disk (same pattern as Data Hub); you pull a second copy to your own machine with a scheduled task.
- **Never** upload the dump as a GitHub Actions artifact: the repo is public, artifacts of public repos are retrievable by anyone with a GitHub login.
- **Protects against:** accidental deletion/corruption, a bad migration, Supabase project loss *if* the owner's copy survives, a Hetzner loss *if* the owner's copy survives.
- **Does not protect against:** loss of both your PC and the server at once; compromise of the encryption key; silent dump failure unless the workflow checks (see checklist); Supabase restoring itself for you.
- **RPO [R]:** ≤ 24 h (daily). **RTO [R]:** 2–4 h to a *new* Supabase project plus re-pointing URL/keys (unvalidated).
- **Storage/retention [R]:** ≈ 0.2 GB per day uncompressed → 14 daily + 8 weekly ≈ 4–5 GB. Disk space on the server is not verified (the Data Hub budget is 100 GB logical).
- **Access control:** workflow secrets only; SSH key scoped to a write-only `backups` directory; encryption private key never on server or GitHub.
- **Complexity / failure modes:** direct DB host may be IPv6-only from GitHub runners (use the pooler); `pg_dump` major version must be ≥ the server's (Postgres 17 here); the Supabase-managed schemas (`auth`, `storage`) restore with permission quirks; extensions (`vector`, `pg_cron`, `pg_trgm`) must exist in the target; a 6-hour GitHub schedule slip is normal; the SSH host key must be pinned.
- **Safe test:** CI drill on a *synthetic* database (apply all migrations to a clean Postgres 17 container, dump, encrypt with a throwaway test key, decrypt, restore, compare table counts and a checksum of a synthetic table) — no real data leaves production. A real-data drill is run by you offline into a scratch database (never into production).
- **Cost:** $0 new. **Approval needed** to add the workflow, to give it the SSH key and DB password, and for the first real run.

### Option 2 — low-cost independent copy
Option 1's dump, additionally sent to an object store or box that is independent of both GitHub and Hetzner.
- **Candidates [D, verify pricing before choosing]:** an S3-compatible bucket with a free allowance (Backblaze B2, Cloudflare R2) — at roughly 2–5 GB this would likely sit inside a free allowance or cost cents a month; or a Hetzner Storage Box at a few euros a month.
- **Protects against:** everything in Option 1 *without* depending on your PC; a compromised server cannot delete it if the key is write-only/versioned (enable object lock/versioning).
- **Does not protect against:** key loss; vendor account compromise (use a dedicated account, MFA).
- **RPO/RTO [R]:** as Option 1 (≤ 24 h / 2–4 h).
- **Cost:** a new vendor account and a possible recurring charge ($0 to a few $/€ per month). **Requires your explicit approval.**

### Option 3 — managed (Supabase Pro)
- **Mechanism:** upgrade the organisation to Pro. [D] daily backups with a short retention window; point-in-time recovery is a separate paid add-on. Pro also unlocks Supabase's server-side leaked-password protection (the 402 we hit) and removes free-plan limits [D].
- **Protects against:** database-level loss without any code of ours.
- **Does not protect against:** Supabase account closure/compromise; Storage object files [D]; secrets; mistakes made *before* the retention window; and it is not a restore *test*.
- **RPO/RTO [D/R]:** per Supabase documentation (daily; PITR finer) — **unvalidated for this project**.
- **Cost:** a recurring monthly charge (list price about $25 per month for Pro at last check, PITR extra — **verify at supabase.com/pricing**). **Requires your explicit approval; I will not change billing.**

### Recommendation [R]
Do Option 1 now (zero cost), decide on Option 2 or 3 afterwards. Option 3 is the only one that fixes the password-protection gap, so the two decisions are linked. If you choose Option 3, still keep one independent copy (Option 1) — it covers Storage and account-loss.

## 5. Runbook and checklist
- Procedure: `docs/audit/VISIONEX_BACKUP_RESTORE_RUNBOOK.md`
- Verification: `docs/audit/VISIONEX_BACKUP_VERIFICATION_CHECKLIST.md`

## 6. Related free-plan finding
`cron.job_run_details` holds 58 MB of the 134 MB database [V] and grows with the 17 active `pg_cron` jobs (e.g. two jobs every 5 minutes: `library-event-reminders`, `reap-stale-content-publications`). Free plans have a database size cap [D — check the current figure in the dashboard]. No job prunes this table [V: no `cron.job_run_details` deletion in the 17 `cron.job` rows or migrations reviewed]. Proposed: a daily pruning job keeping 7 days (task T-A10); not applied.

## 7. Steps that need your approval or your hands
1. **Look (1 minute, no cost):** Supabase Dashboard → Project → Database → Backups; and Hetzner Console → the server → Backups/Snapshots. Tell me what each shows; I will record it here.
2. Approve building the Option 1 workflow (touches `.github/workflows/`, needs the existing `SUPABASE_DB_PASSWORD` and an SSH key scoped to a backup directory).
3. Generate the `age` key pair yourself (instructions in the runbook); give me only the **public** key.
4. Choose Option 2 / Option 3 or neither (cost decision).
5. Approve the first real backup run and, separately, a restore drill into a *scratch* database.
6. Name a second person/location that can recover the encryption key and account access.
7. Optional: approve a read-only "backup status" probe workflow (Management API `GET …/database/backups`) so status is verifiable from CI.
