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

## 5. Second pass (2026-10-19, later)

### The six high-severity advisories, one by one (`npm audit --omit=dev`, run today)
| Package | In `package.json` | Advisory | Ships to browsers or servers? | Reachable? |
|---|---|---|---|---|
| `braces` (transitive) | via tailwindcss → chokidar/micromatch | GHSA-vfj7-8cjw-p6xm, stack exhaustion on deeply nested brace patterns | No: only in `node_modules` of the build | Only if an attacker controls a glob pattern given to the build. Tailwind's globs come from `tailwind.config` [C] |
| `micromatch`, `chokidar`, `fast-glob` (transitive) | via tailwindcss | via `braces` | No (build/dev watcher) | same |
| `tailwindcss` 3.4.x | **devDependency** [C] | the four above plus `postcss-nested`/`postcss-selector-parser` | No: CSS is compiled at build time; nothing runs it at request time | Build-time only. The fix is Tailwind 4 (breaking migration) |
| `xlsx` 0.18.5 | **dependency** | GHSA-4r6h-8v6p-xvw6 (prototype pollution), GHSA-5pgg-2g8v-p4x9 (ReDoS) | **Yes**, in the lazy chunk `LibraryOrganizationAnalytics-*.js` [C: built output] | The code calls only `book_new`, `aoa_to_sheet`, `book_append_sheet`, `write` (`organizationReports.ts:63-70`); nothing reads or parses a workbook [C]. The advisories' titles describe parsing; whether the write path with user-supplied cell text is affected is [I: not expected], not tested. npm `latest` for `xlsx` is 0.18.5 (the project ships fixed builds from its own CDN, not npm) [C], so there is no `npm audit fix` |

### TipTap (38 moderate)
Root advisory GHSA-cp6q-959q-f8rh (`mergeAttributes` and an own `__proto__` key). Facts gathered before any upgrade:
- Installed `@tiptap/*` 2.27.3 is the **latest 2.x** [C: npm]; the fix exists only in 3.x (`@tiptap/core` 3.32.0, peer `@tiptap/pm` 3.32.0), so the upgrade is a major one across 13 packages used in the Library Studio (7 files) and one **custom extension** that calls `mergeAttributes` itself (`footnoteExtension.ts`).
- Content enters the editor in one place: `useChapterEditor.ts:84`, `editor.commands.setContent(chapter.content_json)`. That JSON is authored by a chapter's owner or collaborators, so an attacker would need write access to a chapter [C: code; I: collaborator roles not enumerated].
- I could **not** reproduce the advisory on 2.27.3: `mergeAttributes({}, JSON.parse('{"__proto__":{"onclick":"alert(1)"}}'))` returns an object whose `__proto__` is an own key and `onclick` is `undefined` [C: ran]. The end-to-end render path was not tested. So: advisory range applies, exploitability **not demonstrated**.
- Recommendation: do not upgrade yet. Plan a 3.x migration as its own PR with the Library Studio tests as the safety net (there are none specific to the editor today), or, if the risk matters sooner, strip `__proto__` keys from `content_json` before `setContent` (one function, no behavior change for legitimate documents). Neither was done.

### RLS function coverage still untested
Named in the header of `scripts/sql/rls-authorization-scenarios.mjs` (#438): `approve_subscription_order`, `approve_vx_coin_order`, `charge_file_conversion`, `subscribe_radio`, `subscribe_tv`, the `award_*` family except `award_points`, `buy_kids_item`, `claim_kids_gift`, `purchase_kids_product`, `kids_coin_balance`, `get_leaderboard`, `vx_account_parity_detail`, `vx_wallet_*_report`, plus the `vx_reserve/settle/release` family at the *privilege* level (the money behavior is now covered by `vx-accounting-scenarios.mjs`, #448). Next safe step: add the admin-approval pair (`approve_*`) and `charge_file_conversion`, since they move VX on someone's say-so.

### Uptime monitor, refreshed
`Site uptime` runs on record now: 00:13Z, 04:47Z, 10:30Z on 2026-10-19 (3 in 16 h against ~64 scheduled). GitHub's scheduler is the limit; the options are in `VISIONEX_REMAINING_RISKS.md` §9. Whether a failure e-mail would reach anyone cannot be checked from here (it depends on the notification settings of the account that last edited the cron line). The branch-protection required checks are: Type check, Unit tests (Vitest), ESLint, Lint & Type Check, Tests, Security Scan, with "up to date" enforced; the axe and RLS jobs are **not** required.
