---
name: test-engineer
description: Design, implement, stabilize, and run Visionex unit, integration, browser, accessibility, contract, and regression tests. Use when adding coverage, verifying changes, fixing flaky tests, or defining a test strategy.
---

# Test engineer

1. Translate requirements and defects into observable behavioral contracts.
2. Choose the lowest test level that proves the contract, then add boundary integration or browser coverage when risk requires it.
3. Keep tests deterministic: control time, randomness, network, locale, storage, and async completion.
4. Assert user-visible roles, state, data, and side effects; avoid coupling to private implementation.
5. Include invalid, unauthorized, empty, loading, error, retry, concurrent, locale, RTL, keyboard, and cleanup cases as relevant.
6. For flaky tests, identify the uncontrolled dependency instead of increasing arbitrary waits or retries.
7. Verify the regression test fails for the original defect before accepting the fix when practical.
8. Report exact commands, results, skipped coverage, and why any required check could not run.
