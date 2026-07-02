# Logging

`supabase/functions/_shared/careerLogger.ts` — used by the new Phase 11
Edge Functions only (`career-billing-checkout`, `career-billing-webhook`,
`career-gdpr-request`, `career-system-health`). Not retrofitted into the
Phase 10 `career-ai-*` functions, per this phase's "don't modify previous
phases" rule.

- `newTraceId()` — one UUID per request, threaded through every log line
  and into `career_request_metrics`/`career_error_log` so a single request
  can be traced across both tables.
- `log.debug/info/warn/error(fields, message)` — emits one JSON line to
  stdout/stderr (`console.log`/`console.warn`/`console.error`). Supabase
  Edge Function logs are already captured by the platform's log viewer, so
  structured JSON here is immediately greppable/queryable there — no extra
  shipping step required to get "structured logs" (section 6).
- `persistCareerError()` / `recordCareerRequestMetric()` — best-effort
  writes to `career_error_log`/`career_request_metrics`. Both swallow their
  own failures (a logging write must never break the request being logged).

## Log levels

`debug | info | warn | error`, matching the request.
