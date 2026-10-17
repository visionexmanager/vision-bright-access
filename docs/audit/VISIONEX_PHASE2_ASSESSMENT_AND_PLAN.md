# Visionex — Phase 2 assessment and implementation plan

Date: 2026-10-17 · Base: `main` @ `f7265be2` (PRs #427–#429 merged and deployed).
Status: **assessment only.** No application code, migration or workflow changed in this PR, nothing deployed, no production workflow dispatched.
Evidence labels: **[repo]** read in this checkout · **[live-ro]** read-only query/probe of production on 2026-10-17 (aggregate counts only, no row content) · **[inferred]** reasoning, not observed.

## 0. Facts that change the priorities

| Fact | Evidence |
|---|---|
| The Supabase organisation is on the **free** plan | [live-ro] Supabase `get_organization` → `plan: free`. Consistent with the 402 on leaked-password protection |
| **Nothing backs up the production database.** `infrastructure/DISASTER_RECOVERY.md` says backups are "handled by Supabase… on every paid project tier", which does not apply to a free project; no `pg_dump` / `supabase db dump` exists in `.github/`, `scripts/`, `infra/`, `server/`; the only dump script is for the separate ISP service (`services/isp-management/deploy/scripts/backup.sh`) | [repo] + [live-ro] |
| The platform is **pre-revenue and small**: 20 users, 0 new users in 30 days, 0 subscriptions, 0 subscription orders, 0 Bazaar orders, 0 Bazaar products (2 shops), 1 Academy enrolment (6 courses), 8 library books, 0 arcade runs, 14 signup-page views in 30 days, 287 sessions in 7 days, 23 WhatsApp conversations | [live-ro] |
| VX metering is **built and switched off**: 9 services in `central_pricing_registry`, 0 enabled, 0 `vx_usage_ledger` rows | [live-ro]; design in `.claude/references/vx-architecture.md` |
| `AdminInfra` shows **invented data** (see 2.3) | [repo] `src/pages/admin/AdminInfra.tsx:17-40,155` |

These mean: protect the data first, make the operator screens honest, then fix the acquisition funnel — not more features or more metering.

## 1. Part 1 — outstanding audit items

| # | Item | State | Evidence / gap | Plan task |
|---|---|---|---|---|
| 1.1 | Bazaar contrast + nested-interactive | Partially fixed | PR #427 labelled the selects and fixed primary contrast; production axe on `/bazaar` after deploy still reported 1 contrast node (`#898e97` on white, 3.29:1) and 1 `nested-interactive` — a clickable `div` card (`src/pages/VXBazaar.tsx:852`, `cursor-pointer … h-[400px]`) containing interactive children. The grey source was not located (`grep 898e97 src` empty; likely a `text-stone-500`/opacity utility, e.g. VXBazaar.tsx:766, 794, 796) | T-A5 |
| 1.2 | Authenticated and cross-user authorization tests | **Missing** | No test runs SQL as a role: `grep "set role\|request.jwt.claim" src/test scripts` → none. PGlite is already used for behaviour tests (`src/test/kids-membership-policy-recursion.test.ts`, `ivx-award-allowance.test.ts`, `ai-subscription-gate.test.ts`), so the harness exists; `src/test/billing-rls-hardening.test.ts` and `rpc-privilege-isolation.test.ts` check migration text, not behaviour. Live: only anonymous probes were done | T-B1 |
| 1.3 | Provider Hub with an authorized admin | Unverified | `supabase/functions/provider-hub/index.ts` admin gate (`has_role` via `roleDb`) and the two `ph_get_provider_stats` calls now use the service client; no test calls `get_metrics`. `scripts/e2e/function-harness.ts` + `.github/workflows/e2e-function-harness.yml` run functions against a stub Supabase, so a no-credential test is possible | T-B2 |
| 1.4 | Manual screen-reader / keyboard testing | **Missing** (automation only) | `playwright.config.ts` has `testDir: "./tests"` but **`tests/` does not exist** and no workflow runs Playwright; the only axe-style checks in CI are the static tests added in #427. Guidance: `docs/audit/VISIONEX_MANUAL_ACCESSIBILITY_TEST_GUIDE.md` (added in this PR) | T-A4 |
| 1.5 | Lighthouse | **Missing** | No Lighthouse config or workflow (`ls .github/workflows` has none). Home page measured by Performance API: LCP 3.3 s, CLS 0.254 (see PERFORMANCE report) | T-C3 |
| 1.6 | Server access, backups, recovery | **Backups missing**; server probe exists, unrun | Backup gap in section 0. Server: `.github/workflows/server-probe.yml` (read-only SSH check) and `spa-deploy-doctor.yml` exist; the Data Hub store is on the Hetzner disk (`scripts/datahub/datahub.sh`). No restore drill exists anywhere | T-A1 |
| 1.7 | Payment + webhook end-to-end | Signatures verified; replay/idempotency **unverified**; no behavioural tests | All five payment webhooks verify signatures: `bazaar-stripe-webhook`, `library-stripe-webhook` (HMAC over `t.body`, 300 s tolerance, line 36), `library-paypal-webhook` (`verifyPayPalWebhookSignature`), `library-crypto-webhook` (`verifyCoinbaseSignature`), `career-billing-webhook`. Only a static test asserts they log signature failures (`src/test/security-hardening.test.ts:113-115`). **Confirmed gap:** `library-stripe-webhook/index.ts:66-70` inserts into `library_donations` with no event/session key, so a redelivered `checkout.session.completed` double-counts a donation; lines 84/88 (`library_borrowed_books`, `library_licenses`) have no visible idempotency either (a unique constraint may exist; not found in the migrations I grepped). `subscription_orders`: 0 rows, so nothing has ever been paid through the site | T-A3 |
| 1.8 | Windows CRLF test failure | Root cause known | `ai-route-report-workflow.test.ts:17` asserts `"permissions:\n  contents: read"`; `.gitattributes` forces LF for `*.mjs *.cjs *.sql *.awk *.conf *.sh` but **not `*.yml`**. 27 tests read workflow files | T-A2 |
| 1.9 | Leaked-password protection | **Blocked by plan** | `supabase-auth-hardening.yml` apply → HTTP 402 "Pro Plans and up" (run 39052467400). Current: `password_hibp_enabled=false`, `password_min_length=6` (run 39052428262) | T-A6 |

**Client-side vs server-side password protection (be precise):**
- *Client-side (live since #429):* `src/lib/pwnedPassword.ts`, called in `src/pages/Signup.tsx` and `ResetPassword.tsx`. Protects people who use the website forms. **Bypassable** by calling the Supabase Auth API directly with the public key. Fails open on network error.
- *Server-side (not enabled):* Supabase Auth's HIBP check. Applies to every path. Needs the Pro plan.
- I did not identify a free server-side equivalent and have not investigated one further; do not assume the client check is a substitute.
- `password_min_length=6` can be raised on the free plan through the same Management API call (no cost); the UI minimums in `Signup.tsx:88,226` and `ResetPassword.tsx:56,122` must change in the same PR.

## 2. Part 2 — proposed improvements vs what exists

### 2.1 Continuous security, service-health and failure alerts — **Partially implemented**
- Exists: `.github/workflows/security-monitor.yml` (hourly cron `17 * * * *`, reads `security_event_summary(hours)` from migration `20261018000000` and `ai_anon_usage`, fails on platform ceilings, forged-webhook spikes, distinct-caller spikes, >80% daily ceiling). Also `external-sources-health.yml`, `library-search-health.yml`, `tv-stream-health-cron.yml`, `whatsapp-voice-probe.yml`, `provider-smoke.yml`, `ai-provider-eval.yml`, `live-route-contract.yml`, `spa-deploy-doctor.yml`, and the `health-check` Edge Function (authoritative on provider keys).
- Notification channel: **only "a failed scheduled run notifies the owner"** (stated in the monitor's header) — i.e. GitHub's failed-workflow email. No pager/chat/uptime service is configured (`grep -i sentry|datadog|uptimerobot|pagerduty` over `package.json src supabase/functions .github` → none).
- Gaps: (a) no external uptime check of `visionex.app` itself and of the Edge Functions on a schedule with an alert; (b) no alert for **free-plan limits** (database size, egress, auth users, function invocations) or for project **pause**; (c) no alert on webhook delivery failures other than forged signatures; (d) no client error reporting beyond `src/main.tsx` and `src/features/arcade/monitoring/arcadeMonitoring.ts`.
- Recommendation: extend the existing pattern (scheduled workflow that fails on a threshold), no new vendor.

### 2.2 AI routing, fallback, caching, cost limits, VX metering — **Implemented, mostly unverified in production; metering intentionally off**
- Routing/fallback: `supabase/functions/_shared/providerRouter.ts`, `providerSelection.ts`, `providerState.ts`, `aiProvider.ts`; readiness-driven demotion and probes (`ai-provider-eval.yml`, `live-route-contract.yml`; tests `openai-reliability-routing.test.ts`, `provider-chat-recording.test.ts`, `provider-error-logs.test.ts`). Registry: 25 `ph_providers`, 24 `ph_logs` rows in 7 days [live-ro] (low traffic).
- Cost limits: `check_ai_budget` / `check_ai_rate_limit` called from `ai-chat`, `file-convert`, `kids-*` functions; public-endpoint ceilings in `ai_anon_usage` and `_shared/aiDailyLimit.ts`; hourly review by `security-monitor.yml`.
- Metering: `_shared/metering.ts`, `usageMeter.ts`, `usageSink.ts`, `meteredFetch.ts`, `streamUsage.ts`; tests `ai-usage-metering.test.ts`, `ai-usage-streaming.test.ts`, `ai-usage-media.test.ts`, `vx-meter.test.ts`, `vx-metered-request.test.ts`. Live: 0/9 services enabled, 0 ledger rows [live-ro] — so **no real-money path is exercised**.
- Caching: only the career AI has a response cache (`_shared/careerAiOrchestrator.ts`, table `ai_response_cache`). General `ai-chat` has none. **Not recommended yet:** with ~24 provider calls per week there is nothing to save; add caching only after usage data justifies it.
- Gap: no admin-visible cost/usage view (`grep ai_usage|ai_cost src/pages/admin` → none); spend is visible only through `luna-usage-report.yml` and raw tables.

### 2.3 Unified admin dashboard with trustworthy data — **Partially implemented; one screen is fabricated**
- Real: `src/pages/admin/AdminDashboard.tsx` (live counts from `products`, `profiles`, `service_requests`, `content_reports`, …), `AdminUsers`, `AdminSubscriptionOrders`, `AdminVX`, `AdminVXPricing`, `AdminLogs`, `AdminAnalytics`, `OwnerControlCenter`, `docs/owner-control-centre.md`.
- **Defect:** `AdminInfra.tsx` (`/admin/infra`, `App.tsx:1183`) renders constants, not measurements: `SERVICE_HEALTH` (lines 17–26: all `ok: true` for "redisClusters", "cdn", "waf", "vault", "aiWorkers", "billingEngine"), `QUEUE_REGIONS` (28–34: invented queue depths and workers per region), `SECURITY_CONTROLS` (36+: "cloudArmorWaf", "ddosProtection" all `on: true`), a chart built from `Math.random()` (line 155), and a link to `grafana.internal.visionex.ai` (line 79). The deployment actually runs on one Hetzner VPS + Supabase; the GKE jobs are "not yet enabled" in CI. An admin reading "all systems green" is being misinformed.
- Gap: no single place showing provider health (`ph_*`), AI cost, subscription/payment state (`subscription_orders`, `user_subscriptions`), webhook failures (`security_event_summary`) or error rates.

### 2.4 Automated accessibility + practical NVDA/VoiceOver/keyboard — **Missing** (partial static checks)
- Exists: static regression tests `src/test/primary-colour-contrast.test.ts`, `bazaar-select-labels.test.ts`; `docs/accessibility-validation.md`; `visionex-accessibility-reviewer` agent; Playwright installed (`package.json`) with config but no tests.
- Gap: no browser-driven axe in CI, no manual protocol. Added: `VISIONEX_MANUAL_ACCESSIBILITY_TEST_GUIDE.md`.

### 2.5 Safe deployment, post-deploy verification, rollback — **Implemented for deploy/verify; rollback missing for the real stack**
- Exists and verified in this session: `deploy.yml` records the previous build, waits for the new bundle (`Last-Modified`/entry hash — "still the previous build" loop, lines ~125–233), then smoke-checks 200; migrations job lists applied files; `deploy-changed-supabase-functions.sh` deploys only changed functions with retries; `reconcile-release.yml`; `spa-deploy-doctor.yml`; `vx-deploy-verify.yml`; `edge-function-jwt-lists.test.ts`.
- Gap: the only rollback workflow is GKE-specific and disabled (`ci-cd.yml` "Emergency Rollback" skipped). There is **no documented, tested rollback for the Hetzner SPA, the Edge Functions or a bad migration** (migrations are forward-only). RELEASE report gives the revert path ad hoc.

### 2.6 Privacy-conscious product analytics — **Implemented, minimal; funnel and retention missing**
- Exists: `src/components/PageTracker.tsx` inserts `page_view` into `page_events` with path, title and a per-tab random session id (no user id, no IP, no cookie); constraints cap metadata/path/session length (migration `20260409173515_…`); admin view `AdminAnalytics.tsx`, `AdminAcademyAnalytics.tsx`; 357 events / 287 sessions in 7 days [live-ro].
- Gaps: no conversion events (signup started/completed, upgrade clicked, first AI request, first lesson); no retention job found for `page_events`; no consent/Do-Not-Track handling or privacy-policy statement verified; anonymous inserts are unthrottled beyond size limits.

### 2.7 Revenue-focused prioritisation — **Missing as an analysis; data now available**
Live funnel [live-ro]: 287 sessions/7 d → 14 signup-page views/30 d → 0 new users/30 d → 0 subscriptions. WhatsApp (23 conversations, more than the 20 registered users) is the most engaged channel. Supply side is empty: 0 Bazaar products, 0 arcade runs, 1 Academy enrolment.
**Not recommended yet:** enabling VX billing, adding providers, more games, or Bazaar transaction features — nothing downstream converts yet.

## 3. Implementation plan

Effort: XS < ½ day · S ≈ 1 day · M ≈ 2–4 days · L ≈ 1–2 weeks. "Safe w/o prod creds" = can be built and tested in CI/PGlite/stubs without production secrets or a human account action.

### Phase A — safeguards (do first; zero new recurring cost unless stated)

| ID | Task | Value | Security / reliability | Current → gap | Effort | Recurring cost | Dependencies / risks | Acceptance criteria / tests | Safe w/o prod creds? |
|---|---|---|---|---|---|---|---|---|---|
| **T-A1** | **Database backup + restore drill** | Prevents total, unrecoverable data loss (users, content, wallets) | Highest reliability item | Free plan, no dumps (§0) → Option 1: Supabase Pro (Supabase documents daily backups on paid plans; point-in-time recovery is a separate add-on — confirm current terms). Option 2 (free): scheduled `pg_dump` from a workflow, encrypted (age/gpg) and copied by SSH to the Hetzner persistent disk (pattern: Data Hub), retention 14 days, never in public artifacts | M (Option 2) / XS (Option 1) | **Option 1: Supabase Pro, list price about $25/month at last check — verify current pricing; needs your approval.** Option 2: $0 (uses existing disk) | Option 2 needs `SUPABASE_DB_PASSWORD` (exists) + the SSH key already used by Data Hub; free-plan direct DB host may be IPv6-only → use the pooler; dump contains personal data → encryption key custody is yours | A restore of last night's dump into a scratch Postgres succeeds in CI with row counts matching; dump file is encrypted; failure fails the workflow; runbook `docs/…/restore.md` | Build + restore test: yes (Postgres service container, synthetic data). First real dump: needs your go-ahead |
| **T-A2** | Fix CRLF test failures | Windows developers get true signal | Test reliability | `.gitattributes` lacks `*.yml` (27 tests read workflows) → add `*.yml text eol=lf`, `*.yaml text eol=lf` | XS | $0 | Contributors must `git add --renormalize` | `ai-route-report-workflow.test.ts` passes on Windows; CI unchanged | Yes |
| **T-A3** | Payment-webhook idempotency + behavioural tests | Correct revenue/donation data once payments start | High: duplicate grants, double counts | Signature + 300 s tolerance exist; no event dedupe (§1.7) → add a `processed_webhook_events(provider, event_id)` unique table or unique keys on `library_donations`/`library_licenses`/`library_borrowed_books`; handlers return 200 on duplicates; tests with signed fixtures for Stripe/PayPal/Coinbase | M | $0 | Migration on live tables (additive); Stripe/PayPal live-mode E2E needs **your test-mode keys and an account** | Replaying the same signed event twice yields one row; bad signature → 400 + security event; tests in `src/test/` using PGlite + the handler functions | Yes (fixtures); live test-mode run needs you |
| **T-A4** | Browser a11y automation in CI | Catches regressions like #427's 12-route contrast failure | Accessibility is the product's core promise | `tests/` missing, axe not wired (§1.4) → Playwright + `@axe-core/playwright` against `vite preview` for ~15 public routes, fail on serious/critical; plus manual guide | M | $0 (dev deps only) | Adds CI minutes; flakiness risk (language chunk loads late); pre-existing violations need a baseline file | CI job fails on a seeded violation, passes on current main after baseline; guide followed once by a screen-reader user | Yes (public routes). Authenticated routes need test accounts |
| **T-A5** | Finish Bazaar a11y | Removes remaining axe failures on a main nav page | WCAG 2.2 AA | 1 contrast node + nested-interactive (§1.1) → make the card a single link/button with non-interactive children, raise the grey | S | $0 | Visual change in a dark theme page; needs real-browser verification | axe on `/bazaar` = 0 violations; keyboard: one tab stop per card, Enter opens it | Yes |
| **T-A6** | Password policy, honest scope | Closes the direct-API bypass only if Pro | Account takeover via reused breached passwords | Client check live; server off (§1.9) → (i) **decision for you:** Pro plan, then run `Supabase Auth hardening` apply; (ii) free now: raise `password_min_length` to 8 via the same workflow (+ UI minimums) | XS | **Pro plan (see T-A1 for price) — needs approval** (shared with T-A1 Option 1) | Raising min length affects only new/changed passwords | After approval: `password_hibp_enabled=true` verified by the workflow; signup with a known-breached password rejected through the raw Auth API | Min-length change: yes; HIBP: blocked on plan |
| **T-A7** | Rollback runbook + redeploy-previous | Recovery in minutes, not guesswork | High | Only disabled GKE rollback exists (§2.5) → `docs` runbook: SPA (redeploy prior SHA via `workflow_dispatch`), Edge Functions (`functions` input at prior SHA), migrations (forward-fix pattern, grant-restore snippets) and a dry-run test of the SPA path | S | $0 | Needs one rehearsed rollback on a quiet day; must not weaken the CI gate (AGENTS.md) | Runbook exercised once; `deploy.yml` accepts a SHA input and still requires CI-green | Mostly (rehearsal touches production) |

### Phase B — verification of authorization and money paths

| ID | Task | Value / impact | Current → gap | Effort | Cost | Risks | Acceptance | Safe w/o creds? |
|---|---|---|---|---|---|---|---|---|
| **T-B1** | Cross-user RLS/RPC test suite (PGlite, `set role authenticated` + `request.jwt.claims`) | Proves user A cannot read/write user B's wallet, subscriptions, notifications, profiles, WhatsApp rows, org data | None today (§1.2) → generic helper + ~40 assertions over the sensitive tables and the 9 write-capable anon/auth RPCs reviewed in the Security report | M | $0 | PGlite extension limits (vector, pg_cron) — stub per existing tests | Each assertion fails when its policy is dropped (mutation-checked); runs in the Vitest job | Yes |
| **T-B2** | Provider Hub admin-path test | Confirms the PR #427 change works for admins and is refused for users | Untested (§1.3) → function-harness test: non-admin → 403 + `provider_hub_forbidden` event; admin → `get_metrics` returns the stub's numbers via the service client | S | $0 | None | Test in `e2e-function-harness` | Yes. A live check with your admin login stays optional |
| **T-B3** | Live admin smoke (read-only) | Confirms production screen after #427 | Not run | XS | $0 | Needs an admin session | You open `/admin` Provider Hub; no empty-metrics error | **Needs your account** |

### Phase C — cost control and operational visibility

| ID | Task | Value | Current → gap | Effort | Cost | Risks | Acceptance | Safe w/o creds? |
|---|---|---|---|---|---|---|---|---|
| **T-C1** | Replace fake `AdminInfra` with real data (or remove sections) | An honest operator screen | Hard-coded "all OK" (§2.3) → read `ph_providers`/`ph_metrics`, `security_event_summary`, the `health-check` function; delete invented Redis/WAF/queue/GKE rows and the Grafana link; show "not monitored" where unknown | M | $0 | Admin UI i18n (20 locales) | No `Math.random`/constant health in `src/pages/admin`; a guard test fails if a literal `ok: true` array returns; unknown ≠ green | Yes |
| **T-C2** | Alerting v2 on the existing pattern | Know about outages and free-plan exhaustion before users do | Failed-workflow email only; no uptime/quota/pause alert (§2.1) → scheduled workflow: site + key Edge Function probes, DB size and plan limits from the Management API usage endpoints (verify availability), webhook error rate; fail on threshold | S–M | $0 | GitHub schedule drift (best effort, not real-time); log is public — booleans only | Seeded failure turns the run red; no secrets in logs; documented thresholds | Yes (uses existing secrets) |
| **T-C3** | Lighthouse/Web-Vitals job | Measured LCP/CLS/INP with budgets; fixes the 0.254 CLS | Single Performance-API reading (§1.5) → `lighthouse-ci` against production, weekly + manual; budgets: LCP ≤ 2.5 s, CLS ≤ 0.1 on `/`, `/services`, `/library`, `/pricing` | S, then S–M remediation (reserve height for the late section at `section.px-4.pb-20`; split the two ~540 kB entry chunks) | $0 | Runner variance; do not change caching/indexing of private pages | Report artifact (public-safe), before/after numbers in `VISIONEX_PERFORMANCE_REPORT.md` | Yes |
| **T-C4** | Admin AI cost/usage panel (read-only) | See spend per provider/feature before enabling any billing | No view (§2.2) → `ph_metrics`/usage tables via an admin-gated RPC | S–M | $0 | Must not expose provider margins to non-admins (service-role/admin RPC only) | Admin sees 7/30-day cost by provider; non-admin gets 403 (T-B1 test) | Yes |
| **T-C5** | Keep VX metering **off**; write the go/no-go checklist | Avoids charging users on unproven pricing | Built, 0/9 enabled (§2.2) | XS | $0 | Owner pricing decisions pending (memory: VX economics audit) | Checklist in `.claude/references/vx-pre-deploy-checklist.md` updated; no enablement without your approval | Yes |

### Phase D — product and revenue (only after A–C; each needs your approval of scope)

| ID | Task | Value | Evidence for priority | Effort | Cost | Acceptance |
|---|---|---|---|---|---|---|
| **T-D1** | Funnel events + `page_events` retention | Tells you where the 287 weekly sessions drop out | Funnel is 287 → 14 → 0 [live-ro]; no conversion events, no retention job (§2.6) | S | $0 | Events `signup_started/completed`, `cta_clicked`, `first_ai_request`, `first_lesson`; no user id/IP; 90-day delete job; admin funnel view |
| **T-D2** | WhatsApp → web activation | Biggest engaged audience (23 conversations) is not converting to accounts | `wa_conversations` 23 vs 20 users [live-ro]; assistant docs `docs/whatsapp-ai-assistant.md` | M | $0 (within existing WhatsApp templates) | Measured share of WhatsApp users who sign up; opt-in only |
| **T-D3** | Academy first, then Library | Content exists (6 courses, 8 books) but 1 enrolment | Lowest-effort supply already in place | M | $0 | Course discoverability from home; measured enrolment lift |
| **T-D4** | Bazaar: decide seed-or-hide | A marketplace with 0 products and 0 orders harms trust | 2 shops, 0 products [live-ro] | S | $0 | Either curated seed products with owner consent, or the section is labelled "opening soon" |
| **T-D5** | Games: find out why 0 runs | `arcade_result_submissions` = 0 | Possibly discoverability or an auth gate; investigate before building | S | $0 | Root cause documented |
| **T-D6** | Subscription checkout rehearsal | First sale path is manual (`subscription_orders`, `AdminSubscriptionOrders`) | 0 orders ever | S | $0 | End-to-end with your test account and a test order |

### Explicitly not recommended now
Semantic caching for `ai-chat`; new AI providers; enabling VX billing; GKE/Grafana (not in use); a paid monitoring vendor; Playwright for authenticated routes before test accounts exist.

## 4. Approvals needed from you

1. **Backups:** choose Option 1 (Supabase Pro — verify current price; it also unlocks server-side leaked-password protection) or Option 2 (free encrypted dump to the Hetzner disk). *I recommend deciding this first; the database currently has no backup.*
2. Permission to run the first real backup/restore drill and (later) the read-only `Probe the server` workflow.
3. A **test-mode** Stripe/PayPal/Coinbase set of keys and one test account, if you want live payment E2E (T-A3, T-D6). Not needed for the code and fixture tests.
4. An admin login session for T-B3.
5. Whether to raise `password_min_length` to 8 (free, small UX change).
6. Scope approval for any Phase D item.

## 5. Not verified in this assessment
Row-level security as an authenticated user, Supabase usage/limit figures (plan limits were not queried), backup availability beyond the plan lookup, Hetzner server state, live payment flows, Lighthouse scores, and screen-reader behaviour. The statements in section 0 marked [live-ro] are single-moment aggregate counts.

## Addendum 2026-10-17 (later the same day) — new evidence, new tasks
Evidence gathered after this plan was first written (details and sources in `VISIONEX_REMAINING_RISKS.md`):
- **T-A8** (new): `AdBanner` loads Google AdSense with no consent check; a fresh Lighthouse profile fetched the ad request and a third-party cookie.
- **T-A9** (new): the home page's 51 first-party requests are served over HTTP/1.1.
- **T-A10** (new): `cron.job_run_details` is 58 MB of a 134 MB database and unpruned.
- **T-A11** (new): sign-up message reveals existing emails; no CAPTCHA; production auth settings unread.
- **T-C6** (new): `check_ai_budget` fails open silently.
- **T-C3 baseline now exists:** Lighthouse mobile performance 29–49, LCP 9–27 s, CLS up to 0.645.
- Remaining a11y sources located: `src/components/Layout.tsx:119` (`text-muted-foreground/70`) and the `text-amber-600`/`cyan-600`/`sky-600`/`emerald-600` category colours on `/services`.
- Ordering and gates are now maintained in `VISIONEX_PRODUCT_ROADMAP.md`; this document remains the per-task detail.
