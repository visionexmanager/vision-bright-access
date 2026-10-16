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
