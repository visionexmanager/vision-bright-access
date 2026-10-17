# Visionex — remaining risks and audit follow-through

Date: 2026-10-17 · Base `main` @ `f7265be2`. Labels: **[V]** verified (repo, CI record, or read-only production query/probe, aggregates only) · **[I]** inference · **[U]** unverified · **[R]** recommendation.
Status vocabulary: *Verified fixed* · *Fixed, not independently verified* · *Still open* · *Blocked* · *Accepted residual risk*.

## 1. Merged work — verified against GitHub records
| PR | Merge commit | Merged (UTC) | Evidence |
|---|---|---|---|
| #427 | `f8e77ceb` | 2026-10-17 12:43 | `gh pr view 427`; Deploy run `39033910785` success (migrations, SPA, `provider-hub`) |
| #428 | `b1986997` | 2026-10-17 17:07 | `gh pr view 428` |
| #429 | `f7265be2` | 2026-10-17 17:25 | `gh pr view 429`; Deploy success on that commit |
| #430 | open, CI green | — | assessment docs only |

## 2. Status of every previously open audit item

| # | Item | Status | Evidence / what is still missing |
|---|---|---|---|
| 1 | Provider Hub metrics work for an authorized admin after the service-role change | **Fixed, not independently verified** | Code: `supabase/functions/provider-hub/index.ts` now calls `ph_get_provider_stats` with `roleDb` after the `has_role` admin gate; deployed in run 39033910785. **No test calls `get_metrics` and no admin session was used.** → task T-B2/T-B3 |
| 2 | Anonymous and ordinary users cannot read provider metrics | **Verified for anonymous; verified by catalogue for authenticated** | [V] Anonymous `POST /rpc/ph_get_provider_stats` → 401 "permission denied for function" (was 200 before the fix). [V] Catalogue: `has_function_privilege` anon=false, authenticated=false, service_role=true. [V] `pg_policies`: the five `ph_*` tables have only `*_read_admin` SELECT policies (`has_role(auth.uid(),'admin')`) and no write policies; anon has no table SELECT. **Not done:** a probe with a real non-admin session |
| 3 | Cross-user authorization / tenant isolation | **Still open (no tests)** | No test executes SQL as a role: `grep "set role\|request.jwt.claim" src/test scripts` → none. Test plan §5 |
| 4 | Bazaar contrast | **Partially fixed** | [V] After deploy, no teal (`#1c8779`) failures remain. [V] Lighthouse 2026-10-17 shows one remaining node on every page: `<small class="text-xs text-muted-foreground/70">` at `src/components/Layout.tsx:119` (3.29:1). **Newly found:** `/services` has 11 nodes using `text-amber-600`, `text-cyan-600`, `text-sky-600`, `text-emerald-600` on white (3.18–4.09:1) |
| 5 | Bazaar `nested-interactive` | **Still open** | Post-deploy axe: 1 node, the shop card `div` with `cursor-pointer` at `src/pages/VXBazaar.tsx:852` containing interactive children |
| 6 | Screen-reader / keyboard coverage | **Still open** | No manual run has been performed by anyone; `playwright.config.ts` has `testDir: "./tests"` but `tests/` does not exist. Guide added: `VISIONEX_MANUAL_ACCESSIBILITY_TEST_GUIDE.md` |
| 7 | Lighthouse on public routes | **Measured — poor** | See §3. Baseline recorded; no remediation done |
| 8 | Payment flows / webhooks / idempotency | **Still open** | Signature verification present in all five payment webhooks [V repo]; **no behavioural tests** (only the static `security-hardening.test.ts:113-115`); `library-stripe-webhook/index.ts:66` inserts `library_donations` without an event key, so a redelivered event can double-count [V repo]; 0 subscription orders exist, so no payment has ever completed [V live aggregate]. Live payment flows: **Blocked** on test-mode keys/accounts |
| 9 | Server access and monitoring | **Blocked / not run** | `.github/workflows/server-probe.yml` (read-only SSH probe) exists and was not dispatched. HTTP/2 is not served (§3). No external uptime alerting exists [V: no uptime/pager tooling in `package.json`, `.github`] |
| 10 | Backup integrity and recovery | **Still open — highest risk** | See `VISIONEX_DISASTER_RECOVERY_REPORT.md`: free plan, no backup job, no restore ever tested |
| 11 | Windows CRLF test failure | **Still open (root cause known)** | `.gitattributes` forces LF for `*.mjs *.cjs *.sql *.awk *.conf *.sh` but not `*.yml`; `src/test/ai-route-report-workflow.test.ts:17` asserts a `\n`-joined string. CI on Linux is green. Fix: add `*.yml text eol=lf` (not applied in this assessment) |
| 12 | Six high dependency advisories | **Accepted residual risk with triggers** | §4 |
| 13 | Leaked-password protection | **Blocked by plan** | §6 |

