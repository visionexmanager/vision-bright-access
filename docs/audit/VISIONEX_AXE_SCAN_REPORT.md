# axe scan report — 2026-10-18

Branch: `claude/audit-phase2-plan` (PR #430). Tool: axe-core 4.10.2, tags `wcag2a, wcag2aa, wcag21a, wcag21aa`, run in the in-app browser against the local dev server (`npm run dev`, port 8080) at 1280px.

## Limits of this scan (read first)
- The local build ran with a **dummy, git-ignored Supabase URL/key** (no backend). Pages render their shell and static content; anything that needs data or a session did not render.
- `/bazaar` shop cards need shop rows, so they **were not rendered**. The nested-interactive fix there was verified only on a reduced reproduction of the card markup (old markup: `nested-interactive`; new markup: none), not on the live page.
- `/arcade`, `/auth`, `/about` rendered only the layout shell (skip link, header) with an empty main region in this environment; their `0 violations` is **not evidence** about those pages.
- Authenticated journeys, dialogs, forms with error states, Lighthouse and the server audit were not run.
- Automated scanning finds a minority of accessibility problems. It does not replace manual testing with NVDA, JAWS, VoiceOver, TalkBack and the keyboard (see `VISIONEX_MANUAL_ACCESSIBILITY_TEST_GUIDE.md`).

## Before the fixes
| Path | Result |
|---|---|
| `/` | 1 violation: `color-contrast` (serious), `.text-muted-foreground/70`, 3.29:1, `#898e97` on white. Footer line "© 2026 Visionex…" in `src/components/Layout.tsx`. |
| `/bazaar` (card markup, reduced repro) | `nested-interactive`: `div role="button"` wrapping a `<button>` |

## Fixes
1. `src/components/Layout.tsx`: footer text `text-muted-foreground/70` → `text-muted-foreground`. This was the long-unlocated `#898e97` node from the earlier reports; the `/70` alpha is the root cause.
2. `src/pages/VXBazaar.tsx`: the shop card `div` no longer claims `role="button"`/`tabIndex`/key handlers. The real `<button>` inside is the keyboard and screen-reader control and now carries the shop-specific `aria-label` (`bazaar.enterShop`); the card's mouse click is kept as a convenience. Sign text opacity raised (`opacity-70/60` → `opacity-90`) for contrast.

## After the fixes
| Path | Rendered content | Violations |
|---|---|---|
| `/` | yes | 0 |
| `/bazaar` | shell and headings only, no shop cards | 0 |
| `/services` | yes | 0 |
| `/travel` | yes | 0 |
| `/library` | yes | 0 |
| `/pricing` | yes | 0 |
| `/contact` | yes | 0 |
| `/arcade`, `/auth`, `/about` | **shell only — not meaningful** | 0 |

## Project checks (same tree)
- `npm run lint`: 0 errors (7 existing warnings).
- `npm run typecheck`: clean.
- `npm run build`: succeeds.
- `npm test`: 6831 passed, **1 failed**: `ai-route-report-workflow.test.ts` expects `\n` in a workflow file but the Windows checkout has CRLF. It is unrelated to these changes (a known local-only CRLF effect) and was not run on Linux CI here.

## Still open
`text-muted-foreground/70` (and `/60`, `/50`, `/40`) appears in about 50 other files. They were not flagged on the scanned routes but may fail contrast where the page renders them; check them as screens are scanned with real data.
