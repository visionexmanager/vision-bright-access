# Before the first VX deploy

This deploy installs the mechanism and changes no behaviour. Every service is
disabled, `daily_vx_limit` is NULL, no balance moves, and no wallet is
migrated. What follows is what to confirm before and after.

## The one-line summary

Nothing in these eight migrations can charge anybody, because
`central_pricing_registry.enabled` is `false` on all eight rows and
`vx_reserve` refuses a disabled service before it reads a balance.

## Database

- [ ] All eight migrations apply in order: `20261022` → `20261029`.
      *Verified: applied twice, in order, against real PostgreSQL. The second
      pass is what proves a failed deploy can be retried.*
- [ ] No migration drops a table. *Verified — only `admin_give_vx` is dropped,
      and it could never write anything.*
- [ ] No migration enables a service. *Verified: 8 rows, 0 enabled, after two
      passes.*
- [ ] No migration changes a balance. *Verified: `user_points` untouched.*
- [ ] No RunPod dependency anywhere. *Verified across every migration, every
      shared module and `deploy.yml`.*
- [ ] After deploy: run `.github/workflows/supabase-types.yml` with
      `open_pr: true`. **This is required** — see *Known blocker* below.

## RLS and grants

- [ ] `ph_providers`, `ph_metrics`, `ph_logs`, `ph_configs`, `ph_failovers`,
      `ph_provider_audit`, `central_pricing_registry`, `central_pricing_audit`,
      `vx_usage_ledger`, `vx_wallet_migrations` — **admin SELECT only**.
      *Verified as three real roles: anon denied, non-admin 0 rows, admin reads.*
- [ ] `anon` holds no grant on any new table. *Verified.*
- [ ] No spending function is executable by `anon` or `authenticated`:
      `vx_reserve`, `vx_settle`, `vx_release`, `vx_balance`,
      `vx_reap_stale_reservations`, `vx_reserve_for_whatsapp`,
      `vx_migrate_wallet_balances`, `vx_revert_wallet_migration`. *Verified.*
- [ ] `vx_price_list()` and `my_vx_usage()` **are** executable by
      `authenticated` — they are the two user-facing column lists. *Verified.*

## VX

- [ ] `user_points` is the only balance. `SUM(points)`, no balance column.
- [ ] **Do not run** `vx_migrate_wallet_balances`. Production has six wallets
      holding zero and no transactions; there is nothing to move.
- [ ] A reservation is a real debit, so `usePoints`, `spend_vx` and the Arcade
      all keep seeing the truth without knowing reservations exist.
- [ ] A failed operation can never keep VX. *Verified four ways: every terminal
      state, a crash swept by the reaper, the table CHECK behind the function,
      and a 200-job random walk.*
- [ ] `vx-reap-stale-reservations` is scheduled every ten minutes — confirm the
      `pg_cron` job exists after deploy.

## Usage

- [ ] The Usage screen reads `my_vx_usage()`, never `vx_usage_ledger`.
- [ ] It shows spent, returned, held, service, time, status and — only when an
      account has used more than one — source.
- [ ] It shows no provider, no `base_cost`, no `actual_cost_usd`, no margin.
      *Verified by test.*
- [ ] Empty, loading and error states are distinct. An empty ledger must not
      look like a failure.

## WhatsApp

- [ ] `whatsapp_ai` stays disabled, so every message takes the legacy path.
- [ ] A linked number resolves to an `auth.users` id **inside** SQL;
      `vx_reserve_for_whatsapp` strips `user_id` from its answer.
- [ ] An unlinked number gets `not_linked` and keeps `whatsapp_entitlements`,
      `whatsapp_meter` and every abuse control. No wallet is invented.
- [ ] `wa_message_id` is the idempotency key, so a Meta redelivery reserves
      once.
- [ ] A failed answer releases the hold; a settled one cannot be re-answered.

## Admin

- [ ] `/admin/vx-pricing` is behind `AdminRoute`.
- [ ] `provider-hub` checks the role before reading the request body, and
      records a refusal as a security event.
- [ ] Provider rows, costs and secret **names** are admin-only.
- [ ] `admin_set_service_pricing` refuses a negative price — a negative price
      is a way to mint VX.

## Secrets

- [ ] No `VITE_*` provider key. *Enforced by `ai-secret-safety.test.ts`.*
- [ ] No key value in any response, log or CI output — only secret *names*, and
      only to an admin.
- [ ] No RunPod secret exists and none is referenced.

## After the deploy, before enabling anything

1. Regenerate types (`open_pr: true`), review, merge.
2. Confirm the `pg_cron` reaper job is scheduled.
3. Run `billing-engine` action `migration_report` once — expect zero pending.
4. Watch `vx_usage_ledger` stay empty. It should: nothing is enabled.
5. Only then consider enabling one service, and choosing `daily_vx_limit` from
   a real day of numbers (see below).

## Choosing `daily_vx_limit`, later

Not invented now, on purpose. The procedure:

1. Enable one service and leave the ceiling NULL for a week.
2. Read `vx_usage_analytics(7)` — it gives reserved, consumed and refunded VX
   per service per source, and the real `actual_cost_usd`.
3. Set the ceiling at a multiple of the observed daily peak that the platform
   can afford to lose in a runaway — the point of the ceiling is to bound an
   incident, not to shape normal use, which is what per-service
   `max_daily_usage` and `plan_limits` are for.
4. Confirm it refuses only above that peak, then leave it.

The token and request ceilings keep their existing values and meaning.

## Known blocker

`src/integrations/supabase/types.ts` is **6,784 lines behind the live schema**,
and that drift is entirely pre-existing — `ai_anon_usage`, `ai_eval_cases`,
`ai_knowledge_entries`, the whole `flight_*` set, `check_ai_anon_rate_limit`
and more, from migrations merged weeks ago. Regenerating **before** this deploy
would pull all of that in and still not include any of this branch's objects,
because they are not in production yet.

So the order is: deploy the migrations, then regenerate. One regeneration then
clears the backlog and adds the new objects together.

Until then the admin screen and the Usage screen both reach the new objects
through `billing-engine` rather than PostgREST, which is why they type-check
today.
