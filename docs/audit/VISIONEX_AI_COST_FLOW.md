# AI request → cost → VX → budget: what the code does today

Read-only source review, 2026-10-19, base `1598cca9`. No production data was read; nothing here was run against production. Labels: **[C]** confirmed in source · **[H]** hypothesis, not demonstrated · **[U]** unverified (needs production state).

## 1. The path of one `ai-chat` request

```
browser  callAIChat → callEdge            Idempotency-Key header (one UUID per attempt, no automatic retry)   [C]
   │
ai-chat/index.ts
   ├─ auth.getUser()                      domain assistants need a user; the default assistant may be anonymous
   ├─ subscriptionGate                    no active paid plan → refused before anything else
   ├─ rpc check_ai_budget                 global daily ceiling; `false` → 503; error/null → proceeds (fail-open)
   ├─ rpc check_ai_rate_limit             per user, 60/day            ; anonymous: check_ai_anon_rate_limit
   └─ billedRequest(serviceId "ai_chat")  _shared/vx/billing.ts
         ├─ guest, or service disabled, or registry unreadable → SHADOW: run as-is, nothing held, nothing charged
         ├─ enabled + fixed   → meter(): vx_reserve(vx_price) → run → consume/release
         └─ enabled + metered → worst case from ai_price_book → vx_reserve_metered → run → settle from ai_usage_events
                                (refusal happens before any provider call)
      run → streamChatCompletionWithFallback (aiProvider.ts)
            walks the target chain; an English reply to a non-Latin question counts as a failed attempt and the next model answers
            every attempt → usage sink → ai_usage_events (provider, model, tokens, provider_cost_usd, outcome)   [C]
```

Every service in `central_pricing_registry` is disabled today [C: migration defaults; U: production rows], so today every `ai-chat` request is **shadow**: no VX is held or charged, and the only ceilings that apply are the subscription gate and the per-user/anonymous daily limits.

