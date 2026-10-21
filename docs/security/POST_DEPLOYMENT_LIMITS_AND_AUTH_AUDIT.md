# Post-deployment audit: AI authorization, LiveKit, WhatsApp budget, realtime minutes

Audit of what is deployed after PR #475 (`b1b68940c9a643766a5aa88f82dccfa90bf49c34`) and PR #474
(`882896788ae0b548b07a53339196998bcba766db`). Date of the production reads: 2026-10-21.

This document and its branch change no production state. Nothing here was merged, deployed or applied.
Production was read with aggregate, read-only queries only; no individual balance, e-mail, phone number or
message text was read or is printed.

## 1. Deployment state

| Fact | Evidence | Source |
|---|---|---|
| Both PRs are squash-merged and are ancestors of `origin/main` (`88289678…` is the tip) | `git merge-base --is-ancestor` for both SHAs | Git |
| The Deploy run for `b1b68940` succeeded in migrations, Edge Functions, stream-proxy and TV-catalog jobs; **its SPA job failed** at the final health check (HTTP 403 at 17:33:38) | `gh run view 39644722268` | CI |
| The Deploy run for `88289678` finished `success` (all jobs) | `gh run list --workflow Deploy` | CI |
| `https://visionex.app` returned HTTP 200 afterwards and serves a new entry bundle (`index-BaqSKSTJ.js`; before the deploy it was `index-CCNizvb1.js`) | read-only `curl` | Production |
| Migrations `20261077000000` and `20261078…20261084` are in the production ledger | `supabase_migrations.schema_migrations` | Production |
| `ops_limits`, `whatsapp_notice_log`, `user_has_section`, `ai_subscription_gate_whatsapp`, `bazaar_notify_claim` exist | catalog queries | Production |
| `billing_plans` has 5 rows; total of `user_points` is 6,245 (unchanged since before the merge) | aggregate queries | Production |
| `ops_limits` has **no** `whatsapp_notice_global_per_hour` row (budget off) | count = 0 | Production |
| No plan carries `realtime_monthly_minutes` (monthly audio cap off) | `limits ? 'realtime_monthly_minutes'` count | Production |
| Edge Functions changed by #475 show `updated_at` after the merge | `list_edge_functions` | Production |

**Not verified.** (1) The 403 in the first SPA deploy: the timing (new `Last-Modified` eight seconds after the
failed check) suggests it landed while files were being swapped, but the nginx log needs SSH and was not read.
(2) That the served bundle is exactly the build of `b1b68940` or `88289678`: CI and server builds never share
hashes. (3) That every individual balance is unchanged: only the total (6,245) was read, which does not prove it.
(4) The plan prices and VX allowances were not re-read after the second deploy; the earlier read (basic $5/5,000,
pro $10/11,000, business $20/24,000, kids $3/3,000, free_trial $0) matches the seed pinned by
`src/test/access-migrations-invariants.test.ts`.

## 2. The 21 gate-only AI functions

The authoritative list is `AI_FUNCTIONS_WITHOUT_SECTION` in `src/lib/access/policy.ts`. All 21 authenticate and
pass the plan gate (`ai_subscription_gate`, or `guardVoiceRequest` which runs the same subscription check plus a
daily quota) before any provider call. This audit asked a different question: should the *section* be checked too,
so a direct call cannot reach what the interface does not offer.

**Policy used.** `src/lib/billing/plans.ts` assigns `/library/studio` to the `studio` section, which only
Business (and admin) include, and `App.tsx` enforces that for every route through `sectionForPath`. Every Studio
page is therefore Business-only in the interface. A function whose only interface is under `/library/studio` and
which already requires book ownership is an authoring tool of that section.

