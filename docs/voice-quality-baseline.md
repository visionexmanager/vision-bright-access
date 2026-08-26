# Visionex voice quality baseline

**Status: harness complete, measurements NOT YET TAKEN.**
Authored 2026-08-26. Nothing in this document is an estimate, a figure from a
provider's marketing page, or a number inferred from documentation. Every result
cell is either measured or marked `UNMEASURED` with the reason.

## Why this exists

Every decision ahead of us — whether to add a GPU, whether a local model is good
enough for Arabic, whether to move a provider — is currently an opinion. The
self-hosting audit calls this Blocker 5 and gates all of Phase B on it. For an
audience that cannot see the output, "as good as today" has to be *measured*,
not assumed.

## What could not be measured, and why

| Blocker | Detail |
| --- | --- |
| No provider credentials on this machine | `OPENAI_API_KEY`, `GROQ_API_KEY` and `ELEVENLABS_API_KEY` are deploy-time secrets synced to Supabase by `deploy.yml`. They are not in the working copy and `.env.example` does not carry them. |
| No speech corpus | The repository contains game sound effects and no speech. No recording of a real person may be used, and none was. |
| No ElevenLabs library voice | Every voice id in `vs_voice_profiles` is somebody's cloned voice. Measuring one would mean speaking in a real person's voice without their consent for a benchmark. |

Running the harness now produces exactly this, which is the intended behaviour:

```
STT: 0 measured, 36 unmeasured
  groq ar: UNMEASURED
  groq en: UNMEASURED
  openai ar: UNMEASURED
  openai en: UNMEASURED
TTS:
  openai/tts-1: UNMEASURED — OPENAI_API_KEY is not set
```

## How to take the measurement

```bash
OPENAI_API_KEY=... GROQ_API_KEY=... node scripts/voice/baseline.mts
```

Node 23.6+ runs it directly; on 22.6–23.5 add `--experimental-strip-types`.
Optional: `ELEVENLABS_API_KEY` plus `ELEVENLABS_VOICE_ID` naming a **library**
voice, never a cloned one.

Metrics print to the terminal. Transcripts are written only to a JSON file in
the system temp directory, whose path is printed — so a shared terminal log
cannot leak what was said.

### Supplying real recordings

Drop a file at `scripts/voice/audio/<fixture-id>.<ogg|mp3|wav|m4a|webm>` and the
runner prefers it over synthesis for that fixture. Six fixtures **require** one
and stay `UNMEASURED` without it.

## Methodology

**Audio source.** For fixtures that permit it, audio is synthesised with OpenAI
`tts-1` from the same sentence it is scored against, then transcribed. This
measures an STT provider on clean studio speech: **a floor, not a WhatsApp
estimate.** No room noise, no clipping, no phone codec, no dialect prosody.

**Why Lebanese Arabic is not synthesised.** A TTS voice asked for Lebanese
Arabic produces Modern Standard Arabic with an accent. Scoring a dialect fixture
against that would produce a number that looks like dialect accuracy and is not
one. Every Lebanese and every noisy fixture is therefore marked
`requiresRealAudio` and refuses to be measured synthetically.

**Scoring.** Word error rate and character error rate, each reported twice:

- `raw` — the transcript against the reference as written.
- `normalised` — after folding diacritics, tatweel, alef/yeh/teh-marbuta
  variants, Arabic-Indic digits, case and punctuation.

Both are always reported. `raw` alone makes every Arabic provider look worse
than it is, because «هذه» and «هٰذه» are the same word. `normalised` alone hides
a provider that never writes hamza, which matters when a screen reader is
speaking the result. The implementation is `scripts/voice/metrics.mjs`, and it
is unit-tested against hand-checked distances in `src/test/voice-metrics.test.ts`.

**Also recorded per call:** latency in milliseconds, success or failure, and the
substitution/deletion/insertion split — a provider that substitutes is
mishearing, one that deletes is dropping speech, and those are different faults.

## The corpus — 36 fixtures

Written for this baseline. `scripts/voice/fixtures.json` is authoritative; a
test asserts every id below appears in this document.

### Arabic — Modern Standard (6, synthesisable)

| id | Category | Reference transcript |
| --- | --- | --- |
| `ar-msa-greeting` | conversational | مرحباً، أريد أن أسأل عن حالة طلبي من فضلك. |
| `ar-msa-numbers` | numbers | رقم الطلب سبعة أربعة اثنان تسعة، والمبلغ مئة وخمسة وعشرون دولاراً. |
| `ar-msa-names` | names | اسمي ريم الحاج، وأسكن في بيروت قرب ساحة ساسين. |
| `ar-msa-date` | dates | الموعد يوم الخميس الحادي عشر من أيلول الساعة الثالثة والنصف. |
| `ar-msa-support` | conversational | لم يصلني الطلب حتى الآن، وأريد أن أعرف متى سيصل. |
| `ar-mixed-tech` | code-switching | افتح تطبيق Visionex واضغط على زر WhatsApp، ثم أرسل لي screenshot. |