## 2. What is well built [C]
- One request → one hold → one settlement; the key is required, a replay of finished work gets 409, one in flight is refused (`meteredRequest.ts`).
- The client key is scoped to the account on the server (cross-account replay closed in #384), 8–120 chars of `[A-Za-z0-9_-]`; a network repeat of the same attempt reuses it, a fresh attempt gets a new one (`lib/api/idempotency.ts`). `ai-chat` is in `BILLED_FUNCTIONS`; there is no automatic retry in `callEdge`.
- Failures: a metered hold is released when nothing billable happened; failed attempts are billed only if the policy row says `bill_failed_billable_attempts` and tokens were actually used (`vx_settle_metered`). Settlement is clamped to the hold. If settling fails the answer stands and the reaper returns the hold.
- A refusal (insufficient VX, ceiling, no ready model, unpriced model) costs no provider call.
- Fallback attempts all land in the same reservation, so a fallback cannot create a second charge.

## 3. Confirmed gaps
| # | Finding | Evidence |
|---|---|---|
| G1 | **`check_ai_budget` cannot see `ai-chat`.** It sums `ai_interactions` (written only by the Career AI code) and, if `daily_vx_limit` is set, `vx_usage_ledger.reserved_vx` (empty while every service is disabled). `ai-chat` writes to `ai_usage_events`, which the function does not read. The seeded global budget (20 M tokens / 50 k requests) is therefore compared against Career AI traffic only. | `20261028000000_ai_budget_counts_the_ledger.sql`; grep: no `ai_interactions` write in `ai-chat`, `check_ai_budget` does not mention `ai_usage_events` |
| G2 | **Provider cost is recorded but nobody can read it.** `ai_usage_cost_daily` (per day, function, provider, model: calls, failures, unreported usage, unpriced calls, dollars) is `service_role` only and no admin page, Edge Function or workflow selects from it. Admin pages that show money read VX/points, not provider dollars. | `20261053000000_ai_usage_metering.sql:176-190`; grep over `src`, `supabase/functions`, `.github` |
| G3 | **The only live caps on `ai-chat` spend are per-user (60/day) and the subscription gate.** A burst from many accounts, or one model in the chain that is much more expensive than assumed, has no global dollar ceiling. | §1 |
| G4 | **Fail-open also applies to a missing budget row.** `check_ai_budget` returns true when no active `scope='global'` row exists, on any exception, and the caller treats an RPC error as "within budget". Whether production has an active row: [U]. | function body; `ai-chat/index.ts:261-269` |
| G5 | Other AI functions (image, TTS, documents, voice) do not call `check_ai_budget` at all. | grep: only `ai-chat/index.ts` |

## 4. Hypotheses to test, not claims
- **H1** A streamed answer aborted by the user may settle with `usage_source: "estimated"`/`"missing"`; whether that bills, releases or under-bills depends on policy rows I have not seen [U].
- **H2** The price book intentionally omits some model aliases (`…-latest`); their events are `unpriced` and a metered request for them is refused (`unpriced_model`), a shadow request just records them. If `ai-chat`'s chain uses such aliases, G2's dollar totals under-count [U: which aliases are in production chains].
- **H3** Admin "usage" tiles that read `ai_interactions` or `ph_logs` are partial for the same reason as G1 [not traced].

## 5. Recommended changes (none made; each its own PR, each needing your approval before merge)
1. **Admin reporting (read-only, lowest risk):** an admin-gated RPC returning `ai_usage_cost_daily` for N days, plus one admin card. Adds visibility; changes no behavior. Resolves G2.
2. **Instrumentation:** nothing to add for `ai-chat` itself (events are written); add the same `installUsageMetering` wiring to any AI function that lacks it, after listing them with a test that fails when a provider-calling function has neither metering nor a documented reason.
3. **Budget (needs your decision):** give `check_ai_budget` a dollar leg that sums `provider_cost_usd` from `ai_usage_events` against a new nullable `daily_cost_usd_limit` (NULL = today's behavior). Whether to also make the RPC-error and missing-row cases fail closed is the decision you reserved; the trade-off is that a metering fault would then take the assistant offline for everyone.
4. Before enabling any service in the registry: a policy row (`vx_conversion_policy`) per service, a decision on H1, and a replay test of the metered path with a failing provider mid-stream.

## 6. Test coverage that exists
`ai-usage-metering`, `vx-unified-billing`, `vx-usage-ui`, `vx-hide-reservations`, `ai-chat-limits`, `ai-subscription-gate` and the metered-request tests drive the above with stubs. They do not execute `check_ai_budget` against rows written by `ai-chat`, which is why G1 is invisible to them.

## 7. Source of truth, per fact (2026-10-19, second pass)
Writers and readers found by searching `supabase/functions`, `supabase/migrations` and `src`; "live today" assumes every `central_pricing_registry` row is disabled (migration default; production rows **not** read).

| Fact | Where it lives | Written by | Read by | Live today? |
|---|---|---|---|---|
| Each provider call: provider, model, attempt, chain, outcome, tokens/units, usage source, provider dollars, cost status | `ai_usage_events` | `usageRecording.ts` (via `installUsageMetering`, background) for every `aiProvider`/`meteredFetch` call | `vx_settle_metered`; view `ai_usage_cost_daily` (service role); **no admin page, function or workflow** | yes, for functions that call `installUsageMetering` |
| Which model answered, whether a fallback happened, failures | `ph_logs`, `ph_metrics` (30-day retention for logs) | `chatRecorder.ts` → `providerRecording.ts` per attempt | Provider Hub admin (`provider-hub` function, polls 60–120 s) | yes |
| Quality signals (`fallback`, `failed_request`) | `record_ai_signal` store | `ai-chat` | AI Learning panel | yes |
| VX held / consumed / refunded for a request | `vx_usage_ledger` + hold/refund rows in `user_points` | `vx_reserve*`, `vx_settle*`, `vx_release`, reaper | `check_ai_budget` (reserved, not refunded/expired), `my_vx_summary`, `vx_usage_analytics` | **no rows for `ai-chat`** (shadow mode) |
| User's balance | `user_points` (sum) | awards, spends, holds, refunds | `vx_balance`, admin user list (summed in the browser) | yes |
| Global daily budget | `ai_budgets` (one `global` row) | seed migration | `check_ai_budget` only | seed row exists in the migration; production row [U] |
| Token/request counts for the budget | `ai_interactions` | Career AI code only | `check_ai_budget`, Career analytics | Career AI only |
| Per-user request cap | `check_ai_rate_limit` counter | `ai-chat` | `ai-chat` | yes (60/day) |

## 8. The seven questions
1. **Where is each `ai-chat` request recorded?** Per provider attempt in `ai_usage_events` (reservation id set only when metered) and `ph_logs`/`ph_metrics`; per quality signal in the AI-signal store; the request itself in `vx_usage_ledger` **only when the service is enabled** (not today). `ai_interactions` gets nothing.
2. **Is provider cost captured?** *Captured when the response reports usage and the model is in `ai_price_book` (`cost_status` priced/free); estimated from UTF-8 byte counts when the stream carries none (`usage_source = 'estimated'`, still priced); missing for a call that failed before a body (`missing`, `no_usage`); `unpriced` for models the price book omits.* The Provider Hub's own `total_cost_usd` is **always 0 for chat**: `chatRecorder` passes no `cost_usd` (`p_cost_usd: params.cost_usd ?? 0`), so that figure is "not recorded", displayed as zero.
3. **Can one request be charged twice?** Not in the code reviewed, for a metered or fixed-price service: the key is unique in `vx_usage_ledger`, `vx_reserve_metered` returns the first hold for a replay, `vx_settle`/`vx_release` return a replay on a closed row, the ledger CHECKs `consumed + refunded ≤ reserved`, and the client sends one `Idempotency-Key` per attempt with no automatic retry. Demonstrated by 23 checks and 3 mutation proofs in PR #448. A user who presses send twice creates two requests with two keys, and is charged twice, as intended. Not covered: real concurrency (see the existing gate-SQL job) and `ai-chat` running with a service enabled (it never has).
4. **Can fallback or timeout cause duplicate usage or VX entries?** Duplicate: no — all attempts share one reservation and each attempt writes one event (tested in #449). Missing: yes, one case — an HTTP open that never answers is abandoned with **no** event (#449, "CURRENT BEHAVIOUR"). Late events after settlement or after the reaper are never billed (#448).
5. **Failed and cancelled requests vs the documented policy?** The policy is in `vx_settle_metered` and `vx_conversion_policy.bill_failed_billable_attempts` (default false): nothing billable releases the hold; a failed attempt is billed only if the flag is on **and** it reported usage. A cancelled stream is recorded as an error `stream_cancelled` with the partial usage, so it is billable only under that flag. This matches what #448 asserts. I found no written product policy beyond the migration comments, so "consistent with the documented policy" can only be checked against those.
6. **Why does the global budget miss `ai-chat`?** `check_ai_budget` reads `ai_interactions` (Career AI only) and, if `daily_vx_limit` is set, `vx_usage_ledger.reserved_vx` (empty in shadow mode). `ai-chat`'s events go to `ai_usage_events`, which it does not read. Also true: no production `ai_budgets` row was read.
7. **Dashboard values** —

| Dashboard value | Source | Status |
|---|---|---|
| Provider Hub request counts, success rate, latency | `ph_metrics` / `ph_logs` via `provider-hub` | accurate for chat attempts recorded; `ph_logs` is 30-day; refreshed every 60–120 s (hooks), so up to ~2 min stale |
| Provider Hub **cost** (`total_cost_usd`) | same | **unavailable, shown as 0** for chat: not recorded (see 2) |
| Provider dollars by day/function/model | `ai_usage_cost_daily` | **no screen reads it** — unavailable to admins |
| Admin user list: VX balance per user | `user_points` summed in the browser | **partial** once `user_points` or `profiles` passes the API's per-request row cap (default 1000, silent); fixed in PR #450; production size and `max_rows` not verified |
| VX per user/service for the user | `my_vx_summary` / `my_vx_usage` | accurate for ledger rows; empty while services are disabled |
| Global AI budget used | none shown | not exposed |

## 9. Blind spots, ranked
1. Global spend ceiling does not see `ai-chat` (G1); no dollar ceiling exists anywhere (G3).
2. Provider dollars are recorded but invisible (G2); Provider Hub cost is 0 for chat.
3. An attempt that never opens leaves no record; late/reaped events are never billed (under-billing paths, all documented in #448/#449).
4. Production state never read: registry rows, `ai_budgets`, `bill_failed_billable_attempts`, `max_rows`, table sizes.
5. Decisions that are not mine: a dollar ceiling, whether the four under-billing paths should bill, whether `missing` attempts should be recorded.

## 10. Four under-billing scenarios: decision table (analysis only, 2026-10-19)
Framing that applies to all four: **today every `ai-chat` request is "shadow": no VX is held or charged for any of them** (all `central_pricing_registry` rows disabled; production rows not read). So at present provider cost is incurred with *no* VX accounting by design; the scenarios below describe what happens *once* `ai_chat` is enabled as a metered service. They were demonstrated in `vx-accounting-scenarios.mjs` (#448) and `ai-usage-chain-gaps.test.ts` (#449). Nothing in this section changes charging, refunds, balances or budgets.

Data that exists for reconciliation in every case: `ai_usage_events` (one row per provider call: provider, model, resolved model, tokens, `usage_source`, `provider_cost_usd`, `cost_status`, `reservation_id`, `occurred_at`) and `vx_usage_ledger` (reserved/consumed/refunded VX, `status`, `settled_at`, `metadata.attempts / billable_attempts / unpriced_billable_attempts / release_reason`). A read-only join on `reservation_id` finds each case below.

| | 1. Late usage event | 2. Reaped / expired hold | 3. Unpriced model | 4. Missing usage event |
|---|---|---|---|---|
| **What happens today** | An event written after `vx_settle_metered` closed the hold is stored but never billed (the settle call is a replay). | If settlement never runs or fails, `vx_reap_stale_reservations` (every 10 min, holds older than 1 h, floor 10 min) returns the whole hold, status `expired`; events recorded for it are ignored later. | Settlement bills only `priced`/`free` events. An answered call whose model has no price row counts as unpriced billable and, if nothing else was billable, the hold is released in full (status `failed`). | A request with no event at all (write failed, sink absent, or an HTTP open that never answered, #449) has nothing billable: hold released in full. |
| **Provider cost incurred without VX accounting?** | Yes, whatever the late call cost. | Yes, the full cost of an answer that was delivered. | **Yes, and not rare**: 3 of the 6 default `ai-chat` targets (`gemini-flash-latest`, `gemini-flash-lite-latest`, `ministral-14b-latest`) have no row in the seeded price book (only OpenAI and Groq models are seeded; only three migrations mention `ai_price_book`) [confirmed in the repo; production rows not read]. Their calls are recorded `unpriced`, with tokens but no dollars. | Yes. For a never-opened attempt the provider may or may not have billed; nothing records it. |
| **How it can arise** | Background write slower than settlement's wait, or an attempt completing after the request ended. Settlement waits for the writes it has registered, so this is the exception [inferred]. | Isolate killed mid-request, database error at settlement, a stream held open for over an hour. | Any answer from an unpriced model; also a price row removed or expired between reserve and settle. A *metered* request is refused up front if any model in its ready chain is unpriced (`unpriced_model`), so enabling metering today would refuse nearly every `ai-chat` request rather than leak [inferred from `billing.ts`]. | A database fault swallowed by design ("metering never reaches the request"), a provider that reports no usage when no estimate is possible, an abandoned open. |
| **Reconciliation data** | `ai_usage_events.occurred_at > vx_usage_ledger.settled_at` for the same `reservation_id`. | `vx_usage_ledger.status = 'expired'` with events present, and the sum of their `provider_cost_usd`. | `cost_status = 'unpriced'` events with their `usage` counts; `ai_usage_cost_daily.unpriced_calls`; ledger `metadata.unpriced_billable_attempts`. Once a price row is added, the same tokens can be priced after the fact. | `ph_logs` counts attempts per provider/model/time without a reservation id (fuzzy match); the provider's own invoice is the only exact source. `ai_usage_cost_daily.usage_not_reported` counts answered calls without provider usage. |
| **Customer impact** | Favourable: not charged for it. | Favourable: a free answer. | Favourable (free) until a price is set; if the owner later bills retroactively, unfavourable and a trust issue. | Favourable: free. |
| **Safe recovery / idempotency options** | Leave it; or a periodic read-only "late event" report. Re-opening a settled hold is *not* safe without a new adjustment row keyed to the reservation (one `user_points` row per `reservation_id`, unique) so a rerun cannot charge twice. | Make the reaper settle from events instead of releasing when billable events exist. `vx_settle` already guards on `status = 'reserved'` and takes the user lock, so a settle-on-reap is idempotent and cannot exceed the hold. | Add price rows (a data change, no code) for the three models after checking the providers' own price pages; make the gap visible meanwhile. Adding rows changes what *metered* requests do (they stop being refused), so it is tied to enabling the service. | Instrument-only change: write an `error` event with `usage_source = 'missing'` for an abandoned open (no VX effect while `bill_failed_billable_attempts` ignores `missing`). Billing such attempts is a separate decision. |
| **Needs an explicit product/pricing decision?** | Yes if retroactive billing is wanted; no for reporting. | **Yes**: bill a delivered answer whose settlement failed, or keep it free. | **Yes**: the price (or a conservative flat charge) for models without a published per-token price, and whether to refuse them instead. | **Yes** to bill unrecorded usage; **no** for recording the gap. |

What can be done without any pricing decision: (a) the report queries above (read-only), (b) writing `missing` events for abandoned opens, (c) an admin view of `ai_usage_cost_daily`, (d) an alert when `expired` holds have events.

## 11. Measuring real `ai-chat` provider cost without touching balances or exposing secrets
1. **Source:** `ai_usage_events` already stores `provider_cost_usd` for every priced call (and the tokens for unpriced ones), so nothing new is needed to *measure*. It is readable today only with the service role (`ai_usage_cost_daily`).
2. **Reader (proposal, not built):** an admin-only SQL function returning aggregates only: day, function, provider, resolved model, calls, failed calls, unreported usage, unpriced calls, dollars; plus one admin card. It reads and never writes; it exposes no prompt, answer or user id; it needs a migration (so a deploy) and your approval. A GitHub workflow that prints the same table is **not** recommended: the repository is public, run logs are world-readable, and cost by model is commercial information.
3. **Calibration against the provider's own invoice:** once per provider, compare the dashboard's token and dollar totals for one day with `sum(provider_cost_usd)` plus the tokens of `unpriced` rows priced by hand. Their ratio is the error bar on everything above.
4. **Add the missing prices** for `gemini-flash-latest`, `gemini-flash-lite-latest` and `ministral-14b-latest` *as data*, only from the providers' published pages, so the dollar column stops under-counting (events record `resolved_model`).
5. **Evidence needed to choose a ceiling (collect for at least 14 days, then decide; no number is proposed here):**
   - daily cost: median, 95th percentile, maximum, and the worst single hour;
   - cost per request by model, and the share of requests answered by each (fallback rate: `ai_usage_events.attempt > 1`);
   - the share of calls that are `unpriced`, `estimated` or `missing` (how wrong the dollar figure is);
   - requests per user per day against the 60/day limit (how much headroom abuse would use);
   - revenue per active plan (`billing_plans.price_monthly_usd`) and its VX allowance, so a ceiling can be expressed as a share of revenue;
   - the provider invoice for the same days.
6. **Safety properties of this measurement:** reads only; service-role or admin-gated; aggregates only; no secret appears in output; no balance, ledger or budget row is touched.

## 12. Fail-open and the budget: what to decide, stated plainly
`check_ai_budget` returns "within budget" on any exception and when no active budget row exists, and the caller treats an RPC error as within budget. Making it fail closed means a metering fault takes the assistant offline for everyone; leaving it open means a fault removes the only global ceiling. Today the ceiling does not see `ai-chat` at all (section 3, G1), so the first decision is not open versus closed but whether to add a dollar leg that reads `ai_usage_events` against a number you choose after section 11. Nothing here was changed.
