-- Shadow usage metering: what every AI provider call used, and what it cost
-- the provider. Nothing here charges anyone.
--
--   ai_price_book    provider cost, one versioned row per provider + model
--                    (+ unit). The single place a provider price lives; no
--                    Edge Function carries one.
--   ai_usage_events  one row per provider call — a direct call, or one attempt
--                    of a fallback chain — with its normalized usage, whether
--                    that usage was reported or estimated or missing, the price
--                    row used and the resulting provider cost.
--
-- Provider cost is kept apart from anything VisionEX charges: converting a cost
-- into VX, reserving and settling belong to vx_usage_ledger and are a later,
-- separate decision. No plan, VX price, balance or entitlement is touched here.
--
-- Both tables are service-only (RLS on, no policy), like every other registry
-- table: prices and per-model costs are an implementation detail, and nothing
-- in a browser should read them. Do not add a policy "to make it work".

-- ── Price book ──────────────────────────────────────────────────────────────

-- Token prices: input (required), cached_input, output — USD per 1M tokens.
-- Every other unit: price — USD per unit. A rate is a non-negative number or
-- absent. A CHECK cannot hold a subquery, hence a function; and a NULL answer
-- is false, so a malformed row never passes on NULL.
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
       WHERE e.key IN ('input', 'cached_input', 'output', 'price')
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

CREATE TABLE IF NOT EXISTS public.ai_price_book (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider       text NOT NULL CHECK (provider ~ '^[a-z0-9_-]{1,32}$'),
  model_id       text NOT NULL CHECK (model_id ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'),
  unit           text NOT NULL CHECK (unit IN (
                   'usd_per_1m_tokens', 'usd_per_1m_characters', 'usd_per_minute',
                   'usd_per_hour', 'usd_per_image', 'free')),
  rates          jsonb NOT NULL DEFAULT '{}',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to   timestamptz,
  source         text NOT NULL CHECK (source ~ '^https://'),
  verified_on    date NOT NULL,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT ai_price_book_rates_valid CHECK (public.ai_price_rates_valid(unit, rates))
);

-- One price in force per provider + model: a change closes the old row
-- (effective_to) and inserts a new one, so an old event keeps its old price.
CREATE UNIQUE INDEX IF NOT EXISTS ai_price_book_current_idx
  ON public.ai_price_book (provider, model_id) WHERE effective_to IS NULL;

-- A price row is history once written: only effective_to may be set, once.
CREATE OR REPLACE FUNCTION public.ai_price_book_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.provider IS DISTINCT FROM OLD.provider
     OR NEW.model_id IS DISTINCT FROM OLD.model_id
     OR NEW.unit IS DISTINCT FROM OLD.unit
     OR NEW.rates IS DISTINCT FROM OLD.rates
     OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
     OR NEW.source IS DISTINCT FROM OLD.source
     OR NEW.verified_on IS DISTINCT FROM OLD.verified_on
     OR (OLD.effective_to IS NOT NULL AND NEW.effective_to IS DISTINCT FROM OLD.effective_to) THEN
    RAISE EXCEPTION 'ai_price_book rows are history: close this one (effective_to) and insert a new price'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_price_book_immutable ON public.ai_price_book;
CREATE TRIGGER ai_price_book_immutable
  BEFORE UPDATE ON public.ai_price_book
  FOR EACH ROW EXECUTE FUNCTION public.ai_price_book_immutable();

REVOKE ALL ON FUNCTION public.ai_price_book_immutable() FROM PUBLIC, anon, authenticated;

-- Two prices for one model may not cover the same instant: an event's cost
-- must have exactly one answer. (The unique index covers only open rows.)
CREATE OR REPLACE FUNCTION public.ai_price_book_no_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.ai_price_book b
     WHERE b.provider = NEW.provider AND b.model_id = NEW.model_id AND b.id <> NEW.id
       AND tstzrange(b.effective_from, b.effective_to) && tstzrange(NEW.effective_from, NEW.effective_to)
  ) THEN
    RAISE EXCEPTION 'ai_price_book: % % already has a price in force for part of that period', NEW.provider, NEW.model_id
      USING ERRCODE = 'exclusion_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_price_book_no_overlap ON public.ai_price_book;
CREATE TRIGGER ai_price_book_no_overlap
  BEFORE INSERT OR UPDATE ON public.ai_price_book
  FOR EACH ROW EXECUTE FUNCTION public.ai_price_book_no_overlap();

REVOKE ALL ON FUNCTION public.ai_price_book_no_overlap() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.ai_price_book ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_price_book FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_price_book TO service_role;

COMMENT ON TABLE public.ai_price_book IS
  'Provider cost per model, versioned (effective_from/to). Provider cost only — never a VisionEX/VX price. Service-only; RLS on with no policy by design.';

