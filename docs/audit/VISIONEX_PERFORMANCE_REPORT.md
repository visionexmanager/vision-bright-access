# Performance report — 2026-10-17

Measured on production `/` in the in-app browser pane (Performance API; not Lighthouse, which was not available). The pane can be hidden, which affects timing, so treat these as indicative single-run numbers, not benchmarks.

| Metric | Value |
|---|---|
| TTFB | 325 ms |
| DOMContentLoaded / load | 1.23 s / 1.23 s |
| LCP | 3.30 s (Google "good" ≤ 2.5 s) |
| CLS | 0.254 (one shift at 3.30 s; "good" ≤ 0.1). Sources: `section.px-4.pb-20` and a bottom gradient overlay, i.e. a below-the-fold section appearing late |
| Requests / JS transferred / total | 59 / ~1013 kB / ~1200 kB (encoded) |
| Build | 6903 modules; two ~540 kB index chunks (144–154 kB gzip), Vite chunk-size warning |

## Changes
None for performance in this PR, so no before/after claim. The CLS shift and the LCP are candidates: reserve height for the late-rendering section, and check what the LCP element is. Re-measure in a visible tab or with Lighthouse before acting.

## Not measured
Other routes, mobile throttling, database query plans (the Supabase performance advisor was not run), connection usage, backup restore.
