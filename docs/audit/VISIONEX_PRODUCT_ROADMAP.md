# Visionex roadmap — phased, evidence-based (2026-10-17)

Inputs: `VISIONEX_DISASTER_RECOVERY_REPORT.md`, `VISIONEX_REMAINING_RISKS.md`, `VISIONEX_FEATURE_MATRIX.md`, and the per-task detail (value, security impact, acceptance tests, credential needs) in `VISIONEX_PHASE2_ASSESSMENT_AND_PLAN.md` (task IDs below refer to it; IDs T-A8…T-A11 and T-C6 are new in this revision and defined here).
Effort: XS < ½ day · S ≈ 1 day · M ≈ 2–4 days · L ≈ 1–2 weeks. **Costs are $0 unless stated. Nothing in this roadmap has been started, approved or deployed.**

## Existing functionality that needs completion vs genuinely missing
| Needs completion (code exists) | Genuinely missing |
|---|---|
| Consent gating of `AdBanner`; Bazaar a11y (card, services colours, footer text); payment-webhook idempotency; Provider Hub admin test; `AdminInfra` (replace fake data); alert coverage on `security-monitor`; analytics (add funnel events, retention); WhatsApp local audio (built, off); VX metering (built, off) | Database backup + restore drill; cross-user authorization tests; browser axe + Lighthouse in CI; rollback runbook; destructive-migration guard; cron-history pruning; external uptime/free-plan-limit alerting; admin cost/usage view; manual screen-reader record |

## Phase 1 — data safety and security (do first)
| Task | Deliverable | Depends on | Effort | Cost | Approval needed | Release gate / definition of done |
|---|---|---|---|---|---|---|
| **T-A1** Backup (Option 1 → 2/3) | encrypted nightly dump (DB + Storage) to server + owner copy; runbook; checklist C1–C6 | owner generates `age` key; SSH key for a backup-only user; `SUPABASE_DB_PASSWORD` | M | $0 (Option 1); Option 2 vendor / Option 3 Supabase Pro are **recurring costs** | Yes: workflow + secrets + first run; separately any paid option | CI synthetic restore drill green; first real backup decrypts and restores into a scratch DB; failed run turns red |
| **T-A8** Consent-gate `AdBanner` (N1) | `AdBanner` loads `adsbygoogle.js` only when `readConsent()?.advertising`; reacts to `AD_CONSENT_EVENT`; test that no ad request is made without consent | none | S | $0 | No (bug fix) — confirm you want ads kept at all | Lighthouse `third-party-cookies` passes on a fresh profile; unit test; no layout shift when ads are off |
| **T-A3** Payment-webhook idempotency + tests | unique event/session keys; duplicate-safe inserts; signed-fixture tests for Stripe, PayPal, Coinbase, career billing | none for fixtures | M | $0 | Test-mode keys + account only for a live test | replaying one signed event twice creates one row; bad signature → 400 + security event |
| **T-B1** Cross-user authorization suite | PGlite role-switched matrix (Remaining Risks §5) | none | M | $0 | Level 3 needs disposable accounts | every assertion fails when its policy is dropped |
| **T-A6** Password scope | decide Pro (server-side protection) or raise `password_min_length` to 8 free; align UI minimums | decision | XS | Pro = recurring | **Yes** | workflow verifies `password_hibp_enabled`/min length; UI and server agree |
| **T-A11** Sign-up abuse + enumeration | read-only probe of production auth settings (extend `supabase-auth-hardening.yml` plan mode: `mailer_autoconfirm`, rate limits, site URL); neutral sign-up message; CAPTCHA decision | approval to extend the probe | S | $0 (Turnstile is free but a new third-party dependency) | Yes for probe + any CAPTCHA vendor | enumeration removed or justified; settings documented |
| **T-A2** CRLF `.gitattributes` | add `*.yml`/`*.yaml text eol=lf` | none | XS | $0 | No | Windows run of `ai-route-report-workflow.test.ts` green |

## Phase 2 — production reliability and open audit items
| Task | Deliverable | Depends on | Effort | Cost | Approval | Gate / DoD |
|---|---|---|---|---|---|---|
| **T-A7** Rollback runbook + rehearsal | documented SPA/function/migration rollback; `deploy.yml` stays main-only (revert via PR) | none | S | $0 | rehearsal touches production | one rehearsed revert, timed |
| **T-A9** HTTP/2 (N3) | confirm cause on the server (`server-probe.yml`), fix nginx listener; verify with `curl --http2`/Lighthouse | approval to dispatch the read-only probe; server change via the existing nginx workflow | S | $0 | Yes (production server) | Lighthouse `uses-http2` passes; nginx fixture tests unchanged |
| **T-A10** Prune `cron.job_run_details` | migration adding a daily `cron` job keeping 7 days; same for `page_events` (90 days) | none | XS | $0 | normal PR | DB size trend; jobs still succeed |
| **T-B2/T-B3** Provider Hub admin | harness test (non-admin 403 + event, admin gets metrics) + one admin smoke by you | admin session | S | $0 | admin login for the live smoke | test green; screen shows numbers |
| **T-A5** Finish a11y | Bazaar card as single link; `text-muted-foreground/70` footer text; `/services` category colours to ≥4.5:1 (use `-700` shades) | none | S | $0 | No | axe + Lighthouse show 0 contrast nodes on audited routes; keyboard: one stop per card |
| **T-A4** Browser a11y in CI | create `tests/`, Playwright + axe on ~15 public routes, baseline file | none | M | $0 | No | seeded violation fails CI |
| Triage historic failing schedules | root-cause note for locale generator, release reconcile, media-processor deploy | none | S | $0 | No | each has an owner decision recorded |

