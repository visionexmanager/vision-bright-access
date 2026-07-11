# CI/CD — what's real vs. what to add

## The real, active pipeline

`.github/workflows/deploy.yml` is what actually ships this app:
- `run-migrations` — `supabase db push --linked` (every migration uses
  `IF NOT EXISTS`/`DO $$ ... EXCEPTION WHEN duplicate_object$$` guards, so
  this is safe to run unconditionally). **No action needed** — every new
  `supabase/migrations/*.sql` file this phase added is picked up
  automatically.
- `deploy-edge-functions` — `supabase functions deploy` per function.
  **No action needed** — the new `career-billing-checkout`,
  `career-billing-webhook`, `career-gdpr-request`, and `career-system-health`
  functions deploy the same way as every other function once added to that
  job's function list.
- `deploy-vps` — webhooks a self-managed VPS to pull the new static build,
  then health-checks `https://visionex.app`.

`.github/workflows/ci.yml` is the real PR gate (typecheck/lint/unit tests),
but **excludes `supabase/functions/` from lint** — Deno code isn't linted by
the frontend ESLint config, and there was no Deno-specific check before.

## What this phase adds

`.github/workflows/career-ai-deno-check.yml` — a new, additive workflow
(does not modify `ci.yml`/`ci-cd.yml`/`deploy.yml`) that runs
`deno check` over every `supabase/functions/career-*/index.ts` and
`supabase/functions/_shared/career*.ts` file on PRs touching those paths.
This closes the one real gap: these files were previously untyped-checked
in CI.

## What this phase deliberately does NOT add

`.github/workflows/ci-cd.yml` already exists and targets a GKE/Helm
multi-region blue-green deploy — but its `deploy-staging`/`deploy-production`
jobs are hard-disabled (`if: false`) and it doesn't match how the app is
actually deployed. It appears to be scaffolding for a different, unrelated
subsystem ("Visionex AMS" — see `infra/ARCHITECTURE.md`) that was never
activated. This phase does not extend it, since doing so would repeat
exactly the disconnected-parallel-infrastructure problem this phase's
production-architecture doc (`infrastructure/README.md`) was asked to avoid.
If a real move to Kubernetes ever happens, `ci-cd.yml` is the place to
finish — not a second copy under `infrastructure/`.
