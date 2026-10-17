# Roadmap from this pass — all zero recurring cost

| # | Item | Impact | Effort |
|---|---|---|---|
| 1 | Enable Supabase **leaked-password protection** (dashboard toggle) | High for account safety | Minutes — owner action |
| 2 | Re-probe `ph_get_provider_stats` as anon after the migration deploys (expect 401/403) and re-run axe | Verifies this PR | Minutes |
| 3 | Scheduled **live RLS/RPC probe** (anon key) as a read-only workflow, using the pattern in `docs/audit/VISIONEX_SECURITY_REPORT.md` | High | Medium |
| 4 | Revoke anon EXECUTE from org/research RPCs that already check the caller (defence in depth), one caller-verified batch at a time | Medium | Medium |
| 5 | Fix home-page CLS (reserve section height) and LCP; run Lighthouse | Medium | Low–Medium |
| 6 | CI: lint the whole repo (currently changed files only) | Medium | Low |
| 7 | Real CSP with `script-src` (report-only first) | Medium | Medium |
| 8 | Remaining a11y: `#898e97` text, Bazaar nested-interactive, i18n for new Bazaar labels, manual screen-reader pass, authenticated-route axe run | High for the audience | Medium |
| 9 | Sanitise admin email preview | Low | Low |
| 10 | Make file-walking tests timeout-safe; make workflow-text tests CRLF-proof (they fail only on Windows checkouts) | Low | Low |
