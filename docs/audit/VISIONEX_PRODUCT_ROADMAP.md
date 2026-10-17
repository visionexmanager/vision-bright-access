# Product and engineering roadmap — from this pass

Ranked by impact / effort. All items are zero recurring cost.

1. **CI: lint the whole repo (or at least fail on unlinted drift)** — CI lints changed files only, which hid 3 errors. Low effort.
2. **Live RLS and authorization probe** as a scheduled read-only job (anon + authenticated keys). Medium effort, high value.
3. **Real CSP with `script-src`** (report-only first). Medium effort.
4. **Sanitise admin email preview** (DOMPurify). Low effort.
5. **Browser + axe pass** on the main routes and an NVDA/VoiceOver manual check. Medium.
6. **Split the two ~540 kB entry chunks** and measure with Lighthouse before/after. Medium.
7. **Make the file-walking tests timeout-safe** (several use the 5 s default and time out when the full suite runs under load). Low.
8. **CRLF-proof workflow tests** (`ai-route-report-workflow` fails on Windows checkouts). Low.
