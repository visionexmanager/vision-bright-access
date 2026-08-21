# WhatsApp AI upgrade — progress

Phase-by-phase upgrade of the live WhatsApp assistant. A phase is `DONE` only
when it has evidence: tests, a commit, and where it applies a production check.
A blocked phase records the real reason, never a claimed pass.

Status vocabulary: `NOT STARTED` · `IN PROGRESS` · `BLOCKED` · `DONE`.

A later session should read Phase 0, then continue from the first phase that is
not `DONE`.

---

## Phase 0 — Audit · **DONE**

### What is already live and must not be rebuilt

`supabase/functions/whatsapp-webhook/index.ts` (427 lines) is deployed and
serving. Probed on 2026-08-19:

| Probe | Result | What it proves |
| --- | --- | --- |
| `GET ?hub.verify_token=<wrong>` | **403** | Function is deployed and rejects a bad handshake |
| `POST` with no `X-Hub-Signature-256` | **403** | Signature is enforced — and since the code returns **503** when `WHATSAPP_APP_SECRET` is unset, a 403 proves the Meta secret **is configured in production** |

Working today:

- Meta `GET` verification handshake, and HMAC `X-Hub-Signature-256` over the raw
  body with a constant-time compare.
- Deduplication: `whatsapp_messages.wa_message_id` is unique, and the `23505`
  path turns a Meta retry into a no-op instead of a second AI call.
- Always answers `200`, so a processing failure never causes a retry storm.
- Per-message `try/catch`: one bad message cannot drop the rest of the batch.
- Conversation + transcript in `whatsapp_conversations` / `whatsapp_messages`,
  RLS on, service-role write, admin-only read.
- Owner control centre over WhatsApp (approve / reject / take over / return),
  authorised by configured number, rate-limited to 120 commands/hour.
- Arabic/English detection, welcome message, handover and failure notices.
- Escalation on: explicit request for a person, assistant self-handover, or AI
  provider failure. `control='human'` silences the assistant entirely.
- Bounded memory: last 12 conversational turns replayed.
- Reply clamping under WhatsApp's 4096-character limit.
- AI through the existing `_shared/assistants.ts` registry and
  `_shared/aiProvider.ts` fallback chain — no separate model config.
- `verify_jwt = false` correctly present in **both** `supabase/config.toml` and
  `scripts/deploy-changed-supabase-functions.sh` (Meta cannot present a JWT).

### What is missing

- **All media.** `extractMessages` marks anything that is not `text` as
  `unsupportedType` and the user gets "I can't read that kind of message yet."
  No image, audio, document or video handling exists.
- **No rate limiting or spam protection for ordinary users.** Only *owner
  commands* are limited. A single number can drive unbounded AI calls.
- **No outbound send retry.** `sendWhatsAppText` logs a non-OK status and gives
  up; the reply is lost.
- **No knowledge base retrieval.** The assistant answers about Visionex from
  model priors, with nothing to ground it.
- **No user preferences**, no classification, no summarisation, no Bazaar or
  order lookup, no metrics.
- **Language support is Arabic/English only**, by a character-range heuristic.

### Reusable assets found (do not rebuild)

| Capability | Where | Note |
| --- | --- | --- |
| Speech→text | `supabase/functions/speech-transcribe` | OpenAI `whisper-1` |
| Text→speech | `speech-generate`, `text-to-speech` | ElevenLabs key present |
| OCR | `ocr-scan` | Only if genuinely needed |
| RAG | `ai_embeddings` + `match_embeddings()` RPC, `embed-content`, `ai-search` | pgvector, 1536-dim |
| Structured output | `structuredCompletion` in `_shared/aiProvider.ts` | For classification |
| Providers | openai · anthropic · gemini · **groq** · mistral | All keys already synced by `deploy.yml` |

### Hard constraints

- **96 of 100 edge functions used.** New functions are nearly out of budget, so
  every capability here extends `whatsapp-webhook` and `_shared/` instead.
  (Recorded previously: at 100, new functions fail with a 402 that reads like a
  bundling error.)
- Free-form replies only inside Meta's 24-hour customer-service window.
- The repository is public — no production data in CI logs.

### Out of scope, as instructed

WhatsApp Calling API and Groups API: not enabled for this account and not
verifiable from here. Marketing and paid template campaigns: excluded.

---

## Phase 1 — Core messaging hardening · **DONE**

**Found.** Dedup, idempotency, malformed-payload safety, structured per-message
error handling and the always-200 contract were **already correct** and were left
alone. Two real gaps: ordinary senders had *no* rate limit (only owner commands
did), so one number could drive unbounded paid model calls in a loop; and a
rejected outbound send was logged and dropped, losing the reply.

**Changed.**
- `20260916000000_whatsapp_rate_limiting.sql` — `blocked_until`,
  `rate_notified_at`, `rate_limit_hits` on `whatsapp_conversations`, plus a
  partial index on inbound messages for the limiter's hot path and an abuse-triage
  index. Self-expiring by design: a cooldown, not a ban.
- `rateLimitDecision()` — a pure verdict over counts the webhook already has:
  60/hour, 10/minute burst, and a repeat guard for a client stuck resending. It
  notifies **once per window**, because replying to every throttled message is
  the flood it is meant to stop.
