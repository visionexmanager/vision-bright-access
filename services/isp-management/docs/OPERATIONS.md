# Operations

## Daily
* Dashboard → system status (database, ISP system, WhatsApp, worker, disk, memory), recent errors.
* Critical events arrive by WhatsApp to enrolled SUPER_ADMINs.

## Health
* Public: `/health`, `/readiness`, `/liveness` → one word. nginx exposes only `/health`.
* Detailed: `/api/system` (session required): per-component status and latency, write capabilities (booleans),
  kill-switch state, action counts for 24 h.
* Worker heartbeat: stale > 3 min shows "worker: Problem".

## Logs
Structured JSON on stdout (`timestamp, service, level, msg, requestId, …`), redacted by key name. Docker
`json-file` rotation: 10 MB × 5 per container. Query with `docker compose -p visionex-isp logs api`.

## Common tasks
| Task | How |
| --- | --- |
| Add an admin | Web → Admin users (SUPER_ADMIN) |
| Authorise a WhatsApp number | Web → WhatsApp admins; hand over the one-time code and seed privately |
| Stop all changes now | Web → System → Disable ALL changes (or set `allWrites` via the API) |
| Re-enable | Same page; env flags still gate each capability |
| Lock an account out | Disable the user (sessions revoked at once) |
| Verify audit integrity | Audit page → Verify integrity |
| Rotate a PI password | Change it in PI, update `PI_PASSWORD` in `isp.env`, `docker compose … up -d api worker` |
| Rotate `WA_GATEWAY_HMAC_SECRET` | Update here and in the relay together; messages in flight are retried by Meta |

## Capacity
The service stores only a cache and the audit trail; sizes are small. Searches are bounded (max 25) and
every provider call has a 15 s timeout. Memory limits: api 384 MB, worker 256 MB, db 512 MB.

## Alert thresholds (src/events.ts)
10 failed logins / 10 min · 3 bad WhatsApp signatures / 10 min · 5 unknown senders / hour · 30 rate-limit hits /
10 min · enumeration (immediate) · 3 RADIUS/action failures / 10 min · any CRITICAL event.
