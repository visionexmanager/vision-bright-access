-- OpenAI model catalog curation, from a full audit of the key (2026-09-28).
--
-- openai-inventory.yml listed every model on OPENAI_API_KEY (132) and sent each
-- one a real request on its own endpoint. This curates the ones Visionex can
-- use through an adapter it already has, at OpenAI's published standard price
-- (https://developers.openai.com/api/docs/pricing, read 2026-09-28), and
-- records the shutdown date of every model the code still calls that OpenAI
-- has deprecated (https://developers.openai.com/api/docs/deprecations).
--
-- What this does NOT do: route anything. routing_enabled stays false on every
-- new row, and gpt-5.6-luna's stays as it was; which chain calls which model is
-- decided in code (aiProvider.ts and the chains), and no chain changes here.
-- No ph_providers row, plan, VX price or entitlement is touched. Discovery's
-- columns (available, last_seen_at …) are left to discovery.
--
-- Pricing units. Transcription and TTS-1 are sold per minute and per character,
-- not per token, and moderation is free; the CHECK learns those three units so
-- they can be written down instead of left NULL. Every other rule of the old
-- CHECK is kept: a price is positive, or it is not there. The old CHECK also
-- let a price with no "input" or no "unit" through — a NULL comparison passes
-- a CHECK — so the whole condition is now COALESCEd to false.

ALTER TABLE public.ph_provider_models
  ADD COLUMN IF NOT EXISTS shutdown_on date,
  ADD COLUMN IF NOT EXISTS replacement_model_id text;

COMMENT ON COLUMN public.ph_provider_models.shutdown_on IS
  'OpenAI''s announced shutdown date for this model id (deprecations page). NULL: none announced.';

ALTER TABLE public.ph_provider_models DROP CONSTRAINT IF EXISTS ph_provider_models_capabilities_check;
ALTER TABLE public.ph_provider_models ADD CONSTRAINT ph_provider_models_capabilities_check
  CHECK (capabilities <@ ARRAY['chat','vision','tts','stt','image','text_to_video','voice_cloning','embedding','moderation','realtime']::text[]);

ALTER TABLE public.ph_provider_models DROP CONSTRAINT IF EXISTS ph_provider_models_pricing_check;
ALTER TABLE public.ph_provider_models ADD CONSTRAINT ph_provider_models_pricing_check
  CHECK (pricing IS NULL OR COALESCE(
    jsonb_typeof(pricing) = 'object'
    AND pricing ->> 'unit' IN ('usd_per_1m_tokens', 'usd_per_minute', 'usd_per_1m_characters', 'free')
    AND (pricing ->> 'unit' = 'free' OR (pricing ->> 'input')::numeric > 0)
    AND (NOT (pricing ? 'output') OR (pricing ->> 'output')::numeric > 0)
    AND (NOT (pricing ? 'cached_input') OR (pricing ->> 'cached_input')::numeric > 0),
    false));

-- New rows. A model already in the catalog (seeded, or inserted by a discovery
-- run) gets its curated columns set by the UPDATE below instead.
INSERT INTO public.ph_provider_models (provider, model_id, routing_enabled)
SELECT 'openai', m, false
  FROM unnest(ARRAY[
    'gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra',
    'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.2', 'gpt-5.1',
    'gpt-4.1-mini', 'gpt-4.1-nano',
    'text-embedding-3-large', 'omni-moderation-latest',
    'tts-1-hd', 'gpt-transcribe', 'gpt-4o-mini-transcribe',
    'gpt-image-2', 'gpt-image-2.5-sunburst', 'gpt-image-2.5-flare',
    'gpt-realtime-2', 'gpt-realtime-2.1', 'gpt-realtime-2.1-mini', 'gpt-live-1'
  ]) AS m
ON CONFLICT (provider, model_id) DO NOTHING;

-- Curated columns only. routing_enabled is not in this list: it keeps its value.
UPDATE public.ph_provider_models AS t
   SET display_name        = c.display_name,
       capabilities        = c.capabilities,
       capability_source   = 'curated',
       pricing             = c.pricing,
       pricing_source      = CASE WHEN c.pricing IS NULL THEN NULL ELSE c.pricing_source END,
       pricing_verified_on = CASE WHEN c.pricing IS NULL THEN NULL ELSE DATE '2026-09-28' END,
       shutdown_on         = c.shutdown_on,
       replacement_model_id = c.replacement,
       notes               = c.notes,
       updated_at          = now()
  FROM (VALUES
    -- Text, through the existing Chat Completions adapter. Tools and vision
    -- are granted only where the audit saw them work.
    ('gpt-6-astra', 'GPT-6 Astra', ARRAY['chat','vision'],
     '{"unit":"usd_per_1m_tokens","input":10.00,"cached_input":1.00,"output":50.00}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL::date, NULL,
     'Reasoning; the adapter sends effort low (none is refused). OpenAI refuses function tools with any reasoning effort for this model on /v1/chat/completions (400, param reasoning_effort) and it cannot run at none, so it can never call a tool through the Chat Completions adapter. Tools work on /v1/responses; json_schema response_format works on Chat Completions. Not for structured chains until one of those is used.'),
    ('gpt-6-sol', 'GPT-6 Sol', ARRAY['chat','vision'],
     '{"unit":"usd_per_1m_tokens","input":2.00,"cached_input":0.20,"output":10.00}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Reasoning, effort none. Text, tools and vision passed the audit.'),
    ('gpt-6-luna', 'GPT-6 Luna', ARRAY['chat'],
     '{"unit":"usd_per_1m_tokens","input":0.10,"cached_input":0.01,"output":0.50}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Reasoning, effort none. Text and tools passed. Vision is not granted pending a decision: the audit miss was the test (a "HELLO 42" image asked for digits only); on an unambiguous image it read 5/5 and transcribed 5/5.'),
    ('gpt-5.6-sol', 'GPT-5.6 Sol', ARRAY['chat','vision'],
     '{"unit":"usd_per_1m_tokens","input":4.00,"cached_input":0.40,"output":20.00}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Reasoning, effort none. Text, tools and vision passed the audit.'),
    ('gpt-5.6-terra', 'GPT-5.6 Terra', ARRAY['chat','vision'],
     '{"unit":"usd_per_1m_tokens","input":2.00,"cached_input":0.20,"output":12.00}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Reasoning, effort none. Text, tools and vision passed the audit.'),
    ('gpt-5.6-luna', 'GPT-5.6 Luna', ARRAY['chat','vision'],
     '{"unit":"usd_per_1m_tokens","input":0.20,"cached_input":0.02,"output":1.20,"long_context":{"above_input_tokens":272000,"input_multiplier":2,"output_multiplier":1.5}}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Reasoning, effort none. Routed straight after gpt-4.1 in the assistant, ai-chat and ai-voice-chat chains. Price re-read 2026-09-28: $1.20 output is the standard column.'),
    ('gpt-5.5', 'GPT-5.5', ARRAY['chat','vision'],
     '{"unit":"usd_per_1m_tokens","input":5.00,"cached_input":0.50,"output":30.00}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Reasoning, effort none. Price is the under-272K-token column. Text, tools and vision passed.'),
    ('gpt-5.4', 'GPT-5.4', ARRAY['chat','vision'],
     '{"unit":"usd_per_1m_tokens","input":2.50,"cached_input":0.25,"output":15.00}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Reasoning, effort none. Price is the under-272K-token column. Text, tools and vision passed.'),
    ('gpt-5.4-mini', 'GPT-5.4 mini', ARRAY['chat','vision'],
     '{"unit":"usd_per_1m_tokens","input":0.75,"cached_input":0.075,"output":4.50}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Reasoning, effort none. Text, tools and vision passed.'),
    ('gpt-5.4-nano', 'GPT-5.4 nano', ARRAY['chat','vision'],
     '{"unit":"usd_per_1m_tokens","input":0.20,"cached_input":0.02,"output":1.25}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Reasoning, effort none. Text, tools and vision passed.'),
    ('gpt-5.2', 'GPT-5.2', ARRAY['chat'],
     '{"unit":"usd_per_1m_tokens","input":1.75,"cached_input":0.175,"output":14.00}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Reasoning, effort none. Text passed; tools and vision were not tested.'),
    ('gpt-5.1', 'GPT-5.1', ARRAY['chat'],
     '{"unit":"usd_per_1m_tokens","input":1.25,"cached_input":0.125,"output":10.00}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Reasoning, effort none. Text passed; tools and vision were not tested.'),
    ('gpt-4.1', 'GPT-4.1', ARRAY['chat','vision'],
     '{"unit":"usd_per_1m_tokens","input":2.00,"cached_input":0.50,"output":8.00}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Leads the assistant, ai-chat and ai-voice-chat chains (routed in code, not from this row).'),
    ('gpt-4.1-mini', 'GPT-4.1 mini', ARRAY['chat','vision'],
     '{"unit":"usd_per_1m_tokens","input":0.40,"cached_input":0.10,"output":1.60}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Non-reasoning. Text, tools and vision passed.'),
    ('gpt-4.1-nano', 'GPT-4.1 nano', ARRAY['chat'],
     '{"unit":"usd_per_1m_tokens","input":0.10,"cached_input":0.025,"output":0.40}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Non-reasoning. Text passed; tools and vision were not tested.'),
    ('gpt-4o', 'GPT-4o', ARRAY['chat','vision'],
     '{"unit":"usd_per_1m_tokens","input":2.50,"cached_input":1.25,"output":10.00}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Named in code (vision analysts, generators, academy-chat, radar-ai, ocr-scan …).'),
    ('gpt-4o-mini', 'GPT-4o mini', ARRAY['chat','vision'],
     '{"unit":"usd_per_1m_tokens","input":0.15,"cached_input":0.075,"output":0.60}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'The most-called model in code: library, kids, documents, WhatsApp.'),

    -- Embeddings and moderation.
    ('text-embedding-3-small', 'text-embedding-3-small', ARRAY['embedding'],
     '{"unit":"usd_per_1m_tokens","input":0.02}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'EMBEDDING_MODEL in aiProvider.ts; stored vectors are 1536-d, so no other model can replace it without re-embedding.'),
    ('text-embedding-3-large', 'text-embedding-3-large', ARRAY['embedding'],
     '{"unit":"usd_per_1m_tokens","input":0.13}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     '3072-d. Not a drop-in for -small: every stored vector is 1536-d.'),
    ('omni-moderation-latest', 'Omni moderation', ARRAY['moderation'],
     '{"unit":"free"}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'moderate-content; free, deliberately unlimited (guards children''s chat).'),

    -- Speech.
    ('gpt-4o-mini-tts', 'GPT-4o mini TTS', ARRAY['tts'],
     '{"unit":"usd_per_1m_tokens","input":0.60,"output":12.00}'::jsonb,
     'https://developers.openai.com/api/docs/models/gpt-4o-mini-tts', NULL, NULL,
     'Text tokens in, audio tokens out. The voice path for web and WhatsApp.'),
    ('tts-1', 'TTS-1', ARRAY['tts'],
     '{"unit":"usd_per_1m_characters","input":15.00}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL, NULL),
    ('tts-1-hd', 'TTS-1 HD', ARRAY['tts'],
     '{"unit":"usd_per_1m_characters","input":30.00}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL, NULL),
    ('gpt-transcribe', 'GPT Transcribe', ARRAY['stt'],
     '{"unit":"usd_per_minute","input":0.0045}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'OpenAI''s named replacement for whisper-1 and the gpt-4o transcribe models. Passed the audit; not yet called from code.'),
    ('whisper-1', 'Whisper', ARRAY['stt'],
     '{"unit":"usd_per_minute","input":0.006}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', DATE '2027-02-26', 'gpt-transcribe',
     'Deprecated. Still called from code.'),
    ('gpt-4o-transcribe', 'GPT-4o Transcribe', ARRAY['stt'],
     '{"unit":"usd_per_1m_tokens","input":2.50,"output":10.00}'::jsonb,
     'https://developers.openai.com/api/docs/models/gpt-4o-transcribe', DATE '2027-02-26', 'gpt-transcribe',
     'Deprecated. Used by realtime-session for input transcription.'),
    ('gpt-4o-mini-transcribe', 'GPT-4o mini Transcribe', ARRAY['stt'],
     '{"unit":"usd_per_1m_tokens","input":1.25,"output":5.00}'::jsonb,
     'https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe', DATE '2027-02-26', 'gpt-transcribe',
     'Deprecated.'),

    -- Images: prices are per image token; text-prompt tokens are billed as well.
    ('gpt-image-2', 'GPT Image 2', ARRAY['image'],
     '{"unit":"usd_per_1m_tokens","input":8.00,"cached_input":2.00,"output":30.00}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Image tokens. OpenAI''s named replacement for gpt-image-1-mini. Generated in the audit.'),
    ('gpt-image-2.5-sunburst', 'GPT Image 2.5 Sunburst', ARRAY['image'],
     '{"unit":"usd_per_1m_tokens","input":8.00,"cached_input":2.00,"output":30.00}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Image tokens. OpenAI''s most capable image model. Generated in the audit.'),
    ('gpt-image-2.5-flare', 'GPT Image 2.5 Flare', ARRAY['image'],
     NULL, NULL, NULL, NULL,
     'Generated in the audit. Unpriced: the pricing page shows its text-input rate only, no image-output rate.'),
    ('gpt-image-1', 'GPT Image 1', ARRAY['image'],
     '{"unit":"usd_per_1m_tokens","text_input":5.00,"input":10.00,"cached_input":2.50,"output":40.00}'::jsonb,
     'https://developers.openai.com/api/docs/models/gpt-image-1', NULL, NULL,
     'Image tokens (text prompt 5.00). image-generate uses it; base64 only.'),
    ('gpt-image-1-mini', 'GPT Image 1 mini', ARRAY['image'],
     '{"unit":"usd_per_1m_tokens","input":2.50,"cached_input":0.25,"output":8.00}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', DATE '2026-12-01', 'gpt-image-2',
     'Deprecated. Still called from code.'),

    -- Realtime: a session is minted by realtime-session; audio prices in "audio".
    ('gpt-realtime-2', 'GPT Realtime 2', ARRAY['realtime'],
     '{"unit":"usd_per_1m_tokens","input":4.00,"cached_input":0.40,"output":24.00,"audio":{"input":32.00,"cached_input":0.40,"output":64.00}}'::jsonb,
     'https://developers.openai.com/api/docs/models/gpt-realtime-2', NULL, NULL,
     'realtime-session''s model.'),
    ('gpt-realtime-2.1', 'GPT Realtime 2.1', ARRAY['realtime'],
     '{"unit":"usd_per_1m_tokens","input":4.00,"cached_input":0.40,"output":24.00,"audio":{"input":32.00,"cached_input":0.40,"output":64.00}}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'Same price as gpt-realtime-2. A session was minted in the audit.'),
    ('gpt-realtime-2.1-mini', 'GPT Realtime 2.1 mini', ARRAY['realtime'],
     '{"unit":"usd_per_1m_tokens","input":0.60,"cached_input":0.06,"output":2.40,"audio":{"input":10.00,"cached_input":0.30,"output":20.00}}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'A session was minted in the audit.'),
    ('gpt-live-1', 'GPT Live 1', ARRAY['realtime'],
     '{"unit":"usd_per_minute","input":0.05}'::jsonb,
     'https://developers.openai.com/api/docs/pricing', NULL, NULL,
     'A session was minted in the audit.')
  ) AS c(model_id, display_name, capabilities, pricing, pricing_source, shutdown_on, replacement, notes)
 WHERE t.provider = 'openai' AND t.model_id = c.model_id;
