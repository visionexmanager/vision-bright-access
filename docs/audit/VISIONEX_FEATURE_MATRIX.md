# Feature matrix — verified against source, tests and production aggregates (2026-10-17)

**Meaning of the labels (strict):**
1. **Implemented and verified** — code exists *and* an automated test in CI exercises the behaviour *and* (where stated) a production read-only check agrees. It does **not** mean real users rely on it.
2. **Implemented but incomplete** — works for the stated path, with a named gap.
3. **Implemented but not verified** — code exists; no test or production check that covers the behaviour.
4. **Partially implemented** — some of the capability exists.
5. **Missing** — nothing found (search stated).
6. **Not recommended yet** — with the reason.
Production figures are single-moment aggregate counts ([live]); nothing was read at row level. I ran no end-to-end journey with a user account.

## A. Platform, security, operations
| Capability | Label | Evidence |
|---|---|---|
| Row-level security on every public table | Implemented and verified (anonymous side) | [live] 629/629 tables `relrowsecurity`; anonymous REST reads of sensitive tables denied/empty. Authenticated cross-user behaviour: **no test** (see Remaining Risks §5) |
| `SECURITY DEFINER` hygiene | Implemented and verified | [live] 539 definer functions, 0 without `search_path`; `src/test/rpc-privilege-isolation.test.ts` (migration text); #427 fixed `ph_get_provider_stats` |
| Edge Function JWT exemptions | Implemented and verified | `src/test/edge-function-jwt-lists.test.ts` compares `supabase/config.toml` and `scripts/deploy-changed-supabase-functions.sh` |
| Payment webhook signature verification | Implemented but not verified | Code in `bazaar-stripe-webhook`, `library-stripe-webhook` (300 s tolerance), `library-paypal-webhook` (`_shared/paypal.ts`), `library-crypto-webhook` (HMAC), `career-billing-webhook`; test only `security-hardening.test.ts:113-115` (static log call) |
| Payment webhook idempotency | Partially implemented | Upserts on subscriptions; `library-stripe-webhook/index.ts:66` donation insert has no event key; no replay test |
| Security monitoring | Implemented but incomplete | `.github/workflows/security-monitor.yml` (hourly), `security_event_summary` (`20261018000000_abuse_limits_and_security_events.sql`); alert channel = failed-run email only; no uptime/pager tooling (grep `package.json src supabase/functions .github`) |
| Service-health probes | Implemented but incomplete | `health-check` function, `external-sources-health.yml`, `library-search-health.yml`, `tv-stream-health-cron.yml`, `whatsapp-voice-probe.yml`, `provider-smoke.yml`; none watches `visionex.app` itself or free-plan limits |
| Scheduled DB jobs | Implemented and verified | [live] 17 `pg_cron` jobs, 0 failures in 7 days; but `cron.job_run_details` unpruned (58 MB) |
| Failed GitHub schedules | Implemented but incomplete | Historical failures on main: locale generator ×5, release reconcile ×5, media-processor deploy ×3 — no evidence they were triaged |
| Deployment gating | Implemented and verified | `ci.yml` gates `deploy.yml`; `deploy.yml` records previous build and waits for the new bundle ("still the previous build" loop); this session's deploys were confirmed by log and live bundle hash |
| Post-deploy smoke | Implemented but incomplete | `deploy.yml` home-page 200 + bundle change; `spa-deploy-doctor.yml`; no route-level or auth smoke |
| Rollback | Missing (for the real stack) | `deploy.yml` refuses non-`main` refs (`GITHUB_REF != refs/heads/main`); only rollback workflow is the disabled GKE `Emergency Rollback` in `ci-cd.yml`; migrations are forward-only |
| Destructive-migration guard | Missing | no check for `DROP TABLE/COLUMN/TRUNCATE` in `ci.yml` or `scripts/` (searched) |
| Migration validation | Partially implemented | `src/test/migration-function-signatures.test.ts`; PGlite-based migration execution in several tests; CI job "The gate SQL, single connection and real concurrency" |
| Database backup | **Missing** | Free plan; no dump job; see `VISIONEX_DISASTER_RECOVERY_REPORT.md` |
| Restore procedure | Missing (untested) | proposal only |

