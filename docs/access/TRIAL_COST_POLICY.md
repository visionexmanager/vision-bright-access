# Cost-aware free trial and feature access policy

2026-10-21. Branch `claude/cost-aware-trial-policy`. Labels: **[C]** confirmed in source · **[T]** pinned by a test in this PR · **[M]** measured in production today (read-only) · **[U]** unverified.

Nothing here changes a price, a plan row, a VX balance, a subscription or customer data. The one entitlement change (the trial opens three more sections) ships as a migration that is **not applied until this PR is merged and deployed**, and needs your approval.

## 1. The rule, as implemented

> A trial account may use what Visionex already holds or serves from its own database, files and CPU. Anything that can reach a paid external provider needs identity, then an eligible paid plan, then VX/budget where it is charged, then the provider, in that order, on the server.

One declaration: [`src/lib/access/policy.ts`](../../src/lib/access/policy.ts). It adds **no price and no plan** (those stay in `lib/billing/plans.ts`) and **replaces no enforcement** (`ai_subscription_gate`, `plan_for_user`, the VX meter and the daily limits keep doing the work). What it adds is a written, tested answer to "does this reach a paid provider, and what must be true first", per Edge Function and per user-facing operation, plus `decideAccess()` which returns one of: allow (internal / saved / provider) or refuse with a reason and a translation key (`sign_in`, `trial_excluded`, `plan_required`, `plan_not_included`, `insufficient_vx`, `unavailable`, `review`).

The tests that keep the table honest (`src/test/access-policy.test.ts`, 54 tests): every directory under `supabase/functions` is classified and nothing else is; a function whose source reaches a paid provider can never be A, B or C (mutation-checked: flipping `ai-chat` to B turns it red); every D function's source shows the guard its row names; the subscription gate precedes the first provider call in every gated function; cron/admin provider functions demand their secret or role; the webhooks demand the sender gate; a trial-allowed operation can never touch a paid provider except through a stored answer served first; the policy file holds no price.

