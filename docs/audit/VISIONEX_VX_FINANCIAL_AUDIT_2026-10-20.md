# VX financial integrity, AI budget enforcement and `page_events` retention — audit

Read-only review of `main` at `a6c17244` plus one new non-production test. 2026-10-20.
**Nothing was run against production, no migration or function was changed, no balance, price, grant or budget behaviour was touched.** Labels: **[E]** executed in PGlite in this pass · **[C]** confirmed by reading current source · **[P]** carried from an earlier read-only production observation in the repo docs (not re-read today) · **[U]** unverified, needs production state.

This extends `VISIONEX_AI_COST_FLOW.md` (read it first for the request path and the four under-billing scenarios). It does not repeat them; it re-confirms what could be re-confirmed, executes what was only read before, and turns the gaps into a plan.

## 1. Which table or function is authoritative for what

| Question | Authoritative | Not authoritative (do not use for it) |
|---|---|---|
| What did a provider call cost *us*? | `ai_usage_events.provider_cost_usd` per call, priced from `ai_price_book` at write time (`usageRecording.ts` `recordUsageEventIn`) [C] | Provider Hub `ph_metrics.total_cost_usd` (always 0 for chat), `vx_usage_ledger.actual_cost_usd` (only for metered requests) |
| What was a user *charged*? | `user_points` rows (the one ledger; balance = `SUM(points)` = `vx_balance`) [C]; the request-level record is `vx_usage_ledger` (`reserved_vx`, `consumed_vx`, `refunded_vx`, `status`) | `profiles` (no balance column), the browser sum in `AdminUsers` (fixed in #450/#456) |
| What does a plan include? | `billing_plans` / the entitlement functions (`ai_user_entitled`, `ai_subscription_gate*`, migration `20261062…`) [C] | the VX allowance is a *grant into `user_points`*, not a separate counter |
| Is the platform over its daily ceiling? | `check_ai_budget()` — see §3: it does **not** measure `ai-chat` | `ai_usage_events` is the right source for `ai-chat` but nothing reads it for enforcement |
| Per-user abuse limit | `check_ai_rate_limit` (60/day) + `check_ai_anon_rate_limit` [C] | — |

Four different things, four different tables: **provider cost** (`ai_usage_events`), **user charge** (`user_points` + `vx_usage_ledger`), **allowance** (grant rows into `user_points`), **enforcement** (`ai_budgets` via `check_ai_budget`, rate-limit counters). No single query joins them for an admin today (G2 in the cost-flow doc).

## 2. VX lifecycle: what is sound, what is not

Latest definitions (one per function; `git grep` over `supabase/migrations`): `vx_balance` 20261023, `vx_reserve` 20261023, `vx_reserve_metered` / `vx_settle_metered` / `vx_metered_charge` 20261055, `vx_settle` / `vx_release` / `vx_hold_points_row` 20261058, `vx_reap_stale_reservations` 20261023, `vx_reserve_for_whatsapp` 20261029, `vx_self_award_take` 20261043, `spend_vx` 20260411, `system_deduct_vx` 20260515 [C].

**Sound, with executed evidence** (`scripts/sql/vx-accounting-scenarios.mjs`, 23 `check(` calls, and the `vx-metered` / `vx-hide-reservations` scripts; only `vx-accounting-scenarios.mjs` has a CI step, in the "RLS authorization matrix" workflow) [E by the earlier pass; I re-ran only the new budget script and the RLS matrix today]:
- One request key → one hold; a replay of the same key holds nothing more (`vx_usage_ledger.idempotency_key UNIQUE`).
- A hold is settled or released at most once; `consumed + refunded ≤ reserved` is a CHECK.
- A refused request (insufficient VX, unpriced model, no ready model) makes no provider call.
- Fallback attempts share one reservation; no second charge.

**Gaps (all inherited from the cost-flow doc; re-confirmed against current source [C]):**
1. **Priced coverage is partial.** The seeded price book (`20261053…`, `20261054…`) has OpenAI and Groq rows only. The per-assistant chains in `assistants.ts` use `LUNA` (OpenAI), `GROQ`, `GEMINI`, `GEMINI_LITE` and `MISTRAL`; the file's own comments route education, research and long-context work to Gemini and multilingual/writing work to Mistral. **Gemini and Mistral models have no price-book row, so any answer from them is recorded `unpriced`** — for those assistants that is the *primary* path, not just a fallback. Dollars are under-counted, and a *metered* request for them would be refused (`unpriced_model`). How much traffic each assistant gets: [U]. Whether production has extra price rows added by data: [U].
2. **[Fixed by #462, `e230a639`; this paragraph describes the code before it.] Events are written fire-and-forget and failures were silent.** `recordUsageEventIn` ends `try { … await db.from("ai_usage_events").insert(…) } catch {}` and **never inspects the `{ error }` the insert returns**, so a rejected insert (constraint, RLS, outage) is not logged and not counted [C: `usageRecording.ts:74-94`]. Tests assert "never throws" (`ai-usage-metering.test.ts:290`) but nothing signals loss. Under-recording is invisible.
3. **No uniqueness on an event** (`(chain_id, attempt)` is not unique), so a double delivery would double-count dollars [E: `ai-budget-scenarios.mjs`]. The code has no retry path that does this today [C], so this is a hardening item, not an active bug.
4. **Four under-billing paths** (late event, reaped hold, unpriced model, missing event) are documented with reconciliation queries in cost-flow §10. Each favours the customer; each needs a product decision to change.
5. **While every `central_pricing_registry` row is disabled, `ai-chat` runs in shadow mode: nothing is held or charged** [C migration defaults; U production rows]. All provider spend is therefore uncharged by design today.
6. `check_ai_budget`'s VX leg counts `reserved_vx` of every ledger row not `refunded`/`expired` — including `settled` rows at their *hold* size, not what was consumed, and `failed` rows [E]. When a service is enabled this over-counts relative to real spend (conservative, but it can refuse sooner than a cost ceiling would).

## 3. `check_ai_budget` — executed, not just read

New: `scripts/sql/ai-budget-scenarios.mjs` (wired into the "RLS authorization matrix" workflow). It replays all migrations in PGlite and drives the real function against rows shaped like the ones the code writes. **19 checks and 1 mutation proof pass** [E]:

| Scenario | Result |
|---|---|
| 6 rows in `ai_interactions` vs a 5-request limit; 12,000 tokens vs a 10,000-token limit | refused — the Career AI path **is** counted |
| 50 `ai-chat` events in `ai_usage_events` = 500,000 tokens (50× the token limit, 10× the request limit) | **still "within budget"** — `ai-chat` spend is invisible to the token and request legs (**G1 demonstrated**) |
| No global row / row inactive | always "within budget" (G4) |
| Exception inside the function (table unreadable) | "within budget" — fail-open (G4) |
| VX leg: 60 settled + 40 reserved vs a 100 VX limit | refused at 100; refunded and expired holds excluded |
| `ai-chat` events with no ledger row (shadow mode) vs the VX leg | invisible to it as well |
| Rows from two days ago | not counted (day = `date_trunc('day', now())`) |
| Removing the request leg (mutation) | turns a check red |

`ai-chat` is the only caller [C: `supabase/functions/ai-chat/index.ts:261`], and treats an RPC error or `null` as "within budget". Image, TTS, document and voice functions do not call it at all [C, cost-flow G5].

**Why it fails to measure the assistant.** The function was written for the Career AI store (`ai_interactions`: `prompt_tokens`, `completion_tokens`). `ai-chat` records every provider attempt to `ai_usage_events` (a different table with a different shape: `usage` jsonb, `provider_cost_usd`, `cost_status`). The function was later extended to `vx_usage_ledger` (20261028), which is empty for `ai-chat` while services are disabled. There is no leg over `ai_usage_events`.

**Correct data source for each limit**
- Dollars (the thing that matters for spend): `SUM(provider_cost_usd)` over `ai_usage_events` for today, **plus a separate count of `unpriced`/`missing` calls** so the figure's error is visible rather than hidden.
- Requests: `COUNT(*)` of `ai_usage_events` per `function_name`, or per chain (`attempt = 1`) to count requests rather than attempts.
- Tokens: `usage->>'total_tokens'` where `usage_source = 'reported'`; `estimated` rows flagged.
- VX: `vx_usage_ledger` as today, using `consumed_vx + reserved_vx of open rows` rather than `reserved_vx` of settled rows.

## 4. Failure modes and an explicit policy for each (recommendations — none applied)

| Failure | Today | Recommended policy | Needs your approval? |
|---|---|---|---|
| Budget RPC errors / times out | proceeds (fail-open), no log | **Stay fail-open for availability, but log + count it** (a `security_event`/metric row) and raise an alert when more than N occur in an hour; closing it takes the assistant down for everyone on a metering fault | log/alert: no; fail-closed: **yes** |
| No active global row | proceeds | Treat as a **configuration error**: alert (do not block); ship an owner-set row via the admin settings | alert: no |
| Event insert rejected | silent | Log once per minute per reason with the code (never the payload); count in a metric | no |
| Provider returns no usage | recorded `missing`/`estimated` | Keep; report the share on the admin card; never present dollars without it | no |
| Model not in price book | `unpriced`, uncharged | Add rows **as data** for Gemini/Mistral from the providers' published pages; until then show "unpriced calls: N" beside any dollar total | adding prices: **yes** (pricing data) |
| Dollar ceiling reached | none exists | Per-chain, not global shutdown: refuse **new** requests with a clear 503 and retry-after; let in-flight finish; owner-set ceiling, default NULL = off | **yes** (enabling) |
| Provider quota/outage | chain falls back (tested) | unchanged; alert on fallback rate > threshold | no |
| Hold never settled | reaper returns it after 1 h | unchanged until the product decides on billing delivered answers | **yes** |

## 5. Proposed architecture for accurate limits, fallback and cost alerts

1. **Read model (low risk).** An admin-only SQL function `admin_ai_cost_daily(days)` returning aggregates from `ai_usage_events` (day, function, provider, resolved model, calls, failed, unpriced, missing, dollars) — no prompts, no user ids. Same pattern as `admin_user_balances()`: `SECURITY DEFINER`, fixed `search_path`, `has_role` check inside, `REVOKE … FROM PUBLIC, anon`. One admin card. Resolves G2.
2. **Visibility of loss (low risk).** Inspect the `{ error }` from the event insert and log a rate-limited, payload-free line; add a unit test (the existing test seam `stubDb(…, true)` already simulates a failed insert).
3. **Budget leg over events (needs approval).** Add nullable `daily_cost_usd_limit` to `ai_budgets` (NULL = off, so behaviour is unchanged until the owner sets it) and a dollar leg in `check_ai_budget` that reads `ai_usage_events`. Keep the `EXCEPTION → true` branch but make it **emit a signal** first. Collect 14 days of the §11 evidence in the cost-flow doc to choose the number; this audit proposes none.
4. **Alerts (low risk, no new cost).** A scheduled GitHub workflow cannot be trusted for cadence (observed gaps of hours); use the existing `pg_cron` to write a row to an alerts table when today's `unpriced` share, fallback rate or dollar total crosses an owner-set threshold, and surface it on the admin card.
5. **Price coverage (needs approval, data only).** Add Gemini and Mistral rows to `ai_price_book`, effective-dated, from published pricing.
6. **Do not** make the budget fail-closed, disable any service, or enable metering for `ai-chat` as part of any of the above.

## 6. Tests

- Added: `scripts/sql/ai-budget-scenarios.mjs` — 19 checks + 1 mutation proof [E], CI step in `.github/workflows/rls-authorization.yml`. It labels today's behaviour "CURRENT BEHAVIOUR", so changing the budget is a deliberate edit to the test, not an accident.
- Existing and unchanged (duplicate events, failed holds, retries, unpriced models, late events): `vx-accounting-scenarios.mjs` (invariants and the four under-billing scenarios), `vx-metered-scenarios.mjs`, `vx-hide-reservations-scenarios.mjs`, `src/test/ai-usage-metering.test.ts`, `ai-chat-limits.test.ts`, `ai-subscription-gate.test.ts`. I did not duplicate them.
- Not covered by any test: a failed event insert being *reported* (there is nothing to report yet); `ai_usage_events` double-delivery; the reaper settling from events (a policy change, not a bug).

## 7. Read-only `page_events` retention audit

**What is stored** [C]: `page_events(id, event_type, page_path, page_title, user_id, session_id, metadata jsonb, created_at)` (`20260331114241…`). Written only by `src/components/PageTracker.tsx`, once per route change: `event_type='page_view'`, `location.pathname` (no query string), `document.title`, and a random per-tab id kept in `sessionStorage`. The client never sets `user_id`; `metadata` is unused by the writer.
**Who can write/read** [C]: insert for `public` limited to six event types (`20260409151706…`); size caps (`metadata` < 4096 B, path ≤ 500, session ≤ 100) (`20260409173515…`); select for admins only. No update/delete policy; no retention job exists in any migration (`git grep` over `supabase/migrations`).
**Volume evidence available without querying production** [P]: earlier read-only observation in the repo docs recorded **357 events and 287 sessions over 7 days** (`VISIONEX_PHASE2_ASSESSMENT_AND_PLAN.md:68`, `FEATURE_MATRIX.md:54`). At that rate the table gains roughly 19,000 rows a year — on the order of a few MB. **I did not re-read the current row count or table size (that needs a production query); retention is therefore a privacy decision, not a capacity emergency.**
**Privacy implications**
1. **`PageTracker` runs without checking cookie/analytics consent** [C]: the file never imports `readConsent`, although `src/features/ads/consent.ts` already records an `analytics` choice. No cookie is set (sessionStorage only), but it is a first-party analytics record keyed by a per-tab pseudonymous id, written before any consent choice. Whether that needs consent depends on the owner's legal position and the published privacy policy, which I did not review.
2. **Paths and titles can carry identifiers** if any route embeds an id or a name in the path or `document.title` [U: not enumerated].
3. Anonymous inserts are unthrottled apart from size limits [C], so the table can be inflated by anyone.
**Proposed policy (not implemented; deletion needs your approval)**
- Keep raw `page_events` **90 days**, aggregates longer if wanted (the roadmap's T-A10/T-D1 already says 90).
- Implement as a daily `pg_cron` delete modelled on `20261071000000_prune_cron_run_history.sql` (#433), in batches, with an executed PGlite test over rows of every age — the same method as #433.
- Before the delete job: gate `PageTracker` on the consent record (or document why it is exempt), and decide whether to add an anonymous-insert rate limit.
- Update the privacy policy text to state what is collected and for how long.

## 8. Plan

**Low risk — can be done without further approval, each as its own PR**
1. ~~Log (rate-limited, payload-free) a failed `ai_usage_events` insert + unit test.~~ Done in #462 (`e230a639`, `src/test/usage-recording-failures.test.ts`).
2. `admin_ai_cost_daily(days)` read function + admin card, with an RLS-matrix block like #456's (anon refused, ordinary user refused, admin allowed, nothing written).
3. A read-only "late event / expired-with-events / unpriced share" report query set in `docs/` or an admin RPC.

**Needs your explicit approval first**
4. Any change to `check_ai_budget` behaviour (dollar leg, fail-closed, alert thresholds that block).
5. Price rows for Gemini/Mistral; any decision to bill the four under-billing paths.
6. Enabling `ai_chat` metering in `central_pricing_registry`.
7. The `page_events` delete job and the `PageTracker` consent gate.

## 9. Not verified

- Production `ai_budgets` row(s), `central_pricing_registry` enabled flags, extra `ai_price_book` rows, `bill_failed_billable_attempts`, the `page_events` row count and table size.
- That PostgREST `max_rows` is 1000 in production.
- Real cost against a provider invoice (calibration step in cost-flow §11).
