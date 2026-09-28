-- Shadow usage metering, part 3: the provider calls outside aiProvider.ts —
-- images, speech, transcription, moderation, and the functions that call
-- OpenAI directly (meteredFetch.ts). Still nothing is charged.
--
-- 1. A plain, non-streamed chat completion is its own operation, "chat".
-- 2. gpt-image prices text and image input apart: the rates validator learns
--    image_input and cached_image_input (non-negative numbers, like the rest).
-- 3. Prices, verified 2026-09-28 against OpenAI's own model and pricing pages.
--    gpt-4o-mini-tts is billed per audio output token, which /audio/speech does
--    not return; its row is entered so that a call reporting tokens is priced,
--    and until then its events stay "unpriced" rather than guessed.

ALTER TABLE public.ai_usage_events DROP CONSTRAINT IF EXISTS ai_usage_events_operation_check;
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_operation_check CHECK (operation IN (
  'chat', 'structured', 'stream', 'embedding', 'image', 'tts', 'stt', 'realtime', 'moderation'));

CREATE OR REPLACE FUNCTION public.ai_price_rates_valid(_unit text, _rates jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_typeof(_rates) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_each(_rates) e
       WHERE e.key IN ('input', 'cached_input', 'output', 'price', 'image_input', 'cached_image_input')
         AND (jsonb_typeof(e.value) <> 'number' OR (e.value)::text::numeric < 0))
    AND CASE _unit
          WHEN 'free' THEN true
          WHEN 'usd_per_1m_tokens' THEN _rates ? 'input'
          ELSE _rates ? 'price'
        END,
    false);
$$;

REVOKE ALL ON FUNCTION public.ai_price_rates_valid(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_price_rates_valid(text, jsonb) TO service_role;

INSERT INTO public.ai_price_book (provider, model_id, unit, rates, effective_from, source, verified_on, notes)
SELECT v.provider, v.model_id, v.unit, v.rates::jsonb, timestamptz '2026-09-28 00:00:00+00', v.source, DATE '2026-09-28', v.notes
  FROM (VALUES
    ('openai', 'gpt-image-1', 'usd_per_1m_tokens',
     '{"input":5.00,"cached_input":1.25,"image_input":10.00,"cached_image_input":2.50,"output":40.00}',
     'https://developers.openai.com/api/docs/models/gpt-image-1', 'input = text tokens; output = image tokens.'),
    ('openai', 'gpt-image-1-mini', 'usd_per_1m_tokens',
     '{"input":2.00,"cached_input":0.20,"image_input":2.50,"cached_image_input":0.25,"output":8.00}',
     'https://developers.openai.com/api/docs/models/gpt-image-1-mini', 'Deprecated; shuts down 2026-12-01.'),
    ('openai', 'gpt-4o-transcribe', 'usd_per_1m_tokens', '{"input":2.50,"output":10.00}',
     'https://developers.openai.com/api/docs/models/gpt-4o-transcribe', 'Deprecated; shuts down 2027-02-26.'),
    ('openai', 'gpt-4o-mini-transcribe', 'usd_per_1m_tokens', '{"input":1.25,"output":5.00}',
     'https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe', 'Deprecated; shuts down 2027-02-26.'),
    ('openai', 'gpt-4o-mini-tts', 'usd_per_1m_tokens', '{"input":0.60,"output":12.00}',
     'https://developers.openai.com/api/docs/models/gpt-4o-mini-tts',
     'Text tokens in, audio tokens out. /audio/speech returns no token counts, so its events are unpriced until usage is reported.')
  ) AS v(provider, model_id, unit, rates, source, notes)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.ai_price_book b
    WHERE b.provider = v.provider AND b.model_id = v.model_id AND b.effective_to IS NULL);
