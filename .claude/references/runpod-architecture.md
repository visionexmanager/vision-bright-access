# RunPod — Stage 1: the layer, switched off

RunPod is an execution provider. It is not the billing authority, not the
entitlement authority, and not the system of record. Hetzner remains primary.

**Nothing in this document activates anything.** As shipped, three independent
switches are off and no RunPod request can be made.

## Where it sits

```
request → entitlement (user_has_section) → VX reserve (vx_reserve)
        → provider router (ph_providers)  → adapter (runpod | existing)
        → normalized ComputeJob           → VX settle / release
        → Usage page · WhatsApp · service result
```

Three layers, already in production before this, and deliberately separate:

| | knows | does not know |
| --- | --- | --- |
| `providerRouter.ts` | capability, health, latency, cost, priority | billing |
| `_shared/vx/meter.ts` | reserve, settle, release | providers |
| the adapter | one vendor's dialect | billing, entitlement |

`meter()` takes the work as a promise, which is what makes the thing being
metered opaque to it. That is why a new execution target needs an adapter and a
row, and touches neither billing nor entitlement.

## Files

| | |
| --- | --- |
| `_shared/providers/compute.ts` | the normalized job, the error vocabulary, the adapter contract. Pure — no Deno, no fetch — so it is unit-tested for real. |
| `_shared/providers/runpod.ts` | the RunPod Serverless adapter. Server-only. |
| `20261036000000_…_inactive.sql` | one `ph_providers` row, `status = 'inactive'`. |

## The API, as verified

Checked against `docs.runpod.io`, not carried from an example:

```
POST https://api.runpod.ai/v2/{endpointId}/run              async → {id, status}
POST https://api.runpod.ai/v2/{endpointId}/runsync          waits — not used
GET  https://api.runpod.ai/v2/{endpointId}/status/{jobId}
POST https://api.runpod.ai/v2/{endpointId}/cancel/{jobId}
GET  https://api.runpod.ai/v2/{endpointId}/health

authorization: Bearer <RUNPOD_API_KEY>
body: { "input": { … } }
status: IN_QUEUE | IN_PROGRESS | COMPLETED | FAILED | CANCELLED | TIMED_OUT
```

`/status` and `/cancel` take the job id as a **path segment**. Async results
live ~30 minutes, sync ~1 minute — which is why `JOB_EXPIRED` is distinct from
`JOB_NOT_FOUND`.

`/run` rather than `/runsync`, always: `/runsync` holds the HTTP connection for
the whole GPU job, so an Edge Function would pay to wait and its own limit
would cut the job off with VX already reserved.

## Status mapping

| RunPod | Visionex | billable |
| --- | --- | --- |
| `IN_QUEUE` | `queued` | no |
| `IN_PROGRESS` | `running` | no |
| `COMPLETED` | `completed` | **yes** |
| `FAILED` | `failed` | no |
| `CANCELLED` | `cancelled` | no |
| `TIMED_OUT` | `timed_out` | no |
| *anything else* | `failed` | no |

An unrecognised status is a failure, not a guess. Reading a new vendor state as
`completed` would settle a reservation for work that may not exist; reading it
as `failed` releases the hold — that costs revenue and never costs a customer.

## The three switches

| | where | default |
| --- | --- | --- |
| `RUNPOD_ENABLED` | Edge Function env | off (must equal `"true"`) |
| `ph_providers.status` | the row | `inactive` — invisible to the router |
| `central_pricing_registry.enabled` | the service | `false` |

Independent on purpose: an operator can take RunPod out of rotation without
disabling a service that has another provider, and disable a service without
taking the provider from the others. `runpodReadiness()` checks env, key and
endpoint before a request is built, and reports `PROVIDER_DISABLED` (a
decision) separately from `NOT_CONFIGURED` (a fault).

## Secrets

`RUNPOD_API_KEY`, in Supabase Edge Function secrets, synced from a GitHub
repository secret by `deploy.yml` — the mechanism every other provider key
already uses. **It is not configured today.**

Never in: source, `VITE_*`, frontend env, a database row, a log, a bundle. The
row stores the secret *name* (`api_key_ref`), never a value — the same rule
`ph_providers` has always had. The Authorization header is built at the call
site and appears exactly once in the adapter.

The endpoint id is configuration, not a secret, and is still kept out of every
user-facing response: it is infrastructure, and a user who can see it has been
told something about how Visionex is built.

## What a user sees

VX charged, VX reserved, VX released, VX remaining, service, time, status.

Never: RunPod cost, GPU seconds, provider cost, Hetzner cost, margin, markup,
endpoint id, worker, container, vendor name. `SAFE_MESSAGE` is keyed by code
alone so a provider's own text cannot ride along into a user's screen — a
vendor message can carry an endpoint id, a model name or a quota figure. The
vendor's words go to `metadata`, which is admin-read.

A test asserts every safe sentence against `/runpod/i`, `/gpu/i`, `/endpoint/i`,
`/\$\d/`, `/cost/i`, `/margin/i` and more, and fails when one is injected.

## Failure and accounting

Only `completed` is billable. Everything else releases, through the existing
`vx_release` — no new accounting rule was invented.

| | |
| --- | --- |
| timeout, 5xx, network | `PROVIDER_UNAVAILABLE` / `PROVIDER_TIMEOUT`, **retryable** |
| 401 / 403 | `NOT_CONFIGURED` — an operator problem, not the user's |
| 429 | `PROVIDER_UNAVAILABLE` |
| other 4xx | `INVALID_INPUT`, **not** retryable |
| unknown status | `failed` |
| result aged out | `JOB_EXPIRED` |

Never retried: invalid input, auth failure, entitlement failure, insufficient
VX, rate limit, payload too large. Each would burn money to reach the same
answer.

## Idempotency

Visionex's reservation id is the key, passed to the worker as
`visionex_request_id`. **The vendor's job id is never the control** — it does
not exist until after the call a duplicate would repeat. The binding decision
is the unique index on `vx_usage_ledger.idempotency_key`, which already
protects against double click, browser retry, WhatsApp redelivery, Edge
Function retry and polling.

## Job ownership

A job is addressed by the Visionex reservation id, which already carries
`user_id` and sits behind the ledger's admin-only policy. The provider job id
is internal and returned to nobody, so there is no vendor handle to enumerate
and no cross-user handle to guess.

## Deploy and rollback

Deploy: merge — the row arrives inactive and the adapter is unreachable.

Activate, in order, each reversible on its own:
1. add the `RUNPOD_API_KEY` GitHub secret
2. set `config.endpoint_id` on the row
3. `status = 'active'`
4. `RUNPOD_ENABLED=true`
5. enable the service in `central_pricing_registry`

Roll back by reversing any single step. Setting `status='inactive'` removes
RunPod from routing immediately and leaves every existing provider untouched —
a RunPod outage never needs a Visionex deployment rollback.

## Not done

No RunPod account has been inspected, no endpoint exists, no secret is
configured, and no real smoke test has been run. No service is routed to
RunPod. See the PR for the exact next step.
