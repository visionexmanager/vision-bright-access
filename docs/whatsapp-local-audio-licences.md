# Prerecorded WhatsApp clips: sources, licences, state (2026-10-16)

Machine-readable record: `assets/local-audio/voice-prompts/provenance.json`
(source page, creator, licence, original checksum, transcript, transformation).
Reproduce with `scripts/local-audio/acquire.mjs` (reads `sources.json`; **refuses**
any file whose licence, re-read live from the Commons API, is not CC0 / public domain).

## What was found

Searched: Mozilla Common Voice (CC0, but its sentences did not contain our fixed
replies and the download needs an account and gigabytes), Wikimedia Commons, and
public Arabic corpora. **No recording of any existing registered reply exists in
public sources.** What does exist, CC0, is one-word human speech from the Lingua
Libre project on Wikimedia Commons. So, as agreed, new short acknowledgement
phrases were registered whose exact text is the recorded word. No existing text was
changed or removed.

| Response ID | en | ar | Source speaker (all CC0) |
| --- | --- | --- | --- |
| `ack_thanks` | Thanks. | شكرا. | en Wodencafe, ar AlNatiq |
| `ack_sorry` | Sorry. | آسف. (no clip) | en Wodencafe |
| `ack_hello` | Hello. | سلام. | en Wodencafe, ar Shahjina |
| `ack_goodbye` | Goodbye. | مع السلامة. (no clip) | en Wodencafe |
| `ack_okay` | Okay. | حسنا. (no clip) | en Wodencafe |
| `ack_yes` | Yes. | نعم. (no clip) | en Wodencafe |
| `ack_no` | No. | لا. | en Wodencafe, ar Besma05 |

10 clips: 7 English, 3 Arabic. The Arabic words with no clip have no CC0 recording
(the ones found were CC BY-SA or CC BY, which carry attribution or share-alike
duties and were not used). Other languages: no text, no clip, nothing claimed.

## Licence and attribution

CC0 1.0: no attribution is required and commercial use is permitted. Creators are
still named in `provenance.json`. The clips are lossy re-encodes (Opus 24 kbps mono
in Ogg) of the original WAV files; the original SHA-256 of each is recorded.

## State: what is and is not verified

- **Verified by machine:** each file decodes, is Ogg/Opus mono, 0.7–1.0 s, under
  3 KB, not silent; the manifest size/checksum match the file in
  `assets/local-audio/voice-prompts/` (test `local-audio-assets.test.ts`); the
  licence was CC0 per the Commons API on 2026-10-16.
- **NOT verified: that each clip says the word it is filed under.** The transcript
  is the word in the file's title. No one has listened. **All 10 are `disabled`**
  in the manifest; a person must listen, set `reviewed: true` in `provenance.json`
  and flip `status` to `active` in a PR. A test refuses `active` without review.
  Arabic `سلام` ("peace") should get a native speaker's judgement as a greeting.
- **Nothing sends these phrases yet.** A recording plays only when the reply text
  equals the registered phrase. No current reply path produces "Thanks." etc., so
  there are zero savings until one is added (e.g. answering a sender's thanks),
  which is a product decision.
- **Not installed anywhere:** no `voice-prompts` dataset on the server, no access
  here. `WHATSAPP_LOCAL_AUDIO` untouched. No WhatsApp message sent.

## Behaviour note for the owner

With the flag on, a voice-reply whose text is exactly one of these phrases and whose
clip is unusable goes out as text, not synthesised (the existing rule for registered
phrases). While the clips are `disabled`, an AI answer of exactly "Yes." or "No."
to a voice sender would therefore be text. With the flag off, nothing changes.

## The first use: mirroring a spoken greeting (flag `WHATSAPP_LOCAL_ACK`)

`supabase/functions/_shared/localAck.ts`, wired once in `whatsapp-webhook/index.ts`
after the plan check and the typed-message local answers, before triage.

- **Off** unless `WHATSAPP_LOCAL_ACK` **and** `WHATSAPP_LOCAL_AUDIO` are both `1`.
  Neither is set by this change.
- **Voice notes only, no caption.** Typed messages keep today's path.
- **Whole transcript must be one pleasantry**: hello / hi / hey, goodbye / bye /
  bye bye (English); سلام / مرحبا (Arabic). "hello, what are your prices" and
  "السلام عليكم" do not match. "Thanks" is not handled (no natural reply).
- **Only when the clip is `active`**, i.e. a person approved it. All clips are
  `disabled`, so today this never fires even with both flags on.
- **Reuses the ordinary `reply()`**: history, plan check, metering and the
  no-duplicate guard are the existing ones. If the clip then cannot be read, the
  existing speaking path sends the written word instead.
- No Arabic farewell: no CC0 recording exists.

## Still needing a person to listen (all 10, nothing is approved)

en: `ack_thanks`, `ack_sorry`, `ack_hello`, `ack_goodbye`, `ack_okay`, `ack_yes`,
`ack_no`. ar: `ack_thanks` (شكرا), `ack_hello` (سلام: also judge it as a greeting),
`ack_no` (لا). Only `ack_hello` (en, ar) and `ack_goodbye` (en) can be used by the
flag above; the others are registered for later use.

## Complete-sentence search (2026-10-16)

Commons / Lingua Libre searched for the registered sentences and their parts
("try again", "not available", "your question", "go ahead", حاول مرة أخرى, اكتب
سؤالك, غير متاحة, …): **no recording of any registered sentence exists.** Only
unrelated phrases turned up ("one moment, please", لحظة), neither a registered
reply and the Arabic one not CC0. Common Voice's sentence corpus does not contain
them either.
