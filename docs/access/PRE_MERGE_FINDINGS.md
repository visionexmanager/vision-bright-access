# PR #475 — pre-merge findings (second pass, 2026-10-21)

Labels: **[C]** read in source · **[T]** pinned by a test · **[H]** real handler run in-process with the network replaced (`scripts/e2e/*-harness.ts`) · **[S]** executed SQL (PGlite, or real PostgreSQL 18 where stated) · **[M]** measured in production, read-only today.

Nothing here changes a price, a plan price, a VX balance, an order, a subscription or customer data.

## 1. LiveKit voice rooms

- **Order [C][T][H].** `livekit-token` reads the `Authorization` header, verifies the session (`getUser`), then calls `hasActivePaidPlan` (`ai_user_entitled`: a paying account or an admin) **before `req.json()` is read and before `new AccessToken(...)` is created**. A source-order test pins both; the in-process harness confirms no token is ever returned to a refused caller.
- **Cases [H][S].** Free week → 403, no token. Expired subscription → 403. No plan → 403. Kids (active) → 200 with a signed token. Basic/Pro/Business (active) → 200. Admin → 200. Plan lookup failing → 503, no token (fails closed). No Authorization → 401 before any plan lookup. The database answers behind those cases are executed in `trial-entitlement-scenarios.mjs` ("LiveKit:" lines). The previous handler fails 3 of the harness checks (it signed a token for anyone signed in).
- **Kids voice rooms still work.** The VisionKids rooms call the same function with the parent's session; a Kids subscription is an active paid plan, so they pass (`ai_user_entitled` is true for Kids). Only a Kids account without an active subscription loses them.
- **Behaviour change, stated plainly: non-paying accounts lose voice-room access.** That is the free week, an expired or lapsed account, and a signed-in account with no plan. Before this PR they could join a room by direct link, because the lobby is a Pro section but joining a room falls under the free community section and the function checked nothing.
- **Unresolved, not invented.** LiveKit's own billing (cloud or self-hosted, the per-minute rate) is unknown. There is **no cap on room minutes** and none was added: a paying account can request a new two-hour token as often as it likes. No price or limit was changed.

## 2. WhatsApp notice, traced

1. A message reaches `whatsapp-webhook` (signature-verified). After the message is recorded, stage `subscription_gate` calls `requireActiveSubscription(db, {channel: "whatsapp", waPhone})`.
2. That calls `ai_subscription_gate_whatsapp(phone)`. Owner handset → authorized. Otherwise the linked account is looked up in `whatsapp_identities`.
3. **[20261079] A linked account whose plan resolves to `free_trial` is answered `blocked_silent` immediately, before the shared gate: no notice row is created, no renotice clock starts.**
4. Otherwise the shared gate runs: an entitled account is authorized; an unentitled one wins the *first notice* through `INSERT ... ON CONFLICT DO NOTHING` on `(channel, subject)`, and later messages are silent. Since #471, `UPDATE ... SET notified_at = now() WHERE notified_at < now() - interval '10 minutes'` re-arms it: the row lock lets exactly one concurrent message win.
5. On `blocked_first_notice` the webhook inserts the transcript row and calls `sendWhatsAppText` (Meta Graph API). That is the only message sent to an unentitled sender unprompted. No model, no provider, no VX is reached.
6. The webhook's separate account-linking turn (typed "link"/"unlink", or inside the email/code steps) replies once per user message. It is user-initiated and unchanged.

