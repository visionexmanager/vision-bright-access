# Accessibility test coverage and remaining security items

2026-10-19, base `1598cca9`. Labels: **[C]** confirmed from the repo or a command run today · **[H]** hypothesis, not demonstrated · **[U]** needs production state or a human. Nothing here claims accessibility compliance: automated tools find a minority of problems.

## 1. Automated accessibility coverage — what exists
| Layer | State |
|---|---|
| axe-core in CI | **None.** No axe/jest-axe dependency in `package.json`, no accessibility workflow in `.github/workflows` [C]. The 2026-10-18 scans (`VISIONEX_AXE_SCAN_REPORT.md`) were run by hand in a browser pane against a local build with a dummy backend |
| Browser end-to-end | `@playwright/test` is installed and `playwright.config.ts` points at `./tests`, which does not exist [C]. Nothing runs in a browser in CI |
| Unit-level a11y assertions | `ai-result-accessibility`, `plans-accessibility`, `voice-access`, `bazaar-select-labels`, `primary-colour-contrast`, and `LanguageContext` direction tests (`ltr`/`rtl` on `<html>`) [C] |
| Locales | 20 dictionaries; RTL set is `ar`, `ur`, `fa` [C: `LanguageProvider.tsx`]. axe was run on `/bazaar` in Arabic only; no other locale or RTL page was scanned [C: scan report] |
| Authenticated states | Not scanned: dashboard, checkout, library studio, admin, shop-owner screens, dialogs, error states [C: scan report "limits"] |
| Forms | Signup has per-field inline errors with `role="alert"`, `aria-describedby` and `aria-required` [C: `Signup.tsx`]. Login reports failures only through a toast (`toast.error(error.message)`) and has no field-level error association; whether the toast is announced reliably by NVDA/JAWS/VoiceOver is **[U]** — a human check, not a proven defect |

## 2. Gaps worth closing, in order
1. **A real browser axe job** (Playwright + `@axe-core/playwright`, dev dependencies) over a fixed route list in `en`, `ar` and one more LTR language, against the built app with a mocked backend. This is the single change that makes regressions visible; it adds two dev dependencies and a CI job, so it needs your approval before I add it.
2. **Authenticated routes**: needs either test-mode accounts or a mocked session; the scan report already used a synthetic session. Same job, second route list.
3. **Keyboard and focus tests** (dialog focus trap and return, skip link, menu roles) — cheap with Testing Library once (1) exists; these cannot be proven by axe alone.
4. **Login inline error** (`role="alert"` + `aria-invalid` on the failing field) — a small UI change in `Login.tsx` once a human confirms the toast is not announced.

## 3. What cannot be automated
Reading order and meaning, announcements of dynamic updates, whether alt text and link text make sense in context, caption/transcript quality, audio-only games, real device zoom and reflow, switch/voice control, and whether Arabic/Urdu/Persian screen-reader output is intelligible. These need NVDA, JAWS, VoiceOver and TalkBack testers. The procedure already exists in `VISIONEX_MANUAL_ACCESSIBILITY_TEST_GUIDE.md` (setup, keyboard-only pass, per-page screen-reader pass, locale and direction pass, record sheet); use it rather than a second checklist.

## 4. Security items: confirmed, hypothetical, accepted
| Item | Class | Evidence and impact |
|---|---|---|
| Sign-up says "This email is already registered" | **Confirmed in code** [C `Signup.tsx:70-73`]; whether Supabase returns that error depends on production email-confirmation setting [U] | Account enumeration by anyone who can submit the form. Low–medium: no password is exposed. Fixing means changing wording or auth flow — **your decision**, not changed |
| Login shows the raw `error.message` | Confirmed in code; content depends on Supabase. "Invalid login credentials" does not distinguish accounts; "Email not confirmed" would | Same decision as above |
| No CAPTCHA/Turnstile anywhere in `src` | Confirmed [C]. Production auth rate limits unknown [U] | Abuse risk (sign-up and reset spam, credential stuffing). Adding one is a product/dependency decision |
| `page_events` retention | No deletion or cron found in migrations [C] | Unbounded growth; privacy-retention question, not an exploit |
| Server-side leaked-password protection | Off; needs the Pro plan [C from DR/risks reports] | The client-side HIBP check is bypassable through the Auth API; length minimum is enforced server-side |
| `npm audit --omit=dev` today | **47: 6 high, 38 moderate, 3 low** [C: run today]. The 10-17 report counted only the highs | High (build-time only, as before): braces, micromatch, chokidar, fast-glob, tailwindcss. High (runtime bundle): `xlsx` 0.18.5 — only the write helpers are called, no workbook is parsed [C: previous review]. **New:** 38 moderate are the `@tiptap/*` family via GHSA-cp6q-959q-f8rh (`mergeAttributes` turns an own `__proto__` key into inherited DOM attributes); fix is `@tiptap/core` 3.32.0, a semver-major bump. Used by the library studio editor. Reachability depends on whether another user can place attacker-controlled node attributes into a document you render [H]. Low: `dompurify` (IN_PLACE option — `IN_PLACE` is not used in `src` [C]), `katex` (no import found in `src` [C]), `diff` |
| Webhook idempotency, AdBanner consent, cron history | Fixed and deployed (#431–#433) | — |
| `check_ai_budget` blind to `ai-chat` | Confirmed (`VISIONEX_AI_COST_FLOW.md`) | Missing global cost ceiling; enforcement change reserved for you |
| RLS / authorization | 84-check matrix (#438, open); money/admin functions listed there as exercised vs not | Not full coverage |

**Recommended order:** (1) decide N7/CAPTCHA/Pro together (they are one auth-hardening decision); (2) approve the Playwright+axe job; (3) plan the TipTap 3.x bump as its own PR with the library-studio tests, since it is a major version; (4) add a `page_events` retention job modeled on #433.
