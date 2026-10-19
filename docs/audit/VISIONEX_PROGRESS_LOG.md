# Visionex — progress log

Durable checkpoint for the autonomous mission. Newest entry first. Update after each milestone. A new session should read this file, then `VISIONEX_REMAINING_RISKS.md` and `VISIONEX_PHASE2_ASSESSMENT_AND_PLAN.md`.

## 2026-10-19 (later) — status audit, then three PRs opened (none merged)
Verified from GitHub: main is `1598cca9`; #430–#437 merged by the owner, each head commit green, each merge commit has a successful Deploy run. #432 and #433 migrations were applied (Deploy logs).

| PR | Change | Evidence |
|---|---|---|
| #438 | RLS matrix: 38 → 84 checks, 4 → 7 mutation proofs | CI check "Who can read and write which rows" green. Found and fixed a fidelity gap: the two privilege-hardening migrations aborted in PGlite, so the old matrix ran against default grants |
| #439 | Synthetic restore rehearsal script + runbook §F | Local run: dump → encrypt → tamper detected → restore → fingerprints identical; known-bad control fails. Not the real platform; whole-schema pg_dump hung in PGlite |
| #440 | Google Fonts linked from index.html, not a CSS @import | Lighthouse ×3 each, local builds: FCP −0.5 s; LCP unchanged (~16 s); score change is TBT noise |

Findings (no change made):
- **Uptime monitor cadence.** "Site uptime" ran twice in ~11 h (00:13Z, 04:47Z) against ~44 scheduled; GitHub drops scheduled runs. Effective cadence is hours, not 15 minutes. Failure alerting = the failed run only (GitHub emails the person who last edited the cron line; owner's notification setting not verified). A reliable alert needs an outside monitor (owner account/decision).
- **Cron prune.** Migration applied 22:11Z. Whether the 03:40 UTC run happened and what it deleted: unable to verify without a production query.
- **`check_ai_budget`.** Only `ai-chat` calls it, and it counts `ai_interactions` (Career AI only) and `vx_usage_ledger` (metering off); `ai-chat` writes to neither, so the global budget does not see the main assistant's spend. Fail-open on error is deliberate; a missing active `ai_budgets` row also allows everything (production row not checked). Changing this is a charging/enforcement decision — not made.
- Not reviewed yet: VX duplicate-charge protection, provider routing/retries, admin dashboard freshness, locale/RTL/authenticated axe coverage, remaining security items (N7, N8, N9, advisories).

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
