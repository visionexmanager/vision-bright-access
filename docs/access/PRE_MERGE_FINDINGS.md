# PR #475 — pre-merge findings (second pass, 2026-10-21)

Labels: **[C]** read in source · **[T]** pinned by a test · **[H]** real handler run in-process with the network replaced (`scripts/e2e/*-harness.ts`) · **[S]** executed SQL (PGlite, or real PostgreSQL 18 where stated) · **[M]** measured in production, read-only today.

Nothing here changes a price, a plan price, a VX balance, an order, a subscription or customer data.

## A. Final pass (2026-10-21, fourth): what was re-verified and what changed

**Starting state (re-checked, not assumed):** PR #475, base `main` at `4ca80ce1` (no drift), head `516c9697` equal to the pushed branch, working tree clean, merge state CLEAN, 14 checks passing and 5 skipped, no reviews or comments. Open neighbour: PR #474 (realtime minutes) uses migration `20261077`, which does not collide with `20261078` to `20261084`. Production, read-only: plans `free_trial` $0 / 3 sections, `kids` $3 / 3,000 VX / 50 / 4, `basic` $5 / 5,000 / 150 / 8, `pro` $10 / 11,000 / 400 / 14, `business` $20 / 24,000 / unlimited / 18; 0 subscriptions, 1 pending order, 20 profiles, points total 6,245, 9 WhatsApp notice rows (all digits-only), 1 linked WhatsApp number.

**Why the 3→6 and 4→7 section changes exist.** `free_trial` gains `academy`, `library`, `arcade` and `kids` gains the same three. They were approved in this task's brief (free trial and Kids reach Academy, Library and Arcade without a paid subscription, provided no unapproved external cost is incurred). They are stored-content sections: every AI function inside them is a separate Edge Function behind the subscription gate, which neither plan passes as a trial, and the new section-level checks below mean a Kids or free-week account cannot use them to reach a provider. They do not open `assistant`, `career`, `mediaStudio`, `professional`, `studio`, `messages`, `kids` (for the trial) or any paid section. Pinned by `access-policy.test.ts` (the plan-by-section matrix) and the executed before/after snapshot.

### A.1 New findings fixed in this pass

| # | Severity | Scenario | Fix | Evidence |
|---|---|---|---|---|
| 1 | High (cost) | **WhatsApp notices are bounded per number but not in aggregate**: many different senders each get a first notice | Migration `20261083`: optional database-wide hourly budget in `ops_limits` (**off by default**), atomic under an advisory lock, claims handed back when refused, fails closed, counter holds no number or text; numbers normalised to digits | 46 PGlite checks; real PostgreSQL: 30 numbers in three simultaneous bursts against a budget of 7 are told exactly 7 times |
| 2 | High | **LiveKit signs a token for any string**: any paying account could name any room (creating rooms outside the product), reach a Kids room by prefix, join a room it was banned from, and the browser's e-mail address was shown as the participant name | `livekit-token` validates the id (UUID or `kids-<UUID>`), requires the room to exist and be active (admins excepted), refuses a ban, and names the participant by display name | in-process harness, 46 checks; the previous handler fails 21 |
| 3 | High | **AI gate is plan-eligibility only**: a Basic account could call the Kids AI functions, and a Basic or Kids account the Career AI, directly | `requireSection` (one helper in `_shared/entitlements.ts`) after the gate in 17 functions; saved answers also require the Library section | 17 functions × zero provider calls in the harness; table-driven plan × function tests; the old handlers fail the harness |
| 4 | Medium (privacy) | **The translate/explain cache is shared across users keyed by text**, so someone submitting the same text could read, or probe for, another person's entry; the per-book summary was written in the first requester's reading style | key is **per user** and carries a model and key version; entries older than 90 days are ignored and refreshed; the shared summary is stored and served only for the default reading style | unit and in-process tests (two accounts → two keys; non-default style → no shared read) |
| 5 | Medium | **A keyed notification (an order) could be re-announced every ten minutes** | Migration `20261084`: an event naming an order is a duplicate for 24 hours | PGlite; real PostgreSQL: 30 rounds × 10 simultaneous retries accept exactly 1 |
| 6 | Medium | A notification backed by a stale, cancelled, refunded, unpaid, foreign or other-shop order | already refused by the server-side order check; **now proven** | harness evaluates the filters the handler sent: 7 cases → 403, nothing sent, no claim spent |

### A.2 Section authorization matrix (from `plans.ts`, enforced server-side)