Classes: **A** free in the trial (stored or local content) · **B** free with limits (Visionex's own CPU, database or bandwidth) · **C** needs identity or a verified signature, grants no provider access · **D** paid external provider, closed to the trial · **R** needs review (cost not established), treated as closed.

## 2. What changed

| Change | Where | Effect |
|---|---|---|
| The trial opens `academy`, `library`, `arcade` (plus the free set) | `TRIAL_SECTIONS` in `plans.ts`; migration `20261078` (`trial_sections()`) | A free-week account can read lessons and books and play browser games. Opens **no** billable operation: every AI Edge Function still asks `ai_subscription_gate`, which the trial does not pass. |
| A saved library answer is served **before** the gate, the daily limit and any provider | `library-ai-assistant` + `_shared/librarySavedAnswers.ts` | Before: refused without a paid plan even when Visionex held the answer, and a paid account spent one of its 40 daily units reading a row. Now: returned with `source: "saved"`; no provider, no gate, no VX, no daily unit. A miss or a lookup error falls through to the gate exactly as before. |
| Saved answers are labelled | `source`, `saved_at`; a note under the summary; `library_ai_activity_log.metadata.source` | Accurate about origin: a stored answer is never presented as freshly generated. |
| Six translated messages in all 20 locales, and the outdated free-week card rewritten | `access.*` keys, `plans.freeWeekBody` | The card used to promise "every section open, on the site and on WhatsApp", which was untrue since 20261063. |
| Existing pins updated to the new rule, deliberately | `subscription-tiers`, `trial-entitlement`, `trial-entitlement-scenarios.mjs`, `library-saved-external-scenarios.mjs`, `gate-stubs.mjs` | Each still asserts "the trial is never every section and never an AI service"; the exact set changed from 3 to 6 sections. |

## 3. Provider calls avoided

Measured today **[M]**: `library_ai_content_cache` 0 rows, `library_ai_summaries` 0 rows, `library_ai_activity_log` 0 rows, 0 provider events from any `library-*` function, 8 books, 0 audiobooks. **So the saved-answer path has avoided zero calls so far, because nothing has been stored yet.** The cache is filled only after a paid account generates something; a trial account will see saved answers only for what paid users have already asked. Hits are now countable: `select metadata->>'source', count(*) from library_ai_activity_log group by 1`, and each hit also writes one structured log line (`event: saved_hit, provider_called: false`). Provider calls are counted separately in `ai_usage_events` (by `function_name`). There is no baseline to compare against until traffic exists.

## 4. Existing restrictions that conflict with the policy

| Finding | Status |
|---|---|
| The trial could not open stored-content sections (academy, library, arcade) | **Changed** |
| A saved library answer was behind the paid gate | **Changed** (`library-ai-assistant` only) |
| The free-week card promised "every section" | **Changed** |
| The other library functions that keep their own saved tables (`library-librarian-summary`, flashcard/practice-exam generators, `library-ai-chat`) gate first and have no stored-first path | **Open**: gated, so safe, but a trial account cannot read what they stored |
| WhatsApp holds a trial sender silent after one notice, including for local menus and stored content | **Open, needs review**: the webhook is large and the change touches message handling; no local feature is served to a trial number |
| `livekit-token` mints a room token for any signed-in account; the voice-rooms section needs Pro but the function does not check it | **Open (R)**: LiveKit minutes may be billed by the host; unknown |
| Kids is a separate product: a Kids subscriber has fewer sections than the free week | **Owner decision** (pinned by a test as a known gap) |
| Games that speak through `text-to-speech` are refused for a trial account (gated), and whether each falls back to local or browser speech was not audited | **Unverified** |
| Read-aloud in the library: uses stored audio only when an audiobook exists; production has 0 audiobooks | **Unverified** beyond that |

## 5. Genuinely free versus hidden infrastructure cost

Free of provider cost **[C]**: news, assistive-product catalogue, Academy lessons and exercises, library reading and stored answers, browser games (VX spent on a game is an internal ledger row), account settings.

Not free of infrastructure, though not a paid-provider call: `file-convert` (own server CPU and bandwidth, 10/day, gated), radio/TV stream tokens (bandwidth through the stream proxy, plan-gated), `library-import-book` (fetch and storage), `moderate-content` (OpenAI's free moderation endpoint, rate-bound by the platform), community posts and uploads (storage), `mobility` (keyless map services and partners; cost not established, class R), Supabase Edge invocations (the project is on the free plan today).

## 6. Edge Functions and operations

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
| voice.rooms | messages | R | yes | no | no | no | none | no | livekit-token |

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
| bazaar-checkout | C | unverified | no | Checkout or marketplace action; needs an account. |
| bazaar-notify-seller | C | unverified | no | Checkout or marketplace action; needs an account. |
| bazaar-stripe-connect | C | unverified | no | Checkout or marketplace action; needs an account. |
| bazaar-stripe-webhook | C | signature | no | Payment webhook; verified by provider signature, not a user session. |
| billing-engine | C | unverified | no | Subscription and order logic. |
| career-ai | D | ai_gate | no | Career AI; gated through its shared handler (handleStructuredCareerAiRequest). |
| career-billing-checkout | C | unverified | no | Checkout or marketplace action; needs an account. |
| career-billing-webhook | C | signature | no | Payment webhook; verified by provider signature, not a user session. |
| career-gdpr-request | C | unverified | no | Data-protection requests. |
| career-system-health | R | unverified | no | Lists Gemini models with a key. Caller auth not verified in this audit. |
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
| kids-issue-certificate | C | unverified | no | Issues a certificate. |
| kids-story-generate | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-ai-assistant | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-ai-chat | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-ai-classify-book | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-ai-search | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-ai-writing-assistant | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-book-analytics | B | unverified | yes | Reading analytics from the database. |
| library-build-knowledge-graph | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-checkout-session | C | unverified | no | Checkout or marketplace action; needs an account. |
| library-crypto-checkout | C | unverified | no | Checkout or marketplace action; needs an account. |
| library-crypto-webhook | C | signature | no | Payment webhook; verified by provider signature, not a user session. |
| library-detect-series | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-embed-book | D | ai_gate | no | Gated; produces or indexes content with a provider or heavy compute. |
| library-generate-flashcard-deck | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-generate-narration | D | ai_gate | no | Gated; produces or indexes content with a provider or heavy compute. |
| library-generate-practice-exam | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-generate-quotes | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-generate-reading-plan | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-import-book | B | unverified | no | Fetches and stores external files: bandwidth and storage on Visionex; not offered to the trial. |
| library-issue-certificate | C | unverified | no | Issues a certificate. |
| library-librarian-chat | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-librarian-daily-plan | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-librarian-privacy | C | unverified | yes | Privacy settings for the librarian. |
| library-librarian-recommendations | B | jwt | yes | Database-only recommendations; per-user daily limit, no provider. |
| library-librarian-summary | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-paypal-checkout | C | unverified | no | Checkout or marketplace action; needs an account. |
| library-paypal-webhook | C | signature | no | Payment webhook; verified by provider signature, not a user session. |
| library-process-background-jobs | D | cron | no | Scheduled (CRON_SECRET); processes queued jobs. |
| library-purchase-book | C | unverified | no | Checkout or marketplace action; needs an account. |
| library-recommend-books | B | jwt | yes | Database-only recommendations. |
| library-recommend-community | B | unverified | yes | Database-only recommendations. |
| library-research-assistant | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-reward-vx | C | unverified | yes | Awards VX through the self-award allowance. |
| library-semantic-search | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-stripe-webhook | C | signature | no | Payment webhook; verified by provider signature, not a user session. |
| library-summarize-discussion | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-sync-progress | C | unverified | yes | Reading progress sync. |
| library-track-reading | C | unverified | yes | Reading time tracking. |
| library-translate-book-metadata | D | ai_gate | no | Subscription gate runs before the provider call. |
| library-translate-comment | D | ai_gate | no | Subscription gate runs before the provider call. |
| livekit-token | R | jwt | no | Mints a LiveKit room token for any signed-in user. LiveKit minutes may be billed by the host; the section (messages/voice rooms) needs Pro but the function does not check it. |
| meta-messaging-webhook | D | webhook_gate | no | Messenger/Instagram webhook; AI answers need an active plan. |
| mobility | R | jwt | no | Calls keyless map services and travel partners; costs not established. |
| moderate-content | B | jwt | yes | Calls the free OpenAI moderation endpoint (no charge); signed-in only. Deliberately outside the subscription gate so child safety checks keep working. |
| news-generate | D | cron | no | Scheduled (CRON_SECRET) or admin; never a user request. |
| newsletter-preferences | C | unverified | yes | Subscription preferences. |
| ocr-scan | D | ai_gate | no | Subscription gate runs before the provider call. |
| organization-ai-admin | D | ai_gate | no | Subscription gate runs before the provider call. |
| owner-control | D | owner | no | Owner/admin console, can run AI. |
| provider-hub | D | admin | no | Admin or CRON_SECRET; provider registry and model discovery. |
| radar-ai | D | ai_gate | no | Subscription gate runs before the provider call. |
| radio-stream-token | B | unverified | no | Mints a stream token; bandwidth through Visionex stream proxy. Section needs a paid plan. |
| realtime-session | D | ai_gate | no | Subscription gate runs before the provider call. |
| send-email | C | jwt | no | Sends e-mail through the mail provider; signed-in only. |
| social-oauth | C | unverified | no | Connects owner social accounts. |
| social-publish | D | cron | no | Scheduled publishing (CRON_SECRET) and owner actions; uses AI for captions and images. |
| speech-generate | D | ai_gate | no | Subscription gate runs before the provider call. |
| speech-transcribe | D | ai_gate | no | Subscription gate runs before the provider call. |
| text-to-speech | D | voice_guard | no | Voice request guard: identity, plan, limit, then provider. |
| text-tools-generate | D | ai_gate | no | Subscription gate runs before the provider call. |
| trial-billing | C | cron | no | Scheduled trial reminders and expiry e-mails. |
| tv-stream-token | B | unverified | no | Same as radio. |
| tv-validate-stream | B | unverified | no | Validates stream availability. |
| video-studio | D | ai_gate | no | Subscription gate runs before the provider call. |
| voice-studio | D | ai_gate | no | Subscription gate runs before the provider call. |
| vx-coin-review | C | unverified | yes | VX review actions. |
| whatsapp-webhook | D | webhook_gate | no | WhatsApp webhook; AI answers need an active plan. Local menus/audio for the trial are NOT yet served: the gate stays silent for them. |

Counts: {"D":58,"C":26,"R":3,"B":11}

## 7. Rollout and rollback

**Order (each step is safe on its own):**
1. Deploy the Edge Function change first (`library-ai-assistant` + the shared module). It changes no entitlement; it only serves stored answers earlier. Watch `saved_hit` log lines and `ai_usage_events` for `library-*` calls.
2. Apply migration `20261078` and deploy the SPA (`TRIAL_SECTIONS`). The pipeline already runs migrations before functions; the SPA follows. Watch trial accounts: the count of `ai_subscription_gate_notices` (the gate still refuses them) and any new provider events attributable to a trial account (there should be none).
3. Seed the cache deliberately (an offline, owner-approved run of the existing summary generator over the 8 books) so the trial has something to read. Not done here: it spends money.

**Rollback:**
- Section change: re-create `trial_sections()` with the three-element array from `20261063` (one `CREATE OR REPLACE`), and revert `TRIAL_LOCAL_SECTIONS` in `plans.ts`. No row, price or balance is touched either way.
- Saved-first path: revert `library-ai-assistant/index.ts`; the shared module and the activity-log `source` field are additive.
- Locale keys are additive.

## 8. Unresolved risks and decisions for you

1. **Approve the trial change** (academy, library, arcade). Decide whether Kids subscribers should also get them.
2. **WhatsApp for trial senders** (local menus, stored content) is not changed; it needs its own review.
3. **`livekit-token`**: confirm whether LiveKit is self-hosted; if it is billed, add the section check.
4. The saved-answer path is **verified in code and in tests, but unproven in production** until there is something stored.
5. A shared cache means one account's summary is shown to another. That is the existing design (the tables are shared and the underlying text was already accessible to the requester); it was not changed, and it means a stale summary stays until replaced.
6. Pages that call a gated function (the AI panel in the reader) show the existing subscription notice; the new sign-in and not-included messages are translated and tested but not yet shown by a screen, because the existing notice component handles only the 403 case.
7. 26 Edge Functions have a guard that was **not proven** in this audit (`guard: unverified`); a test caps that number so it can only shrink.

## 9. How to reproduce

```
npx vitest run src/test/access-policy.test.ts          # 54 tests
npx vite-node scripts/finance/access-tables.ts          # regenerates the tables above
node scripts/sql/trial-entitlement-scenarios.mjs        # the trial rule in PGlite (npm i --no-save @electric-sql/pglite)
```
