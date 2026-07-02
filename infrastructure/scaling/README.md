# Scalability & performance

## Horizontal scaling

Both compute tiers already scale horizontally without any action from us:
- **Edge Functions** — Supabase runs each function as an independently
  auto-scaled Deno isolate; there's no fixed pool size we manage.
  `career-ai-chat`'s streaming responses and every other function's
  request/response cycle scale the same way.
- **Static frontend** — nginx serving pre-built static assets on the VPS is
  cheap to scale (add a second VPS + load balancer, or move to a CDN
  origin) whenever traffic warrants it; nothing in Career Center's design
  assumes a single frontend instance.

## Database

- **Connection pooling** — Supabase already runs PgBouncer in front of
  Postgres for every project; every Edge Function connection already goes
  through it.
- **Read replicas** — a Supabase paid-tier toggle, not something to build.
  Worth enabling once `get_career_*_analytics()` RPCs
  (`20260706060000_career_center_business_analytics.sql`) or the admin
  overview (`get_career_admin_overview()`) start showing up as slow queries
  in the Supabase dashboard — route those specifically to a replica.
- **Sharding** — not warranted at Career Center's current or foreseeable
  scale; every table here is a normal single-tenant-per-row design (RLS
  does the isolation), nothing requires it structurally.
- **Indexing** — every new table in this phase has indexes on its FK/filter
  columns (see each migration); the existing Phase 9 tables were indexed
  the same way. No slow-query-driven index additions were needed since
  nothing here has production traffic yet to profile.

## Caching (multi-layer, as requested)

1. **`ai_response_cache`** (Phase 10) — per-request AI response cache,
   Postgres-backed today, Redis-interface-compatible for later.
2. **HTTP caching** — the nginx config in `infrastructure/docker/nginx.conf`
   sets `Cache-Control: public, immutable` for hashed static assets (JS/CSS/
   images), so repeat visits are served from the browser/CDN cache, not the
   origin.
3. **Postgres itself** — Supabase's connection pooler + Postgres's own
   shared buffer cache handle hot-row caching; nothing extra needed at
   Career Center's scale.

## Queue-based async processing

`queue_jobs` + `claim_queue_jobs()` (Phase 9) is the background-job system.
No Career Center feature currently needs it (all current operations are
synchronous request/response), but it's there for the first one that does
(e.g. a bulk resume re-scoring job, or a scheduled digest email) without
needing new infrastructure.

## Frontend performance

Out of scope for actual changes (rule 18: no UI changes), but worth noting
what's already true: the Vite build already code-splits by route (React
Router lazy-loaded pages), and no framer-motion or other heavy animation
library was added across any Career Center phase specifically to keep the
bundle lean (see Phase 2's decision to skip Framer Motion). SSR/ISR isn't
applicable — this is a client-rendered SPA, not a Next.js app; if SEO ever
becomes a real requirement for public job listings, that's a frontend
architecture decision for a future phase, not something to bolt on here.

## Backend performance

- **Response compression** — nginx `gzip on` is set in
  `infrastructure/docker/nginx.conf` for the static frontend; Supabase's
  own edge network already compresses Edge Function responses.
- **Batch processing** — `career-gdpr-request`'s export path already
  batches all tables in one request rather than N round-trips.
- **AI response caching** — covered above (`ai_response_cache`).
