-- The provider model catalog: which OpenAI models this project's key can see,
-- what Visionex knows about each, and whether policy lets it be routed.
--
-- ── Why a table, and why this shape ─────────────────────────────────────────
--
-- ph_providers holds one row per provider *and capability* ('openai-chat',
-- 'openai-vision', 'openai-tts' …) with a single default_model. It has no place
-- for "the models OpenAI offers us", so models were only ever named in code.
-- This table adds that, beside ph_providers rather than instead of it: nothing
-- here changes a provider row, a default, a priority or a route.
--
-- Three questions, kept apart on purpose:
--   * available        — did the authenticated GET /v1/models list it last run?
--                        Written only by discovery (openaiModelDiscovery.ts).
--   * capabilities,    — what Visionex has verified it can do, and what it
--     pricing            costs. Curated. Discovery never overwrites either.
--   * routing_enabled  — Visionex policy. Curated, false by default.
--
-- A model is routing-eligible only when all four hold: available, at least one
-- capability, known pricing, routing_enabled. Anything missing fails closed.
-- A model that vanishes from /v1/models is marked unavailable, never deleted —
-- ph_logs rows name models, and history is not rewritten.
--
-- RLS on, no policy: service-only. Admins see it through provider-hub, which
-- checks has_role(...,'admin'); prices and model lists never reach a user.

CREATE TABLE IF NOT EXISTS public.ph_provider_models (
  provider            text        NOT NULL CHECK (provider IN ('openai')),
  -- Exactly as OpenAI returns it. Never renamed, never lower-cased by us.
  model_id            text        NOT NULL CHECK (model_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'),
  display_name        text,
  owned_by            text,
  upstream_created_at timestamptz,
  first_seen_at       timestamptz,
  last_seen_at        timestamptz,
  available           boolean     NOT NULL DEFAULT false,
  unavailable_since   timestamptz,
  -- The existing ph_providers type taxonomy, plus 'embedding'.
  capabilities        text[]      NOT NULL DEFAULT '{}'
                        CHECK (capabilities <@ ARRAY['chat','vision','tts','stt','image','text_to_video','voice_cloning','embedding']::text[]),
  capability_source   text        NOT NULL DEFAULT 'unknown'
                        CHECK (capability_source IN ('curated', 'classified', 'unknown')),
  -- NULL means unknown, and unknown is never routable. When set it must carry
  -- a unit and strictly positive prices: there is no zero-price fallback.
  pricing             jsonb
                        CHECK (pricing IS NULL OR (
                          jsonb_typeof(pricing) = 'object'
                          AND pricing ->> 'unit' IN ('usd_per_1m_tokens')
                          AND (pricing ->> 'input')::numeric > 0
                          AND (NOT (pricing ? 'output') OR (pricing ->> 'output')::numeric > 0)
                          AND (NOT (pricing ? 'cached_input') OR (pricing ->> 'cached_input')::numeric > 0)
                        )),
  pricing_source      text,
  pricing_verified_on date,
  routing_enabled     boolean     NOT NULL DEFAULT false,
  notes               text,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, model_id)
);

ALTER TABLE public.ph_provider_models ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ph_provider_models FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ph_provider_models TO service_role;

COMMENT ON TABLE public.ph_provider_models IS
  'Provider model catalog. available is written by discovery; capabilities, pricing and routing_enabled are curated. Service-only; RLS on with no policy by design.';

-- ── Curated entries ─────────────────────────────────────────────────────────
--
-- available = false until discovery has seen the model on this key: being
-- curated is not the same as being accessible. ON CONFLICT DO NOTHING, so a
-- re-run never overwrites what an admin or discovery has since written.
--
-- Prices are OpenAI Standard tier, USD per 1M tokens, from
-- developers.openai.com/api/docs/pricing and the model pages (read 2026-09-25).
--
-- gpt-5.6-luna: the model page lists output at $1.20. One reading of the
-- pricing table showed a $0.75 column beside it, but its long-context output
-- ($1.80) is exactly the documented 1.5x of $1.20, so $1.20 is recorded. Check
-- it again against the pricing page before the first bill is reconciled.

INSERT INTO public.ph_provider_models
  (provider, model_id, display_name, capabilities, capability_source, pricing, pricing_source, pricing_verified_on, routing_enabled, notes)
