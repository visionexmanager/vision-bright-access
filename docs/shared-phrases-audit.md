# Shared phrase library: platform audit (2026-10-16)

Evidence is from the repository at `0d69ba6` and the commands named below.
Production behaviour is unchanged by this work.

## 1. Already implemented (PR #421, #422, #423, #424)

- **Registry** `supabase/functions/_shared/localAudioManifest.ts`: `LOCAL_RESPONSES`
  (19 phrases: 12 full sentences read from `whatsappStrings.ts`, 7 curated `ack_*`
  words with their own text) and `LOCAL_AUDIO_ASSETS` (10 clips). `keys.ts` named in
  the brief does not exist; nothing needs it.
- **Loader** `localAudio.ts`: exact match, checksum and Ogg check, bounded cache.
- **WhatsApp**: voice replies consult the registry when `WHATSAPP_LOCAL_AUDIO=1`;
  `localAck.ts` mirrors a spoken greeting when `WHATSAPP_LOCAL_ACK=1`.

## 2. New in this change

- `sharedPhrases.ts`: one lookup over that same registry. `phraseText`, `findPhrase`
  (exact, locale-bound, **context-bound**), `audioState`, `sharedPhraseText`,
  `sharedPhraseClip`, `phraseCoverage`. No second catalogue.
- **Contexts**: a phrase names where it may be used. The seven `ack_*` words are
  `voice_pleasantry` only; the twelve sentences are `fixed_reply`. So "Yes." cannot be
  returned as an arbitrary reply because the text matches.
- **Review**: `ClipRecord.reviewed` (absent = not reviewed). The shared path and the
  greeting path refuse a clip without it, and `inspectRegistry` reports
  `active_without_review`.
- **Flags** (new, default off): `VX_SHARED_PHRASES_ENABLED` (text reuse) and
  `VX_SHARED_PHRASE_AUDIO_ENABLED` (needs the first too). The WhatsApp flags keep
  their meaning. Nothing is set anywhere.

## 3. Modules actually integrated and tested

Three WhatsApp runtime paths now consult the shared library, each with a test in
`src/test/shared-phrases-wiring.test.ts`. Everything else is listed below as not
integrated, with the reason.

| Path | What the shared library decides | Proven by |
| --- | --- | --- |
| Clip loader `loadClip` (the one place a clip is read) | A clip must be `reviewed`, not just `active`; otherwise `not_reviewed`, no fetch | loader tests, source check |
| Voice-reply resolver `localSpeechResolver` and the webhook `speak` fallback | Phrase **context**: an ordinary reply matches only `fixed_reply` phrases, so an AI answer of exactly "Hello." is synthesised as it was before #423 | resolver tests, webhook source checks |
| Spoken-greeting path `ackFor` | Exact words, `voice_pleasantry` context and `approved` clip state come from `findPhrase` / `audioState` | state tests, source check |

The webhook tells the resolver the context through one variable, set to
`voice_pleasantry` only inside the greeting block. Entitlement, metering, history and
the duplicate-reply guard are untouched. The new `VX_SHARED_*` flags are **not** read
by these paths (the WhatsApp flags keep their meaning), so they gate nothing yet.
Nothing changes in production today because every clip is disabled and the flags
are unset.

Not integrated, from inspection:

| Area | What it does today | Fit for fixed phrases |
| --- | --- | --- |
| Web TTS (`speakText`, 11 pages) | Browser `speechSynthesis`, free | Nothing to save; a recording would change the voice |
| `text-to-speech`, `useSpeechGenerate`, Library read-aloud, Kids story / voice tools, `library-generate-narration` | Paid or generated speech of **user or book content** | Dynamic; not fixed phrases |
| Web UI messages | `src/i18n/*.ts`, 13,573 flat keys, one file per locale | **0 of the 12 registered sentences exist as a web string.** 38 of 371 WhatsApp strings share their English text with some web key, and the ack words collide with unrelated labels ("Okay" rating, "Yes"/"No" quiz answers), so matching by text alone would be wrong |
| Academy, VisionKids, Games, Library, Bazaar notifications | Own i18n keys / components | Not inspected line by line; no shared wording found. Not claimed |

