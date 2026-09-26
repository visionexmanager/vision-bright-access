# AI provider readiness — audit of 2026-09-26

Measured, not inferred. Every PASS below is a real generation made by
`.github/workflows/provider-smoke.yml` with the production provider secrets,
and every key it used was confirmed to be the **same value** the Supabase Edge
Function runtime holds (SHA-256 compared inside the job). Re-run the workflow
to refresh any line; nothing here should be trusted past the next key or plan
change.

## Keys

| Secret | GitHub | Supabase runtime | Used by code |
| --- | --- | --- | --- |
| OPENAI_API_KEY | yes | yes, same | everywhere |
| GEMINI_API_KEY | yes | yes, same | chat/vision chains, analyze-image, WhatsApp |
| GROQ_API_KEY | yes | yes, same | chat chains, Whisper STT |
| MISTRAL_API_KEY | yes | yes, same | chat chains, Voxtral voice |
| FAL_KEY | yes | yes, same | — |
| NVIDIA_NIM_API_KEY | yes | **no** | nothing |
| OPENROUTER_API_KEY | yes | **no** | nothing |
| BYTEZ_API_KEY | yes | **no** | nothing |
| ANTHROPIC_API_KEY | no | no | news-generate (optional fallback), career-ai matrix |
| RUNPOD_API_KEY, LUMA_API_KEY, ELEVENLABS_API_KEY, REPLICATE_API_TOKEN | no | no | video (Luma), RunPod (inert), ElevenLabs (Voxtral replaces) |

## Providers and models

| Provider | Verdict | Verified | Refused / broken |
| --- | --- | --- | --- |
| OpenAI | **production** | gpt-4o-mini, gpt-4o, gpt-4.1, gpt-5.6-luna (text); tools on 4o-mini/4.1; vision on 4o-mini/4o; text-embedding-3-small (1536); omni-moderation-latest; gpt-4o-mini-tts; gpt-4o-mini-transcribe, whisper-1 | — |
| Groq | **production** | openai/gpt-oss-20b, gpt-oss-120b (text, tools); whisper-large-v3-turbo | llama-3.1-8b-instant, llama-3.3-70b-versatile: no longer served. No vision model. gpt-oss at max_tokens 200 and default effort returns **empty text** (reasoning eats the budget); fine at effort "low". TPM 8,000 per model. |
| Gemini | **production** (was unfunded until at least 2026-08-20) | gemini-flash-latest, gemini-flash-lite-latest: text, vision, JSON-schema output | No rate-limit headers returned, so the tier's ceilings are not observable from here — treat as limited. |
| Mistral | **partial** | ministral-8b-latest, ministral-14b-latest, open-mistral-nemo (text, tools); ministral-14b, pixtral-12b (vision); mistral-embed; voxtral-mini-latest (STT) | mistral-small-latest, mistral-small-2506, mistral-medium-latest: **429 on every call** (code 1300); mistral-large-latest: 403 (code 1910); mistral-ocr-latest / -2512: 429. A plan restriction, not a burst — it held across four runs with 1.5 s pacing. |
| NVIDIA NIM | **not eligible** | meta/llama-3.2-11b-vision-instruct (vision); openai/gpt-oss-20b (text, 4.7 s) | Most catalogue ids answer **410 Gone**, including ids the listing returns; mistral-nemotron timed out at 45 s; every embedding id 404/410. Not in the runtime. |
| OpenRouter | **not eligible** | key authenticates; free-tier key with a hard limit | Paid models 403; free models 429. Not in the runtime. |
| Bytez | **not eligible** | — | Model listing 500; every chat id 404 on both the OpenAI-compatible and native endpoints. Not in the runtime. |
| Anthropic | **unverifiable** | — | No key anywhere. |
| RunPod, Luma, ElevenLabs | **unverifiable** | — | No key anywhere. Video generation is therefore unavailable (Luma). RunPod stays inert (#315). |

NIM, OpenRouter and Bytez are deliberately **not integrated**: none of them
passed a production-shaped test, and none adds a capability the verified four
lack. Revisit with a funded key and a re-run of the workflow.

## What routes where (after #350)

- **Chat/structured chains** (`assistants.ts`, `generators.ts`, ai-chat, ai-voice-chat, kids-course-generate, whatsapp): OpenAI gpt-4.1/gpt-4o-mini, Gemini flash, Groq gpt-oss-20b/120b, Mistral ministral-14b, in each chain's quality order, reordered by health: a per-isolate cooldown after a repeatable failure and the `ph_providers` rows (inactive/error, degraded or health ≤ 20 go to the back; 10 % recovery share). Nothing is dropped.
- **Vision** (`visionAnalysts.ts`, WhatsApp images): Gemini flash, OpenAI gpt-4o / gpt-4o-mini.
- **Embeddings**: OpenAI text-embedding-3-small only — the stored vectors are 1536-d, so no fallback of another dimension is possible.
- **STT**: OpenAI Whisper/4o-transcribe and Groq Whisper, recorded. **TTS**: OpenAI gpt-4o-mini-tts; Mistral Voxtral for cloned voices.
- **Image generation**: OpenAI gpt-image-1 (recorded against `openai-image`).
- **Single-provider OpenAI services** (library-*, kids-*, academy-chat, analyze-meal, generate-diet-plan, radar-ai, ocr-scan, document-generate, text-tools-generate, organization-ai-admin, analytics-insights, enrich-product, news-generate): authenticated, per-user daily limit (`check_ai_rate_limit`), no fallback and no registry recording. They work while OpenAI works.

## Open items

1. Mistral plan: `mistral-small/medium/large` and OCR are refused. Chains use ministral-14b; restoring small/large is one line each once the plan allows it.
2. Single-provider OpenAI services have no fallback. Moving them to `structuredCompletionWithFallback` needs a per-service check of output quality on the fallback models — not a mechanical change.
3. WhatsApp PDF and video reading are switched off because Gemini was unfunded (`DOCUMENT_TARGETS` / `VIDEO_TARGETS` in `whatsappUnderstand.ts`). Gemini now generates; re-enabling needs the owner to confirm the Gemini tier's limits.
4. Video generation needs `LUMA_API_KEY`.
5. A stream that starts and then breaks mid-body counts as a success for recording and cooldowns (pre-existing).
