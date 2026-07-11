# Monitoring

## Tables (`20260706050000_career_center_monitoring.sql`)

- `career_system_health_checks` — one row per component per health-check
  run (status: ok/warning/error/missing + detail). Admin-read only.
- `career_request_metrics` — per-request latency/status/endpoint, tagged
  with a `trace_id`. Admin-read only.
- `career_error_log` — structured error records (service/severity/message/
  context jsonb), tagged with the same `trace_id` so a failing request can
  be traced end-to-end through both tables. Admin-read only.

AI-specific metrics (latency, tokens, cache hit rate, provider/model) were
already tracked in Phase 10's `ai_interactions` table — this phase doesn't
duplicate that, see `get_career_ai_usage_analytics()` in
`20260706060000_career_center_business_analytics.sql` for the admin-facing
rollup.

## `career-system-health` Edge Function

GET/POST, no auth required (read-only diagnostics — same convention as the
site-wide `health-check` function). Checks: OpenAI/Anthropic/Gemini/Stripe
key presence, and that every Career Center table is reachable. Every run is
persisted to `career_system_health_checks`.

**Wire it up to run periodically** the same way `tv-stream-health-cron.yml`
does for `tv-validate-stream`: a new GitHub Actions `schedule:` workflow
that POSTs to `$SUPABASE_URL/functions/v1/career-system-health` with a
`CRON_SECRET` bearer token every 30 minutes. Not added automatically by this
phase since it needs `verify_jwt = false` added to `supabase/config.toml`
for this function (a config change outside pure-addition scope) — add both
together when ready to activate scheduled polling.

## Dashboards (Datadog/ELK-ready, not connected)

No APM exists anywhere in this codebase yet (confirmed: no Sentry/Datadog/
LogRocket references). `career_error_log`'s shape (service, severity,
message, context jsonb, trace_id) is deliberately export-friendly — a
future sync job can read new rows and forward them to Datadog/ELK without
a schema change.
