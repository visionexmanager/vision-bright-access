# Roadmap

Superseded in detail by **`VISIONEX_PHASE2_ASSESSMENT_AND_PLAN.md`** (2026-10-17), which classifies each proposal against the code and production, and gives per-task value, effort, cost, risks and acceptance criteria. Summary of order:

1. **Phase A — safeguards:** T-A1 database backup + restore drill (production has none; Supabase org is on the free plan) · T-A2 CRLF `.gitattributes` · T-A3 payment-webhook idempotency + tests · T-A4 browser axe in CI · T-A5 finish Bazaar a11y · T-A6 password policy (server-side protection needs Pro) · T-A7 rollback runbook.
2. **Phase B — authorization proof:** T-B1 cross-user RLS tests · T-B2 Provider Hub admin test · T-B3 live admin smoke.
3. **Phase C — cost and visibility:** T-C1 replace fabricated `AdminInfra` data · T-C2 alerting v2 · T-C3 Lighthouse + CLS/LCP · T-C4 admin AI cost panel · T-C5 keep VX metering off until approved.
4. **Phase D — revenue (after A–C, scope needs approval):** funnel events, WhatsApp→web activation, Academy/Library, Bazaar seed-or-hide, games investigation, checkout rehearsal.

Decisions waiting on the owner are listed in section 4 of the plan. Paid plans: none changed or approved.