| Section | free week | expired / none | Kids | Basic | Pro | Business | admin |
|---|---|---|---|---|---|---|---|
| library | yes | no | **yes** | yes | yes | yes | yes |
| academy | yes | no | **yes** | yes | yes | yes | yes |
| arcade | yes | no | **yes** | yes | yes | yes | yes |
| kids | no | no | yes | no | yes | yes | yes |
| assistant | no | no | no | yes | yes | yes | yes |
| career | no | no | no | no | yes | yes | yes |
| mediaStudio / professional | no | no | no | no | no | yes | yes |
| messages (voice rooms lobby) | no | no | no | no | yes | yes | yes |

AI-eligible plans (those that pass `ai_subscription_gate`): Kids, Basic, Pro, Business and admin. A free-week or expired account never passes it, whatever its sections. **Behaviour changes, stated plainly:** a Basic account can no longer call the Kids AI functions directly, and a Basic or Kids account can no longer call the Career AI directly; the browser already hid both. Twenty-one AI functions remained gate-only (any paying plan) at the time of this pass; a later audit moved seven of them to sections, see `docs/security/POST_DEPLOYMENT_LIMITS_AND_AUTH_AUDIT.md`. The rest remain gate-only because no single section owns them (the general assistant, voice features, nutrition, the Library authoring and catalogue tools); each has its reason in `policy.ts` and the list is pinned so it cannot grow. Whether any should get a section is a product decision.

### A.3 What is enforced by code, what is verified, what is not

| Control | Enforced in code | Verified by | Not verified / outside this repository |
|---|---|---|---|
| WhatsApp notice: free-week senders never; per-number first + 6/day; atomic | yes | PGlite + real PostgreSQL concurrency | Meta's rate for these markets, whether this notice is billed, whether the account is on the free tier |
| WhatsApp global hourly budget | yes, **default OFF** | PGlite + real PostgreSQL | the value (proposal below) |
| Duplicate webhook delivery | yes: a unique `wa_message_id` makes a Meta retry a no-op before the gate | source (`whatsapp-webhook`, `whatsapp_messages.wa_message_id UNIQUE`) | not re-executed in this pass |
| Notice send fails closed | yes: an RPC error is "unavailable", which is not a first notice; one send attempt, no retry loop | source + the migration-83 fail-closed scenario | |
| LiveKit: paid plan, room, ban, name, token scope, ttl | yes | in-process harness | room join cost, password, privacy and capacity are **checked by the browser only**; no room-minute cap; no provider spend alert; LiveKit's own billing |
| Section entitlement of AI functions | yes (17 functions) | harness + table-driven tests | 21 gate-only functions (product decision) |
| Cache privacy and eligibility | yes | tests | the empty production cache is not a saving |
| Seller notification limits | yes | PGlite + real PostgreSQL + harness | none known |
| Dashboards or alerts for any of the above | **no** | | not built; provider billing alerts (Meta, LiveKit, Resend) cannot be seen from this repository |

**Safe counters that exist** (no number, text or account in them): `whatsapp_notice_log` (a timestamp and a kind, when a budget is set), `bazaar_notification_log`, `ai_subscription_gate_notices` (state), `library_ai_activity_log.metadata.source` (saved or generated) and the `saved_hit` log line. Example: `select kind, count(*) from whatsapp_notice_log where sent_at > now() - interval '24 hours' group by 1`.

### A.4 Proposed values that need your approval (nothing was invented or set)
- **`whatsapp_notice_global_per_hour`**: production holds 61 outbound messages of the notice's kind ("unsupported", which may include replies other than this notice) in 14 conversations since records began (about seven weeks, roughly 9 a week), so **60 an hour** would never bind in normal use and would stop a flood. Proposed, not set. To set: the `INSERT ... ON CONFLICT` in the header of migration 20261083.
- A room-minute cap and a join-cost enforcement for LiveKit: not proposed numerically because the provider's billing is unknown; the safe next step is a server-side join flow (verify member row, join cost and password at token time) and a LiveKit-side spend alert.

## 0. Third pass (the four remaining risks)

### 0.1 `bazaar-notify-seller` — was open, now limited

**Every way it can send** [C]: for one request it can create (1) an in-app notification for the seller, (2) an e-mail through Resend, a paid provider, to the seller's address, and (3) a WhatsApp text through the Graph API to the shop's number, which Meta may bill. The text and the buyer's name were chosen by the caller.

**What an authenticated user could do before** [H]: pass any shop id and notify its owner, unlimited times, with any text, on all three channels; and send `order_paid`, `order_status` or `low_stock` for a shop they had nothing to do with, so any account could tell a seller "New paid order". The notice also named the buyer by their **e-mail address** when no name was supplied, which put a buyer's address into the seller's inbox and WhatsApp. The previous handler fails 8 of the 20 checks in the new harness.

