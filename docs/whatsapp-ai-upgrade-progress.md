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

## Phases 7 and 8 — Images and documents · **DONE**

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

## Phase status

| Phase | Status | Commit |
| --- | --- | --- |
| 0 — Audit | **DONE** | this document |
| 1 — Core messaging hardening | **DONE** | `feat(whatsapp): rate limit ordinary senders and retry rejected sends` |
| 2 — Multilingual AI | **DONE** | `feat(whatsapp): answer in the sender's own language` |
| 3 — Conversation memory | **DONE** | `feat(whatsapp): bound the context window and roll up long conversations` |
| 4 — Knowledge base | NOT STARTED | |
| 5 — Voice notes | **DONE** | `feat(whatsapp): understand voice notes` |
| 6 — Voice replies | NOT STARTED | |
| 7 — Images | **DONE** | `feat(whatsapp): read images and documents` |
| 8 — Documents | **DONE** | `feat(whatsapp): read images and documents` |
| 9 — Video | NOT STARTED | |
| 10 — Human handoff | NOT STARTED | partially exists (see Phase 0) |
| 11 — Classification | NOT STARTED | |
| 12 — Summaries | **DONE** | summary engine built in Phase 3; handoff summary in Phase 10 |
| 13 — Bazaar assistant | NOT STARTED | |
| 14 — Order tracking | NOT STARTED | |
| 15 — User preferences | NOT STARTED | |
| 16 — Observability | NOT STARTED | |
| 17 — Cost control | NOT STARTED | |
| 18 — Security audit | NOT STARTED | |
| 19 — Accessibility and UX | NOT STARTED | |
| 20 — End-to-end tests | NOT STARTED | |
