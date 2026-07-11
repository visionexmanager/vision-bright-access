# Disaster recovery

## Database backups

Handled by Supabase, not by us: daily automated backups on every paid
project tier, with Point-in-Time Recovery (PITR) available on Pro tier and
above (configurable retention window in the Supabase Dashboard → Database →
Backups). Nothing in Career Center's schema needs a separate backup
mechanism — verify the project's plan has PITR enabled if sub-24h recovery
granularity matters; that's an account-level setting, not something a
migration can turn on.

## File storage backups

Supabase Storage buckets (`career-resumes`, `career-portfolios`,
`career-certificates`, `career-media`) live on the same managed
infrastructure as the database and are covered by the same project-level
backup policy. No separate action needed.

## AI prompt/version backups

`_shared/careerPrompts.ts` (Phase 10) already versions every prompt
(`version: "v1"` per service) in source control — prompt history is git
history, which is backed up wherever this repository is hosted (GitHub).
No separate prompt-versioning database is needed for that reason.

## Failover

Supabase projects run on a single managed Postgres primary per project;
cross-region failover is a Supabase platform capability (Enterprise tier),
not something this repo configures. For the VPS serving the frontend: it's
a single instance today per `deploy.yml` — a second VPS behind a load
balancer would be the next step if uptime requirements tighten, but that's
an infrastructure provisioning decision outside this migration-only phase's
scope.

## What Career Center adds on top

- **`career_error_log`** — makes incident diagnosis possible after the
  fact (structured errors with trace IDs), which matters as much for
  recovery *speed* as backups matter for recovery *possibility*.
- **`career_system_health_checks`** — a history of component health, so a
  postmortem can establish when a dependency (e.g. an AI provider key)
  actually went bad rather than only when it was noticed.
- **Grace period handling** (`career_billing_subscriptions.grace_period_ends_at`)
  — a failed Stripe payment doesn't instantly cut off a company's plan
  limits, which is itself a small reliability/DR concern: a transient
  billing provider hiccup shouldn't cascade into a customer-facing outage
  of their hiring tools.
