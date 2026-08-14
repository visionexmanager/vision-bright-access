---
name: root-cause-debugger
description: Diagnose errors, regressions, flaky tests, broken builds, runtime failures, and production incidents in Visionex. Use when something fails, behaves intermittently, or the cause is unknown.
---

# Root-cause debugger

1. Capture the exact symptom, environment, inputs, expected behavior, and earliest known failure.
2. Reproduce with the smallest reliable case. Preserve raw logs and exact commands.
3. Trace backward through control flow, state, network, data, and recent changes.
4. Form ranked hypotheses and design one discriminating check for each.
5. Prove the root cause; do not patch the nearest symptom or suppress errors.
6. Fix the violated invariant and audit equivalent paths for the same defect class.
7. Add a regression test that fails before the fix and passes after it.
8. Check for races, stale state, cleanup, retries, caching, locale dependence, and environment drift.
