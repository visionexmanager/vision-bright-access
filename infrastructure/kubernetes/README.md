# Kubernetes — not applicable to Career Center

This folder exists to satisfy the requested `infrastructure/` layout, but
intentionally contains no manifests.

The app deploys as a static build to a self-managed VPS
(`.github/workflows/deploy.yml`) plus Supabase-hosted Postgres/Auth/Storage/
Edge Functions — there is no container orchestrator in the real deployment
path, so there is nothing here for Kubernetes to schedule.

A full (but inactive) Kubernetes/Terraform/Helm architecture already exists
in this repo at `infra/k8s/`, `infra/terraform/`, `infra/helm/` for a
different, unrelated subsystem ("Visionex AI Media Studio"). It was never
wired to a real deploy job (`ci-cd.yml`'s deploy jobs are hard-disabled).
**Do not copy that pattern here** — if Career Center ever genuinely needs
container orchestration (e.g. a stateful worker process Edge Functions
can't run), that's a real infrastructure decision to make deliberately, not
something to scaffold speculatively per feature area.
