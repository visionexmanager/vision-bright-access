---
name: deployment
description: How a Visionex change reaches production — branch, pull request, CI, migrations, Edge Functions, and how to prove the merged commit is actually live. Load before pushing, merging, deploying or verifying a release.
---

# Deployment

**Never deploy or merge unless explicitly authorized.** Authorization is the
user saying so for this change. It does not carry over from the last one.

## The path

Branch → pull request → CI green on the latest commit → merge → `deploy.yml`
runs on `workflow_run`: SPA to the VPS, Edge Functions, `supabase db push`,
image build, catalog warm.

1. Never commit or push unless asked. Never push to `main` directly — a hook
   blocks it, and it would bypass CI.
2. `gh pr merge --auto` is the form that passes the command classifier. It
   stalls silently if the branch is behind; update it rather than forcing.
3. Merging runs migrations against production. Treat it as the irreversible
   step it is, and say so before doing it.

## Environment

4. Secrets reach a function only through `deploy.yml`'s sync step. Rotating a
   GitHub secret changes nothing until the next deploy.
5. `VITE_*` variables in repository secrets do nothing: the SPA is built on the
   VPS from its own environment.
6. A new secret has to be added to the sync list, or the function reads
   `undefined` in production and nowhere else.

## Proving it shipped

7. The VPS health check is green while the old bundle is still serving. It
   proves nothing about your change.
8. For a migration, read the `Run DB migrations` job log: it names every file it
   applied. A green job with nothing applied looks identical.
9. For an Edge Function, probe the live endpoint and read the *shape* of the
   error. A function that exists but refuses `anon` answers differently from one
   that was never deployed.
10. For the SPA, fetch the served bundle and grep for a string unique to the
    change. Do not compare asset hashes — a local build never matches the VPS.
11. Several deploy runs appear per merge and all but one say `skipped`. Find the
    successful one for your commit before concluding anything.

## Rollback

12. Know the way back before going forward: an additive migration is safe to
    leave, a function is redeployed from the previous commit, and a feature
    behind a config flag is switched off without a deploy at all.

Depth: `github-release-manager` to run a release, `production-verifier` and the
`release-verifier` agent to confirm one.