## B. AI, VX, billing
| Capability | Label | Evidence |
|---|---|---|
| Provider registry + routing + fallback | Implemented but not verified in production | `_shared/providerRouter.ts`, `providerSelection.ts`, `providerState.ts`, `aiProvider.ts`; tests `openai-reliability-routing.test.ts`, `provider-chat-recording.test.ts`; [live] 25 providers, 24 log rows in 7 days (too little traffic to judge) |
| Per-attempt timeouts / bounded retries | Implemented and verified | `aiProvider.ts`: `STRUCTURED_ATTEMPT_TIMEOUT_MS=45000`, `STREAM_FIRST_TEXT_TIMEOUT_MS=20000`; `providerSelection.ts` bounded waits. A global retry/cost ceiling per request: **[U]** not audited line by line |
| Daily/rate/budget limits | Implemented but incomplete | `check_ai_rate_limit`, `check_ai_budget` called from `ai-chat`, `file-convert`, `kids-*`; `_shared/aiDailyLimit.ts`; **budget is fail-open by design** (`ai-chat/index.ts:258`) |
| Response caching | Partially implemented | Career AI only (`_shared/careerAiOrchestrator.ts`, `ai_response_cache`); `ai-chat` has none. *Not recommended yet* for general chat: ~24 provider calls/week |
| Usage metering | Implemented and verified (code), **off in production** | `_shared/metering.ts`, `usageMeter.ts`, `usageSink.ts`, `meteredFetch.ts`, `streamUsage.ts`; tests `ai-usage-metering.test.ts`, `ai-usage-streaming.test.ts`, `ai-usage-media.test.ts`, `vx-meter.test.ts`; [live] `central_pricing_registry` 9 services, 0 enabled, `vx_usage_ledger` 0 rows |
| VX balance / reservation / settle | Implemented and verified (code), **inert** | `.claude/references/vx-architecture.md`; tests `vx-unified-billing.test.ts`, `vx-metered-request.test.ts`, `vx-self-award-allowance.test.ts`, `ivx-award-allowance.test.ts`; duplicate-charge protection: idempotency key `dbfd9dda` (#385) — exercised only by tests |
| Plans / subscriptions | Implemented but not verified | `subscription_orders` manual checkout; `AdminSubscriptionOrders.tsx`; `subscription-checkout.test.ts`, `ai-subscription-gate.test.ts`; [live] 0 subscriptions, 0 orders — never used |
| Admin cost visibility | Missing | no admin page reads usage/cost (`grep ai_usage\|ai_cost src/pages/admin` → none); `luna-usage-report.yml` only |
| Spending alerts | Partially implemented | `security-monitor.yml` flags >80% of anonymous daily ceilings; nothing for paid-provider spend |
| Local prerecorded audio instead of paid TTS | Implemented, off | `_shared/localAudio.ts` (needs `WHATSAPP_LOCAL_AUDIO=1`), `_shared/localAck.ts` (`WHATSAPP_LOCAL_ACK`), `docs/whatsapp-local-audio*.md` (10 CC0 recordings, disabled pending review per the commit log) — no saving until enabled and reviewed |

## C. Admin and analytics
| Capability | Label | Evidence |
|---|---|---|
| Admin dashboard (content counts) | Implemented but not verified | `AdminDashboard.tsx` reads real counts; no test |
| Infrastructure screen | **Implemented but misleading (fabricated data)** | `src/pages/admin/AdminInfra.tsx:17-40` constant "all OK" services (Redis, CDN, WAF, vault), invented queue depths, `Math.random()` chart (line 155), link to `grafana.internal.visionex.ai` (line 79) |
| Provider Hub | Implemented but not verified | `supabase/functions/provider-hub/index.ts`; admin path untested |
| Unified service/cost/payment/security board | Missing | no single page; data sources exist (`ph_*`, `security_event_summary`, `subscription_orders`) |
| Data freshness indicators | Partially implemented | relative times in `src/pages/admin/components/AlertsFeed.tsx` (`timeAgo`); no consistent "as of" stamp or stale-data warning across admin pages (grep for `lastUpdated|updatedAt|dataUpdatedAt` over `src/pages/admin` listed above) |
| Product analytics | Partially implemented | `PageTracker.tsx` (path, title, per-tab session id, no user id) → `page_events` ([live] 357 events/7 d); `AdminAnalytics.tsx`; no funnel/conversion events, no retention job |
| Consent for ads | **Implemented but bypassed** | `src/features/ads/consent.ts` + `CookieBanner.tsx` exist; `src/components/AdBanner.tsx` does not call them |

## D. Product modules
| Module | Label | Evidence |
|---|---|---|
| Bazaar / marketplace | Implemented but incomplete | `VXBazaar.tsx`, `bazaar-checkout`, `bazaar-stripe-connect`, `bazaar-stripe-webhook`; [live] 2 shops, 0 products, 0 orders; a11y: selects labelled (#427), nested-interactive + footer contrast open |
| Academy | Implemented but incomplete | `src/pages/academy/*`, `docs/ACADEMY.md`; [live] 6 courses, 1 enrolment; 4 test files |
| VisionKids / IVX | Implemented but not verified in production | `src/features/visionkids`, `src/features/ivx`, 14 test files; [live] 0 kids marketplace products |
| Library | Implemented but incomplete | `src/components/library/*`, external-source provider registry, 8 test files; [live] 8 books; checkout via `library-*` functions with unverified idempotency |
| Games / Arcade | Implemented but not verified | `src/features/arcade`, 66 test files (engines, smoke renders); [live] 0 `arcade_result_submissions` — discoverability/gating unknown |
| WhatsApp assistant | Implemented and verified (extensively) | 62 test files; `docs/whatsapp-ai-assistant.md`; [live] 23 conversations; prior 25-phase audit in `.claude/references/verified-findings.md` |
| Notifications | Implemented but not verified | `notifications` table, `send-email`, `bazaar-notify-seller`, cron reminders ([live] success); no test files named for notifications |
| Multilingual (20 locales) | Implemented and verified (key parity) | `src/i18n/*.ts` + `chunks/{bn,hi,ru}.ts`; `src/test/i18n-integrity.test.ts`, `whatsapp-locale-coverage.test.ts`; RTL rendering and DOM-translator behaviour are **not** covered by tests |
| Accessibility automation | Partially implemented | static guards (`primary-colour-contrast.test.ts`, `bazaar-select-labels.test.ts`, `plans-accessibility.test.ts`); no browser axe in CI; `tests/` for Playwright absent |
| Lighthouse / Web Vitals | Missing in CI; measured once | see Remaining Risks §3 (performance 29–49, mobile) |

## E. Auth
| Capability | Label | Evidence |
|---|---|---|
| Sign-up / login / reset | Implemented but incomplete | `Signup.tsx`, `Login.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`; sign-up message reveals existing emails; raw `error.message` toast on login; no CAPTCHA |
| Client breached-password check | Implemented and verified (client scope) | `src/lib/pwnedPassword.ts`, `src/test/pwned-password.test.ts` (8 tests); bypassable by direct API; fails open |
| Server leaked-password protection | **Missing — blocked by plan** | workflow run 39052467400 → HTTP 402 |
| Device ban / trial-abuse checks | Implemented but not verified | `is_device_banned`, `device_trial_used` RPCs (anon-executable), called in `Signup.tsx:102` |
