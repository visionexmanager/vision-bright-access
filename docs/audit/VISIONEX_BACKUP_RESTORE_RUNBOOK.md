# Backup and restore runbook (proposed — nothing here has been run)

Status: **design for Option 1 in `VISIONEX_DISASTER_RECOVERY_REPORT.md`.** Every step marked ⚠ needs the owner's approval and has not been executed. Until the first successful restore drill (checklist C5), treat this as untested.

## Principles
1. A backup that has not been restored does not exist.
2. Backups hold personal data: encrypted before they leave the runner; the decryption key is never on GitHub or the server.
3. Never print row contents, connection strings or keys in a workflow log (the repository and its logs are public).
4. Never restore into production as an experiment. Restore into a *new* project or a scratch database.

## A. One-time setup ⚠
1. Owner generates an `age` key pair on their own machine: `age-keygen -o visionex-backup.key`. Store the private key offline in two places (password manager + offline copy); give the repository only the **public** key (a line starting `age1…`).
2. Create a restricted SSH user on the server whose only permission is writing to `/var/lib/visionex/backups` (no shell, no read of other paths). Pin the server host key in the workflow.
3. Store as GitHub secrets (never in files): backup SSH key. Reuse the existing `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`, `SUPABASE_SERVICE_ROLE_KEY`. Store the `age` public key as a repository *variable*.
4. Owner sets up a scheduled pull of the encrypted files to their own machine (second independent copy).

## B. Nightly backup job (to be built)
1. Install a `postgresql-client` whose major version ≥ the server (17).
2. Dump through the connection pooler (the direct host may be IPv6-only): schema + data of `public`, `auth`, and Storage metadata; roles are not restorable on Supabase and are excluded.
3. Export Storage objects through the Storage API (28 MB at last count) into a tar.
4. Write `manifest.json`: timestamp, git SHA, Postgres version, per-table row counts, file sizes, SHA-256 of each file. No row data.
5. `tar | age -r <public key>` → `visionex-YYYYMMDD-HHMM.tar.age`.
6. Copy over SSH to the backup directory; verify size and SHA-256 on the far side.
7. Prune: keep 14 daily + 8 weekly.
8. Fail the job (red run → owner email) if any step fails, if the dump is smaller than 50% of the previous one, or if the manifest row counts drop sharply.
9. Log only: file size, duration, table count, SHA-256, "ok".

## C. Restore (to a NEW target, never production)
1. Create a new empty Supabase project (or a scratch Postgres 17 with the `vector`, `pg_trgm`, `pgcrypto` extensions; `pg_cron` only if testing cron).
2. Decrypt on your own machine: `age -d -i visionex-backup.key file.tar.age | tar x`.
3. Apply schema (the dump, or `supabase db push` from the repo at the git SHA recorded in the manifest), then load data; restore Storage objects through the Storage API.
4. Compare table counts with `manifest.json`; run the application's read-only checks (migrations table state, a sample of RLS probes with the test accounts, never real users).
5. For a real disaster: update the SPA's `VITE_SUPABASE_URL` / publishable key on the server build, rotate the service-role key, redeploy Edge Functions (`Deploy` workflow with `functions`), re-register webhooks (Meta, Stripe, PayPal, Coinbase) to the new function URLs, and re-set Edge Function secrets from the owner's offline inventory.
6. Record actual time taken (that measurement is the real RTO) in the DR report.

## D. Secrets inventory (owner, offline)
List — **names and where to re-issue, never values** — of every secret: the 41 GitHub secrets (`gh secret list`), Supabase function secrets, provider dashboards (OpenAI, Gemini, Groq, Mistral, Meta/WhatsApp, Stripe, PayPal, Coinbase, ElevenLabs, LiveKit). Keep it with the age key backups.

## E. Incident decisions
- Suspected compromise: do not restore over production; rotate keys first, preserve evidence, restore into a new project.
- Accidental deletion: restore the affected table(s) into a scratch DB, export only those rows, apply deliberately.

## F. Synthetic rehearsal — run 2026-10-19 (in memory, no production contact)
`node scripts/dr/synthetic-restore-rehearsal.mjs` (needs `npm i --no-save @electric-sql/pglite @electric-sql/pglite-tools`).

| Step | Result | Measured |
|---|---|---|
| Replay migrations into a source database | 285 applied, 61 skipped (pg_cron / pgvector / realtime and dependents) | ~5 s |
| Insert invented users, points, wallets, subscriptions | 2 users, 3 point rows, 2 wallets, 2 plans | — |
| Data-only dump of those tables plus `auth.users` | 2.4 kB | 0.3 s |
| Encrypt (AES-256-GCM, throwaway key) and decrypt | identical to the original | — |
| Flip one ciphertext byte | rejected on decrypt | — |
| Restore into a second database built from the same migrations | ok; per-table counts, content hashes, RLS / policy / function counts identical | ~6 s |
| Known-bad control (delete one restored row) | fingerprints differ, run fails | — |

**What this does and does not show.** It shows the *procedure* in section C (schema from migrations, data loaded afterwards, fingerprint compared against the source) is sound and that the comparison can fail. It does not show that `pg_dump` through the Supabase pooler, the Storage export, or the restore of real `auth.users` columns work, and it is not a recovery time for production. A whole-schema `pg_dump` of the 445 replayed tables did not finish in PGlite within 280 s, so only data is dumped; do not read that as a statement about Postgres 17.

**Objectives (targets, not measurements).** RPO ≤ 24 h and RTO 2–4 h are Option 1 targets from the DR report. Assumptions: a daily job exists (it does not today), the owner holds the private key, a new Supabase project can be created (free plan project limit: verify), the 41 secrets can be re-issued from their providers. The first real number is the time of the first real drill into a scratch project.

**Needs the owner:** the `age` key pair, the backup SSH user, creating a scratch Supabase project, any plan change, and the first real backup run. Nothing in this section was done on production.
