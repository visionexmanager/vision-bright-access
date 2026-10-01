# Backup and restore

**Status:** scripts written and shell-syntax-checked. **Not executed**: this machine has no Docker or
PostgreSQL client and no server access, so `pg_dump`/`pg_restore` have not run. The schema itself was applied
and exercised on real PostgreSQL semantics (PGlite). Treat the first server run as the restore test (below).

## What is backed up
`deploy/scripts/backup.sh` → `pg_dump -Fc` of the `isp` database to `/opt/visionex-isp/backups/` (mode 0700,
files 0600) with a `.sha256`. Encrypted with `age` when `BACKUP_AGE_RECIPIENT` is set (recommended — the dump
holds cached customer contact data). TOTP seeds in the dump are ciphertext.

**Not in the backup, by design:** `/etc/visionex-isp/isp.env`, the DB password files, `ISP_ENCRYPTION_KEY`,
the PI credentials. Keep them in your password manager. **Losing `ISP_ENCRYPTION_KEY` makes every stored
TOTP seed unreadable** (admins re-enrol; the data is otherwise fine).

## Schedule and retention
`isp-backup.timer` nightly 02:30. 14 daily and 8 weekly copies; a pre-deploy backup is taken by `deploy.sh`.
Copy backups off the host (Hetzner Storage Box / another region) — a backup on the same disk is not a backup.

## Test the restore (do this once after the first deploy, then quarterly)
```bash
deploy/scripts/restore.sh /opt/visionex-isp/backups/<file>        # scratch database, verifies, drops it
```
Pass criteria: ≥10 tables, audit row count matches production, admin users present.

## Disaster recovery
1. New host: repeat first-time setup (`DEPLOYMENT.md`), restore secrets from the password manager.
2. `docker compose … up -d db`, then:
   `deploy/scripts/restore.sh <dump> --into-production` (stops api/worker, asks you to type `RESTORE`,
   re-applies grants, restarts, health-checks).
3. Run `GET /api/audit/verify` — the hash chain must report intact.
4. Point nginx/DNS at the new host; re-run the pre-production checklist.
