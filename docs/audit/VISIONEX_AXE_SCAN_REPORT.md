# axe scan report — 2026-10-18

Branch: `claude/audit-phase2-plan` (PR #430). Tool: axe-core 4.10.2, tags `wcag2a, wcag2aa, wcag21a, wcag21aa`, run in the in-app browser against the local dev server (`npm run dev`, port 8080) at 1280px.

## Limits of this scan (read first)
- The local build ran with a **dummy, git-ignored Supabase URL/key** (no backend). Pages render their shell and static content; anything that needs data or a session did not render.
- `/bazaar` shop cards need shop rows, so they **were not rendered**. The nested-interactive fix there was verified only on a reduced reproduction of the card markup (old markup: `nested-interactive`; new markup: none), not on the live page.
- **Correction (round 2):** `/arcade`, `/auth`, `/about` are not routes; they rendered the "Page Not Found" page, so round-1 results for them mean nothing. The real routes are scanned in round 2 below.
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

# Round 2 — 2026-10-18 (same day, after round 1)

## Method
Local dev server plus a **local mock of the Supabase REST/auth API** (a throw-away Node script, port 54321, synthetic data only: two shops, one product; everything else returns empty). Nothing touched production, no real credentials, no backend config changed. axe-core 4.10.2, WCAG 2.0/2.1 A+AA, 1280px, English locale.

## Skipped CI checks on PR #430 (all workflow-defined, none a failure)
| Check | Workflow | Why skipped | Missing validation? |
|---|---|---|---|
| Build & Push Images | Visionex AMS — CI/CD Pipeline | `if: github.ref == main or staging`; this is a PR branch | No: runs after merge |
| [GKE — not yet enabled] Deploy → Staging | same | `if: false` (hard-disabled in the file) | No: GKE not in use |
| [GKE — not yet enabled] Deploy → Production (Blue/Green) | same | `if: false` | No |
| Emergency Rollback | same | `if: workflow_dispatch && inputs.action == 'rollback'` | No: manual only |
| Build stream-proxy image | CI | `if: github.ref == main` | Partly: the Docker build of the stream-proxy is not exercised before merge; it is not touched by this PR |

GitHub's summary counts 5; the check list shows these five plus no others skipped. Nothing was enabled or triggered.

## Routes and states scanned
`/bazaar` street (2 synthetic shop cards rendered); inside a shop (product shelf); after "Add to cart" (toast open); chat with seller; `/games`; `/login` (plus empty submit); `/signup`; `/forgot-password`; `/reset-password`; `/contact-us`. The cookie banner was present on the later scans.

## Before the fixes (violations found)
| State | Rule (impact) | Element |
|---|---|---|
| After Add to cart | `button-name` (critical) | toast close button, icon only (`ui/toast.tsx`) |
| After Add to cart | `list` (serious) | toast viewport `ol` containing `li role=status` (Radix default markup) |
| Chat with seller | `button-name` (critical) | send button, icon only |
| Chat with seller | `scrollable-region-focusable` (serious) | the `role="log"` scroll area |
| Chat with seller | also the toast `button-name` and `list` above | |

## Fixes
- `ui/toaster.tsx`: close button gets `aria-label={t("common.dismiss")}` (key exists in all 20 locales). `Toaster` moved inside `LanguageProvider` in `App.tsx`; outside it `t()` would have returned the raw key.
- `ui/toast.tsx`: viewport and each toast render as `div` (via Radix `asChild`) instead of `ol`/`li`, so no list semantics are misused. No rule was disabled.
- `VXBazaar.tsx`: chat send button `aria-label={t("msg.send")}`; chat log `tabIndex={0}` so the scrollable region is keyboard reachable.

## After the fixes
| Route / state | Rendered | Violations |
|---|---|---|
| `/bazaar` street (2 cards) | yes | 0 |
| `/bazaar` inside a shop | yes | 0 |
| `/bazaar` after Add to cart (toast open) | yes | 0 |
| `/bazaar` chat with seller | yes | 0 |
| `/games` | yes | 0 |
| `/login` (+ empty submit) | yes | 0 |
| `/signup` | yes | 0 |
| `/forgot-password` | yes | 0 |
| `/reset-password` (no token) | yes | 0 |
| `/contact-us` | yes | 0 |

## Not verified / blockers
- **No `/about` route exists**; nothing to scan.
- The product detail dialog was not opened (the image button only exists for products with an image; the synthetic product has none).
- Login empty submit is stopped by native `required` validation, so no custom error was shown. A signup submit with a weak password showed no error in the mock environment (submit path not confirmed), so **the breached-password error state from #429 was not scanned**.
- `/reset-password` without a token has no `h1` (best-practice rule, not part of the WCAG tags scanned).
- Authenticated screens, shop owner management view, checkout, create-shop form, other locales and RTL were not scanned. Toast visual appearance after the `div` change was not compared against the old one (the animation classes are unchanged).
- Project checks on this tree: lint 0 errors (7 existing warnings), typecheck clean, build OK, tests 6831 pass / 1 fail (`ai-route-report-workflow`, CRLF on this Windows checkout, unrelated, same as round 1).
- axe does not replace manual NVDA / JAWS / VoiceOver / TalkBack and keyboard testing.