| # | Function | Entry points | Authorization before the provider | Direct-call bypass of the interface? | Disposition |
|---|---|---|---|---|---|
| 1 | `library-ai-writing-assistant` | `WritingAssistantPanel` (Studio) | plan gate, rate limit, `can_edit_library_book`/collaborator, author profile | Yes: any paying plan with an author profile | **Section `studio` added** |
| 2 | `library-ai-classify-book` | Studio book overview | plan gate, rate limit, `can_edit_library_book` | Yes | **Section `studio` added** |
| 3 | `library-detect-series` | Studio book overview | plan gate, rate limit, `can_edit_library_book` | Yes | **Section `studio` added** |
| 4 | `library-build-knowledge-graph` | Studio book overview | plan gate, rate limit, `can_edit_library_book` | Yes | **Section `studio` added** |
| 5 | `library-translate-book-metadata` | Studio book overview | plan gate, rate limit, `can_edit_library_book` | Yes | **Section `studio` added** |
| 6 | `library-generate-narration` | `narration.ts` service; header calls it an authoring action | plan gate, then owner or admin | Yes | **Section `studio` added** (the registry also lists it under `mediaStudio`; both are Business-only, so the effect is identical) |
| 7 | `library-generate-quotes` | none found in `src` | plan gate, rate limit; the chapter must be readable by the caller under RLS (free preview, accessible, purchased, owned): **not owner-only**, contrary to the old note | n/a: readers can legitimately reach it | **Section `library` added** (every plan that passes the gate already has it, so no one loses anything) |
| 8 | `library-embed-book` | none found in `src` | plan gate, then owner or admin; no rate limit by design | Possible for any paying plan that owns a book | **Escalated**: no interface entry point was found, so the owning section cannot be established. It may be reached by an import pipeline; gating it by `studio` could break that |
| 9 | `organization-ai-admin` | `LibraryOrganizationAnalytics` | `is_organization_admin` first, then plan gate and rate limit | Organisation admins are the intended users | Keep plan-only: organisations are not a plan section |
| 10 | `ai-chat` | many sections | plan gate, per-function limit | n/a | Keep plan-only (no single owner) |
| 11 | `ai-generate` | general | plan gate, limit | n/a | Keep plan-only |
| 12 | `ai-search` | general | plan gate, limit | n/a | Keep plan-only |
| 13 | `ai-voice-chat` | `VoiceRoom` (AI in a room) | `guardVoiceRequest`: identity, plan gate, daily quota | n/a | Keep plan-only |
| 14 | `text-to-speech` | Library read-aloud, Kids studio | `guardVoiceRequest` | n/a | Keep plan-only |
| 15 | `speech-transcribe` | Kids studio | plan gate, limit | n/a | Keep plan-only |
| 16 | `realtime-session` | voice conversation | plan gate, limit, optional monthly minutes | n/a | Keep plan-only |
| 17 | `analyze-image` | assistive | plan gate, limit | n/a | Keep plan-only |
| 18 | `radar-ai` | `RadarAI` | plan gate, limit | n/a | Keep plan-only |
| 19 | `analyze-meal` | `NutritionExpert` | plan gate, limit | n/a | **Product decision**: nutrition is not a plan section |
| 20 | `generate-diet-plan` | `NutritionExpert` | plan gate, limit | n/a | **Product decision**: same |
| 21 | `ocr-scan` | Library reader, `OCRScan` | plan gate, limit | n/a | Keep plan-only (free by design; pinned by `section-entitlement.test.ts`) |

Result: the gate-only list shrinks from 21 to 14. The pinned test now says "14 today" and still forbids growth.

**Behaviour change, stated plainly.** A Basic, Pro, Kids or free-week account can no longer call the six studio
tools directly. None could reach them through the interface (the studio routes already refuse those plans), and
none of the six has a caller outside `/library/studio`. Business and admin are unchanged. If an author on Pro is
expected to keep these tools, `studio` would have to be added to Pro in `plans.ts` first; that is a pricing
decision and was not made here.