**What now happens:**
- Platform calls (bearer = service role, i.e. the Stripe webhook) are unchanged and unlimited.
- A user may send `message`, `add_to_cart`, `wishlist`, `review`, `dispute`, `report` and `order_paid`. `order_paid` is accepted only for an order that user really has with that shop (status paid/processing/shipped/completed, created in the last 30 minutes), and the order id becomes the dedupe key, so two real orders are two notifications. `order_status` and `low_stock` from a user are refused (403): no client sends them.
- Every user-triggered notification is claimed through **`bazaar_notify_claim`** (migration `20261081`): the same event within 10 minutes is a duplicate; at most 5 per user per shop per hour; at most 30 per user per day; and **e-mail and WhatsApp are granted to at most 20 notifications per shop per hour across all senders** (the in-app notification is never withdrawn by the shop-wide cap). The decision and the ledger insert are one transaction under advisory locks, so a burst cannot all pass. The claim failing means nothing is sent (503); a refused claim returns 200 `skipped`, so the marketplace screens (which fire and forget) are unaffected.
- Text is stripped of control characters and cut (buyer name 60, message 600), and the buyer is named by the supplied name or their display name, never by e-mail.

**Legitimate use is untouched:** a buyer adding several products, saving a wishlist, messaging, reviewing or disputing stays well inside 5 an hour per shop, and each real VX or card order is announced.

