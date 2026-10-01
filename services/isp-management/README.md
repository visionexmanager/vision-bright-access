# VisionEX ISP Management

An isolated, internal management layer around the existing **PI / Proradius** customer portal
(the owner's ISP portal). It gives authorised admins a web console and a WhatsApp admin channel to look
up customers, check RADIUS/session state, and — behind confirmation, audit and kill switches —
suspend, resume or activate service.

**It is not a VisionEX product feature.** It shares no database, no code path and no UI with the
public site, and the public WhatsApp assistant has no route into it.

## Status (read this first)

| Area | State |
| --- | --- |
| Service code, schema, RBAC, audit chain, WhatsApp admin, kill switch, admin UI | **Built and tested locally** (113 automated tests, in-process PostgreSQL) |
| PI read adapter | Built against the **API paths the PI web app itself calls**. Response shapes were never observed (no credentials during discovery), so field mapping is tolerant and fails safe to `UNKNOWN`. Run `npm run pi:probe` with a read-only account to replace the guesses with facts. |
| PI write operations | **Not implemented on purpose.** PI's bulk-action payloads were never observed. Writes are driven by a captured template file; with none, every write reports "not available". |
| Deployed to Hetzner | **No.** Needs inputs only the owner can give — see `docs/DEPLOYMENT.md`, "What is still required". |
| WhatsApp verified end to end | **No.** Needs Meta credentials and the relay hookup. Signature, replay, enrolment, unlock and the full button flow are tested with a recording sender. |

## Layout

```
services/isp-management/
  src/            API, worker, providers, WhatsApp admin
  migrations/     SQL (checksummed, idempotent; *.down.sql is manual-only)
  web/            React admin console (built and served by the API, same origin)
  deploy/         Dockerfile, compose, nginx, systemd, scripts
  scripts/        dev-server (fictional data), pi-contract-probe (read-only)
  test/           113 tests
  docs/           ARCHITECTURE, SECURITY, DEPLOYMENT, RADIUS, WHATSAPP-ADMIN, BACKUP-RESTORE, OPERATIONS, INCIDENT-RESPONSE
```

## Develop

```bash
npm ci && npm --prefix web ci
npm run typecheck && npm test
npm run build
```

Local run with fictional data (no real system is touched):

```bash
ISP_ENV=development ISP_PUBLIC_ORIGIN=http://localhost:8443 DATABASE_URL=postgres://unused \
ISP_ENCRYPTION_KEY=$(openssl rand -base64 32) ISP_SESSION_PEPPER=$(openssl rand -base64 32) \
ENABLE_RADIUS_WRITE=true ENABLE_CUSTOMER_SUSPENSION=true REQUIRE_MFA=false \
DEV_ADMIN_PASSWORD='choose-a-local-password-1' npx tsx scripts/dev-server.ts
```

`.env.example` lists every variable by name only. Real values live outside the repository.
