# Visionex — progress log

Durable checkpoint for the autonomous mission. Newest entry first. Update after each milestone. A new session should read this file, then `VISIONEX_REMAINING_RISKS.md` and `VISIONEX_PHASE2_ASSESSMENT_AND_PLAN.md`.

## 2026-10-19 (fourth pass) — review of #450 and #452, billing decision table
Main `85b5ff91` (the five approved PRs #448, #449, #451, #453, #454 were merged by the owner's instruction; Deploy succeeded for each). #450 and #452 are open, behind main, unmerged.
- **#450 reviewed.** Orderings are total (`profiles.user_id` is UNIQUE; `user_points.id` is the primary key). Added `keyOf` dedupe after reproducing a repeat when a row arrives at the top of a newest-first read; 8 tests, tsc/ESLint/build clean locally. **Finding that changes its value:** under the schema defined by the migrations an admin session reads 0 rows of `user_points` (one owner-only SELECT policy, no admin policy; executed in PGlite, `profiles` readable, `credit_wallets` 0), so `AdminUsers` balances are wrong for everyone but the viewer regardless of the row cap. Production not verified. PR description corrected. The real fix is an admin-only balance function (migration; not written; needs approval).
- **#452 reviewed.** CLS before → after, local, synthetic delayed plans: en 0.272 → 0 (mobile) and 0.108 → 0.023 (desktop); ar 0.289 → 0 / 0.116 → 0.007; fa 0.308 → 0 / 0.115 → 0.007; hi 0.250 → 0 / 0.108 → 0.023. RTL text stays right-aligned in the loading state (screenshot checked). Visible cost: about 1 s of empty space under "Loading…". Lab numbers only; no real-user data exists in this repository.
- **Docs (separate PR):** four-scenario billing decision table, cost-measurement proposal and ceiling evidence list (`VISIONEX_AI_COST_FLOW.md` §10–12), advisory fixes, and the real limits of scheduled GitHub Actions. Notable evidence: 3 of the 6 default `ai-chat` chain models have no price row, so metered billing would refuse almost every request today.
- Uptime run history now: 00:13Z, 04:47Z, 10:30Z, 17:10Z on 2026-10-19 (4 runs in 18 h; checked 18:46Z).
No production changes, merges (this pass), deploys or costs.

## 2026-10-19 (third pass) — open PRs, none merged, nothing deployed (all except #450 and #452 later merged, see above)
Main at `d20d1ae3` when started. Opened (each its own branch; CI result is on the PR, not here):
| PR | What | Evidence |
|---|---|---|
| #448 | VX accounting invariants in PGlite (duplicate delivery, settle/release/reap idempotency, fallback attempts, malformed cost rows, clamp, conservation) | 23 checks + 3 mutation proofs, local; four "CURRENT BEHAVIOUR" under-billing paths recorded, none changed |
| #449 | Chain timeout / silent open / throwing sink / malformed stream usage / one event per attempt | 8 tests; found that an open that never answers leaves no usage event |
| #450 | Admin user list reads `profiles` and `user_points` in pages (API row cap made balances partial) | 7 tests; production size and `max_rows` not verified |
| #451 | AI cost flow: source-of-truth table, answers to the seven questions, dashboard accuracy | docs; Provider Hub cost is 0 for chat, `ai_usage_cost_daily` unread, budget blind to `ai-chat` |
| #452 | `/pricing` footer jump (CLS) | production 0.244 → local 0.272/0.108 → 0/0.023 (mobile/desktop, synthetic delayed plans, 3 runs) |
| #453 | axe job: + Persian, Urdu, Hindi | 67 passed locally |
| this PR | second-pass security/uptime notes | six advisories one by one, TipTap migration facts, RLS gaps |

Production Lighthouse (public GET, mobile): `/` score 47–48, FCP ~6.9–7.1 s, LCP 9.9–10.0 s, CLS 0; `/pricing` 23, CLS 0.244; `/bazaar` 16, CLS 0.439 (shifts in `div.animate-in > div.relative`, not reproducible without data, not fixed). LCP element on `/` is `h1#hero-heading`. `/favicon.png` is 1.27 MB and doubles as the WhatsApp profile picture source, so it was not shrunk (see #452).
Uptime: `Site uptime` ran 3 times in 16 h; alert delivery unverifiable from here.
No production queries, merges, deploys, charges, secrets or paid services in this pass.

## 2026-10-19 (final) — everything below merged and deployed
Owner instructed "complete to the end including the merge". Merged (squash, each after CI on its head; branches updated one at a time because the base branch is protected "up to date"): #438 `0246ff42`, #439 `dd22aea5`, #440 `b044449a`, #441 `8b8128e6`, #442 `2904954b`, #443 `2ce339b3`, #444 `73cdfe08`, #445 `008ab483`, #446 `dcf6b2f5` (its branch had to be merged with main locally: add/add conflict in `tests/a11y/axe.spec.ts` after #445 was squashed; resolved by keeping the branch version, diff against main checked = Navbar.tsx + the emptied baseline).
- Deploy workflow: success for every merge commit including `dcf6b2f5`. No migration in any of these PRs.
- Live check (anonymous GET, 2026-10-19): `https://visionex.app/` returns 200 HTML containing the fonts `<link>` and preconnects; the served `index-*.css` contains no font `@import`; the main bundle is served as JavaScript.
- New CI: `Accessibility (axe)` — 33 scans (11 routes × en/ar/es) + a keyboard test, empty baseline, green on `dcf6b2f5`. First finding (nav contrast over a dark hero on `/games`) fixed in #446. This job only covers public routes with a stub backend.
- Still true: the earlier lines of this entry about #438–#441 "none merged" are superseded by this paragraph. Open decisions for the owner: `check_ai_budget` / dollar ceiling (see `VISIONEX_AI_COST_FLOW.md`), sign-up enumeration wording, CAPTCHA, Supabase Pro, an outside uptime monitor (`VISIONEX_REMAINING_RISKS.md` §9), TipTap major bump. Not verified: the 03:40 UTC cron prune run (needs a production query), GitHub e-mail on a failed uptime run, real Supabase backup/restore.

## 2026-10-19 (later) — status audit, then three PRs opened (since merged, see above)
Verified from GitHub: main is `1598cca9`; #430–#437 merged by the owner, each head commit green, each merge commit has a successful Deploy run. #432 and #433 migrations were applied (Deploy logs).

| PR | Change | Evidence |
|---|---|---|
| #438 | RLS matrix: 38 → 84 checks, 4 → 7 mutation proofs | CI check "Who can read and write which rows" green. Found and fixed a fidelity gap: the two privilege-hardening migrations aborted in PGlite, so the old matrix ran against default grants |
| #439 | Synthetic restore rehearsal script + runbook §F | Local run: dump → encrypt → tamper detected → restore → fingerprints identical; known-bad control fails. Not the real platform; whole-schema pg_dump hung in PGlite |
| #440 | Google Fonts linked from index.html, not a CSS @import | Lighthouse ×3 each, local builds: FCP −0.5 s; LCP unchanged (~16 s); score change is TBT noise |

Findings (no change made):
- **Uptime monitor cadence.** "Site uptime" ran twice in ~11 h (00:13Z, 04:47Z) against ~44 scheduled; GitHub drops scheduled runs. Effective cadence is hours, not 15 minutes. Failure alerting = the failed run only (GitHub emails the person who last edited the cron line; owner's notification setting not verified). A reliable alert needs an outside monitor (owner account/decision).
- **Cron prune.** Migration applied 22:11Z. Whether the 03:40 UTC run happened and what it deleted: unable to verify without a production query.
- **`check_ai_budget`.** Only `ai-chat` calls it, and it counts `ai_interactions` (Career AI only) and `vx_usage_ledger` (metering off); `ai-chat` writes to neither (it writes provider usage to `ai_usage_events`, which the budget does not read; correction of an earlier wording), so the global budget does not see the main assistant's spend. Fail-open on error is deliberate; a missing active `ai_budgets` row also allows everything (production row not checked). Changing this is a charging/enforcement decision — not made. Full trace, five confirmed gaps and hypotheses: `VISIONEX_AI_COST_FLOW.md` (#443). The VX reserve/settle/idempotency path itself reviewed as sound; no service is enabled, so nothing is charged today.
- Uptime wording and options: #442. Not reviewed yet: locale/RTL/authenticated axe coverage, remaining security items (N7, N8, N9, advisories).

## 2026-10-19 — merged and verified
Merged to main (squash, auto-merge, in order): #430 docs and accessibility, #431 AdBanner consent, #432 library webhook idempotency, #433 cron history prune, #434 uptime check, #435 RLS authorization matrix; #436 (/services contrast) was waiting on CI when this was written — check its state, do not assume.
Production evidence (read-only): the Deploy run for #432 applied `20261070000000_library_webhook_idempotency.sql` and the three unique indexes exist; the `cron-run-history-prune` job is scheduled at `40 3 * * *` and `cron.job_run_details` held 60,366 rows (oldest 2026-07-23) before its first run, so check the row count after 03:40 UTC. The `Site uptime` workflow has not yet run: dispatch it once from the Actions tab to confirm it.
RLS matrix (#435): 38 checks and 4 mutation proofs pass on seven tables; no defect found; it runs in CI on PRs that touch migrations.
Not started: restore rehearsal, provider/VX audit (check_ai_budget fail-open needs an owner decision), admin dashboard, Lighthouse remediation, other locales/RTL axe beyond /bazaar in Arabic, manual NVDA/VoiceOver/keyboard testing.

## 2026-10-18 (later) — focused PRs opened from main (all open, none merged)
| PR | Change | Verification |
|---|---|---|
| #431 | AdBanner loads AdSense only after advertising consent (N1) | 4 new tests; fail on old code, pass on fix |
| #432 | Library Stripe webhook safe to redeliver (donation, rental, licence) | migration executed in PGlite; 7 tests; deno check |
| #433 | Daily prune of pg_cron run history (N5) | DELETE executed in PGlite on rows of every age; 3 tests |
| #434 | External uptime + certificate check every 15 min | script run against production (ok) and failure cases (exit 1); 3 tests |
CI for #431-#434 was still running at the time of writing; read the PR checks, not this line.

Decided not to do without the owner: sign-up wording that reveals an existing account (N7) is a product/security-policy trade-off with unknown production auth settings; Supabase Pro items; merging (merge deploys).
Not started in this session: PGlite authorization matrix, restore test, provider/VX audit, admin dashboard, Lighthouse remediation, other locales/RTL axe. They remain in the order given in the next-actions list below.

## 2026-10-18 — Phase 1 (PR #430)
- Branch `claude/audit-phase2-plan`. CI green on `850cafe3` (7 real checks success; 5 skipped are conditional/disabled in the workflow files, see the axe report).
- axe rounds 1–3 in `VISIONEX_AXE_SCAN_REPORT.md`: fixes for footer contrast, bazaar card nested-interactive, toast close name and list markup, chat send/log, XP progress bar, settings switches and selects. Scans were local with a mock backend and a synthetic session; production was never touched.
- `ai-route-report-workflow`: passes on Linux CI (run 39148051646). Locally it failed only because the working copy was CRLF. Added `*.yml text eol=lf` to `.gitattributes`; after re-checkout the test passes locally (3/3).
- Wishlist button label and toast now use existing localized keys (`wishlist.title`, `wishlist.added`).
- Not done / limits: manual NVDA/VoiceOver/keyboard, shop-owner screens, 18 other locales, themes, mobile, Lighthouse remediation.

## Next actions (in order; each its own focused PR from main)
1. PGlite authorization test matrix (RISK item 3), starting with user_points, credit_wallets, user_subscriptions.
2. Restore rehearsal in an isolated database with synthetic data (DR report, owner decisions first).
3. /services colour-600-on-white contrast nodes (RISK item 4).
4. Lighthouse: Google Fonts render-blocking, CLS on / and /pricing.
5. Provider/VX: check_ai_budget fail-open (N6) needs an owner decision on fail-closed.

## Needs owner approval (nothing was changed)
Supabase Pro (server-side leaked-password protection, managed backups); test-mode payment keys; disposable test accounts; dispatching the read-only server probe; merging PRs (merge deploys to production).
