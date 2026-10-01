# Deployment

**Current state: not deployed.** Nothing has been installed, started, opened or changed on the Hetzner
server, DNS, the firewall, PI, RADIUS, or any VisionEX service. This document is the procedure, written
for the layout the scripts assume. Steps marked ▢ are unperformed.

## What is still required from the owner

| # | Item | Why it blocks |
| --- | --- | --- |
| 1 | Hostname for the admin console (proposal: `isp-admin.<your-domain>`) and the DNS provider | A DNS record and TLS certificate are needed; not created automatically |
| 2 | Private link Hetzner ↔ the PI network (WireGuard / Tailscale / Cloudflare Tunnel) | the PI portal's DNS name resolves to a private address; Hetzner cannot reach it otherwise |
| 3 | A **dedicated read-only PI account** → `PI_USERNAME`, `PI_PASSWORD` (and `PI_TOTP_SECRET` if it has 2FA) | No credential was available; never paste into chat or Git |
| 4 | Admin source IPs for the nginx allow-list and SSH rule | Admin UI must not be public |
| 5 | WhatsApp: access token, phone-number id, app secret, and a decision: direct webhook vs relay from the existing public webhook | Needed to send replies and verify Meta signatures |
| 6 | Captured PI action payloads (for suspend/resume) from a test account | Writes are disabled until then; see `RADIUS.md` |
| 7 | SSH access to the server for whoever runs the deploy | This session has no server credentials |

## Server facts (measured 2026-10-01 by the repository's read-only `server-probe` workflow)

Ubuntu 24.04.4 LTS, 4 vCPU (AMD EPYC-Milan), 15 GiB RAM (14 GiB available, no swap), 150 GB disk (137 GB free),
load ≈ 0. Docker 29.7.2 and Compose v5.5.0 installed and usable; 1 container running (the media processor);
nginx, node, npm and git present; 8 listening sockets. Hence the Docker Compose layout below. Not measured:
firewall rules, existing nginx server names, DNS provider — the probe deliberately prints counts only.

Server access exists only as GitHub Actions secrets, so this session could not log in; a human (or a
reviewed, manually-dispatched workflow) must run the steps.

## CI access path for the PI check
The `isp-pi-check` workflow uses its own restricted SSH key, never the administrator key: see `deploy/ci-pi-check/README.md` (forced command, two-line sudoers rule, hash-pinned bundle, dry-run installer, uninstaller). Not installed until approved.

## Server layout

```
/opt/visionex-isp/
  app/            git checkout of this repository (read-only deploy key)
  config/nginx-allow.conf   `allow <ip>;` lines + `deny all;`
  backups/        mode 0700
  logs/           (docker json-file rotation handles container logs)
/etc/visionex-isp/            # root:root 0700 — outside any Git directory
  isp.env                     # 0600, all variables from .env.example
  db_owner_password, db_app_password   # 0400
```

## First-time setup ▢

1. Create `/etc/visionex-isp/*` (strong random DB passwords; `ISP_ENCRYPTION_KEY` and `ISP_SESSION_PEPPER`
   = `openssl rand -base64 32`). `ISP_ENV=production`, `ISP_PUBLIC_ORIGIN=https://<host>`.
   Set `DATABASE_URL` to the **`isp_app`** role and `DATABASE_URL_OWNER` to `isp_owner` (host `db`).
2. Keep every `ENABLE_*` flag `false`.
3. `deploy/scripts/firewall.sh` (dry run first) — only 22 (admin IPs), 80, 443. Mirror it in the Hetzner
   Cloud Firewall.
4. nginx: copy `deploy/nginx/isp-admin.conf`, replace `ISP_ADMIN_HOST`, obtain a certificate with certbot
   (auto-renew timer), `nginx -t`, reload. This adds a new server block; it does not edit the visionex.app sites.
5. `deploy/scripts/deploy.sh <commit-sha>` (CI-green commit).
6. Create the first admin: `ISP_BOOTSTRAP_PASSWORD=… docker compose … run --rm api node dist/admin-cli.js <name>`
   then sign in and enrol MFA immediately.
7. Install `deploy/systemd/isp-backup.*`, enable the timer, run `backup.sh` and `restore.sh <file>` once.

## Enabling capabilities (only after the checks below)

1. Read-only first: verify customer search/profile/RADIUS status against real data.
2. Run `npm run pi:probe`, update `mapper.ts` if shapes differ, add a test with the real shape.
3. Capture a suspend/resume request from the PI UI **on a test account**, write `PI_ACTIONS_FILE`.
4. Enable `ENABLE_RADIUS_WRITE` + `ENABLE_CUSTOMER_SUSPENSION` + `ENABLE_CUSTOMER_ACTIVATION`, test on the
   test account only, confirm the audit trail and read-back.
5. Only then `ENABLE_WHATSAPP_WRITE`.

## Rollback ▢
`deploy/scripts/rollback.sh` (previous image, `deploy.sh` calls it automatically if the health check fails).
Migrations are additive and are not reversed; recover data with `restore.sh`.

## Pre-production checklist (state today)

- [x] tests pass (113) · [x] typecheck · [x] build · [x] migrations apply (PGlite)
- [x] no secrets in the repository or the frontend bundle (CI step greps the build output)
- [ ] secrets configured · [ ] firewall · [ ] HTTPS · [ ] backup + restore tested on the server
- [ ] RADIUS read-only tested against PI · [ ] write tested on a safe account
- [ ] WhatsApp admin verified with real numbers · [ ] unauthorised sender tested live · [ ] kill switch tested live
