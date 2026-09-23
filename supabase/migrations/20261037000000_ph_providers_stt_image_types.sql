-- Phase 2C — widen ph_providers.type to add 'stt' and 'image'.
--
-- Additive and inert on its own. No caller reads a 'stt' or 'image' row yet —
-- resolveProvider("stt") / resolveProvider("image") do not exist anywhere in
-- the codebase today. Wiring speech-transcribe and the image-generating
-- functions onto this registry is Phase 2D, a separate, later change to those
-- call sites. This migration only makes the rows possible to seed and select.
--
-- Two capabilities seeded, both genuinely live in production already — just
-- through their own hardcoded call sites (_shared/voice/stt.ts,
-- _shared/contentMedia.ts / image-generate), not through this table:
--
--   stt    groq-stt (whisper-large-v3-turbo), openai-stt (whisper-1) —
--          the exact fallback order _shared/voice/stt.ts already uses.
--   image  openai-image (gpt-image-1) — the model contentMedia.ts already
--          calls first, before falling back to gpt-image-1-mini. That
--          fallback is a same-vendor MODEL fallback (see
--          .claude/references/provider-routing-architecture.md §D) — a
--          second model on one provider, not a second provider row.
--
-- Replicate (image-tools-generate) is deliberately NOT seeded here. It is not
-- a single text-to-image model the way gpt-image-1 is: it serves five
-- different Replicate models (stability-ai/sdxl, real-esrgan, background
-- remover, gfpgan, and sdxl again for avatars) selected by an operation mode
-- (img2img / upscale / bg-remove / restore / avatar), so there is no one
-- `default_model` to put on a single row without misrepresenting it as a
-- plain image generator. Modeling those five operations correctly is a
-- capability-vocabulary question the architecture document explicitly defers
-- (§B: "which should remain implementation-specific") — not something to
-- guess at inside a migration.
--
-- cost_per_request is left at the column default (0) for all three rows
-- rather than an invented figure: nothing currently reads it for these two
-- types (no caller scores 'stt' or 'image' rows yet), and a fabricated
-- number sitting unused in a cost-scoring column is worse than an honest
-- unset one. Real pricing belongs in whichever phase first wires a caller to
-- resolveProvider() for these types.

ALTER TABLE ph_providers DROP CONSTRAINT ph_providers_type_check;
ALTER TABLE ph_providers ADD CONSTRAINT ph_providers_type_check
  CHECK (type IN ('tts', 'voice_cloning', 'text_to_video', 'stt', 'image'));

INSERT INTO ph_providers
  (name, slug, type, status, priority, api_key_ref, default_model, capabilities, is_system, config)
VALUES
  -- STT — priority matches _shared/voice/stt.ts's existing Groq-first,
  -- OpenAI-fallback order exactly, so a future caller reading this table
  -- reproduces the chain that is already live rather than a new one.
  ('Groq Whisper',   'groq-stt',   'stt', 'active', 10, 'GROQ_API_KEY',   'whisper-large-v3-turbo', ARRAY[]::text[], true, '{}'),
  ('OpenAI Whisper', 'openai-stt', 'stt', 'active', 20, 'OPENAI_API_KEY', 'whisper-1',              ARRAY[]::text[], true, '{}'),
  -- Image — the one model contentMedia.ts and image-generate call first.
  ('OpenAI Images',  'openai-image', 'image', 'active', 10, 'OPENAI_API_KEY', 'gpt-image-1', ARRAY[]::text[], true, '{}')
ON CONFLICT (slug) DO NOTHING;
