# Assistant: answers that need no AI provider

Audit and change record, 2026-10-22. Branch `claude/visionex-cost-optimization-52888a`.

## What already existed (not rebuilt)

| Piece | Where |
| --- | --- |
| Local intent engine: greeting, farewell, thanks, help, and 7 page names, 20 locales, exact/pattern/squeezed/fuzzy tiers, whole-message rule | `supabase/functions/_shared/localIntents.ts`, `localIntentCatalogue.ts` |
| Website wiring (default assistant only) and WhatsApp wiring (plain text, entitled senders) | `ai-chat/index.ts`, `whatsapp-webhook/index.ts` |
| Saved library answers served before the gate | `library-ai-assistant` (#475) |
| Trial/cost policy table | `src/lib/access/policy.ts`, `src/lib/billing/plans.ts` |
| Provider usage metering (`ai_usage_events`) and admin cost reports | migrations 20261053, 20261073 |
| Prerecorded-phrase registry (WhatsApp voice) | `localAudio.ts`, `localAudioManifest.ts` |
| Provider-audio cache for WhatsApp replies | `whatsappSpeechCache.ts` |

## The gap that mattered

`ai-chat` answered local intents **after** `subscriptionGate`. A free-week, expired
or signed-out visitor who typed "hello" received a subscription refusal, so the
cost-free layer only ever helped callers who were already allowed to cost money.

## What changed

1. **`ai-chat` serves a local answer before the gate** (default assistant only).
   The caller's own limit (60/day, or the guest limit) is taken first; nothing
   else runs: no provider, VX, memory, budget or personal data. Anything not
   recognised outright falls through unchanged. The old post-gate copy is removed.
2. **Three fixed FAQs** (`localFaqCatalogue.ts`), 20 locales each: the free week,
   changing the language, contacting the team. Exact whole-message match only.
   Every statement is pinned by `src/test/local-faq.test.ts` to its source
   (`TRIAL_DAYS`, `TRIAL_SECTIONS`, `LOCALES.length`, a registered route).
3. **Policy row** `assistant.local_answer` (class A, trial-allowed, no provider).
   `assistant.chat` stays closed to the trial.
4. **Counter** `assistant_local_answer_daily` + `record_local_answer` (service
   role only) + `admin_assistant_local_answers` (admin only). Day / channel /
   intent / language / plan id; no identity, no text. Migration `20261086`.

## Trial plan: what needs no provider, what still does

| Request | Trial caller |
| --- | --- |
| Greeting, thanks, goodbye, "help" | local, no provider |
| "Open the library / academy / games / bazaar / services / pricing / news" | local link (the page applies its own access) |
| "free trial", "change language", "contact" (20 languages) | local |
| Anything else typed to the assistant | refused by the gate as before (assistant needs a paid plan) |
| Questions about *this* account ("days left in my trial") | not answered locally, never |

Nothing in plans, prices, entitlements or the gate changed.

## Not done, and why

* **Not a large "response library".** The existing catalogue answers only what has
  one public, sender-independent answer. Course/product discovery, prices,
  account state and career guidance are dynamic; they stay with the model or the
  owning service. Growing the catalogue is a content decision, one verified
  statement at a time.
* **No WhatsApp counting.** The webhook deliberately never learns who a sender is;
  it keeps its log line only. WhatsApp trial access is unchanged (not entitled).
* **No measured saving.** No production traffic has passed through this yet. The
  report returns local answers beside `ai-chat` provider attempts; the token
  figure is an estimate (4 chars/token), not billing.

## Audio (verified 2026-10-22)

* Text: all 3 FAQs x 20 locales = 60 replies, plus the existing social replies.
* Prerecorded: **0 clips.** Registry: 19 responses, 254 expected clips,
  0 active, 244 missing, 10 disabled, 0 problems. No FAQ answer is registered.
* TTS: OpenAI key valid and TTS models listed (`health-check`; generation not
  probed). Web `text-to-speech` uses `gpt-4o-mini-tts`, sends `no-store`, and
  does not cache. ElevenLabs: `ELEVENLABS_API_KEY` **not configured** (paused).
* Caching: WhatsApp has a provider-audio cache; the web chat has no read-aloud
  that calls the TTS function, so these answers cost nothing in audio — a screen
  reader reads the text. No clips were generated: usage is unmeasured.

## Verification

`npx tsc -b`, `eslint` on changed files, `deno check` of `ai-chat`, targeted and
full vitest, and the PGlite scenarios (`scripts/sql/assistant-local-answers-scenarios.mjs`,
22 checks, wired into `rls-authorization.yml`).
