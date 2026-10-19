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