## 4. Still on their own independent paths

Everything in section 3's table, plus WhatsApp text replies (they use
`whatsappStrings.ts` directly, which `LOCAL_RESPONSES` reads, so there is no
duplicate definition).

## 5. Verified text, no recording

All 12 sentences in 20 locales, and all 7 `ack_*` words in en and ar: no recording
exists for any sentence. Words without a CC0 recording: ar `ack_sorry`, `ack_goodbye`,
`ack_okay`, `ack_yes`.

## 6. Recordings awaiting a human (none approved, none `reviewed`)

| Clip | Exact phrase | Source / licence | Needs |
| --- | --- | --- | --- |
| `ack_thanks.en` | Thanks. | Wodencafe, CC0 | listen |
| `ack_sorry.en` | Sorry. | Wodencafe, CC0 | listen |
| `ack_hello.en` | Hello. | Wodencafe, CC0 | listen |
| `ack_goodbye.en` | Goodbye. | Wodencafe, CC0 | listen |
| `ack_okay.en` | Okay. | Wodencafe, CC0 | listen |
| `ack_yes.en` | Yes. | Wodencafe, CC0 | listen |
| `ack_no.en` | No. | Wodencafe, CC0 | listen |
| `ack_thanks.ar` | شكرا. | AlNatiq, CC0 | **fluent Arabic speaker** |
| `ack_hello.ar` | سلام. | Shahjina, CC0 | **fluent Arabic speaker**: "peace", judge it as a greeting |
| `ack_no.ar` | لا. | Besma05, CC0 | **fluent Arabic speaker** |

Provenance: `assets/local-audio/voice-prompts/provenance.json`. Every clip is
`disabled`; `reviewed` is not set on any.

## 7. Savings

- **Measured: zero.** No flag is on and no phrase has an approved clip.
- **Expected (estimate only):** each full-sentence reply to a voice sender that
  reached a paid TTS provider is one avoided call, once a recording exists. No
  sentence has one, so there is nothing to estimate per clip yet. The web has no paid
  fixed-phrase TTS to save.
- Method to measure: count `local_audio` log lines with `outcome: audio` and
  `local_ack` lines; those are the only avoided calls.

## 8. Flags, production state

| Flag | Meaning | State |
| --- | --- | --- |
| `WHATSAPP_LOCAL_AUDIO` | WhatsApp prerecorded replies | not set (not verifiable from here) |
| `WHATSAPP_LOCAL_ACK` | spoken greeting mirror | not set (not verifiable) |
| `VX_SHARED_PHRASES_ENABLED` | shared text reuse | new, nothing reads it yet |
| `VX_SHARED_PHRASE_AUDIO_ENABLED` | shared recording reuse | new, nothing reads it yet |

## 9. Checks

Typecheck clean; `deno check` clean on `sharedPhrases.ts` and the webhook; eslint
clean on the changed files; production build succeeded; focused tests (shared
phrases, ack, local-audio) pass; full suite 6800 of 6801. The one failure,
`ai-route-report-workflow` (CRLF in a workflow file), **also fails on a clean checkout
of `main` on this Windows machine**, so it is a baseline failure, not this change.
Not run: CI-only jobs, any live WhatsApp test.

## 10. Remaining

1. Human listening and Arabic review of the 10 clips, then a PR setting `reviewed` and
   `status`.
2. Install the clips as the `voice-prompts` Data Hub dataset on the server (no access
   here), set the flags, run one authorised live test.
3. A real call site for `sharedPhraseText` / `sharedPhraseClip`. None exists, so
   wiring one is a product decision per module, not a bulk replacement.
4. Wording that really repeats across modules has to be found first; the exact-text
   overlap between web and WhatsApp today is nil for the registered sentences.