-- ── Usage events ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  function_name     text NOT NULL CHECK (function_name ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  operation         text NOT NULL CHECK (operation IN (
                      'structured', 'stream', 'embedding', 'image', 'tts', 'stt', 'realtime', 'moderation')),
  provider          text NOT NULL CHECK (provider ~ '^[a-z0-9_-]{1,32}$'),
  model             text NOT NULL CHECK (model ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'),
  resolved_model    text CHECK (resolved_model IS NULL OR resolved_model ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'),
  chain_id          uuid,
  attempt           smallint CHECK (attempt IS NULL OR attempt BETWEEN 1 AND 50),
  outcome           text NOT NULL CHECK (outcome IN ('ok', 'error')),
  error_code        text CHECK (error_code IS NULL OR error_code ~ '^[a-z0-9_]{1,32}$'),
  -- Counts only: input/cached/output/reasoning/total tokens, characters,
  -- seconds, images. Never text.
  usage             jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(usage) = 'object'),
  usage_source      text NOT NULL CHECK (usage_source IN ('reported', 'estimated', 'missing')),
  price_id          bigint REFERENCES public.ai_price_book (id) ON DELETE RESTRICT,
  provider_cost_usd numeric(14, 9) CHECK (provider_cost_usd IS NULL OR provider_cost_usd >= 0),
  cost_status       text NOT NULL CHECK (cost_status IN ('priced', 'free', 'unpriced', 'no_usage')),
  cost_note         text CHECK (cost_note IS NULL OR length(cost_note) <= 120),
  -- A cost exists exactly when the call was priced (or free).
  CHECK ((cost_status IN ('priced', 'free')) = (provider_cost_usd IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS ai_usage_events_time_idx     ON public.ai_usage_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_events_model_idx    ON public.ai_usage_events (provider, model, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_events_function_idx ON public.ai_usage_events (function_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_events_chain_idx    ON public.ai_usage_events (chain_id) WHERE chain_id IS NOT NULL;

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_usage_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.ai_usage_events TO service_role;

COMMENT ON TABLE public.ai_usage_events IS
  'One row per AI provider call (shadow metering): normalized usage, its source, the price row and the provider cost. Counts only, no content, no user id. Service-only; RLS on with no policy by design.';

-- What the owner needs to price a service: calls, usage quality and provider
-- cost per day, function and model. Read with the service role.
CREATE OR REPLACE VIEW public.ai_usage_cost_daily
WITH (security_invoker = true) AS
SELECT date_trunc('day', occurred_at)                            AS day,
       function_name,
       provider,
       COALESCE(resolved_model, model)                           AS model,
       count(*)                                                  AS calls,
       count(*) FILTER (WHERE outcome = 'error')                 AS failed_calls,
       count(*) FILTER (WHERE usage_source = 'reported')         AS usage_reported,
       count(*) FILTER (WHERE usage_source <> 'reported' AND outcome = 'ok') AS usage_not_reported,
       count(*) FILTER (WHERE cost_status = 'unpriced')          AS unpriced_calls,
       sum(provider_cost_usd)                                    AS provider_cost_usd
  FROM public.ai_usage_events
 GROUP BY 1, 2, 3, 4;

REVOKE ALL ON public.ai_usage_cost_daily FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_usage_cost_daily TO service_role;

-- ── Seed: only prices verified against the provider's own page, 2026-09-28 ──
--
-- Models the code calls whose price could not be tied to an exact model id are
-- deliberately absent: Gemini's gemini-flash-lite-latest and Mistral's
-- ministral-*-latest, open-mistral-nemo and pixtral-12b-latest are aliases the
-- providers' pages do not map to a priced model. Their events record the
-- concrete model the response names (resolved_model) and stay "unpriced" until
-- a verified row for that model is inserted — never a guessed rate.
-- Image, gpt-4o-mini-tts, gpt-4o-transcribe and realtime prices split by token
-- class (text/image/audio); they arrive with the normalizers that report those
-- classes, not before.

INSERT INTO public.ai_price_book (provider, model_id, unit, rates, effective_from, source, verified_on, notes)
SELECT v.provider, v.model_id, v.unit, v.rates::jsonb, timestamptz '2026-09-28 00:00:00+00', v.source, DATE '2026-09-28', v.notes
  FROM (VALUES
    ('openai', 'gpt-4.1',          'usd_per_1m_tokens', '{"input":2.00,"cached_input":0.50,"output":8.00}',
     'https://developers.openai.com/api/docs/pricing', NULL),
    ('openai', 'gpt-4o',           'usd_per_1m_tokens', '{"input":2.50,"cached_input":1.25,"output":10.00}',
     'https://developers.openai.com/api/docs/pricing', 'The gpt-4o-2024-05-13 snapshot is priced differently ($5/$15); an event resolved to it and unmatched here falls back to this alias row.'),
    ('openai', 'gpt-4o-mini',      'usd_per_1m_tokens', '{"input":0.15,"cached_input":0.075,"output":0.60}',
     'https://developers.openai.com/api/docs/pricing', NULL),
    ('openai', 'gpt-5.6-luna',     'usd_per_1m_tokens', '{"input":0.20,"cached_input":0.02,"output":1.20}',
     'https://developers.openai.com/api/docs/pricing', 'Above 272K input tokens OpenAI charges 2x input and 1.5x output; not applied — no Visionex call comes near it.'),
    ('openai', 'text-embedding-3-small', 'usd_per_1m_tokens', '{"input":0.02}',
     'https://developers.openai.com/api/docs/pricing', NULL),
    ('openai', 'omni-moderation-latest', 'free', '{}',
     'https://developers.openai.com/api/docs/pricing', NULL),
    ('openai', 'tts-1',            'usd_per_1m_characters', '{"price":15.00}',
     'https://developers.openai.com/api/docs/pricing', NULL),
    ('openai', 'whisper-1',        'usd_per_minute',    '{"price":0.006}',
     'https://developers.openai.com/api/docs/pricing', 'Deprecated; shuts down 2027-02-26.'),
    ('groq',   'openai/gpt-oss-20b',  'usd_per_1m_tokens', '{"input":0.075,"output":0.30}',
     'https://console.groq.com/docs/models', NULL),
    ('groq',   'openai/gpt-oss-120b', 'usd_per_1m_tokens', '{"input":0.15,"output":0.60}',
     'https://console.groq.com/docs/models', NULL),
    ('groq',   'whisper-large-v3-turbo', 'usd_per_hour', '{"price":0.04}',
     'https://console.groq.com/docs/models', NULL)
  ) AS v(provider, model_id, unit, rates, source, notes)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.ai_price_book b
    WHERE b.provider = v.provider AND b.model_id = v.model_id AND b.effective_to IS NULL);
