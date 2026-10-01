# Architecture

## What was discovered about the existing system (evidence, not assumption)

Source: the public login page and its JavaScript bundles of the owner's PI portal (unauthenticated GETs only).

| Fact | Confidence | Evidence |
| --- | --- | --- |
| Product is **Proradius**, Next.js frontend behind nginx | Confirmed | page `<title>`, `X-Powered-By: Next.js`, Turbopack chunks |
| Separate JSON backend at same-origin `/api` | Confirmed | axios instance `baseURL:"/api"`, `withCredentials` |
| Backend is Django REST Framework | Likely | `get_all_permissions`, numeric `user_type`, `{detail}` errors, `/token/` + `/token/refresh/` |
| Auth: `POST /api/token/` → JWT access token (`Authorization: Bearer`); refresh via cookie; optional TOTP 2FA | Confirmed | `authApis.jwtLogin`, request interceptor, 202 `2fa_required` handling |
| PI roles: user, reseller, support, admin, collector, **readonly** | Confirmed | login handler role map |
| RADIUS implementation, database engine, table names | **Unknown** | nothing observable from the browser side |
| The portal's DNS name points at a private (RFC1918) address | Confirmed | public DNS resolves it to a LAN address; port 443 refused from outside that LAN |

Consequence: the PI system is only reachable from its own network. A Hetzner-hosted gateway needs a
private tunnel to it (WireGuard / Tailscale / Cloudflare Tunnel).

## Target architecture

```
Internet ── VisionEX public site ─ (no route to this system)
   │
   ├─ WhatsApp ─► public relay (signs: HMAC(secret, ts.body)) ──┐
   │                                                            ▼
   └─ Admin browser ──HTTPS, IP allow-list──► nginx (isp-admin host) ─► 127.0.0.1:8443
                                                                         │
                       ┌──────────── ISP API (Fastify, TypeScript) ──────┤
                       │   auth/RBAC · directory · action engine · WhatsApp controller
                       ▼                                                 ▼
              PostgreSQL (dedicated,                         Provider interfaces
              internal network only)                         Customer/Service/Payment/Radius
                       ▲                                                 │
                 worker (sweeps,                              PI adapter ─► private tunnel ─► PI /api
                 heartbeat, alerts)
```

* **One host, one compose project** (`visionex-isp`): `db`, `migrate` (one-shot), `api`, `worker`.
  PostgreSQL has no published port and sits on an `internal: true` network. API and worker also join an
  `egress` network for the PI tunnel and WhatsApp.
* **Provider interfaces** (`src/providers/types.ts`) are the only thing the rest of the code knows about
  the ISP system. Replacing PI means writing one adapter.
* **Authoritative reads.** The local `customers`/`services`/`payments` tables are a best-effort cache
  filled when a customer is opened. Every state-changing action re-reads the customer from PI first, and
  again afterwards to verify.
* **No business logic is duplicated.** Billing, expiry and RADIUS provisioning stay in PI; this service
  calls it.

## Data model

`admin_users`, `admin_sessions`, `whatsapp_admins`, `wa_sessions`, `wa_inbound` (replay window),
`customers`, `services`, `payments`, `radius_accounts` (cache; schema per the brief),
`pending_actions` (two-step actions + idempotency), `audit_logs` (append-only, hash-chained),
`system_events`, `settings` (kill switch, environment tag), `heartbeats`.
`radius_accounts` exists for the schema but nothing fills it yet: RADIUS state is read live.

## Action lifecycle

`request` (RBAC, rate limit, flags/kill switch, **fresh** PI read, state-transition check, snapshot) →
user sees a summary and presses a button → `confirm` (atomic claim of the row so one confirm wins; recheck
RBAC/flags; **fresh** read must still match the snapshot; execute; **read back** and require the expected
status; audit). A failure at any step is reported as a failure; success is never assumed.