- `sendWhatsAppText()` now retries 429 and 5xx (and transport faults) up to
  three attempts with capped backoff, and never retries a 4xx — the same bytes
  would be rejected again, and the retry would cost the delivery window.
- The limiter runs **after** the message is logged, so a throttled sender still
  appears in the transcript; only the model call and the reply are withheld. The
  owner is exempt.

**Tests.** 12 new cases in `src/test/whatsapp-assistant.test.ts` (31 total in that
file): each limit, cooldown expiry, notify-once, retryable-status classification,
backoff bounds, plus two structural assertions — that throttling happens after the
insert, and that no send log line can contain the recipient number.

**Quality gate.** typecheck PASS · full suite 1301 PASS · both Deno sources parse
· no secrets in the diff. The one failing file, `whatsapp-business-profile.test.ts`,
fails identically on `main` from a Windows CRLF issue and is untouched here.

**Not verified.** The migration could not be executed locally — this machine has
no Docker, psql or PGlite — so it is reviewed, not run. It is additive
(`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) and re-runnable.

---

## Phase 2 — Multilingual AI · **DONE**

**Found.** Detection was a single regex — Arabic script, or English. The site is
translated into twenty locales, so a sender writing Turkish, Hindi or Japanese
was answered in English.

**Changed.**
- `detectLanguageCode()` covers all twenty locales. Script decides where a
  script belongs to one language (Bengali, Devanagari, Hangul, kana, Cyrillic,
  Han); marker words and diacritics decide the Latin-script ones. Deliberately
  **not** a model call — this runs on every inbound message, and a round-trip
  for something a regex settles is exactly the cost that accumulates unseen.
- Arabic script is split three ways. Urdu is caught by its own letters
  (`ٹ ڈ ڑ ں ھ ے ہ`); Persian is separated from Arabic by **orthography**
  rather than vocabulary — Persian writes keheh (`ک` U+06A9) and farsi yeh
  (`ی` U+06CC) where Arabic writes `ك` and `ي` — which survives sentences too
  short to contain a known function word.
- `preferred_language` (migration `20260916010000`) outranks detection, so a
  user who asked for English is not switched back the moment they quote an
  Arabic product name. NULL keeps the follow-the-message default.
- `languageDirective()` is **appended** to the assistant's existing system
  prompt, never replaces it, and tells the model not to mix languages. For
  `ar`/`fa`/`ur` it also asks for natural right-to-left text with no Latin
  chrome wrapped around it.
- The conversation row now stores the detected locale rather than the narrowed
  `ar`/`en` pair.

**Tests.** 26 new cases: one per locale with a real sentence, the three-way
Arabic-script split, empty and digit-only input, preference precedence, an
invalid stored preference, and the RTL flag. 62 in the file.

**Two real bugs the tests caught before commit.** `por favor` is shared between
Portuguese and Spanish and was making every Spanish sentence read as Portuguese;
and the Persian markers missed `سلام، من به کمک نیاز دارم`, which the
orthography rule now catches.

**Quality gate.** typecheck PASS · full suite 1332 PASS · Deno sources parse ·
no secrets. Same single pre-existing CRLF failure, untouched.

**Not verified.** Canned notices (welcome, handover, failure) still exist only in
Arabic and English; a Turkish sender gets an English welcome and then a Turkish
conversation. Widening those is queued for Phase 19.

---

## Phase 3 — Conversation memory · **DONE**

**Found.** Thread memory existed (12 turns, filtered to conversational kinds)
and was correct as far as it went. Three gaps: the window was bounded by *turn
count* but not by size, so twelve long messages could push tens of thousands of
characters into every model call; nothing condensed a conversation once it
outgrew the window; and **nothing was ever deleted**.

**Changed.**
- `budgetTurns()` caps replayed transcript at 6,000 characters, dropping from
  the old end so the exchange the user is actually in survives, and truncating a
  single oversized message rather than letting it evict everything around it.
- Rolling summary: once a conversation outgrows the window it is condensed once
  and replayed as background, refreshed every 10 inbound messages rather than
  every turn. It runs on **Groq**, not the model answering the customer — bulk
  text work with nobody waiting on the wording.
- The summary is framed as *reference material, not instructions*, because it is
  built from user text and must never be able to redirect the assistant.
- `redactSummary()` strips card-length digit runs, passwords, OTPs and tokens,
  and the summariser is told to **omit** secrets rather than mask them.
- `whatsapp_prune_transcripts(_days)` deletes message rows older than 90 days
  and keeps the conversation row and its summary, so continuity survives
  retention. Service-role only, with a 7-day floor so it cannot be used to wipe
  live support context. Scheduling is left as a commented `cron.schedule`, as
  the other recovery jobs in this repository do, because pg_cron is enabled per
  environment.
- A failed summary is logged and ignored: it costs context, never the reply.

**Tests.** 16 new cases (78 in the file): budget ceilings across sizes, oldest-
first eviction, oversized-message truncation, the too-small-budget case,
summary scheduling, prompt-injection framing, secret redaction, and three
assertions on the migration itself — that it never deletes conversations, that
it refuses a sub-7-day window, and that the function is revoked from ordinary
roles.

**Correction worth recording.** The "Deno sources parse" check used in Phases 1
and 2 was unsound — `esbuild --loader=ts` only applies to stdin, so it was
failing on usage rather than parsing. Fixed, and re-run against the Phase 1 and
Phase 2 commits: both genuinely parse. The corrected check then immediately
caught a real unterminated-string error in this phase's own patch.

**Quality gate.** typecheck PASS · full suite 1348 PASS · both Deno sources
parse (verified properly) · no secrets. Same pre-existing CRLF failure.

**Not verified.** Migrations still cannot be executed locally. The summary path
needs a live conversation longer than 12 turns to exercise end to end.

---

## Phase 5 — Voice notes · **DONE**

*Taken before Phase 4 deliberately: every attachment shares one fetch path, so
building it here also unlocks Phases 7–9, and none of it depends on the
knowledge base.*

**Found.** Every attachment — voice note, photo, PDF — got the same reply: "I
can't read that kind of message yet." `extractMessages` discarded the media id
entirely, so there was nothing to fetch even if something had wanted to.

**Changed.**
- `_shared/whatsappMedia.ts` — the shared fetch path. Media arrives as an id;
  turning it into bytes means asking Graph for a URL and then fetching it, which
  is **the shape of an SSRF**, so the host is checked against Meta's before any
  request is made. The URL carries an access token in its query string, so it is
  never logged, stored or put in an error. Size is checked twice: the declared
  size because it is free, and the bytes actually read because a declaration is a
  claim, not a fact. Per-kind MIME allowlists and byte ceilings.
- `_shared/whatsappTranscribe.ts` — **Groq `whisper-large-v3-turbo` first,
  OpenAI `whisper-1` second.** Both keys already exist, so no new vendor and no
  new credential; the order is the cost decision. Whisper detects the spoken
  language itself, so nothing biases it — a hint would be a guess from the
  *typed* language of earlier messages, and people switch.
- `extractMessages` now carries the media id, MIME, filename, caption and the
  `voice` flag. A caption is treated as the question, because it usually is.
- The webhook transcribes a voice note, re-detects the language **from what was
  said** rather than from an empty caption, answers it like any other question,
  and rewrites the stored row as `[voice] …` so the transcript and the replayed
  history read as a conversation rather than a gap.

**Tests.** 20 new cases (98 in the file). The SSRF guard gets its own group:
Meta's real hosts accepted; `evil-fbcdn.net`, `fbcdn.net.attacker.com` and
`lookaside.fbsbx.com.evil.co` refused; and `file://`, `169.254.169.254`,
`localhost` and plain http all refused. Plus MIME allow/deny, size ceilings,
duration estimation, the no-provider path, provider ordering, caption parsing,
and a check that the download URL can never reach a log line.

**Quality gate.** typecheck PASS · full suite 1368 PASS · all four Deno sources
parse · no secrets · **CI green on the PR** for the phases pushed so far.

**Not verified.** No real voice note has been transcribed end to end — that
needs a live message to the production number. The provider call itself is
exercised only through its guard paths, since no key is set under Vitest.

---

## Phases 7 and 8 — Images and documents · **DONE (PDF withheld)**

> **Correction, 2026-08-20.** This phase was written assuming Gemini was
> available. It is not: the account has no credit (confirmed by the owner, and
> the reason `gemini` is absent from `DEFAULT_PROVIDER_ORDER` in
> `careerAiOrchestrator.ts`). Three consequences were fixed before merge:
>
> - **Images** still work — the chain falls back to `gpt-4o-mini`. But Gemini
>   led the list, so every photo paid a failed round trip first. OpenAI now
>   leads; swap the two lines back when the account is funded.
> - **Text documents** shared the PDF chain, which is Gemini-only. That gave the
>   one attachment path needing no vision the *only* chain with no fallback, so
>   a plain `.txt` came back as "I couldn't read that file. A PDF or a text file
>   works best" — advice that blames the customer for a billing fault. They now
>   use `DOCUMENT_TEXT_TARGETS`, which is `VISION_TARGETS`.
> - **PDFs are genuinely Gemini-or-nothing** — `structuredOpenAICompatible`
>   sends a `data:` URL as `image_url` and OpenAI rejects `application/pdf`.
>   `DOCUMENT_TARGETS` is therefore **empty**, and `understandDocument` returns
>   the distinct reason `no_reader`, which the webhook answers with
>   `noReaderNotice` — "I can't read PDF files at the moment; send a screenshot
>   or paste the text". Restoring it is one line: put the Gemini target back.

Taken together: both ride the Phase 5 media path and differ only in what is
sent to the model.

**Changed.**
- Images and stickers are downloaded, encoded and read by a vision model.
  `gemini-flash-latest` first, `gpt-4o-mini` second — the cheap one leads.
- Documents: plain text, CSV and Markdown are **decoded locally**, because
  sending a text file to a vision model is paying for OCR nobody needs. A PDF
  goes to Gemini *as a PDF* — Gemini passes the MIME type through to
  `inline_data`, so no PDF parser is needed anywhere in this repository.
  Word files are zip containers and are declined honestly rather than
  half-read.
- **The schema is the anti-hallucination measure.** A model asked for prose
  about an unreadable photo will write prose; this one must answer
  `readable: true|false` first, and the webhook passes a `false` straight
  through as "I couldn't read that" instead of dressing it up as a description.
  The prompt also forbids inventing order numbers, prices, dates and policies.
- Attachments answer in the conversation's language, not the caption's.

**Design correction made mid-phase.** The first version put the pure decisions
(encoding, format policy, wording, schema) in the same module as the provider
calls. That broke `npm run typecheck`: importing it into the test suite pulled
`aiProvider.ts` and its `Deno` globals into the tsc project. Split into
`whatsappAttachments.ts` (pure, imported by the tests) and
`whatsappUnderstand.ts` (model calls). The type error was the design telling
me the seam was in the wrong place.

**Tests.** 11 new cases: base64 round-trip including a 300 KB payload that a
naive `String.fromCharCode(...bytes)` would throw on, data-URL shape, format
routing for text/CSV/Markdown/PDF/Word/executable, the budget cap, the schema's
required fields, the refusal wording, provider ordering, and two webhook
assertions — that an unreadable verdict is passed through, and that the reply
language comes from the conversation.

**Quality gate.** typecheck PASS · full suite 1379 PASS · all Deno sources
parse · no secrets.

**Not verified.** No real photo or PDF has been through this end to end; that
needs a live message. Provider behaviour is covered only at its guard paths.

---

## Phase 4 — Visionex knowledge base · **DONE**

**Found.** The assistant answered Visionex questions from model priors with
nothing grounding it. The project already had the whole retrieval stack —
`ai_embeddings` (pgvector, 1536-dim), the `match_embeddings` RPC and
`createEmbedding` — so this needed no new index, store or provider.

**Changed.**
- The question is embedded and matched, and only passages at or above **0.78
  cosine similarity** are used. The floor is deliberately high: a weak match is
  *worse* than no match, because it reads as authoritative Visionex material
  while being about something else, and the model will use it.
- With no usable passage the model is told, explicitly, that it has none and
  must not state Visionex prices, policies, dates, availability or order details
  from memory — it should say it needs to check and offer the team. **This is
  the case that actually prevents invention**: staying silent would leave the
  model free to fall back on its priors without noticing it had.
- Retrieved passages are framed as *reference material, not instructions*,
  because they come from a table other systems write to.
- Small talk skips retrieval entirely, so "hi" does not cost an embedding call.
- A retrieval failure degrades to the ungrounded directive, which is the safe
  state rather than the risky one.

**Tests.** 13 new cases: ranking, the similarity floor, passage and character
ceilings, blank passages, both directive shapes, prompt-injection framing of
retrieved text, small-talk skipping, and two webhook assertions.

**Two bugs the tests caught.** `` does not apply to Arabic letters in
JavaScript, so "شكرا" was being sent for retrieval; and the Phase 2 assertion
about prompt assembly went stale when the prompt became an assembled list — it
now asserts the registry prompt still leads.

**Quality gate.** typecheck PASS · full suite 1391 PASS · Deno sources parse ·
no secrets.

**Not verified — and this one matters.** Retrieval quality depends entirely on
what is actually in `ai_embeddings` for Visionex content, which cannot be
inspected from here (service-role table, no production credentials locally). The
*mechanism* is tested; whether the corpus covers services, Academy, Bazaar and
policies well enough to answer real questions is an open question for
production verification. If the corpus is thin, the honest failure mode is the
assistant saying it needs to check — not inventing.

---

## Phases 15 and 6 — Preferences and voice replies · **DONE**

Taken together: a voice reply has to be opt-in, and opting in needs somewhere
to store the choice.

**Changed.**
- Three preferences, and only three: `preferred_language` (Phase 2),
  `voice_replies` and `verbosity`. Marketing opt-in is deliberately **absent** —
  there is no marketing send path in this feature, and a consent flag with
  nothing reading it is a liability pretending to be a feature.
- WhatsApp has no settings screen, so a preference can only be offered by
  noticing someone ask. Matching is deliberately narrow: a language name alone
  is not enough, because "my documents are in English" is a fact about
  documents. An intent phrase has to be present too. Negations are checked
  first, since "no voice replies" contains "voice replies".
- Every change is **confirmed out loud**. Silently changing how someone is
  answered is worse than not offering the setting.
- Voice replies: OpenAI `tts-1` (chosen over ElevenLabs purely on cost — this
  is an optional extra), uploaded to the phone number's media store and then
  sent by id, because audio is two API calls rather than one. **The text reply
  always goes first**, so a failed synthesis costs nothing; every failure in the
  voice path is swallowed. Canned notices stay text — they carry links and
  instructions that are useless read aloud — and URLs and Markdown are stripped
  from anything spoken.

**Tests.** 17 new cases (138 in the file): language switching in both scripts,
the passing-mention cases that must *not* trigger, voice on/off with negation
precedence, both length preferences, ordinary questions left alone, an
over-long message ignored, confirmation wording, and the voice gates including
canned-notice and length limits, plus ordering assertions that text precedes
speech and upload precedes send.

**Bug caught, third of its kind.** `` does not apply to Arabic in JavaScript,
so "احكي معي بالعربي" matched no language. The table now applies `` to the
Latin spellings only. This is the same trap as Phase 4's "شكرا" — worth
remembering as a repo-wide hazard.

**Quality gate.** typecheck PASS · full suite 1408 PASS · Deno sources parse ·
no secrets.

**Not verified.** No voice note has been synthesised or uploaded for real —
that needs a live conversation with the preference enabled.

---

## Phases 10, 11, 12 and 16 — Triage, handoff, summaries and counters · **DONE**

**Changed.**
- **Classification** into ten categories, on `llama-3.1-8b-instant` — the
  cheapest model here, because a label is routing, not an answer. The obvious
  cases skip the model entirely: an explicit request for a person, and an
  attachment with no caption. A classification failure never blocks the reply,
  and an unclassified message is a normal state.
- **Escalation without being asked**, and deliberately conservative: escalating
  a routine question wastes a person's time, but missing a complaint costs a
  customer. It fires on a complaint, on fraud/double-charge/hacked-account
  wording in either language, and on three unanswerable turns in a row — which
  is the assistant failing, not the user. Checked *after* the reply, so the
  customer is answered first.
- **Handoff briefing.** Every escalation path now goes through one helper that
  writes a briefing so the customer is not asked to repeat themselves. It is
  redacted with the Phase 3 redactor, the instruction forbids carrying
  credentials, and `fallbackBriefing()` guarantees staff never open a blank
  field.
- **Counters** as two `security_invoker` views over rows that already exist —
  a second copy would be one more thing to keep true. Daily volume by message
  kind, and a one-row health snapshot: escalations, human-controlled
  conversations, rate-limit hits, currently paused, active in the last day.
  `security_invoker` means the caller's RLS still applies, so the counters are
  not a way around admin-only.

**Tests.** 17 new cases (155 in the file): quick-path classification, schema
enum containment, escalation thresholds in both languages, the reply-before-
escalate ordering, briefing content rules, the non-blank guarantee, and three
assertions on the views including that both keep `security_invoker`.

**Quality gate.** typecheck PASS · full suite 1425 PASS · Deno sources parse ·
no secrets. One pre-existing assertion updated: escalation moved behind a single
helper, so the test now asserts the helper rather than the old inline string.

**Not verified.** No real escalation has produced a briefing; classification
accuracy is untested against real traffic.

---

## Phase 9 — Short video · **BUILT, WITHHELD — needs Gemini credit**

> **Correction, 2026-08-20.** Same cause as Phases 7 and 8. Video has no
> alternative provider at all, so `VIDEO_TARGETS` is **empty** and
> `VIDEO_READING_AVAILABLE` is false. The webhook checks it *before* the
> download — refusing after fetching several megabytes would spend the
> bandwidth to reach the same sentence — and replies with
> `noReaderNotice(language, "video")`. The code below is complete and tested;
> it is switched off, not missing. Funding the Gemini account and restoring the
> target turns it on.

Gemini takes video as `inline_data` exactly as it takes a PDF, so this needed
**no ffmpeg, no frame extraction and no second pipeline**. Capped at 6 MB — far
below the 16 MB media limit — because a model reads video by sampling frames and
the cost climbs with length; a support question is answered by a few seconds of
screen recording, and anything longer is declined with a reason. Gemini only, on
purpose: if it is unavailable the honest answer is "I couldn't watch it", not a
guess from the filename.

---

## Phase 13 — Bazaar assistant · **PARTIAL**

**What works.** Product, shop and service questions are answered through the
Phase 4 knowledge base, grounded in whatever Visionex content is embedded, with
the same rule as everywhere else: no material, no invented answer.

**What does not, and why.** Placing an order needs an authenticated buyer.
`bazaar_orders.buyer_id` references `auth.users`, and a WhatsApp sender has no
Visionex session — the same reason the original schema has no "users read their
own" policy. Ordering over WhatsApp needs the account link described under
Phase 14 before it can be built safely.

---

## Phase 14 — Order tracking · **BLOCKED — needs a product decision**

**The blocker is real and specific.** `bazaar_orders.buyer_id` references
`auth.users(id)`. The only phone number on an order is `shipping_phone`, which
is:

- unverified free text the buyer typed at checkout,
- not unique, and
- frequently **someone else's number** — a spouse, a colleague, a courier
  contact.

Matching an inbound WhatsApp number against `shipping_phone` would therefore
disclose one person's order, delivery address and email to whoever happens to
hold or spoof that number. The instruction for this phase was *"do not show
another person's order"*, and with the schema as it stands there is no lookup
that satisfies it. So it is **not implemented** — deliberately, rather than
shipped with a caveat.

**What would unblock it,** in increasing order of effort:

1. **One-time code link.** The assistant asks for the account email, the site
   emails a six-digit code, the sender types it back, and a verified
   `whatsapp_identities(wa_phone, user_id, verified_at)` row is written. Lookup
   then keys on `user_id`, never on a phone number. Roughly one migration, one
   RPC and one webhook branch.
2. **Order reference plus a second factor** — the customer supplies the order id
   *and* something only the buyer would know, disclosing status only.
3. **Status-only, no detail** — confirm "an order with that reference is out for
   delivery" and nothing more. Weakest, and still leaks existence.

Option 1 is the one worth building. **It needs your decision**, because it adds
an identity table and an email-sending step, and neither can be inferred safely.

---

## Phase 17 — Cost control · **DONE**

Routing was applied as each phase landed rather than bolted on afterwards, and
is now pinned by tests:

| Work | Runs on | Why |
| --- | --- | --- |
| Language detection | **no model** | script and marker regexes |
| Preference parsing | **no model** | narrow pattern matching |
| Obvious triage | **no model** | asked-for-a-person, bare attachment |
| Classification | `llama-3.1-8b-instant` (Groq) | a label is routing, not an answer |
| Rolling + handoff summaries | `llama-3.3-70b-versatile` (Groq) | bulk text, nobody waiting on the wording |
| Images, PDFs, video | `gemini-flash-latest` | cheapest vision; reads PDF and video natively |
| Voice in | Groq `whisper-large-v3-turbo` | a fraction of OpenAI's per-minute price |
| Voice out | OpenAI `tts-1` | cheaper than ElevenLabs for an optional extra |
| The customer's reply | the assistant registry's own targets | one place to change the model |

Every model input is bounded: 6,000 characters of transcript, 4,000 of retrieved
material, 24,000 of document text, 300 seconds of audio, 900 characters spoken,
6 MB of video. Retrieval is skipped for small talk, so "hi" costs no embedding
call. **No provider was added and no new key is required** — every key was
already synced by `deploy.yml`.

---

## Phase 18 — Security audit · **DONE**

| Area | Finding |
| --- | --- |
| Webhook signature | HMAC over the raw body, constant-time compare, checked before parsing; a missing secret fails closed with 503 |
| Token handling | No token, phone number or media URL appears in any log line — asserted across five files by a test that scans every `console.*` call |
| Media URL / SSRF | Download host allowlisted against Meta's **before** any request; suffix-only lookalikes (`evil-fbcdn.net`, `fbcdn.net.attacker.com`) and `file://`, `localhost`, `169.254.169.254` all refused |
| File validation | Per-kind MIME allowlist and byte ceiling; size checked twice — declared and actual |
| Payload size | Every model input bounded (Phase 17 table) |
| Prompt injection | Summaries, retrieved passages and attachment content are all framed as *reference material, not instructions*; the classifier is told its label is routing, never an answer |
| Data leakage | Summaries and briefings are redacted, and the instruction says omit rather than mask |
| Cross-user leakage | Conversations key on `wa_phone`; **no order or account lookup exists** — see Phase 14 |
| RLS | `whatsapp_*` tables are service-role write, admin-only read, with no "users read their own" policy; both metric views are `security_invoker` |
| Rate limits | Per-sender hourly, burst and repeat guards; owner commands separately limited |

**Unresolved, and worth stating:** the prune job is written but **not
scheduled** — pg_cron is enabled per environment, so the `cron.schedule` call is
left commented, as the other recovery jobs in this repository are. Until it is
scheduled, transcripts are retained indefinitely.

---

## Phase 19 — Accessibility and UX · **PARTIAL**

Replies are plain text with no reliance on emoji to carry meaning; every refusal
says what to do instead rather than only what failed; links stay intact in text
and are stripped only from spoken copies; RTL languages get an explicit
instruction not to wrap replies in Latin punctuation.

**Open item.** The canned notices — welcome, handover, failure, rate limit, media
refusals — exist only in Arabic and English. A Turkish sender gets an English
welcome and then a Turkish conversation. Widening them is a translation task
rather than an engineering one, and is the honest remaining gap.

---

## Phase 20 — End-to-end tests · **PARTIAL**

168 automated cases cover the scenarios that do not need a handset: Arabic and
English text, all twenty locales, follow-up context, voice-note handling and its
failure modes, image and document routing, invalid media, asking for a human,
duplicate webhook delivery, provider outage, rate limiting and malformed
payloads.

**What automation cannot reach from here:** a real voice note transcribed, a real
photo read, a spoken reply played back on a handset, and the Bazaar and order
paths. Those need a live message to the production number.

---

## Phase status

| Phase | Status | Commit |
| --- | --- | --- |
| 0 — Audit | **DONE** | this document |
| 1 — Core messaging hardening | **DONE** | `feat(whatsapp): rate limit ordinary senders and retry rejected sends` |
| 2 — Multilingual AI | **DONE** | `feat(whatsapp): answer in the sender's own language` |
| 3 — Conversation memory | **DONE** | `feat(whatsapp): bound the context window and roll up long conversations` |
| 4 — Knowledge base | **DONE** | `feat(whatsapp): ground answers in Visionex's own material` |
| 5 — Voice notes | **DONE** | `feat(whatsapp): understand voice notes` |
| 6 — Voice replies | **DONE** | `feat(whatsapp): remember preferences and speak replies on request` |
| 7 — Images | **DONE** (OpenAI leads; Gemini unfunded) | `feat(whatsapp): read images and documents` |
| 8 — Documents | **DONE** — PDF unblocked by local text extraction | `feat(whatsapp): read PDFs, weather, locations and the bazaar` |
| 9 — Video | **WITHHELD** — built and tested, needs Gemini credit | see Phase 9 |
| 10 — Human handoff | **DONE** | `feat(whatsapp): triage messages and brief the human who takes over` |
| 11 — Classification | **DONE** | `feat(whatsapp): triage messages and brief the human who takes over` |
| 12 — Summaries | **DONE** | rolling summary in Phase 3; handoff briefing in Phase 10 |
| 13 — Bazaar assistant | **DONE for search** | listings read from the tables; ordering still needs the Phase 14 account link |
| 14 — Order tracking | **BLOCKED** | no verified phone-to-account link |
| 15 — User preferences | **DONE** | `feat(whatsapp): remember preferences and speak replies on request` |
| 16 — Observability | **DONE** | `feat(whatsapp): triage messages and brief the human who takes over` |
| 17 — Cost control | **DONE** | routing applied across Phases 2-12, pinned by tests |
| 18 — Security audit | **DONE** | reviewed; assertions in the suite |
| 19 — Accessibility and UX | **PARTIAL** | canned notices still ar/en only |
| 20 — End-to-end tests | **PARTIAL** | 229 automated cases; live scenarios need a handset |
| 21 — Weather | **DONE** | keyless Open-Meteo; `feat(whatsapp): read PDFs, weather, locations and the bazaar` |
| 22 — Shared locations | **DONE** | pin, nearby, six-hour memory with its own erasure job |

---

## Phase 8 revisited — PDF, unblocked · **DONE**

**The blocker was never the format.** `DOCUMENT_TARGETS` was empty because the
only provider in this project's layer that accepts `application/pdf` is Gemini,
and the Gemini account has no credit. Every PDF a customer sent was refused
with `no_reader` before the call — an honest refusal, and still a refusal.

**Changed.** The PDF stops going to a model at all. `whatsappPdfText.ts`
extracts the text layer with `npm:pdf-parse@1.1.1` and the text travels down
`DOCUMENT_TEXT_TARGETS`, which is `VISION_TARGETS` — OpenAI first. `pdf-parse`
is not a new dependency: it is already pinned and running in
`library-import-book/index.ts` in this same Deno runtime, so the runtime
question was answered before this phase started.

Consequences worth stating:

- A PDF is no longer hostage to one account's balance. Neither is it paying
  image-token rates for pages that are mostly prose.
- `PDF_TEXT_BUDGET` (40 000) is larger than `DOCUMENT_TEXT_BUDGET` (24 000),
  because a PDF is usually the longer artefact and the first 24 000 characters
  of a contract can be entirely front matter.
- A scanned PDF is caught **before** a model is asked. `pdf-parse` returns page
  breaks and stray ligatures for a stack of photographs rather than an error,
  and a model handed that fragment writes a confident summary of nothing —
  precisely what the `readable` flag exists to prevent. `pdfTextIsUsable`
  counts meaningful characters, and per page as well as in total.
- Four distinct failures, four distinct replies: `scanned_pdf` (photograph the
  page — the image path reads those well), `empty`, `encrypted_pdf` (send an
  unprotected copy), and a provider fault, which asks the sender for nothing
  because it was not their doing.

**Video is unchanged and still dark.** It has no alternative provider at all;
`VIDEO_TARGETS` stays empty and the webhook still refuses before downloading.

**Not verified.** No real PDF has been through this end to end; that needs a
live message. `pdf-parse` is exercised in production by the library importer,
not by this path.

---

## Phase 13 revisited — Bazaar search · **DONE for search**

**Found.** Product questions were answered through the Phase 4 knowledge base,
grounded in whatever Visionex prose happened to be embedded. That is right for
"how do returns work" and wrong for "do you have honey": embedded prose does
not know today's price or whether a thing is in stock, and a model asked anyway
supplies both.

**Changed.** `whatsappBazaar.ts` reads intent and search terms; the webhook
queries `bazaar_products` joined to `bazaar_shops`, filtered to `is_active`,
and answers with name, price, shop and stock — or an honest nothing, naming
what it searched for so the sender can correct a word.

Three decisions carry the weight:

- **A three-character floor and a stopword list.** `ilike '%في%'` matches
  essentially every row and returns a random shelf as though it were a result —
  a hazard this repository has already been bitten by. The Arabic definite
  article is stripped too, so `العسل` finds a listing called `عسل`.
- **The terms are sanitised by construction.** Everything that is not a letter,
  a digit or a space is removed before a term exists, which is what makes
  interpolating them into a PostgREST `.or()` filter safe rather than merely
  convenient.
- **A weak guess that finds nothing is handed back to the assistant.** "عندك
  رقم الدعم؟" and "كم سعر الاشتراك" are the same phrase shapes a shopper uses
  and are not shopping questions. They are marked `confident: false`, allowed
  to search, and — on a miss — fall through instead of replying "no products
  matched" to somebody asking about their subscription.

**Still not possible.** Placing an order, which needs the Phase 14 account
link. Selling is explained rather than performed: `bazaar_shops.owner_id`
references `auth.users`, and a phone number is not an account. Saying so
plainly is the point — the alternative ends with somebody typing a password
into a chat window.

---

## Phase 21 — Weather · **DONE**

**Why it belongs here.** Knowing whether to take a coat is a glance out of a
window for most people and a message for this audience. It is also the single
most common thing a voice assistant is asked, and this one is reached by voice
note.

**Changed.** `whatsappWeather.ts` holds intent, place extraction, the WMO code
table and the formatting; `whatsappGeo.ts` does the fetching. A named city is
geocoded, an unnamed one falls back to the last shared pin, and with neither
the assistant asks — a forecast for the wrong continent reads exactly like a
right one.

- **Keyless on purpose.** Two capabilities in this assistant have already gone
  dark because a provider account ran dry. Open-Meteo needs no key, so this one
  cannot. A test asserts that `whatsappGeo.ts` reads no environment variable
  and sends no `Authorization` header, which is what stops a later edit
  quietly reintroducing the failure mode.
- **Arabic place names needed a second geocoder.** Probed on 2026-08-21,
  Open-Meteo's geocoder returns **no results at all** for `الرياض` while
  returning Riyadh for `Riyadh`; its index is romanised. Nominatim resolves
  Arabic, so it is the fallback — second, because its usage policy asks for
  restraint and most lookups never reach it.
- **Condition codes become words here, not in a model.** It costs nothing and
  it cannot hallucinate light snow in Riyadh.
- **A sixty-character cap separates a question from a sentence.** "The weather
  has been awful ever since my order went missing" contains the word and is a
  complaint about support.

---

## Phase 22 — Shared locations · **DONE**

**Found.** WhatsApp's location attachment was falling through to *"I can't read
that kind of message (location) yet"* — a strange thing to tell somebody who
has just said precisely where they are standing, and the input this channel
handles best: two taps, no typing, no camera to aim.

**Changed.** A pin is reverse-geocoded through BigDataCloud, which localises
properly (`الرياض، منطقة الرياض، السعودية`), and answered with where you are,
then the weather there as a second message — two topics, and a screen reader
reads one message at a time. `شو حولي` lists mapped places within 500 m from
Overpass, nearest first, with a distance **and** a compass bearing, because a
distance alone is true of every point on a circle.

**The privacy shape is the design.**

- Coordinates live on the conversation row, not in a history table. There is
  one current location; a trail of where somebody has been is a different
  product with a different consent conversation attached.
- They are used for at most six hours (`LOCATION_TTL_MS`). A stale location is
  worse than none — confidently wrong about the one thing the sender could not
  check for themselves.
- They are erased by `whatsapp_forget_locations()`, service-role only, on its
  own hourly schedule. Deliberately not folded into
  `whatsapp_prune_transcripts`, whose contract is different and whose clock is
  ninety days.
- They never enter `whatsapp_messages`. The transcript records `[location]`,
  which is what keeps the short clock meaningful.

**Ordering matters and is pinned by a test.** These checks run *before* the
five visual modes: `وين أقرب صيدلية` and `وين مفاتيحي` both open with وين, and
only the second is waiting for a photograph. Without that ordering the first
one arms the camera and then waits ten minutes for a picture nobody was going
to send.

**Two fixes fell out of the same code.**

- An attachment with no caption was logged to the transcript as the literal
  string `[undefined]`. It is now named by its kind.
- Which in turn exposed a live defect: the repeat limiter compares message
  bodies, so three captionless photos in a row were three identical bodies and
  tripped a fifteen-minute cooldown. Three photos in a row is the most ordinary
  thing a blind sender does here, so the limiter now counts text only —
  genuine redelivery is already a no-op through the unique `wa_message_id`.

---

## Discoverability · `whatsappCapabilities.ts`

A capability that is not announced does not exist. This audience cannot
discover a feature by noticing a new button, so the menu **is** the interface.
`capabilityMenu` lists weather, locations, nearby, the bazaar, selling, files
and voice notes, and is sent as its own message on first contact and whenever
someone asks for the menu — never appended to the five-item photo menu, which
would bury both lists.

---

## Quality gate for this batch

| Check | Result |
| --- | --- |
| `npm run typecheck` (`tsc -b`) | PASS |
| `npm test` | 1879 passed, 0 failed; `whatsapp-assistant` 229 of 229 |
| `npm run lint` | clean on every file touched here |
| `npm run build` | PASS |
| Deno sources parse | all ten whatsapp modules parse clean |
| Guards re-run against known-bad input | three new guards confirmed to fail when the behaviour they pin is removed |

`src/test/whatsapp-business-profile.test.ts` fails to load on this Windows
checkout and does so identically with every change here stashed — it is a line
endings problem in the repository, not a regression from this work.

**Not verified.** Nothing here has been through a live handset: no real pin, no
real PDF, no real Overpass round trip from the edge runtime. The three public
map services were probed directly on 2026-08-21 and behaved as the code
assumes; that is evidence about the services, not about the deployment.