Tests (`scripts/e2e/library-saved-answer-harness.ts`, 63 checks): for each of the seven, a paying account without the section gets
403 `plan_required` naming the section, with zero provider requests and no daily unit spent; with the
section the request is not turned away by the section check; the unmodified handler fails the check
(mutation proof run on `library-ai-writing-assistant`). Unauthenticated callers are rejected by the existing plan-gate
harness (`subscription-gate-harness.ts`), which covers every function. Admin is entitled through
`user_has_section` and is covered by the database scenarios, not re-tested here.

## 3. LiveKit

### Enforced by the application today

Mandatory authentication; paid plan or admin before anything is parsed or signed; room id must be a UUID or
`kids-<UUID>`; the room must exist and be active (admins excepted); ban check; participant name from the profile,
never an e-mail address; token scoped to one room and the verified user id, room-join only, two-hour lifetime;
provider key and secret are read only inside the function. Evidence: `scripts/e2e/livekit-gate-harness.ts`, 46 checks.

### Findings from this audit (all in the browser, none in the server)

| # | Severity | Finding | Evidence | Production exposure today |
|---|---|---|---|---|
| L1 | High (latent) | `voice_rooms.room_password` is stored in plain text and `SELECT` on that column is granted to **anon and authenticated**; the policy "Anyone can view active or upcoming default rooms" lets any visitor read every active room's password. The password is checked only in the browser (`VoiceRoom.tsx`: `password !== roomPassword`). `livekit-token` never checks it. | `has_column_privilege` = true for anon and authenticated; `pg_policies`; source lines | **0 rooms exist** in `voice_rooms` and `kids_voice_rooms`, so no real password is exposed |
| L2 | Medium (latent) | `join_cost_vx` is charged in the browser (`spendVX`); a direct call to `livekit-token` joins without paying | source | 0 rooms, none priced |
| L3 | Medium (latent) | `max_users` capacity and `is_private` are not enforced by the token; membership (`voice_room_members`) is self-grantable by RLS ("Users can join rooms"), so it cannot prove a payment or password | policies, source | 0 rooms |
| L4 | Medium | No token-issuance throttle: a paying account can request tokens in a loop (each token is cheap to sign, the cost is the participant-minutes they then use) | `livekit-token/index.ts` has no limit call | n/a |
| L5 | Medium | No minutes cap and no usage accounting for LiveKit: **the monthly audio limit of PR #474 covers `realtime-session` (OpenAI voice) only**, not LiveKit rooms, not TTS, not `ai-voice-chat` | `20261077` and `realtime-session` only | n/a |
| L6 | Info | Provider-side budget, spend alerts and billing model of the LiveKit project are unknown to this repository | no config in repo | **Unverified** |

L1–L3 were not fixed on this branch. A correct fix is a server-side join RPC that verifies a hashed password,
charges VX and checks capacity atomically, hands out a short-lived join proof that `livekit-token` requires, and
revokes the column; that changes the client join flow, adds a migration that rewrites stored passwords, and must be
designed with you. Doing it as a quick patch would either break rejoining (members cannot be trusted as proof) or leave
the hole open. Because production holds no rooms, the practical risk is that the first room anyone creates with a
password, a price or a capacity limit would not be protected. **Recommendation: treat room passwords, paid rooms and
capacity as unavailable until that join RPC ships**, or approve the fix as its own PR.

### Cost controls: what exists and what is only proposed

| Control | State |
|---|---|
| Plan gate | enforced |
| Token lifetime 2 h | enforced (a participant can reconnect with a fresh token, so this is not a session cap) |
| Room must exist and be active | enforced |
| Token throttle per user | **absent**; proposal: reuse the daily-counter pattern, about 60 tokens per user per hour, enough for normal reconnects |
| Concurrent participants per room | **absent** server-side (`max_users` is a column the browser reads) |
| Monthly minutes per plan | **absent**; proposal below |
| Usage accounting / reconciliation | **absent**: nothing records join or leave on the server (the client calls `cleanup_voice_room`) |
| Provider spend alert / budget | **unverified**; to be set in the LiveKit console by the owner |