## 3. New verified findings (this pass)

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| N1 | **High (privacy/compliance)** | `AdBanner` loads Google AdSense (`pagead2.googlesyndication.com` → `googleads.g.doubleclick.net`, sets a third-party cookie) **without checking cookie consent**. A fresh Lighthouse profile that never touched the cookie banner fetched the ad request and reported a third-party `test_cookie` and Cookie "inspector issues" on `/` | [V] `src/components/AdBanner.tsx` (hard-coded client `ca-pub-…`, no `readConsent`), placed in `src/pages/Index.tsx:394` and `src/pages/Games.tsx:122`; consent logic exists in `src/features/ads/consent.ts` (+`ads.test.ts`) and `CookieBanner.tsx` but `AdBanner.tsx` does not use it; Lighthouse `third-party-cookies` fail, best-practices 75 on `/` |
| N2 | High (performance) | Mobile Lighthouse (simulated slow 4G, 4× CPU): performance 29–49, LCP 9.1–27.3 s, FCP 6.1–14.6 s, page weight 2.3–3.3 MB. Home LCP element is the `<h1 id="hero-heading">` with 1.57 s render delay; render-blocking: main CSS (≈1.5 s) and the Google Fonts stylesheet (4 families incl. Cairo and Devanagari, ≈0.9 s); ads script ≈120 kB unused JS | [V] Lighthouse 12.x run 2026-10-17 from the owner's Windows PC (single run per route, run-to-run variance and local CPU load apply; treat as order of magnitude) |
| N3 | Medium (performance) | All 51 first-party requests on the home page were served over **HTTP/1.1** | [V] Lighthouse `uses-http2`; `curl -sI` shows `HTTP/1.1`. The repo fixtures configure `listen 443 ssl http2` (`services/media-processor/nginx/fixtures/site-*.conf`), so the live nginx differs from the fixtures or HTTP/2 is disabled somewhere — cause **[U]**; check on the server |
| N4 | Medium (CLS) | Layout shift 0.43 (home), 0.645 (pricing), 0.296 (bazaar), 0.166 (signup) | [V] Lighthouse; home culprit `div.absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t …` |
| N5 | Medium (availability) | `cron.job_run_details` = 58 MB of a 134 MB database and nothing prunes it (0 of 17 `cron.job` commands reference it; no migration does) | [V] |
| N6 | Medium (cost control) | `check_ai_budget` is fail-open "by design" (comment in `supabase/functions/ai-chat/index.ts:258`) — a metering fault removes the spending ceiling for that call | [V repo]; combined with metering being off (0 of 9 `central_pricing_registry` services enabled) the only live ceilings are the per-user/anonymous limits |
| N7 | Medium (abuse) | Account enumeration on sign-up: the UI explicitly says "This email is already registered" (`src/pages/Signup.tsx` ~line 72). Login surfaces raw `error.message` (`src/pages/Login.tsx:42`). Forgot-password does not reveal existence (always shows success) | [V repo]; whether Supabase returns the "already registered" error to the browser depends on the project's email-confirmation setting **[U]** |
| N8 | Medium (abuse) | No CAPTCHA/turnstile anywhere in the app; `supabase/config.toml` declares `enable_confirmations = false`. The production auth settings are **[U]** (config.toml only drives local dev) | [V repo]; grep for turnstile/hcaptcha/recaptcha in `src` → none |
| N9 | Low | `page_events` has no retention job | [V] only crons listed above |
| N10 | Info | 17 `pg_cron` jobs ran 0 failures in the last 7 days (e.g. 2016 runs each for the two 5-minute jobs) | [V] `cron.job_run_details`. Failed GitHub workflows on `main` in the retained history: Generate new locale files ×5, Reconcile missing release runs ×5, Deploy media processor ×3 (2026-10-01), Security monitor ×2 (2026-10-03, 10-06), plus my expected "Supabase Auth hardening" 402 |

## 4. Dependency advisories — reachability and revisit triggers
`npm audit --omit=dev` after #427: 0 critical, 6 high. None of `braces`, `micromatch`, `chokidar`, `fast-glob` appears in the built bundle (`grep -l` over `dist/assets/*.js` → 0 files each) [V].

