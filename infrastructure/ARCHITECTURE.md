# Career Center — Production Architecture (real stack)

Each layer the Phase 11 brief asked for, mapped to what this repo actually
runs (see `infrastructure/README.md` for why this isn't Next.js/NestJS/K8s).

| Requested layer | Real equivalent here |
|---|---|
| Frontend (Next.js) | Vite + React SPA, built to static assets, served by nginx on a self-managed VPS (`.github/workflows/deploy.yml`) |
| Backend (NestJS/Node.js) | Supabase Postgres + RLS (authorization logic lives in SQL policies, not an app-layer framework) + Deno Edge Functions for anything that needs a server-side secret or third-party API call |
| AI Layer (multi-provider) | `supabase/functions/_shared/aiProvider.ts` (OpenAI/Anthropic) + `geminiProvider.ts` (Gemini) + `careerAiOrchestrator.ts` — built in Phase 10, unmodified this phase |
| Database (PostgreSQL cluster) | Supabase-managed Postgres. Read replicas and connection pooling (PgBouncer, already in front of every Supabase project) are a paid-tier toggle in the Supabase Dashboard, not something to provision ourselves |
| Cache Layer (Redis cluster) | `ai_response_cache` table today (Postgres-backed, already built Phase 10 — its own doc note says it's "swappable later for Upstash Redis... without touching the calling code"). No Redis instance exists yet; the interface is already Redis-shaped so adding one later is a backend swap, not a rewrite |
| Queue System (BullMQ/Kafka-ready) | `queue_jobs` table + `claim_queue_jobs()` (Postgres `FOR UPDATE SKIP LOCKED`, built Phase 9) — the serverless-compatible equivalent, since Edge Functions can't host a long-running BullMQ worker |
| File Storage (S3-compatible) | Supabase Storage (already S3-compatible under the hood) — `career-resumes`/`career-portfolios`/`career-certificates`/`career-media` buckets, built Phase 9 |
| CDN Layer | Whatever sits in front of the VPS today (out of this phase's visibility — recommend Cloudflare in front of the VPS if not already there; `infra/cloudflare/workers/` exists for the unrelated streaming subsystem and isn't wired to Career Center) |

## Why no dedicated "API Gateway" or "AI Worker" tier

Edge Functions already are the API layer (`career-ai-*`, `career-billing-*`,
etc. — one function per endpoint, auto-scaled by Supabase's own
infrastructure, not something we operate). There's no separate "AI worker
pool" because AI calls are synchronous request/response through the
orchestrator (with caching + fallback), not queued background jobs — if a
genuinely long-running AI job ever needs decoupling from the request cycle,
`queue_jobs` is already there for exactly that (a Career Center Edge
Function could enqueue a job and a second function could poll/claim it).

## Scaling posture

This is intentionally NOT the 5-region, GKE-autoscaled topology `infra/
ARCHITECTURE.md` describes for the AI Media Studio subsystem — that's built
for 1M+ concurrent users and isn't Career Center's current problem. See
`infrastructure/scaling/README.md` for what horizontal scaling actually
looks like on this stack, and when it would be time to reconsider.
