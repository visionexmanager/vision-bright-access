-- Phase 2K-4 — add the 'chat' and 'vision' registry types, and their rows, so
-- chat and vision provider attempts can be recorded.
--
-- Recording only. Nothing selects a 'chat' or 'vision' row: the only registry
-- selection in the codebase is speech-generate's resolveProvider("tts"). The
-- per-assistant provider orders in `_shared/assistants.ts` stay the policy,
-- and the fallback loops in `_shared/aiProvider.ts` try them exactly as before.
--
-- Rows are per provider, not per model: the model each attempt used is written
-- to `ph_logs.request_meta`. Seeded only for the providers the two recorded
-- loops actually reach (audited from every target list that feeds them):
--
--   chat    openai, groq, mistral, gemini — the assistant, generator and
--           course chains. Anthropic is reached only outside the loops
--           (career-ai, news-generate), so it gets no row until those are
--           recorded.
--   vision  openai, gemini — the only providers in any chain that is sent an
--           image (visionAnalysts, whatsappUnderstand).
--
-- Gemini's rows are 'inactive'. Its key is recorded in the code as unfunded
-- (2026-08-11) and no production call has shown otherwise; a row says what is
-- known. Recording still writes to an inactive row, and automation never moves
-- one (Phase 2J-1), so what the attempts show is left for an admin to act on.
-- This changes nothing about where Gemini is or is not in a chain.
--
-- `default_model` is left null: every assistant sends its own model.
-- `priority` and `cost_per_request` stay at their defaults because nothing ranks
-- these rows. `api_key_ref` names the secret `aiProvider.ts` already reads, so
-- provider-hub's probe reports a missing key truthfully; for these slugs the
-- probe makes no network call.

ALTER TABLE public.ph_providers DROP CONSTRAINT IF EXISTS ph_providers_type_check;
ALTER TABLE public.ph_providers ADD CONSTRAINT ph_providers_type_check
  CHECK (type IN ('tts', 'voice_cloning', 'text_to_video', 'stt', 'image', 'chat', 'vision'));

INSERT INTO public.ph_providers
  (name, slug, type, status, api_key_ref, default_model, capabilities, is_system, config)
VALUES
  ('OpenAI Chat',    'openai-chat',   'chat',   'active',   'OPENAI_API_KEY',  NULL, ARRAY[]::text[], true, '{}'),
  ('Groq Chat',      'groq-chat',     'chat',   'active',   'GROQ_API_KEY',    NULL, ARRAY[]::text[], true, '{}'),
  ('Mistral Chat',   'mistral-chat',  'chat',   'active',   'MISTRAL_API_KEY', NULL, ARRAY[]::text[], true, '{}'),
  ('Gemini Chat',    'gemini-chat',   'chat',   'inactive', 'GEMINI_API_KEY',  NULL, ARRAY[]::text[], true, '{}'),
  ('OpenAI Vision',  'openai-vision', 'vision', 'active',   'OPENAI_API_KEY',  NULL, ARRAY[]::text[], true, '{}'),
  ('Gemini Vision',  'gemini-vision', 'vision', 'inactive', 'GEMINI_API_KEY',  NULL, ARRAY[]::text[], true, '{}')
ON CONFLICT (slug) DO NOTHING;