| Package | Advisory | Path | Reachable in production? | Mitigation / trigger |
|---|---|---|---|---|
| `braces` ≤3.0.3 | GHSA-vfj7-8cjw-p6xm stack-exhaustion DoS on deeply nested patterns | `tailwindcss` → `chokidar`/`micromatch` → `braces` (devDependency) | Build-time only; input would be glob patterns from our own source files. No server runs it with user input [V paths, I reachability]. `braces` 3.0.3 is the newest 3.x release | Revisit when `tailwindcss` 4 migration is scheduled (npm's suggested fix is the semver-major `tailwindcss@4.3.3`) |
| `micromatch` | via `braces` | same | same | same |
| `chokidar` 2–3.6 | via `braces` | `tailwindcss` | file watcher in dev/`vite build --watch` | same |
| `fast-glob` | via `micromatch` | `tailwindcss` | build-time | same |
| `tailwindcss` ≤3.4.19 | via the above and `postcss-nested`/`postcss-selector-parser` | direct devDependency | Build runs on the VPS from repo files; no runtime Tailwind in the browser | Plan Tailwind 4 migration (breaking; separate effort) |
| `xlsx` 0.18.5 | GHSA-4r6h-8v6p-xvw6 prototype pollution (<0.19.3), GHSA-5pgg-2g8v-p4x9 ReDoS (<0.20.2) | direct dependency | **Included in the browser bundle** but only `XLSX.utils.book_new/aoa_to_sheet/write` are called (`src/lib/library/organizationReports.ts`); no code path parses an uploaded/untrusted workbook [V repo: single import]. The fixes are published by SheetJS on its own CDN, not npm | Trigger: any feature that reads user-supplied spreadsheets, or replacing with a write-only library. Do not claim zero risk: if parsing is ever added, this becomes exploitable |
`source-map-js` was updated to 1.2.2 in #427 (npm lockfile only; `pnpm-lock.yaml` not touched).

## 5. Authenticated authorization — safe test plan (no real customer data)
Principles: synthetic data only; dedicated test accounts; never read real users' rows; run against a local/PGlite database first, production only with the test accounts.
1. **Level 1 — database (PGlite, no credentials).** Use the pattern in `src/test/kids-membership-policy-recursion.test.ts`. Build a helper that runs `set local role authenticated; select set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true)`. Create users A, B, an admin, an org admin/member. For each sensitive table (`user_points`, `credit_wallets`, `user_subscriptions`, `subscription_orders`, `notifications`, `profiles`, `whatsapp_conversations`, `whatsapp_messages`, organization tables, Bazaar orders) assert: A reads own, A cannot read/update/delete B's, anon reads none, admin reads per policy. For every write-capable `SECURITY DEFINER` RPC reviewed in the Security report assert it raises for a non-owner. Prove each assertion by dropping its policy in a mutation run (it must fail).
2. **Level 2 — Edge Functions (stub Supabase, `scripts/e2e/function-harness.ts`).** For `provider-hub`, `ai-chat`, `file-convert`, `library-*`: a request with no token → 401; with user A's token and B's resource id → 403/404; admin-only actions with a non-admin → 403 and a `provider_hub_forbidden`-style security event.
3. **Level 3 — production, test accounts only (owner action).** Owner creates two disposable accounts (`audit-a@…`, `audit-b@…`) and one disposable admin. Run the Level 1 matrix through the public REST API with their JWTs. Delete the accounts afterwards.
Acceptance: all matrices green; a deliberately removed policy turns the suite red.

## 6. Password protections — precise scope
| Protection | Where enforced | Verified | Bypassable via direct Auth API? |
|---|---|---|---|
| Minimum length 6 | Supabase Auth server (`password_min_length=6`, read by workflow run 39052428262) **and** the UI (`Signup.tsx:88,226`; `ResetPassword.tsx:56,122`) | [V] | No (server enforces) |
| Strength meter | `Signup.tsx` UI only | [V repo] | Yes — advisory only |
| Breached-password check (HIBP range API) | **Client only**, `src/lib/pwnedPassword.ts` called from `Signup.tsx` and `ResetPassword.tsx` (#429) | [V] bundle contains the code; HIBP reachable from the site origin | **Yes.** Anyone with the public key can POST to `/auth/v1/signup` or update a password and skip it. **Fails open** if the service is unreachable (returns not-breached) |
| Supabase leaked-password protection (server-side) | Supabase Auth | `password_hibp_enabled=false` [V]; enabling returned **HTTP 402 "available on Pro Plans and up"** | n/a — it is off |
The client check reduces risk for people using our forms; **it is not a substitute** for the server-side protection. Service-failure handling is safe: errors are swallowed, no message or hash prefix is shown or logged, and only a 5-character prefix leaves the browser [V repo, test `pwned-password.test.ts`].
Available alternatives and cost: (a) Supabase Pro (recurring cost, approval needed — see DR report option 3; the same upgrade also gives managed backups); (b) stay on client-only check plus longer minimum length (free; raise `password_min_length` through the existing workflow and update the UI minimums in the same release); (c) no free server-side equivalent identified. Nothing was changed.

## 7. Items waiting for the owner
Backup decisions and the 1-minute dashboard looks (DR report §7); Pro-plan decision; test-mode payment keys and disposable test accounts; an admin session for T-B3; permission to dispatch the read-only server probe; approval to extend the read-only auth-settings probe (to read `mailer_autoconfirm`, rate limits, site URL so N7/N8 can be settled).
