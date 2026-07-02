# VisionEx Career Center — Production Infrastructure (Phase 11)

## Why this looks different from what was asked

The Phase 11 brief specified a Next.js frontend + NestJS backend +
Kubernetes cluster architecture. Neither exists in this repo: the app is a
Vite/React SPA, and Phase 9 of this same project explicitly chose a
Supabase-native backend (Postgres + RLS + Auth + Storage + Edge Functions)
over building a parallel NestJS service, specifically to avoid maintaining
two disconnected backends. Building Next.js/NestJS/Kubernetes now would
repeat that mistake — and the repo already contains a cautionary example of
it: `infra/k8s`, `infra/terraform`, `infra/helm`, and `infra/monitoring/
prometheus` are a full multi-region GKE architecture for a *different*,
unrelated subsystem ("Visionex AI Media Studio" — see `infra/ARCHITECTURE.md`)
that was scaffolded but never activated (`.github/workflows/ci-cd.yml`'s
deploy jobs are hard-disabled with `if: false`). The real, active deploy
pipeline is `.github/workflows/deploy.yml`: a self-managed VPS pulled via
webhook, plus `supabase functions deploy` / `supabase db push` for the
backend.

Given that, everything below is built for what's actually true today:
**Vite SPA + self-managed VPS + Supabase (Postgres/Auth/Storage/Edge
Functions)**. No fictional Kubernetes manifests were added — see
`kubernetes/README.md`.

## What's in each folder

| Folder | Contains |
|---|---|
| `docker/` | A real multi-stage Dockerfile + docker-compose for local dev parity of the frontend (not the production deploy path — see `ci-cd/README.md`) |
| `kubernetes/` | Explains why there's no K8s here and where the pre-existing (inactive) scaffold lives |
| `ci-cd/` | What `deploy.yml`/`ci.yml` already cover automatically vs. the one new workflow this phase adds |
| `monitoring/` | `career_system_health_checks` / `career_request_metrics` tables + `career-system-health` Edge Function |
| `logging/` | `_shared/careerLogger.ts` — structured JSON logs + `career_error_log` |
| `security/` | RBAC/permissions, encryption helpers, brute-force primitives, audit log |
| `billing/` | `career_billing_*` schema + Stripe checkout/webhook Edge Functions |
| `scaling/` | Caching/indexing/queue/read-replica strategy given the real stack |

## Scope discipline

Per this phase's rules, nothing here touches the existing frontend, changes
any AI logic from Phase 10, or adds a user-facing feature. Everything is a
new migration, a new shared module, or a new Edge Function — see each
subfolder's README for exactly which files.