**Can it generate Meta-billable messages for free-week users?** Yes before this change (a service message beyond the 1,000 free per number per month; Meta's rate for these markets is not stated on its pages). **Not any more for a linked free-week sender [S].** Still possible, and not removed: unlinked numbers and linked accounts whose free week has ended. Those cannot be told apart from a subscriber who has not linked yet, and the notice is how they learn to link. Their exposure is at most 144 notices a day per number and **is not capped across numbers**; production has 9 numbers that have been told [M], and 0 linked free-week accounts today [M], so the new suppression affects nobody right now. Decide whether to cap notices per number per day, or globally per hour.

**Tests.** PGlite (`whatsapp-notice-scenarios.mjs`, 18 checks, mutation-checked): first notice, silence within the window (including 9 minutes), re-notice after 11 minutes, restart of the clock, never more than one row; free-week sender: 25 messages, always silent, zero rows, even with every clock aged; a stale row is not revived; paid → authorized; expired → told once; owner authorized. Real PostgreSQL 18 under 10 simultaneous connections (`ai-subscription-gate-concurrency.mjs`, which CI runs): 100 rounds of the first notice (exactly one winner each), **50 rounds of the 10-minute renotice (exactly one winner, none on the next burst)**, **50 rounds from free-week accounts (all silent, 0 notice rows)**.

## 3. Library saved results, traced

The function files read and write these tables (grep of `.from(...)`). "Saved-first" means a stored result is returned before the gate.

| Function | Stores / reads | Has a "return existing" path? | Decision |
|---|---|---|---|
| `library-ai-assistant` | `library_ai_summaries` (shared per book, row-level security = book access), `library_ai_content_cache` (shared by hash), `library_ai_activity_log` (own) | Yes (summary; translate/explain-paragraph) | **Saved-first, before the gate** (done). |
| `library-librarian-daily-plan` | `library_librarian_daily_plans` (own, one per day) | Yes (`plan_date = today`) | **Saved-first, before the gate** (done); `force` regenerates and stays gated. |
| `library-librarian-summary` | `library_librarian_summaries` (own) | No: always regenerates | Unchanged. The owner already reads stored summaries directly under row-level security. |
| `library-ai-chat`, `library-librarian-chat` | `library_ai_chat_sessions` (own) | No: every call generates | Unchanged. History is read directly by its owner. |
| `library-generate-flashcard-deck`, `-practice-exam`, `-quotes`, `-reading-plan` | decks/cards (own), quizzes (creator), quotes | No: every call generates | Unchanged. Stored output is read directly by its owner. |
| `library-translate-book-metadata` | `library_book_translations` (public read) | No (always calls the model) | Unchanged. |
| `library-research-assistant`, `library-ai-search`, `library-semantic-search`, `library-ai-classify-book`, `-detect-series`, `-build-knowledge-graph`, `-summarize-discussion`, `-translate-comment`, `-ai-writing-assistant` | various | No | Unchanged (generation). |
| the rest (`library-sync-progress`, `-track-reading`, `-recommend-*`, checkout/webhooks, certificates, import) | own rows / payments | not AI | See section 4. |

So only two functions conflated "get or generate" behind the gate; both now serve the caller's stored result first. Everything else already lets an owner read what was stored without any edge function, and none of it was touched.

**Found and fixed: `library_ai_content_cache` could be listed by any signed-in account.** Its only policy was `USING (true)` for `authenticated` (20260727), so a PostgREST `select=*` returned every other user's translations and explanations, including of text they had pasted. With free-week and Kids accounts now in front of this table, migration **20261080** drops the policy and the grants: only the service role can read it, and `library-ai-assistant` looks a stored answer up with the service role **by the exact hash only**. Production holds 0 rows today [M], so nothing has leaked, and the cache is only worth reading once it fills.

**Isolation tests [S]** (added to `rls-authorization-scenarios.mjs`, which CI already runs; 127 checks and 13 mutation proofs pass). The real `CREATE TABLE` and `CREATE POLICY` statements are extracted from the migrations (PGlite cannot replay them whole: they need pgvector) and executed as real roles: for daily plans, flashcard decks, librarian summaries, research analyses and chat sessions, user A reads A's own row, **cannot read B's row**, B cannot read A's, anonymous reads nothing, and A cannot write a row as B; a caller gets the summary of a book they may read and **not** the summary of one they may not; the content cache cannot be listed, read by hash or written by a signed-in user, and the service role reads it by hash. Re-opening a store with a permissive policy turns the matrix red (mutation proofs for the cache, chat sessions, summaries and daily plans). In-process (`library-saved-answer-harness.ts`): the plan lookup is filtered to the caller's id and today and uses the caller's own session; the cache read is a single exact-hash query.

## 4. The 26 previously unverified Edge Functions

Method: read the source of each for its identity check, whether it takes a user id from the request body (none does), what it can reach, and whether any paid provider is reachable. No function in this set reaches a paid generation provider. One reached the Gemini key and was fixed.

| Function | Guard / reason | Classification |
|---|---|---|
| bazaar-checkout, bazaar-stripe-connect, career-billing-checkout, career-gdpr-request, kids-issue-certificate, library-checkout-session, library-crypto-checkout, library-issue-certificate, library-librarian-privacy, library-paypal-checkout, library-purchase-book | verified session (`getUser`); acts on the caller's own account; payments finish at the provider/webhook | **Verified protected** (identity). Per-action authorization beyond identity was not re-reviewed line by line |
| library-sync-progress, library-track-reading, library-recommend-community | verified session; the caller's own rows under row-level security | **Verified protected** |
| library-book-analytics | session plus role check (book owner or admin) | **Verified protected** |
| library-import-book | session; own author record, or admin (public-domain imports admin-only) | **Verified protected** |
| billing-engine | session; admin actions check `has_role` | **Verified protected** |
| library-reward-vx | session; awards through `award_library_xp` under the shared 2,000 VX/day self-award allowance | **Verified protected, bounded** |
| social-oauth | session plus admin role check | **Verified protected** |
| vx-coin-review | admin RPCs enforce `has_role` themselves; the function only e-mails the buyer | **Verified protected** |
| mobility | session required (401); every provider adapter declares shape `none`, so none is callable and no paid call can be made today | **Verified protected**; a future adapter must add a plan gate before it is enabled |
| tv-validate-stream | `CRON_SECRET` | **Verified protected** |
| radio-stream-token, tv-stream-token | redeem a 64-character short-lived token minted for a signed-in account; expiry and the subscription re-checked on use; no token, no stream URL | **Verified intentionally public** (capability token) |
| newsletter-preferences | acts only on the subscriber whose unguessable manage token (UUID) is presented | **Verified intentionally public** (capability token) |
| **career-system-health** | **was unauthenticated**: every call probed the Gemini key and inserted 16 history rows; callable with the public anon key. **Now requires `CRON_SECRET` or an admin session, before any probe or write** | **Fixed** [H]; the old handler fails 4 harness checks |
| **bazaar-notify-seller** | session proven; the notification text carries a caller-supplied buyer name and **no per-caller send limit was found**; calls no paid provider | **Unresolved** (limit), flagged `open` and pinned by a test |

Nothing was marked safe merely because a bypass could not be found: identity is the claim, and the one function with a gap is named. A test now fails if any function has no stated guard and pins the single open one.

## 5. Migrations: verification

Replay on a clean database [S]: all migrations replay in PGlite; 20261062, 20261063, 20261075, 20261078 and 20261079 apply. 20261080 cannot (its table is created by a migration that needs pgvector, which PGlite lacks); it is executed against the real extracted table definition instead (section 3).

Over an existing database [S] (`trial-sections-migration-scenarios.mjs`, 22 checks): seeded accounts in every state (free week, expired, Kids, Basic, Pro, Business, admin), orders, points and linked numbers; snapshot; apply 20261078 and 20261079; apply both again. Results: **a second run changes nothing**; the only differences are `trial_sections()` and the Kids row's section list; every plan's price, name, description, features and active flag are identical; every limit is identical apart from the Kids sections; the section lists of free_trial/basic/pro/business are identical; WhatsApp allowances (50/150/400/unlimited) are identical; row counts for subscriptions, orders, points, profiles and linked numbers and the points balance are identical; each paid account keeps the same plan and AI entitlement; `whatsapp_entitlements` is identical for the free-week, Kids and Basic senders; the free week gains exactly academy, arcade, library. **Rollback** (the statements in the migrations' own header comments, then 20261075's function) returns the database to the "before" snapshot exactly, including the WhatsApp behaviour.

Production state to compare after any deploy [M] (read today): plans `free_trial` $0 / 0 VX / 3 sections; `kids` $3 / 3,000 VX / WhatsApp 50 / 4 sections; `basic` $5 / 5,000 / 150 / 8; `pro` $10 / 11,000 / 400 / 14; `business` $20 / 24,000 / unlimited / 18. 0 subscriptions, 1 order (pending), 20 profiles, 1 linked WhatsApp number, 9 numbers already told, points total 6,245, 0 linked free-week accounts. After deploy, only the `free_trial` and `kids` rows' section counts (3 to 6, and 4 to 7) may differ.

## 6. Exact production effects, deployment scope, rollback

**Effects when merged and deployed**
- Free-week accounts gain Academy, Library, Arcade; Kids subscribers gain the same three. No AI function opens for either.
- A linked free-week WhatsApp sender is never sent the subscription notice (affects 0 senders today).
- Accounts without an active paid plan (free week, expired, no plan) can no longer obtain a LiveKit room token.
- A stored library result or today's librarian plan is returned without the gate, the daily limit or a provider.
- Any signed-in account can no longer list the translate/explain cache; `career-system-health` refuses without `CRON_SECRET` or an admin session.

**Deployment scope.** Migrations `20261078`, `20261079`, `20261080` (additive/idempotent; they write one plan row's `limits.sections` and replace two functions and one policy). Edge Functions: `library-ai-assistant`, `library-librarian-daily-plan`, `livekit-token`, `career-system-health`, plus functions that import the edited shared files (`_shared/entitlements.ts`, the new `_shared/librarySavedAnswers.ts`). The SPA (new `plans.ts`, a note under the summary, 20 locale files). No secret, workflow or `config.toml` change.

**Rollback**
1. Entitlements: re-create `trial_sections()` from `20261063`, and `UPDATE public.billing_plans SET limits = jsonb_set(limits, '{sections}', '["news","community","assistive","kids"]') WHERE id = 'kids';`; revert `TRIAL_LOCAL_SECTIONS` and `KIDS_PLAN` in `plans.ts`.
2. WhatsApp: re-create `ai_subscription_gate_whatsapp` from `20261075`.
3. Content cache: only if the saved path is reverted too, `CREATE POLICY "library_ai_content_cache: authenticated read" ON public.library_ai_content_cache FOR SELECT TO authenticated USING (true);` and `GRANT SELECT ... TO authenticated`. Not recommended: it restores the bulk read.
4. Functions: revert the four function files. Reverting `livekit-token` restores open access.
All of it is data-preserving.

## 7. Remaining risks

1. LiveKit billing and a room-minute cap are unresolved.
2. WhatsApp notices for unlinked and expired senders: up to 144 a day per number, uncapped across numbers; Meta's service-message rate is unverified.
3. `bazaar-notify-seller` has no send limit that I could find.
4. The AI gate is plan-eligibility, not section-aware (pre-existing): any AI-eligible plan, Kids included, can call a gated AI function directly.
5. The saved-answer cache is empty in production; no cost saving exists or is claimed.
6. Free and expired accounts lose voice-room access (intended, a visible change).
7. Not verified in CI at the time of writing; see the PR for the run on the final commit.
