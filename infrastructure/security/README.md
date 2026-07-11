# Security hardening

## Already handled by the platform (nothing to build)

- **Password hashing** — Supabase Auth (bcrypt).
- **OAuth (Google/LinkedIn/Apple)** — configured in the Supabase Dashboard
  under Auth Providers; Apple/LinkedIn need their own OAuth app credentials
  registered there. No code change needed on our side once enabled.
- **JWT refresh rotation** — a Supabase Auth project setting
  (`enable_refresh_token_rotation`), not application code.
- **MFA** — Supabase Auth has native TOTP MFA (`auth.mfa_factors`,
  built into GoTrue). `career_security_settings.mfa_enforced`
  (below) is a per-user flag a future onboarding flow can set to require
  it, but the actual MFA challenge is Supabase's, not ours to build.
- **Encryption at rest / TLS in transit** — Supabase-managed Postgres disk
  encryption + enforced TLS on every connection.

## Recommendation, not auto-applied

`supabase/config.toml:8` has `enable_confirmations = false` for email
signup — new accounts aren't verifying their email address. This is a
platform-wide setting (affects every Visionex feature, not just Career
Center), so this phase does not flip it silently. Worth a deliberate
decision by whoever owns Supabase Auth config.

## Built this phase (`20260706010000_career_center_security_hardening.sql`)

- **Fine-grained permissions** — `career_permissions` / `career_role_permissions`
  + `has_career_permission(user_id, key)`, layered on top of the existing
  `career_role`/`has_career_role()` RBAC from Phase 9. Seeded with
  `jobs.delete`, `candidates.export`, `billing.manage`, `team.manage` for
  the `employer` role.
- **`career_security_settings`** — per-user `mfa_enforced` /
  `session_timeout_minutes`, owner + admin visible.
- **`career_security_events`** — audit log (login/failed_login/
  permission_denied/suspicious_activity/etc.), IP stored hashed, never raw.
  `log_career_security_event()` to write; also used by the GDPR functions
  below to record export/deletion actions.
- **`career_known_devices`** — device fingerprint tracking, owner-managed.
- **`career_login_attempts` + `record_career_login_attempt()` /
  `is_career_login_blocked()`** — brute-force primitives (5 failed attempts
  / 15 min blocks an identifier). Career Center has no custom login
  endpoint today (auth goes straight through Supabase Auth from the
  frontend), so nothing calls these yet — they're ready for whichever
  future custom auth surface (e.g. an employer SSO flow) needs them.

## Data security (`20260706020000_career_center_data_security.sql`)

- `career_encrypt()`/`career_decrypt()` — `pgcrypto` `pgp_sym_encrypt`/
  `pgp_sym_decrypt` wrappers. The passphrase is supplied by the caller
  (an Edge Function reading `CAREER_ENCRYPTION_KEY` from its own env) and
  is never stored in the database.
- `career_encrypted_secrets` — optional owner-only blob store for anything
  a future feature wants encrypted beyond normal RLS protection.
- `career_file_scan_results` — a landing table for upload-scan verdicts on
  the resume/portfolio/certificate/media buckets. No real malware scanner
  is wired in this sandbox (no ClamAV-equivalent available) — this is the
  pluggable landing point for one.

## Already true, nothing to add

SQL injection: every query goes through the Supabase client's parameterized
query builder, no raw string concatenation anywhere in this codebase's new
or existing functions. XSS: `careerAiSafety.ts` (Phase 10) already strips
HTML/script from AI output. CSRF: not applicable — every endpoint is a
Bearer-token JWT API, no cookie-based session to forge.
