# Proposed first batch: 10 recordings (proposal only)

No audio exists and none has been generated. This is a request for recordings and
a translation review. Texts are the existing strings from `whatsappStrings.ts`
(read aloud without the leading emoji). Files are named `<id>.<lang>.ogg`: Opus in
Ogg, mono, at most 512 KB and 20 s (enforced by `scripts/local-audio/prepare.mjs`).

| Response ID | UI key | English | Arabic |
| --- | --- | --- | --- |
| `processing` | `processing` | Processing your request… | عم عالج طلبك… |
| `request_failed` | `failed` | Sorry — that didn't go through. Please try again. | تعذّر إتمام هذه الخدمة الآن. جرّب مرة أخرى. |
| `empty_question` | `emptyQuestion` | I didn't get a question there. Send one and I'll answer. | لم يصلني سؤال. اكتب سؤالك وسأجيبك. |
| `unavailable` | `unavailable` | That one isn't available right now. | هذه الخدمة غير متاحة الآن. |
| `ask_question` | `askForQuestion` | Go ahead — send me your question. | تفضل، اكتب سؤالك. |

## Why these five

- They are the replies a voice-note sender hears most around a failure or a wait,
  where a synthesis call is otherwise made for a few words.
- Fixed sentences: no names, numbers, links, prices or plan details.
- Short (under 60 characters), so the clips are small and quick to review.
- None is a subscription, billing or limit message; those stay written.

**Caveat:** "most heard" is a judgement from the code path, not a measured
frequency. No usage counts exist yet; see the metrics note below.

## Review requirements

- **Arabic:** a native speaker must approve wording and register. `processing` is
  Levantine ("عم عالج") while the other four are Modern Standard; decide whether to
  keep one register for all five before recording. The tashkeel in `تعذّر` and
  `جرّب` should be read as written.
- **English:** one reviewer for tone; "Sorry — that didn't go through" is spoken
  without the dash.
- **Voice and rights:** recorded by a person, or one explicitly approved synthesis
  run; written confirmation that the clips may be stored and used commercially;
  no imitation of a real person without written consent.
- **Text match:** a listener confirms each file says exactly the text above before
  its manifest entry is accepted.

## Usage counts: what exists, and a minimal approach

What exists today:

- `whatsapp_messages` stores each reply body and its `medium`. A grouped count of
  bodies equal to a registered string would give real frequencies, but it reads
  conversation rows. I have no database access and did not run it.
- The `local_audio` log lines carry response id, language and outcome, with no text
  or number, but Supabase logs are short-lived and record nothing while the flag
  is off, so they cannot give the "would have saved" count beforehand.

Proposed minimal approach, **not implemented, needs your approval**:

1. One owner-run, read-only SQL query that returns only
   `(matching ui key, language, count)` for bodies exactly equal to a registered
   fixed string over the last 30 days. Output has no user id, no phone number, no
   other text; rows with count under 5 are dropped. Result goes to `counts.json`
   for `coverage.mjs --usage`.
2. Only if that proves useful and a standing count is wanted: a table
   `local_audio_counters(day, response_id, language, outcome, n)` incremented by
   the webhook. **Migration:** one new table plus an increment RPC. **Retention:**
   keep 90 days via the existing pg_cron cleanup pattern. **Access:** RLS enabled,
   no policies, service role writes, admin-only read RPC. No identifiers, no text.
   Because every service REVOKE needs its grant back, the migration must be tested
   with PGlite before merge.