### Arabic — Lebanese (5, recording required)

| id | Category | Reference transcript |
| --- | --- | --- |
| `ar-leb-greeting` | conversational | كيفك؟ بدي إسأل عن طلبيتي شو صار فيها. |
| `ar-leb-order` | conversational | بعتولي الغرض غلط، بدي إرجّعو وشوف شو الحل. |
| `ar-leb-numbers` | numbers | رقمي واحد سبعة تلاتة تمانية، وبكون بالبيت بعد الساعة خمسة. |
| `ar-leb-mixed` | code-switching | عملت order من الموقع بس ما إجاني confirmation عالإيميل. |
| `ar-noisy-short` | noisy, short | وين صار الطلب؟ |

### English (7, one recording required)

| id | Category | Reference transcript |
| --- | --- | --- |
| `en-conversational` | conversational | Hello, I would like to ask about the status of my order please. |
| `en-numbers` | numbers | My order number is seven four two nine and the total was one hundred and twenty five dollars. |
| `en-names` | names | My name is Reem El Hajj and I live in Beirut near Sassine Square. |
| `en-date` | dates | The appointment is on Thursday the eleventh of September at half past three. |
| `en-technical` | code-switching | Open the Visionex app, tap the WhatsApp button, then send me a screenshot of the error. |
| `en-short` | short | Where is my order? |
| `en-noisy` | noisy, recording required | Can you read this label for me? |


### The other eighteen product languages (18, synthesisable)

One conversational sentence each, and deliberately *the same* sentence —
"I would like to know the status of my order" — so a difference between two
languages is the provider's rather than the sentence's. Arabic and English
keep the deeper coverage above because they are the two this audience uses
most; widening the others is a matter of adding rows to the same file.

| id | Language | Reference transcript |
| --- | --- | --- |
| `fr-conversational` | French | Bonjour, je voudrais connaître l'état de ma commande s'il vous plaît. |
| `es-conversational` | Spanish | Hola, me gustaría saber el estado de mi pedido por favor. |
| `de-conversational` | German | Guten Tag, ich möchte bitte den Status meiner Bestellung erfahren. |
| `pt-conversational` | Portuguese | Olá, gostaria de saber o estado da minha encomenda, por favor. |
| `it-conversational` | Italian | Buongiorno, vorrei sapere lo stato del mio ordine per favore. |
| `nl-conversational` | Dutch | Hallo, ik zou graag de status van mijn bestelling willen weten. |
| `pl-conversational` | Polish | Dzień dobry, chciałbym poznać status mojego zamówienia. |
| `tr-conversational` | Turkish | Merhaba, siparişimin durumunu öğrenmek istiyorum lütfen. |
| `ru-conversational` | Russian | Здравствуйте, я хотел бы узнать статус моего заказа. |
| `hi-conversational` | Hindi | नमस्ते, मैं अपने ऑर्डर की स्थिति जानना चाहता हूँ। |
| `ur-conversational` | Urdu | السلام علیکم، میں اپنے آرڈر کی صورتحال جاننا چاہتا ہوں۔ |
| `bn-conversational` | Bengali | নমস্কার, আমি আমার অর্ডারের অবস্থা জানতে চাই। |
| `fa-conversational` | Persian | سلام، می‌خواهم وضعیت سفارشم را بدانم. |
| `id-conversational` | Indonesian | Halo, saya ingin mengetahui status pesanan saya. |
| `vi-conversational` | Vietnamese | Xin chào, tôi muốn biết tình trạng đơn hàng của mình. |
| `ko-conversational` | Korean | 안녕하세요, 제 주문 상태를 알고 싶습니다. |
| `ja-conversational` | Japanese | こんにちは、注文の状況を知りたいのですが。 |
| `zh-conversational` | Chinese | 您好，我想了解一下我的订单状态。 |

## Targets

### STT

| Provider | Model | Used by | Status |
| --- | --- | --- | --- |
| Groq | `whisper-large-v3-turbo` | WhatsApp, primary | UNMEASURED — no key |
| OpenAI | `whisper-1` | WhatsApp fallback; `speech-transcribe` | UNMEASURED — no key |

### TTS

| Provider | Model | Voice | Used by | Status |
| --- | --- | --- | --- | --- |
| OpenAI | `tts-1` | `alloy` | WhatsApp voice reply | UNMEASURED — no key |
| OpenAI | `gpt-4o-mini-tts` | `nova` | assistant voices, `ai-voice-chat` | UNMEASURED — no key |
| ElevenLabs | `eleven_multilingual_v2` | library voice | Speech Studio | UNMEASURED — no key, and no non-cloned voice id |

