# Security

Controls below are implemented and covered by tests unless marked **(deploy)** — those are configuration
that only exists once the stack is deployed and have not been exercised.

## Exposure
* Admin UI and `/api/*`: nginx allow-list / VPN only **(deploy)**. Everything unmatched returns 404.
* The only publicly reachable route is `POST /internal/v1/whatsapp/events`, authenticated by HMAC +
  timestamp window + message-id replay table, with nginx rate limiting **(deploy)**.
* PostgreSQL: no published port, internal Docker network **(deploy)**. API binds loopback.
* `/health` returns `{"status":"healthy"}` or `unhealthy`. Detail requires a session and never includes
  hostnames or addresses.
* `robots.txt` disallow-all, `X-Robots-Tag: noindex`.

## Authentication (web)
* scrypt password hashes (N=32768), 12+ chars with letters and digits; constant-work login (a dummy hash is
  verified for unknown users) and one identical 401 for every failure.
* Lock after 5 failures for 15 min; per-IP and per-user rate limits; failures audited and counted.
* TOTP MFA (RFC 6238, replay-proof by step); `REQUIRE_MFA` confines a new session to MFA setup and cannot
  be turned off in production.
* Session: random 256-bit token, stored only as a peppered SHA-256, in an `HttpOnly; Secure;
  SameSite=Strict` cookie (`__Host-` prefix in production). 30 min idle / 8 h absolute. Revocable.
  Nothing is kept in `localStorage`.
* CSRF: per-session token header on every non-GET plus an `Origin` check; login requires same-origin JSON.
* Authorisation is enforced server-side on every route (`need()` per permission); the UI only hides things.

## WhatsApp admin
See `WHATSAPP-ADMIN.md`. Number allow-list **and** one-time enrolment code **and** TOTP unlock; signature
verification; 5-minute freshness; replay table; per-admin rate limits; unknown senders get silence.

## State-changing actions
RBAC → rate limit → env flag ∧ not killed → fresh authoritative read → typed confirmation (button only) →
atomic single-winner claim (idempotent) → recheck → execute → read-back verification → audit. Free text and
model output can never confirm anything (`CONFIRM` is not part of the intent schema).

## Data
* Input: every body/query is a strict zod schema (unknown fields rejected); IDs match `[A-Za-z0-9._@-]{1,64}`;
  SQL is parameterised throughout; search forbids wildcards and terms under 3 characters and is paginated
  (max 25).
* Output: JSON only; fixed error sentences; no stack traces; provider session data drops NAS addresses.
* IDOR: pending actions are visible only to their creator — others get 404, indistinguishable from missing.
* Secrets: TOTP seeds AES-256-GCM encrypted at rest; log and audit metadata are redacted by key name
  (password, token, secret, cookie, otp, …); configuration errors name variables, never values.
* Audit: `audit_logs` is append-only (triggers) and hash-chained; the app DB role is granted INSERT/SELECT
  only **(deploy)**; `GET /api/audit/verify` detects edits or removals.

## Abuse monitoring
Events recorded and escalated to SUPER_ADMIN WhatsApp when repeated: failed logins, invalid WhatsApp
signatures, unknown WhatsApp senders, rate-limit hits, enumeration (>50 distinct customers in 10 min),
RADIUS/action failures, interrupted actions, DB down, kill-switch changes.

## Known limitations
* Rate limiting is in memory (single instance); a restart resets windows. Fine for one process behind one
  gateway; revisit before scaling out.
* PI response shapes are unverified; unrecognised status → `UNKNOWN` → no action allowed.
* The WhatsApp relay in the public stack that signs forwarded events is **not written** (see DEPLOYMENT).
* No automated pen-test was run; the security tests cover the cases listed in the test names.
