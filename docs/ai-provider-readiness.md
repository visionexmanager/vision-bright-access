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
| NVIDIA NIM | **blocked — licence** | Key authenticates (`nvapi-`). gemma-4-31b-it, gpt-oss-20b (text, tools, JSON); kimi-k3 (text, tools); llama-3.2-11b-vision (vision); 5 nemotron/glm text models | NVIDIA's FAQ: the build.nvidia.com catalogue is for prototyping and testing only; serving end-users needs NVIDIA AI Enterprise. Of 71 ids tried: 8 are 410 end-of-life (with dates), 46 are 404 not on this account — the listing is not a list of what works. |
| OpenRouter | **blocked — account** | Key authenticates. 12 free models answer text; 2 (ling-3.0-flash) do tool calling | Paid: "Key limit exceeded (total limit)", no credits. Free: 50 requests/day and 20/min account-wide under $10 of purchased credits; some free models 429 upstream; two are "agentic harness only". |
| Bytez | **blocked — account** | Key authenticates (no key and a wrong key are 401) | Every model, including Bytez's own documented example `Qwen/Qwen3-4B`, is "not in the Bytez catalog"; the listing is empty for this account. Our request matches the documented contract. |
| FAL | **blocked — account** | Key authenticates | "User is locked. Reason: Exhausted balance." Nothing was spent. |
| Anthropic | **unverifiable** | — | No key anywhere. |
| RunPod, Luma, ElevenLabs | **unverifiable** | — | No key anywhere. Video generation is therefore unavailable (Luma). RunPod stays inert (#315). |

None of NIM, OpenRouter, Bytez or FAL has a Visionex bug: none had Visionex
code, and each one's blocker is outside the repository. They are registered as
inactive rows carrying that evidence (#352). The workflow's "Diagnose" step
re-tests them. Add the `provider-media-probe` label to a PR to run the paid FAL
media probe once.

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
5. ~~A stream that breaks mid-body counts as a success~~ — fixed in #350: a stream is settled when it ends.

## Viability check (2026-09-26, later run)

Observed with the production keys, no money spent:

- **Bytez:** our key authenticates (no key and a wrong key both get 401), but the model listing returns **0 models** for it, and every model id is "not in the Bytez catalog". That includes Bytez's documented example `Qwen/Qwen3-4B`, a 4B model inside the free plan's "up to 7B". Bytez documents a 402 "Insufficient credits" for an unfunded account; we never received one. The listing endpoint also answers 500 "Expected parameter(s): modelId" for some query forms. **Cause unknown; it is on the account or Bytez side.** No evidence shows that paying would fix it.
- **OpenRouter:** paid models, embeddings and `openrouter/auto` get 403 "Key limit exceeded (total limit)". That is a **per-key limit**, and the account also has no credits. Free models were measured: text on 8 of 17, tools on 2, JSON mode on `gemma-4-26b-a4b-it:free`. Several upstreams return 429, and the account's daily free cap was reached during the run ("free-models-per-day … limit=50 remaining=0").
- **NVIDIA NIM (build.nvidia.com hosted catalogue):** gemma-4-31b-it (text, tools, JSON, ~0.1–0.6 s), gpt-oss-20b (text, tools, JSON, 3–9 s), llama-3.2-11b-vision (vision, tools), llama-3.2-90b-vision (vision, 36 s). Shared workers returned 503 "ResourceExhausted". The licence limits this endpoint to development and testing.
- **FAL:** the key authenticates, and the pricing API answers with the account's prices. Every submission is refused with "User is locked. Exhausted balance", images and video alike.

| FAL endpoint | Price (from FAL's pricing API) |
| --- | --- |
| flux/schnell | $0.003 per megapixel |
| flux/dev | $0.025 per megapixel |
| flux-pro v1.1 | $0.04 per megapixel |
| ltx-video | $0.02 per video |
| wan 2.2 5B | $0.15 per video |
| kling 2.1 std | $0.00017 per compute second |

## Recovery implementation (2026-09-26)

Built and tested, and inert until an admin switches the provider on. The switch is the provider's registry row: status active or degraded, **and** `config.production_eligible = true`. A missing row, an unreadable registry or an inactive row means no traffic.

| Provider | Where | Status |
| --- | --- | --- |
| FAL image | #353: `_shared/providers/fal.ts`, `image-generate` fallback, FLUX.1 [schnell] ("Commercial use") | blocked by account balance |
| FAL video | #354: `FalVideoProvider` in `video-studio`, Wan 2.2 5B ("Commercial use"); LTX-Video refused as "Research only" | blocked by account balance, and no video VX price |
| OpenRouter | #355: OpenAI-compatible, activation-gated. Its model and capabilities come from the row (`default_model`, `config.verified_models`); `OPENROUTER_API_KEY` is synced | blocked by the key limit and no credits |
| Bytez | none: no model has been reachable | account catalogue is empty |
| NVIDIA NIM | none: no production path without NVIDIA AI Enterprise | licence |

In #355, inactive and error rows are **excluded** from the chat chains, not demoted.