**Tests:** 31 checks in PGlite (`bazaar-notify-claim-scenarios.mjs`: delivery, duplicates, distinct orders, the 5/hour and 30/day ceilings, the 20/hour external ceiling, pruning, privileges, idempotent migration, **documented rollback executed**, a mutation proof); on **real PostgreSQL 18 with 10 simultaneous connections** (`ai-subscription-gate-concurrency.mjs`, run by CI): 30 rounds of 10 identical notifications allow exactly 1, 20 rounds of 10 different ones from one user allow exactly 5, and 30 users in three simultaneous bursts all get their in-app notification but only exactly 20 get e-mail/WhatsApp; 20 handler checks in-process (`bazaar-notify-harness.ts`: unauthorized, normal delivery, repeated, over each ceiling, external budget spent, claim failing, forged `order_paid`/`order_status`/`low_stock`, platform calls, the shop's owner, bad input, bounded text, no buyer e-mail), plus source-order tests in `access-policy.test.ts`.

**Rollback:** `DROP FUNCTION IF EXISTS public.bazaar_notify_claim(uuid, uuid, text, uuid, text); DROP TABLE IF EXISTS public.bazaar_notification_log;` then revert the function file (this restores the unlimited behaviour).

### 0.2 WhatsApp notices — exact circumstances, and a daily cap

**Who receives the static notice** (`ai_subscription_gate_whatsapp`, migrations 20261075, 20261079, 20261082):

| Sender | First message | Later messages |
|---|---|---|
| Owner handset, or an active paid account | authorized, no notice | authorized |
| **Linked account in its free week** | silent, **never a notice** (20261079) | silent |
| **Unlinked number** (no linked account) | **one notice** | silent; re-told after 10 minutes of writing again, **at most 6 re-notices in a rolling 24 hours** (20261082), so at most 7 notices a day per number |
| **Linked account whose free week has ended, no active plan** | one notice | same as unlinked |

Every inbound kind (text, voice note, picture) is judged the same way; the notice is always plain text, never synthesised speech. The typed account-linking flow ("link", "unlink", and the e-mail and code steps) is separate from the notice and is not limited by it, so a subscriber can always link their number. The first notice to a new number is never limited, because it is the only way a subscriber learns to link.

**What is verified about Meta pricing, and what is not.** Verified from Meta's own pages on 2026-10-21: per-message charging for service messages began on 2026-10-01, with one free tier of 1,000 delivered service messages per month per business phone number; rates are published only as a rate-card file per currency and no number is given in the page text for the Rest of Middle East or "Other" markets. One Meta page still says service messages are not charged; the dated updates page says they are. **Unknown:** the rate for the owner's markets, whether the owner's account is on the free tier, and whether this static notice is classified as a service message. Nothing in this PR assumes a price or a free allowance; the cap bounds the count instead.

**Controls added:** the daily cap above (`20261082`; two columns on `ai_subscription_gate_notices`; still one atomic UPDATE, so concurrent messages cannot add extra notices). Tested in PGlite (26 checks: seven notices then silence, window reset after 25 hours, first notices unaffected, mutation proofs) and on real PostgreSQL under concurrency (30 rounds at the cap: nobody is re-told; 30 rounds one below it: exactly one winner and the count lands on 6). The migration's own rollback is executed in `trial-sections-migration-scenarios.mjs`.

**Still open:** many different numbers each get their first notice (bounded by real senders: the webhook verifies Meta's signature on every delivery). There is no global hourly cap on first notices.

### 0.3 Library cache isolation — verified at the database

`library_ai_content_cache` after `20261080` has row-level security on, **no policy**, and no grant to `anon` or `authenticated` [S, extracted from the real migrations]. Direct client queries as a signed-in user: cannot list it, cannot read it by hash, cannot write to it; anonymous cannot read it; the service role reads it by exact hash. Other users' saved rows (daily plans, flashcard decks, librarian summaries, research analyses, chat sessions): own row readable, **another user's row not readable**, anonymous reads nothing, no writing as another user; the per-book summary cache follows book access. Paid generation stays gated: a miss with no entitlement stops at the gate with zero provider requests (in-process harness). Re-opening any store turns the matrix red (mutation proofs). **No cached text is exposed from another user's submission** through any path: the lookup is by exact hash of text the requester already sent.

**Residual, stated honestly:** the cache is shared by design (one translation of the same text serves everyone), so a requester who submits the exact text another person submitted gets that stored answer and its `saved_at` date. That reveals only that this exact text was translated before, never an unknown text or whose it was. If that is not acceptable the key must include the user, which removes the sharing.

### 0.4 LiveKit — unchanged

The paid-plan or admin check still runs before the request is parsed and before any token is signed (source-order test and in-process harness). No free access was enabled and no minute cap was invented; LiveKit billing and cost controls remain unverified.

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
| **bazaar-notify-seller** | session proven. It could notify any shop, unlimited, on three channels, and accepted forged `order_paid`/`order_status`/`low_stock`. **Now: event authorisation, an atomic limit (`bazaar_notify_claim`), bounded text, no buyer e-mail** (section 0.1) | **Fixed** [H][S]; the previous handler fails 8 harness checks |

Nothing was marked safe merely because a bypass could not be found. No function is left open; a test fails if any function has no stated guard or is flagged open.

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

**Deployment scope.** Migrations `20261078` to `20261084` (idempotent; they write one plan row's `limits.sections`, replace two functions and drop one policy, create one ledger table with one function, add two columns to `ai_subscription_gate_notices`, create two small service-only tables (`ops_limits`, `whatsapp_notice_log`) and replace the WhatsApp gate function twice more and the notification claim once more). Edge Functions: `library-ai-assistant`, `library-librarian-daily-plan`, `livekit-token`, `career-system-health`, `bazaar-notify-seller`, the 17 section-checked AI functions, plus functions that import the edited shared files (`_shared/entitlements.ts`, the new `_shared/librarySavedAnswers.ts`). The SPA (new `plans.ts`, a note under the summary, 20 locale files). No secret, workflow or `config.toml` change.

**Rollback**
1. Entitlements: re-create `trial_sections()` from `20261063`, and `UPDATE public.billing_plans SET limits = jsonb_set(limits, '{sections}', '["news","community","assistive","kids"]') WHERE id = 'kids';`; revert `TRIAL_LOCAL_SECTIONS` and `KIDS_PLAN` in `plans.ts`.
2. WhatsApp: re-create `ai_subscription_gate_whatsapp` from `20261075`.
3. Content cache: only if the saved path is reverted too, `CREATE POLICY "library_ai_content_cache: authenticated read" ON public.library_ai_content_cache FOR SELECT TO authenticated USING (true);` and `GRANT SELECT ... TO authenticated`. Not recommended: it restores the bulk read.
4. Functions: revert the four function files. Reverting `livekit-token` restores open access.
All of it is data-preserving.

## 7. Remaining risks

1. LiveKit billing and a room-minute cap are unresolved.
2. WhatsApp notices for unlinked and expired senders: up to 144 a day per number, uncapped across numbers; Meta's service-message rate is unverified.
3. Many different numbers each receive a first WhatsApp notice (no global hourly cap); Meta's rate and free-tier status for the owner's account are unknown.
4. The AI gate is plan-eligibility, not section-aware (pre-existing): any AI-eligible plan, Kids included, can call a gated AI function directly.
5. The saved-answer cache is empty in production; no cost saving exists or is claimed.
6. Free and expired accounts lose voice-room access (intended, a visible change).
7. Not verified in CI at the time of writing; see the PR for the run on the final commit.