## Results

### STT — word error rate (normalised)

| Provider | Arabic MSA | Arabic Lebanese | English |
| --- | --- | --- | --- |
| Groq `whisper-large-v3-turbo` | UNMEASURED | UNMEASURED | UNMEASURED |
| OpenAI `whisper-1` | UNMEASURED | UNMEASURED | UNMEASURED |

### STT — character error rate (normalised)

| Provider | Arabic MSA | Arabic Lebanese | English |
| --- | --- | --- | --- |
| Groq `whisper-large-v3-turbo` | UNMEASURED | UNMEASURED | UNMEASURED |
| OpenAI `whisper-1` | UNMEASURED | UNMEASURED | UNMEASURED |

### STT — latency

| Provider | Median ms | Status |
| --- | --- | --- |
| Groq | — | UNMEASURED |
| OpenAI | — | UNMEASURED |

### TTS — objective measurements

Synthesis success, latency, byte size, returned mime type, container validity by
magic bytes, and whether the result is `audio/ogg` — the only thing the WhatsApp
media path accepts.

| Target | Latency | Bytes | Mime | Valid container | WhatsApp-compatible |
| --- | --- | --- | --- | --- | --- |
| OpenAI `tts-1` / `alloy` / opus | — | — | — | — | UNMEASURED |
| OpenAI `gpt-4o-mini-tts` / `nova` / mp3 | — | — | — | — | UNMEASURED |
| ElevenLabs `eleven_multilingual_v2` / mp3 | — | — | — | — | UNMEASURED |

## TTS intelligibility — HUMAN EVALUATION

There is no reproducible automated intelligibility metric in this repository,
and inventing a subjective score and presenting it as a measurement would be
worse than leaving it blank. This section is for people, and must be labelled as
such wherever its results are quoted.

**Rubric.** Two listeners per sample, independently, without seeing the
reference text first. Score 1–5:

| Score | Meaning |
| --- | --- |
| 5 | Every word understood first time; would not notice it was synthetic. |
| 4 | Every word understood; audibly synthetic. |
| 3 | Understood after one replay, or one word guessed from context. |
| 2 | A word or number was wrong or unintelligible. |
| 1 | Could not follow it. |

**Record separately, because they fail differently:** overall intelligibility ·
number pronunciation · proper-noun pronunciation · Arabic/English switching
within one sentence · consistency across the six Arabic fixtures.

**At least one listener must be a daily screen-reader user.** The audience for
this feature is not the team.

## Known limitations

1. Synthetic audio is a floor, not a WhatsApp estimate.
2. Lebanese Arabic and every noisy case need real recordings; five fixtures are
   blocked on that.
3. 36 fixtures characterise, they do not certify. Sixteen of the twenty languages rest on a single sentence each. A regression suite would need
   an order of magnitude more.
4. Whisper transcribes numbers as digits where the reference spells them in
   words; normalisation folds the digits but not "7429" against "seven four two
   nine". Expect an inflated WER on the number fixtures and read the CER beside
   it.
5. One voice per TTS target is measured. Voices differ.
6. No cost figure appears anywhere in this document. The repository's existing
   cost notes — for example the Phase 17 routing table's "a fraction of OpenAI's
   per-minute price" — are **repository assumptions recorded at the time they
   were written**, not current prices, and were not used here.

## What the numbers will decide

- **Whether a local model is viable at all.** A local candidate has to beat, or
  match, the measured Arabic numbers. Piper is already recorded in the
  self-hosting audit as "good English, weak Arabic"; this baseline is what would
  turn that into a decision.
- **Whether Groq's turbo model is costing accuracy** against OpenAI's
  `whisper-1` on Arabic, which is the fallback the WhatsApp path already carries.
- **Whether dialect is the real gap.** If MSA scores well and Lebanese does not,
  the answer is a dialect-tuned model, not a bigger one — and that is a
  different procurement decision.
- **Whether a GPU is worth a host migration.** Hetzner offers none; a GPU means
  moving. Only a measured quality or cost gap justifies that.

## Reproducing this later

The corpus, the metric and the runner are all in the repository, so the same
numbers can be taken again after a provider change, a model upgrade, or the
arrival of a GPU:

```
scripts/voice/fixtures.json     the corpus and the reference transcripts
scripts/voice/metrics.mjs       WER, CER, normalisation, audio validity
scripts/voice/baseline.mts      the runner
src/test/voice-metrics.test.ts  the tests that keep the instrument honest
scripts/voice/audio/            real recordings, when they exist (not committed)
```

Record the date, the provider, the model and the fixture version with any
result. A number without those four is not a baseline.
