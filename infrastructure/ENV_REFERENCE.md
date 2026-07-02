# Environment reference (Career Center, all phases)

All secrets below are set as **Supabase Edge Function secrets**
(Dashboard → Project Settings → Edge Functions → Secrets, or
`supabase secrets set KEY=value` via CLI) — Edge Functions don't read a
`.env` file at runtime the way a Node/Next.js server would.

## Requested vs. real equivalent

The Phase 11 brief listed a NestJS/Next.js-shaped `.env`. Mapped to what
this stack actually uses:

| Requested | Real equivalent |
|---|---|
| `NODE_ENV` | N/A — Deno Edge Functions have no dev/prod build split; `SUPABASE_URL` differing between local (`supabase start`) and linked project is the real environment signal |
| `DATABASE_URL` | N/A — Edge Functions never connect to Postgres directly; they use `SUPABASE_URL` + a key through the Supabase client, which goes through PgBouncer automatically |
| `REDIS_URL` | N/A today — `ai_response_cache` is Postgres-backed; see `infrastructure/scaling/README.md` for the swap-later path |
| `JWT_SECRET` | N/A — Supabase Auth manages JWT signing internally; Edge Functions verify via `supabase.auth.getUser()`, never a raw secret |
| `AWS_S3_BUCKET` | N/A — Supabase Storage buckets (`career-resumes` etc.), already S3-compatible under the hood |
| `MONITORING_KEY` | N/A — no external APM connected yet; `career_error_log`/`career_request_metrics` are the monitoring store today |

## Secrets actually required

| Secret | Used by | Introduced |
|---|---|---|
| `OPENAI_API_KEY` | `_shared/aiProvider.ts` | Pre-existing (site-wide) |
| `ANTHROPIC_API_KEY` | `_shared/aiProvider.ts` | Pre-existing (site-wide) |
| `GEMINI_API_KEY` | `_shared/geminiProvider.ts` | Phase 10 |
| `STRIPE_SECRET_KEY` | `career-billing-checkout`, `_shared/careerStripe.ts` | Pre-existing (shared with Bazaar checkout) |
| `CAREER_STRIPE_WEBHOOK_SECRET` | `career-billing-webhook` | Phase 11 — **new**, register a dedicated webhook endpoint in the Stripe Dashboard for `career-billing-webhook`'s URL to get this value; do not reuse the Bazaar webhook's secret |
| `CAREER_ENCRYPTION_KEY` | Any future caller of `career_encrypt()`/`career_decrypt()` | Phase 11 — optional, only needed if `career_encrypted_secrets` is actually used |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | every function | Auto-injected by Supabase, no action needed |

## Not yet configured (known gaps)

None of the three AI provider keys, `STRIPE_SECRET_KEY`, or
`CAREER_STRIPE_WEBHOOK_SECRET` could be verified as set in this
environment — there's no way to inspect Supabase project secrets from this
sandbox. Confirm all of them in the Supabase Dashboard before relying on
`career-billing-checkout`/`career-billing-webhook`/any `career-ai-*`
function in production; `career-system-health` will report `missing` for
whichever ones aren't set.