VALUES
  ('openai', 'gpt-5.6-luna', 'GPT-5.6 Luna', ARRAY['chat','vision'], 'curated',
   jsonb_build_object('unit', 'usd_per_1m_tokens', 'input', 0.20, 'cached_input', 0.02, 'output', 1.20,
                      'long_context', jsonb_build_object('above_input_tokens', 272000, 'input_multiplier', 2, 'output_multiplier', 1.5)),
   'https://developers.openai.com/api/docs/models/gpt-5.6-luna', DATE '2026-09-25', true,
   'Reasoning model; the adapter sends max_completion_tokens and reasoning_effort none. Text and image in, text out. No audio, no image or video generation.'),
  ('openai', 'gpt-4.1', 'GPT-4.1', ARRAY['chat','vision'], 'curated',
   jsonb_build_object('unit', 'usd_per_1m_tokens', 'input', 2.00, 'cached_input', 0.50, 'output', 8.00),
   'https://developers.openai.com/api/docs/pricing', DATE '2026-09-25', false,
   'Named in code target lists (ai-chat, ai-voice-chat); routed there, not from this row.'),
  ('openai', 'gpt-4o', 'GPT-4o', ARRAY['chat','vision'], 'curated',
   jsonb_build_object('unit', 'usd_per_1m_tokens', 'input', 2.50, 'cached_input', 1.25, 'output', 10.00),
   'https://developers.openai.com/api/docs/pricing', DATE '2026-09-25', false,
   'Named in code (academy-chat, radar-ai, ocr-scan, analyze-meal …).'),
  ('openai', 'gpt-4o-mini', 'GPT-4o mini', ARRAY['chat','vision'], 'curated',
   jsonb_build_object('unit', 'usd_per_1m_tokens', 'input', 0.15, 'cached_input', 0.075, 'output', 0.60),
   'https://developers.openai.com/api/docs/pricing', DATE '2026-09-25', false,
   'Named in code across library, kids, document and WhatsApp paths.'),
  ('openai', 'text-embedding-3-small', 'text-embedding-3-small', ARRAY['embedding'], 'curated',
   jsonb_build_object('unit', 'usd_per_1m_tokens', 'input', 0.02),
   'https://developers.openai.com/api/docs/pricing', DATE '2026-09-25', false,
   'EMBEDDING_MODEL in aiProvider.ts; vector dimensions are pinned to it.'),
  -- Media models in use: capabilities curated, pricing not token-priced and not
  -- yet recorded, so none of these is routing-eligible from the catalog.
  ('openai', 'gpt-4o-mini-tts', 'GPT-4o mini TTS', ARRAY['tts'], 'curated', NULL, NULL, NULL, false, 'Generation-verified 2026-09-19.'),
  ('openai', 'tts-1', 'TTS-1', ARRAY['tts'], 'curated', NULL, NULL, NULL, false, NULL),
  ('openai', 'whisper-1', 'Whisper', ARRAY['stt'], 'curated', NULL, NULL, NULL, false, NULL),
  ('openai', 'gpt-4o-transcribe', 'GPT-4o Transcribe', ARRAY['stt'], 'curated', NULL, NULL, NULL, false, NULL),
  ('openai', 'gpt-image-1', 'GPT Image 1', ARRAY['image'], 'curated', NULL, NULL, NULL, false, 'Generation-verified 2026-09-19.'),
  ('openai', 'gpt-image-1-mini', 'GPT Image 1 mini', ARRAY['image'], 'curated', NULL, NULL, NULL, false, NULL)
ON CONFLICT (provider, model_id) DO NOTHING;

-- ── Reading it ─────────────────────────────────────────────────────────────
--
-- The one definition of "routing-eligible", so no caller re-derives it.
-- security_invoker: it reads the table with the caller's rights, which for any
-- browser role are none.
CREATE OR REPLACE VIEW public.ph_provider_models_routable
WITH (security_invoker = true) AS
SELECT provider, model_id, capabilities
  FROM public.ph_provider_models
 WHERE available
   AND routing_enabled
   AND pricing IS NOT NULL
   AND cardinality(capabilities) > 0;

REVOKE ALL ON public.ph_provider_models_routable FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ph_provider_models_routable TO service_role;