Proposed values are a framework, not measured facts: there is no usage history (zero rooms exist), and no
LiveKit price is recorded in this repository. Step 1 is a provider-side alert at an amount you choose, because it
works without code. Step 2 is server-side join accounting (a `join` and `leave` record written by the token
function and a close-out job), which gives the first real data. Only then should a per-plan minutes cap be picked.
A cap would affect Basic, Pro and Business; the risk is cutting off a live room, so the cap should block
**new tokens** only; rollback is deleting the limit key.

## 4. WhatsApp notice budget (`whatsapp_notice_global_per_hour`)

Verified by `scripts/sql/ai-subscription-gate-concurrency.mjs` on real PostgreSQL 18 (CI job "The gate SQL, single
connection and real concurrency") and `scripts/sql/whatsapp-notice-scenarios.mjs` (46 checks):

- the cap is enforced under an advisory lock, so ten simultaneous connections admit exactly the cap, never more;
- a refused first notice leaves no claim row, so a retry is not charged twice, and keyed retries admit exactly one;
- a missing, null or non-numeric limit means no cap (today's behaviour); `0` is a kill switch;
- the number is normalised to digits, so changing the sender's formatting does not open a second bucket;
- a database failure fails closed (the gate answers "unavailable", nothing is sent);
- the budget applies only to the "you need a plan" notice. The function sends nothing itself and no other
  message type goes through it, so security and delivery messages are not counted.

**Is 60 per hour right?** From aggregate counts: all outbound WhatsApp traffic of every kind totals 857 messages since
2026-08-17, and its busiest hour was **34** messages. A budget of 60 notices per hour is above the busiest hour of
*all* outbound traffic, so it would not have touched a normal hour and would only bite during an abuse wave.
The log table has 0 rows because the budget is off and nothing records while it is off. A separate limit by message
type is not needed today: there is one notice type. **Recommendation: 60 per hour is suitable as a ceiling.** It
should be set with its rollback ready (delete the row, or set it very high). Meta's pricing for service messages
and any free allowance were **not verified**.

## 5. Monthly realtime minutes (PR #474)

- Scope: `realtime-session` only (OpenAI realtime voice). Not LiveKit, not text-to-speech, not `ai-voice-chat`.
- Period: calendar month in UTC. Unit: whole minutes, rounded up, never more than reserved.
- Reservation: a per-user advisory lock serialises reservations; the function reserves
  `min(session length, remaining)` before the provider is called; no cap configured means allowed and nothing recorded.
- **New evidence:** `scripts/sql/realtime-minutes-concurrency.mjs` (real PostgreSQL 18, 12 connections): 40 rounds of
  simultaneous reservations always admit exactly 3 (10+10+5 = 25); 25 rounds of reserve racing end never exceed the
  cap; twelve simultaneous ends of one reservation end it exactly once; another user is unaffected; `authenticated`
  cannot call the function. Removing the advisory lock makes it fail (mutation proof), so it catches the race. The
  older scenario script ran in PGlite, one connection, and could not.
- Fails closed: if the reservation call errors, the function answers 503 and no provider call is made.

Observations (not defects):
1. **No client ever calls `realtime_end`.** It is called only by the server when the provider refuses or the key is
   missing. A session that really lasted two minutes still counts its full reservation (10 by default). That is
   conservative, but it will make users hit a cap sooner than their real use. Either add a client end call (which a
   user could skip) or accept it and size the cap accordingly.
2. A reservation is made before the key and provider are called; both failure paths release it. An exception thrown
   after the reservation (not from the provider) is not released.
3. The Edge Function's outer `catch` returns the raw `e.message` to the browser. This pre-dates #474 and is out of
   scope, but it should say a fixed sentence like the provider branch does.
4. A plan change mid-month applies the new plan's cap to the whole month's usage (usage is summed per user, the cap
   is read per current plan). That is predictable and conservative on a downgrade.

**Candidate limits.** There is no usage data (the table is empty because no cap is set, and nothing recorded
before), so no number can be called measured. As a framework: set the cap per plan to a multiple of the session
length (default 10 minutes), for example Basic 3 sessions, Pro 6, Business 12 per month, start high enough that
nobody reaches it, watch `realtime_sessions` for a month, then lower. Because of observation 1, minutes consumed will
read higher than real talk time. **Not set, and not proposed for activation without your approval.**

## 6. Tests run

All on the branch head described in section 9; commands as in CI.

| Check | Result |
|---|---|
| `scripts/e2e/library-saved-answer-harness.ts` (Deno, in-process) | all passed, 63 checks; old handler fails the new check |
| `livekit-gate-harness`, `career-health-gate-harness`, `bazaar-notify-harness`, `subscription-gate-harness` | all passed |
| `scripts/sql/realtime-minutes-concurrency.mjs` (real PostgreSQL 18.4) | all passed; fails without the advisory lock |
| vitest: access-policy, ai-subscription-gate, trial-entitlement, migrations-invariants, section-entitlement, realtime-minutes | 258 tests passed |
| `tsc -b` | exit 0 |
| `deno check` on the seven changed functions | pass |
| ESLint on changed root files | 0 errors |
| Full vitest, build, SQL scenario scripts, axe, Trivy | see the CI result for the exact commit in the PR |
| Not run: "Edge Function end-to-end" against real provider keys | runs only in CI; skipped locally by design |

The new real-PostgreSQL realtime script runs in the "RLS authorization matrix" workflow (step added with your approval for this PR only). Locally: `npm i --no-save embedded-postgres pg`.

## 7. Recommended settings (none applied)

| Setting | Value | Affects | Rollout | Rollback |
|---|---|---|---|---|
| `ops_limits('whatsapp_notice_global_per_hour')` | 60 | WhatsApp "plan needed" notices | insert one row | delete the row (back to no cap) |
| LiveKit provider spend alert | owner's choice | LiveKit project | set in the LiveKit console | remove |
| `realtime_monthly_minutes` per plan | framework only, see section 5 | `realtime-session` | `limits = limits || '{…}'` on `billing_plans` | `limits - 'realtime_monthly_minutes'` |

## 8. Decisions that need your approval

1. LiveKit room passwords, price and capacity: approve a server-side join design, or declare them unavailable until it exists (L1–L3).
2. Whether Pro authors should keep the studio tools (this change makes them Business-only on the server, as the interface already is).
3. The owning section for `library-embed-book`, `analyze-meal`, `generate-diet-plan`.
5. Whether to set the WhatsApp budget (60/hour) and when.
6. Whether to add a client end call for realtime sessions, and the outer `catch` wording.

## 9. Changes on the branch `claude/post-deploy-limits-auth-audit`

- Seven Edge Functions check the section right after the plan gate (`requireSection`): six `studio`, one `library`.
- `src/lib/access/policy.ts`: the seven move from the gate-only list to `AI_FUNCTION_SECTIONS`; the pinned count is 14.
- `scripts/e2e/library-saved-answer-harness.ts`: seven refusal checks and seven pass-through checks; a placeholder
  provider key so key-first handlers reach the check.
- `scripts/sql/realtime-minutes-concurrency.mjs`: new real-PostgreSQL concurrency script.
- This document.

## 10. Still disabled or unapplied in production

- `whatsapp_notice_global_per_hour`: no row (off).
- `realtime_monthly_minutes`: on no plan (off).
- The seven section checks, the new concurrency script and this audit are on the branch only; **nothing in this PR is merged or deployed**.
- LiveKit room passwords, join cost and capacity: not enforced by the server, and no provider-side budget is verified.
- No migration was added, none applied; no plan, price, VX rule, balance or customer record was touched.
