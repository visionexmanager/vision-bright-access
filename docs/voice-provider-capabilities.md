# Voice provider capabilities

Which provider can hear, and speak, which language — and, kept strictly apart,
**what a vendor claims** versus **what Visionex has measured**.

Authored 2026-08-26. The machine-readable source is
`supabase/functions/_shared/voice/capabilities.ts`; a test asserts this document
and that file list the same languages, so the two cannot drift.

## Read this before quoting anything below

| Status | Means |
| --- | --- |
| `SUPPORTED` | The vendor's documentation claims the language, as understood when this table was written. **Not evidence.** |
| `MEASURED` | Visionex ran the baseline and has numbers. See `docs/voice-quality-baseline.md`. |
| `UNMEASURED` | Nobody here has checked. Today this is **every language**. |
| `UNKNOWN` | Vendor coverage not confirmed. Routed away from, because guessing wrong sends somebody audio in a language they did not ask for. |
| `UNSUPPORTED` | The vendor states it does not cover the language. |
| `DEGRADED` | Measured, and materially worse than the others. Nothing is here yet, because nothing is measured. |

"The provider's documentation says supported" and "Visionex measured it" are
different columns on purpose. Every row below is `SUPPORTED / UNMEASURED`, which
is the honest state of the system today.

## The language list, and the conflict that was resolved

The brief for this work named twenty languages **including Ukrainian and
excluding Chinese**. The repository's canonical list —
`_shared/whatsappLanguages.ts`, asserted identical to the site's own
`LanguageContext` by a test — is:

```
en ar ur hi id ja it ko nl pl vi bn fa es de pt zh tr fr ru
```

That is Chinese, not Ukrainian. The conflict was raised rather than quietly
resolved, and the answer is that **the repository is authoritative**: Chinese
stays, Ukrainian is not added, and no internationalisation change follows from
this work. Adding a locale was never a voice decision — it is twelve thousand
translation keys — so nothing below covers Ukrainian.

## STT — speech to text

Both providers run a Whisper-family model. Whisper's published language set
covers all twenty locales, so the *claim* is uniform. Accuracy across these
languages is not uniform at all, and only the baseline can say by how much.

| Language | STT provider | STT model | Vendor claim | Visionex evidence |
| --- | --- | --- | --- | --- |
| Arabic (ar) | Groq → OpenAI | `whisper-large-v3-turbo` → `whisper-1` | SUPPORTED | UNMEASURED |
| English (en) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| French (fr) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| Spanish (es) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| German (de) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| Portuguese (pt) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| Italian (it) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| Dutch (nl) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| Polish (pl) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| Turkish (tr) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| Russian (ru) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| Hindi (hi) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| Urdu (ur) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| Bengali (bn) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| Persian (fa) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| Indonesian (id) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| Vietnamese (vi) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| Korean (ko) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| Japanese (ja) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |
| Chinese (zh) | Groq → OpenAI | same | SUPPORTED | UNMEASURED |

## TTS — text to speech

| Language | Defined provider | Model | OpenAI claim | ElevenLabs claim | Visionex evidence |
| --- | --- | --- | --- | --- | --- |
| Arabic (ar) | OpenAI | `tts-1` / `gpt-4o-mini-tts` | SUPPORTED | SUPPORTED | UNMEASURED |
| English (en) | OpenAI | same | SUPPORTED | SUPPORTED | UNMEASURED |
| French (fr) | OpenAI | same | SUPPORTED | SUPPORTED | UNMEASURED |
| Spanish (es) | OpenAI | same | SUPPORTED | SUPPORTED | UNMEASURED |
| German (de) | OpenAI | same | SUPPORTED | SUPPORTED | UNMEASURED |
| Portuguese (pt) | OpenAI | same | SUPPORTED | SUPPORTED | UNMEASURED |
| Italian (it) | OpenAI | same | SUPPORTED | SUPPORTED | UNMEASURED |
| Dutch (nl) | OpenAI | same | SUPPORTED | SUPPORTED | UNMEASURED |
| Polish (pl) | OpenAI | same | SUPPORTED | SUPPORTED | UNMEASURED |
| Turkish (tr) | OpenAI | same | SUPPORTED | SUPPORTED | UNMEASURED |
| Russian (ru) | OpenAI | same | SUPPORTED | SUPPORTED | UNMEASURED |
| Hindi (hi) | OpenAI | same | SUPPORTED | SUPPORTED | UNMEASURED |
| Indonesian (id) | OpenAI | same | SUPPORTED | SUPPORTED | UNMEASURED |
| Korean (ko) | OpenAI | same | SUPPORTED | SUPPORTED | UNMEASURED |
| Japanese (ja) | OpenAI | same | SUPPORTED | SUPPORTED | UNMEASURED |
| Chinese (zh) | OpenAI | same | SUPPORTED | SUPPORTED | UNMEASURED |
| Urdu (ur) | **OpenAI only** | same | SUPPORTED | **UNKNOWN** | UNMEASURED |
| Bengali (bn) | **OpenAI only** | same | SUPPORTED | **UNKNOWN** | UNMEASURED |
| Persian (fa) | **OpenAI only** | same | SUPPORTED | **UNKNOWN** | UNMEASURED |
| Vietnamese (vi) | **OpenAI only** | same | SUPPORTED | **UNKNOWN** | UNMEASURED |

The four `UNKNOWN` rows were **not confirmed against a current vendor source**
while this table was written, so they are marked unknown rather than guessed in
either direction. `ttsProviderFor()` routes them to OpenAI. If somebody verifies
ElevenLabs coverage, change one set in `capabilities.ts` and this table.

## Voice cloning

| Capability | Provider | Model | Status |
| --- | --- | --- | --- |
| Cloning | ElevenLabs | `eleven_multilingual_v2` | Implemented in `voice-studio`; **not exposed**, pending the consent and safety layer (Phase F). |

Cloned voices inherit the ElevenLabs language column above. No second cloning
provider is proposed.

## Routing rules, as implemented

**STT.** `sttProvidersFor(language)` returns the providers whose claim is
`documented`, in cost order: Groq, then OpenAI. An unknown or absent language
returns the full chain, because Whisper detects the language itself and "we do
not know what this is" is not a reason to refuse to listen. A language nothing
claims fails as `no_capable_provider` rather than being sent anywhere.

**TTS.** `ttsProviderFor(language, preferred)` honours a caller's preference
when that provider claims the language, and otherwise falls to the one that
does. It returns `null` when nothing claims it — which callers must treat as a
refusal. Audio in the wrong language is worse than no audio, because a
screen-reader user cannot see that it went wrong.

**A provider with no key is skipped, not attempted.** A missing key is a
deployment fact, not a transcription failure. It still appears in `attempts`, so
"why did this go to OpenAI?" always has an answer.

## Adding a local provider later

1. Implement `SttAdapter` (and optionally `TtsAdapter`) in
   `_shared/voice/providers/local.ts`.
2. Register it in `stt.ts`'s `ADAPTERS`.
3. Add its per-language claim to `capabilities.ts` — **a local model's coverage
   is not Whisper's.** Measure before claiming.

No caller, channel or document below the seam changes.

## What would move a row out of UNMEASURED

One baseline run with keys present, and — for any language whose speakers this
matters most to — real recordings rather than synthesised speech. The harness,
the corpus and the method are in `docs/voice-quality-baseline.md`.