## Phase 3 — cost control and operational visibility
| Task | Deliverable | Effort | Cost | Approval | Gate / DoD |
|---|---|---|---|---|---|
| **T-C1** Replace fake `AdminInfra` | real data from `ph_*`, `security_event_summary`, `health-check`; delete invented tiles; guard test against constant health arrays | M | $0 | No | no `Math.random`/constant "ok" in `src/pages/admin`; unknown shows "not monitored" |
| **T-C2** Alerting v2 | scheduled probes of `visionex.app` + key functions; DB size / plan-limit check via Management API (availability to be verified); webhook-failure rate; alert on the failed run (existing email path) | S–M | $0 | No | seeded failure turns red; thresholds documented |
| **T-C3** Lighthouse CI + remediation | weekly Lighthouse with budgets; fix render-blocking fonts/CSS (subset fonts, `font-display`, load Cairo/Devanagari only for those locales), reserve space for the late section, defer ads script, route-level code splitting | M, then M | $0 | No | LCP ≤ 4 s then ≤ 2.5 s on `/`, CLS ≤ 0.1, measured before/after |
| **T-C4** Admin AI cost/usage panel | admin-only RPC over `ph_metrics`/usage; freshness stamps | S–M | $0 | No | non-admin refused (T-B1) |
| **T-C5** Keep VX metering off | go/no-go checklist in `.claude/references/vx-pre-deploy-checklist.md` | XS | $0 | **Yes before any enablement** | no flag flipped without sign-off |
| **T-C6** Make `check_ai_budget` failure visible | log + `security_event` when the budget check errors and fails open; alert threshold | S | $0 | No | seeded failure produces an event |

## Phase 4 — accessibility and user experience
Manual NVDA/VoiceOver/TalkBack pass per `VISIONEX_MANUAL_ACCESSIBILITY_TEST_GUIDE.md` (owner or a screen-reader user; blocks release on its steps 1, 6, 7). RTL/locale browser regression for Arabic and Urdu. Sign-up friction review using T-D1 funnel data. DoD: recorded results per page; defects ticketed.

## Phase 5 — high-value existing features (only after Phases 1–3)
| Task | Why now | Effort | Cost | Gate / DoD |
|---|---|---|---|---|
| **T-D1** funnel events + retention | 287 sessions/7 d → 14 signup views/30 d → 0 new users/30 d: the loss point is unknown | S | $0 | events without user id/IP; 90-day delete; admin funnel view |
| **T-D2** WhatsApp→web activation | most engaged channel (23 conversations > 20 users) | M | $0 | measured sign-up share, opt-in only |
| **T-D3** Academy then Library | content exists (6 courses, 8 books), 1 enrolment | M | $0 | enrolment lift measured |
| **T-D4** Bazaar seed-or-hide | 2 shops, 0 products, 0 orders | S | $0 | curated products with consent, or "opening soon" |
| **T-D5** Games: why 0 runs | 66 test files, 0 submissions | S | $0 | root cause documented |
| **T-D6** First paid-path rehearsal | 0 subscription orders ever | S | $0 | end-to-end with your test account |
| Enable WhatsApp local audio | only after the licence review in `docs/whatsapp-local-audio-licences.md` | S | saves paid-TTS cost | per `docs/whatsapp-local-audio-rollout.md` |

## Phase 6 — new capabilities (not recommended before Phases 1–5)
New AI providers; general `ai-chat` caching (≈24 calls/week); enabling VX billing; GKE/Grafana; paid monitoring vendors; authenticated-route Playwright before disposable test accounts exist; Tailwind 4 migration (clears 5 of the 6 dependency advisories but is a breaking change — schedule separately).

## Approvals required from the owner (consolidated)
1. Backup route (Option 1 now; Option 2 vendor or Option 3 Supabase Pro are recurring costs).
2. Supabase Pro decision (also the only route to server-side leaked-password protection).
3. Permission to merge new workflows and give them the existing secrets (backup, auth probe).
4. Permission to dispatch `Probe the server` (read-only) and approve any nginx change.
5. Test-mode payment keys + disposable test accounts + one admin session for live verification.
6. Whether ads stay (T-A8) and CAPTCHA vendor choice (T-A11).
7. Scope approval before any Phase 5 or 6 item.
