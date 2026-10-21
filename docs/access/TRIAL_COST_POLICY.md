# Cost-aware free trial and feature access policy

2026-10-21. Branch `claude/cost-aware-trial-policy`. Labels: **[C]** confirmed in source · **[T]** pinned by a test · **[H]** demonstrated by running the real handler in-process (`scripts/e2e/*-harness.ts`, network replaced) · **[M]** measured in production today (read-only) · **[U]** unverified.

**Later passes (WhatsApp notice trace and global budget, LiveKit room scope, section-level authorization of AI functions, cache privacy, seller notifications, the 26 audited functions, migration/rollback verification, the plan-by-section matrix, CI): [`PRE_MERGE_FINDINGS.md`](PRE_MERGE_FINDINGS.md).**

Nothing here changes a price, a VX balance, a subscription, an order or customer data. Two billing-plan **entitlement** rows change when this is deployed (the free-week list, and the `kids` plan's section list); see section 8 for the exact effects.

## 1. The rule, as implemented

> A trial account may use what Visionex already holds or serves from its own database, files and CPU. Anything that can reach a paid external provider, or a service billed per use by an outside host, needs identity, then an eligible paid plan, then VX/budget where it is charged, then the provider, in that order, on the server.

One declaration: [`src/lib/access/policy.ts`](../../src/lib/access/policy.ts). It holds **no price and no plan** (those stay in `lib/billing/plans.ts`) and **replaces no enforcement** (`ai_subscription_gate`, `plan_for_user`, the VX meter and the daily limits keep doing the work). It adds a written, tested answer to "does this reach a paid provider, and what must be true first", per Edge Function and per user-facing operation, plus `decideAccess()` returning allow (internal / saved / provider) or a refusal with a reason and a translation key.

Tests that keep the table honest (`src/test/access-policy.test.ts`, 56 tests): every directory under `supabase/functions` is classified and nothing else is; a function whose source reaches a paid provider can never be A, B or C (mutation-checked); every D function's source shows the guard its row names; the subscription gate precedes the first provider call in every gated function; cron/admin provider functions demand their secret or role; webhooks demand the sender gate; LiveKit checks the plan before reading the body or signing a token; a trial-allowed operation can never touch a paid provider except through a stored answer served first; the policy file holds no price.

Classes: **A** free in the trial (stored or local content) · **B** free with limits (Visionex's own CPU, database or bandwidth) · **C** identity or a verified signature, grants no provider access · **D** paid external provider or per-use billed service, closed to the trial · **R** needs review (cost not established), treated as closed.

## 2. What the PR does

| Change | Where | Effect |
|---|---|---|
| The free week opens `academy`, `library`, `arcade` | `TRIAL_SECTIONS` (`plans.ts`); migration `20261078` `trial_sections()` | A free-week account can read lessons and books and play browser games. No AI function opens: each still asks `ai_subscription_gate`, which the trial does not pass. |
| **Kids opens the same three** | `KIDS_PLAN` (`plans.ts`); migration `20261078` updates the `kids` row's `limits.sections` (union, idempotent) | A Kids subscriber has at least what the free week has. Kids was already AI-eligible, so no new AI exposure; the upgrade prompt for these sections points at Basic, never at the children's plan (`cheapestTierFor`). |
| A saved library answer is served **before** the gate, the daily limit and any provider | `library-ai-assistant` + `_shared/librarySavedAnswers.ts` | Before: refused without a paid plan even when Visionex held the answer, and a paid account spent a daily unit reading a row. Now: returned with `source: "saved"` and `saved_at`, no provider, no gate, no VX, no daily unit. A miss or lookup error falls to the gate as before. |
| **LiveKit now requires a paid plan or admin** | `livekit-token` + `hasActivePaidPlan` (`_shared/entitlements.ts`) | See section 4. Fails closed (503) if the plan cannot be read. |
| **WhatsApp: a linked free-week sender is never sent the subscription notice** | migration `20261079` (`ai_subscription_gate_whatsapp`) | The notice is an outbound message Meta may bill. Unlinked and expired senders keep it (see findings). |
| **The shared translate/explain cache can no longer be listed by any signed-in user** | migration `20261080`; the lookup uses the service role by exact hash | It had `USING (true)` for every authenticated account (see findings). |
| **Today's librarian plan is returned before the gate** | `library-librarian-daily-plan` | The caller's own stored row, read under their own session. `force` still pays. |
| **`bazaar-notify-seller` is limited and its events authorised** | migration `20261081` + the function | Any signed-in user could notify any seller unlimited on three channels and forge order notices; now a duplicate window, per-shop and per-day ceilings, a shop-wide e-mail/WhatsApp ceiling, and `order_paid` only for the caller's own recent order. |
| **WhatsApp notices: at most 7 a day per number** | migration `20261082` | First notice always; six re-notices in a rolling day instead of up to 144. |
| **`career-system-health` requires CRON_SECRET or an admin** | the function | It was callable with the public anon key: a Gemini probe plus 16 inserts per call. |
| Six access messages in all 20 locales; the free-week card rewritten | `access.*`, `plans.freeWeekBody` | The card promised "every section open, on the site and on WhatsApp", untrue since 20261063. |

## 3. Provider calls avoided: none yet, and no saving is claimed

Measured today **[M]**: `library_ai_content_cache` 0 rows, `library_ai_summaries` 0 rows, `library_ai_activity_log` 0 rows, 0 provider events from any `library-*` function, 8 books, 0 audiobooks. **The stored-answer path has avoided zero calls in production, because nothing has been stored.** The cache fills only after a paid account generates something.

What is established is the **path**, not a saving **[H]**: `scripts/e2e/library-saved-answer-harness.ts` runs the real handler with the network replaced and a stored row seeded. A stored summary and a stored translation return 200 with `source: "saved"`; zero requests reach any AI provider host; zero RPCs are made (no gate, no daily limit, no VX); only the cache table is read. A request with no stored answer and no plan is refused 403 at the gate with zero provider requests; a mode that is never stored goes straight to the gate; no or invalid session returns 401 and no stored text. The same harness run against the previous handler fails 6 checks, which is the original defect: an unsubscribed account was refused even a stored answer.

Until the cache holds usable answers and a deployed production request is observed returning one (`select metadata->>'source', count(*) from library_ai_activity_log group by 1` and the `saved_hit` log line), this is "designed not to call a provider on a hit", not a cost saving. There is no baseline to compare against.

## 4. Existing restrictions that conflict with the policy

| Finding | Status |
|---|---|
| The trial could not open stored-content sections | **Changed** |
| Kids subscribers would have had less than the free week | **Changed** (this decision) |
| A saved library answer was behind the paid gate | **Changed** (`library-ai-assistant` only) |
| The free-week card promised "every section" | **Changed** |
| **`livekit-token` handed a two-hour room token with publish rights to any signed-in account** (free week, expired, any plan). The voice-rooms lobby is a Pro section, but joining a room (`/community/room/:id`) falls under the free community section and the function checked nothing. Demonstrated: the previous handler fails 3 harness checks **[H]** | **Changed**: paid plan or admin required, before the body is read; 403 for a trial/free/expired account, 503 if unreadable. Behaviour change: an expired or free account can no longer join a voice room until it subscribes. Kids voice rooms keep working (Kids is a paid plan). |
| WhatsApp sent a static subscription notice (no model, no provider, no VX) to any unentitled sender and, since #471, repeats it at most once per 10 minutes per number. It is an outbound message Meta may bill past 1,000 free service messages a month per number | **Changed for linked free-week senders** (never sent); **open for unlinked and expired senders**, who need it to link or subscribe: at most 144 a day per number, not capped across numbers |
| The other library functions that keep their own saved tables gate first | **Open**: safe, but a trial account cannot read what they stored |
| `mobility` calls map services and partners; cost not established | **Open (R)** |
| The AI gate is plan-eligibility, not section-aware: any AI-eligible plan, Kids included, can call any gated AI function directly (the five media endpoints and `file-convert` add a section check) | **Open, pre-existing**; opening sections did not change it |

## 5. Genuinely free versus hidden infrastructure cost

Free of provider cost **[C]**: news, the assistive catalogue, Academy lessons and exercises, library reading and stored answers, browser games (the game pages call no Edge Function; VX spent on a game is an internal ledger row), account settings.

Opening Academy, Library and Arcade to the free week and Kids adds **no paid-provider path**: the only functions those areas call that reach a provider (`academy-chat`, the `library-*` AI functions, `text-to-speech` for read-aloud, `ocr-scan`) are all behind the AI gate or the voice guard, and the external-content search runs inside `library-research-assistant`, also gated. Infrastructure effect is small today **[M]**: 8 books, 3 chapters, 6 courses, no library or academy files in storage (the only stored objects are 31 MB of social-media and video outputs), 20 accounts. The costs that scale with use are Supabase reads and writes (reading progress, academy progress, activity logs), storage egress for book files once they exist, and Edge Function invocations; the project is on the Supabase free plan, so quotas rather than invoices are the exposure. Not provider-billed but metered by us: `file-convert` (own server, gated), radio/TV stream tokens (bandwidth), `library-import-book` (fetch and storage), `moderate-content` (OpenAI's free moderation endpoint).

## 6. WhatsApp and LiveKit

**WhatsApp [C][T]:** `whatsapp_entitlements` still returns `allowed: false` for a free-week account; the webhook asks `requireActiveSubscription` before any model call. The webhook file is not edited. A linked free-week sender now gets neither AI nor the notice (migration 20261079, tested in PGlite and on real PostgreSQL under concurrency); the trace and the remaining exposure are in `PRE_MERGE_FINDINGS.md`.

**LiveKit [H][T]:** now requires a paid plan or admin server-side, checked before the request body is parsed and before any token is signed. Non-paying accounts (free week, expired, no plan) lose voice-room access. The billing exposure of LiveKit itself (cloud or self-hosted, per-minute rate) is still **unknown**; the control is a gate, not a limit. There is no per-account room-minute cap, and a paying account could still run rooms for hours (token TTL is two hours, and a new token can be requested).

## 7. Edge Functions and operations

| Operation | Section | Class | Sign-in | Trial | Paid provider | Needs plan | VX | Stored answer first | Edge functions |
|---|---|---|---|---|---|---|---|---|---|
| library.read | library | A | no | yes | no | no | none | no | library-track-reading, library-sync-progress |
| library.saved_answer | library | A | yes | yes | no | no | none | yes | library-ai-assistant |
| library.audio_playback | library | A | no | yes | no | no | none | no | - |
| academy.content | academy | A | no | yes | no | no | none | no | - |
| arcade.play | arcade | A | no | yes | no | no | none | no | - |
| news.read | news | A | no | yes | no | no | none | no | - |
| assistive.catalogue | assistive | A | no | yes | no | no | none | no | - |
| community.post | community | B | yes | yes | no | no | none | no | moderate-content |
| files.convert | professional | B | yes | no | no | yes | none | no | file-convert |
| stream.tv_radio | tv | B | yes | no | no | yes | none | no | tv-stream-token, radio-stream-token |
| account.manage | - | C | yes | yes | no | no | none | no | billing-engine, newsletter-preferences |
| checkout.subscription | - | C | yes | yes | no | no | none | no | - |
| assistant.chat | assistant | D | yes | no | yes | yes | shadow | no | ai-chat, academy-chat, ai-generate |
| library.ai_generate | library | D | yes | no | yes | yes | none | yes | library-ai-assistant, library-ai-chat, library-generate-flashcard-deck |
| voice.tts | mediaStudio | D | yes | no | yes | yes | fixed | yes | text-to-speech, speech-generate, library-generate-narration |
| voice.stt | assistant | D | yes | no | yes | yes | none | no | speech-transcribe |
| voice.realtime | messages | D | yes | no | yes | yes | none | no | realtime-session |
| image.generate | mediaStudio | D | yes | no | yes | yes | fixed | no | image-generate, image-tools-generate, kids-drawing-to-art |
| video.generate | mediaStudio | D | yes | no | yes | yes | fixed | no | video-studio |
| vision.analyse | assistant | D | yes | no | yes | yes | fixed | no | analyze-image, radar-ai, ocr-scan, analyze-meal |
| whatsapp.ai | - | D | yes | no | yes | yes | shadow | yes | whatsapp-webhook, meta-messaging-webhook |
| kids.ai | kids | D | yes | no | yes | yes | none | no | kids-ai-teacher, kids-story-generate |
| voice.rooms | - | D | yes | no | yes | yes | none | no | livekit-token |

| Edge function | Class | Guard | Trial | Note |
|---|---|---|---|---|
| academy-chat | D | ai_gate | no | Subscription gate runs before the provider call. |
| ai-chat | D | ai_gate | no | Subscription gate runs before the provider call. |
| ai-generate | D | ai_gate | no | Subscription gate runs before the provider call. |
| ai-search | D | ai_gate | no | Subscription gate runs before the provider call. |
| ai-voice-chat | D | voice_guard | no | Voice request guard: identity, plan, limit, then provider. |
| analytics-insights | D | admin | no | Admin-only OpenAI summary of analytics. |
| analyze-image | D | ai_gate | no | Subscription gate runs before the provider call. |
| analyze-meal | D | ai_gate | no | Subscription gate runs before the provider call. |
| bazaar-checkout | C | jwt | no | Marketplace checkout; identity from the verified session (getUser), no user id taken from the body. |
| bazaar-notify-seller | D | claim | no | Sends an in-app notification, an e-mail (Resend) and a WhatsApp message to a seller, so it is treated as billed. Platform calls (service role) are unlimited; a user's are authorised per event (order_paid only for their own paid order from the last 30 minutes at that shop, order_status and low_stock refused) and claimed through bazaar_notify_claim: 10-minute duplicate window (24 hours for an event naming an order), 5 per shop per hour, 30 per day, and e-mail/WhatsApp for at most 20 per shop per hour across all senders. Fails closed. |
| bazaar-stripe-connect | C | jwt | no | Seller onboarding with Stripe Connect; verified session, own account. |
| bazaar-stripe-webhook | C | signature | no | Payment webhook; verified by provider signature, not a user session. |
| billing-engine | C | jwt | no | Subscription/VX actions for the caller; admin actions check has_role inside the function. |
| career-ai | D | ai_gate | no | Career AI; gated through its shared handler (handleStructuredCareerAiRequest). |
| career-billing-checkout | C | jwt | no | Career plan checkout; verified session, own account. |
| career-billing-webhook | C | signature | no | Payment webhook; verified by provider signature, not a user session. |
| career-gdpr-request | C | jwt | no | Data-protection request for the caller; verified session. |
| career-system-health | D | admin | no | Probes the Gemini key and writes 16 history rows per call. Was callable by anyone holding the public anon key; now requires CRON_SECRET or an admin session, before any probe or write. |
| contact-form | B | none | yes | Public form; sends one e-mail. Anonymous allowed with its own limits. |
| document-generate | D | ai_gate | no | Subscription gate runs before the provider call. |
| embed-content | D | admin | no | Admin-only embedding of site content. |
| enrich-product | D | admin | no | Admin-only product enrichment (OpenAI). |
| file-convert | B | ai_gate | no | Runs on Visionex own server (CPU, bandwidth); gated and limited to 10/day. |
| generate-diet-plan | D | ai_gate | no | Subscription gate runs before the provider call. |
| health-check | D | admin | no | Anonymous callers get the free key listing only; the paid generation probe is admin-only. |
| image-generate | D | ai_gate | no | Subscription gate runs before the provider call. |
| image-tools-generate | D | ai_gate | no | Subscription gate runs before the provider call. |
| kids-ai-teacher | D | ai_gate | no | Subscription gate runs before the provider call. |
| kids-course-generate | D | admin | no | Admin-only course generation. |
| kids-drawing-to-art | D | ai_gate | no | Subscription gate runs before the provider call. |
| kids-issue-certificate | C | jwt | no | Issues the caller's own certificate; verified session. |
| kids-story-generate | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-ai-assistant | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-ai-chat | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-ai-classify-book | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-ai-search | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-ai-writing-assistant | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-book-analytics | B | jwt | no | Book analytics for a book's owner or an admin; verified session plus role check. |
| library-build-knowledge-graph | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-checkout-session | C | jwt | no | Library purchase/donation checkout; verified session. |
| library-crypto-checkout | C | jwt | no | Library crypto checkout; verified session. |
| library-crypto-webhook | C | signature | no | Payment webhook; verified by provider signature, not a user session. |
| library-detect-series | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-embed-book | D | ai_gate | no | Gated; produces or indexes content with a provider or heavy compute. |
| library-generate-flashcard-deck | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-generate-narration | D | ai_gate | no | Gated; produces or indexes content with a provider or heavy compute. |
| library-generate-practice-exam | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-generate-quotes | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-generate-reading-plan | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-import-book | B | jwt | no | Import for the caller's own author record, or an admin (public-domain imports admin-only); verified session. |
| library-issue-certificate | C | jwt | no | Issues the caller's own certificate; verified session. |
| library-librarian-chat | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-librarian-daily-plan | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-librarian-privacy | C | jwt | no | The caller's own librarian data requests; verified session. |
| library-librarian-recommendations | B | jwt | yes | Database-only recommendations; per-user daily limit, no provider. |
| library-librarian-summary | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-paypal-checkout | C | jwt | no | Library PayPal checkout; verified session. |
| library-paypal-webhook | C | signature | no | Payment webhook; verified by provider signature, not a user session. |
| library-process-background-jobs | D | cron | no | Scheduled (CRON_SECRET); processes queued jobs. |
| library-purchase-book | C | jwt | no | Purchase of a book for the caller; verified session. |
| library-recommend-books | B | jwt | yes | Database-only recommendations. |
| library-recommend-community | B | jwt | yes | Database-only recommendations for the caller; verified session. |
| library-research-assistant | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-reward-vx | C | jwt | no | Awards through award_library_xp with the caller's own session, bounded by the shared 2,000 VX/day self-award allowance. |
| library-semantic-search | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-stripe-webhook | C | signature | no | Payment webhook; verified by provider signature, not a user session. |
| library-summarize-discussion | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-sync-progress | C | jwt | yes | The caller's own reading progress, favourites, shelves; verified session, row-level security. |
| library-track-reading | C | jwt | yes | The caller's own reading progress; verified session, row-level security. |
| library-translate-book-metadata | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-translate-comment | D | ai_gate | no | Subscription gate runs before the provider call. |
| livekit-token | D | paid_plan | no | LiveKit rooms are billed per participant-minute by the host (billing not verified). Requires an active paid plan or admin before the body is parsed; signs a token only for a room that exists, is active (admins excepted) and the caller is not banned from (adult UUID or 'kids-<uuid>'); the name is the account's display name, never an e-mail; the token is room-join only for the verified user id, two hours. Not enforced here: a room's join cost, password, privacy and capacity (the browser checks them), and there is no minute cap. Fails closed. |
| meta-messaging-webhook | D | webhook_gate | no | Messenger/Instagram webhook; AI answers need an active plan. |
| mobility | C | jwt | no | Requires a verified session (401 otherwise). Every provider adapter declares shape 'none', so no provider is callable today and no paid call can be made; a future adapter must add a plan gate before it is enabled. |
| moderate-content | B | jwt | yes | Calls the free OpenAI moderation endpoint (no charge); signed-in only. Deliberately outside the subscription gate so child safety checks keep working. |
| news-generate | D | cron | no | Scheduled (CRON_SECRET) or admin; never a user request. |
| newsletter-preferences | C | token | yes | Public by design: acts only on the subscriber whose unguessable manage token (UUID, 128 bits) is presented; reads and edits that one row. |
| ocr-scan | D | ai_gate | no | Subscription gate runs before the provider call. |
| organization-ai-admin | D | ai_gate | no | Subscription gate runs before the provider call. |
| owner-control | D | owner | no | Owner/admin console, can run AI. |
| provider-hub | D | admin | no | Admin or CRON_SECRET; provider registry and model discovery. |
| radar-ai | D | ai_gate | no | Subscription gate runs before the provider call. |
| radio-stream-token | B | token | no | Redeems a 64-character short-lived token minted for a signed-in account; expiry and the radio subscription are re-checked on use. No token, no stream URL. |
| realtime-session | D | ai_gate | no | Subscription gate runs before the provider call. |
| send-email | C | jwt | no | Sends e-mail through the mail provider; signed-in only. |
| social-oauth | C | jwt | no | Owner social-account connection; verified session plus an admin role check. |
| social-publish | D | cron | no | Scheduled publishing (CRON_SECRET) and owner actions; uses AI for captions and images. |
| speech-generate | D | ai_gate | no | Subscription gate runs before the provider call. |
| speech-transcribe | D | ai_gate | no | Subscription gate runs before the provider call. |
| text-to-speech | D | voice_guard | no | Voice request guard: identity, plan, limit, then provider. |
| text-tools-generate | D | ai_gate | no | Subscription gate runs before the provider call. |
| trial-billing | C | cron | no | Scheduled trial reminders and expiry e-mails. |
| tv-stream-token | B | token | no | Redeems a 64-character short-lived token minted for a signed-in account; expiry and the TV subscription are re-checked on use. No token, no stream URL. |
| tv-validate-stream | B | cron | no | Scheduled stream-availability probe; requires CRON_SECRET. |
| video-studio | D | ai_gate | no | Subscription gate runs before the provider call. |
| voice-studio | D | ai_gate | no | Subscription gate runs before the provider call. |
| vx-coin-review | C | jwt | no | Admin approval of VX top-ups; the RPCs check has_role(admin) themselves, the function only sends the buyer e-mail. |
| whatsapp-webhook | D | webhook_gate | no | WhatsApp webhook; AI answers need an active plan. A linked free-week sender is never sent the subscription notice; any other unentitled sender gets one notice and at most six re-notices a day, within an optional database-wide hourly budget (ops_limits, off by default). The notice fails closed. Local menus/audio for the trial are NOT served: the gate stays silent for them. |

Counts: {"D":61,"C":26,"B":11}

## 8. Migration `20261078`: exact effects, rollout and rollback

**What it runs** (all idempotent; applied twice in PGlite and a third time in a scenario, with identical results):
1. `CREATE OR REPLACE FUNCTION public.trial_sections()` returning `{news, community, assistive, academy, library, arcade}`. The function is read by `user_sections` and `my_plan_access` for accounts whose resolved plan is `free_trial`. It is `IMMUTABLE`, grants unchanged.
2. `UPDATE public.billing_plans SET limits = jsonb_set(...) WHERE id = 'kids' AND NOT (limits->'sections' @> '["academy","library","arcade"]')`: a **union** (existing entries stay, the three are added), touching only `limits.sections` of the one `kids` row. Its price (3.00), VX (3,000), `whatsapp_daily_messages` (50) and every other plan row are asserted untouched by the scenario script.

**What it does not touch:** `user_subscriptions`, `subscription_orders`, `profiles`, `user_points`, any balance, any price, any other plan, any policy or grant.

**Existing users and subscriptions [M]:** 20 profiles, 1 inside the free week, 0 rows in `user_subscriptions`, 1 pending Business order. So no live subscriber's entitlement moves; the only accounts affected are those in the free week (they gain three sections) and any future Kids subscriber.

**Order:** the pipeline runs migrations, then Edge Functions, then the SPA. Safe in that order: the migration alone opens the sections server-side RPCs (`library_save_external_item` checks `user_has_section('library')`, so a trial or Kids account can now keep a shelf entry, a metadata row); the SPA's `TRIAL_SECTIONS`/`KIDS_PLAN` then unlocks the routes. If the SPA deployed first, routes would stay locked and nothing breaks.

**Deployment effects of the whole PR:** Edge Functions redeployed: `library-ai-assistant` and `livekit-token`, plus any function that imports the edited shared file `_shared/entitlements.ts` (the media-studio functions), which change only by gaining an unused export. SPA: new `plans.ts`, a note under the summary, 20 locale files. No secret, workflow or config change.

**Rollback:**
- Entitlements: `CREATE OR REPLACE FUNCTION public.trial_sections()` with the three-element array from `20261063`, and `UPDATE public.billing_plans SET limits = jsonb_set(limits, '{sections}', '["news","community","assistive","kids"]') WHERE id = 'kids';`, and revert `TRIAL_LOCAL_SECTIONS` / `KIDS_PLAN`. No data is lost either way.
- Saved-first path: revert `library-ai-assistant/index.ts`; the shared module and the `source` field in the activity log are additive.
- LiveKit: revert `livekit-token/index.ts`; this restores the open behaviour, so decide knowingly.
- Locale keys are additive.

**Staged rollout:** (1) Edge Functions first. They change no entitlement; they only serve stored answers earlier and require a plan for LiveKit. Watch voice-room join failures from expected paying accounts and `saved_hit` lines. (2) Migration then SPA. Watch `ai_subscription_gate_notices` and new provider events attributable to free-week accounts (expect none). (3) Seed the cache only after approval (it spends provider money).

## 9. Remaining risks and open decisions

1. The saved-answer cache is empty; no saving exists or is claimed until it holds answers and a deployed request is seen returning one.
2. LiveKit's own billing is unknown, and there is no room-minute cap. The change closes access to non-payers only.
3. A free or expired account can no longer join community voice rooms (previously possible by direct link). If that is not wanted, the check can be narrowed to the free week only.
4. WhatsApp: the static notice repeats every 10 minutes per number with no cross-sender cap; trial senders get no local content.
5. The AI gate is not section-aware (pre-existing).
6. The new sign-in and not-included messages are translated and tested but no screen shows them yet; `livekit-token` refusals show as a generic error in the room page.
7. No Edge Function is left with an unproven guard or flagged open. `bazaar-notify-seller` is now limited (claimed through `bazaar_notify_claim`, migration 20261081); the rest are classified in `PRE_MERGE_FINDINGS.md`.
8. Games that speak through gated `text-to-speech` are refused for the free week; whether each falls back to local or browser speech was not audited.

## 10. How to reproduce

```
npx vitest run src/test/access-policy.test.ts          # 56 tests
npx vite-node scripts/finance/access-tables.ts          # regenerates the tables
node scripts/sql/trial-entitlement-scenarios.mjs        # trial + Kids row, idempotence (npm i --no-save @electric-sql/pglite)
deno run --no-lock --node-modules-dir=none -A scripts/e2e/library-saved-answer-harness.ts   # real handler, network replaced
deno run --no-lock --node-modules-dir=none -A scripts/e2e/livekit-gate-harness.ts           # real handler, network replaced
```
