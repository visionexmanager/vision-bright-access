-- How many assistant messages were answered without an AI provider, by which
-- plan (a plan id, never a person), in which language, with which intent.
--
-- Why. `ai-chat` and the WhatsApp webhook answer greetings, thanks, navigation
-- and a few fixed FAQs from a catalogue (`_shared/localIntents.ts`). Until now the
-- only trace was a console line, so nobody could say how many provider calls that
-- avoided. This keeps one counter row per day / channel / intent / language /
-- plan id.
--
-- What it holds. Counts and an *estimate* of the input tokens not sent. No user
-- id, no message text, no address, no timestamp finer than a day.
--
-- What it is not. Not billing and not a measured saving: a saving is confirmed
-- only by `ai_usage_events` showing fewer rows. The report returns both numbers
-- side by side and labels the token figure an estimate.
--
-- Access. RLS on with no policy (service-only, like the other registry tables);
-- the writer is service_role only; the reader checks `has_role(..., 'admin')`
-- inside the function.

CREATE TABLE IF NOT EXISTS public.assistant_local_answer_daily (
  day                      date   NOT NULL,
  channel                  text   NOT NULL CHECK (channel IN ('website', 'whatsapp')),
  intent                   text   NOT NULL CHECK (intent ~ '^[a-z]{1,16}(\.[a-z]{1,16})?$'),
  locale                   text   NOT NULL CHECK (locale ~ '^[a-z]{2,3}$'),
  plan_class               text   NOT NULL CHECK (plan_class ~ '^[a-z_]{1,32}$'),
  answers                  bigint NOT NULL DEFAULT 0 CHECK (answers >= 0),
  est_avoided_input_tokens bigint NOT NULL DEFAULT 0 CHECK (est_avoided_input_tokens >= 0),
  PRIMARY KEY (day, channel, intent, locale, plan_class)
);

ALTER TABLE public.assistant_local_answer_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assistant_local_answer_daily FROM PUBLIC, anon, authenticated;

-- One call per local answer. The class is derived here, from the id the caller
-- already verified, so a client can never choose its own.
CREATE OR REPLACE FUNCTION public.record_local_answer(
  _channel text,
  _intent text,
  _locale text,
  _user_id uuid,
  _est_tokens integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _class text;
BEGIN
  -- The plan id plan_for_user resolves (admin, a paid plan id, the trial plan id,
  -- none), or 'anonymous'. A plan id is not an identity; no trial flag is read here.
  _class := CASE WHEN _user_id IS NULL THEN 'anonymous' ELSE public.plan_for_user(_user_id) END;

  INSERT INTO public.assistant_local_answer_daily AS d
    (day, channel, intent, locale, plan_class, answers, est_avoided_input_tokens)
  VALUES
    ((now() AT TIME ZONE 'UTC')::date, _channel, _intent, _locale, _class, 1,
     LEAST(GREATEST(COALESCE(_est_tokens, 0), 0), 200000))
  ON CONFLICT (day, channel, intent, locale, plan_class) DO UPDATE
    SET answers = d.answers + 1,
        est_avoided_input_tokens = d.est_avoided_input_tokens + EXCLUDED.est_avoided_input_tokens;
END;
$$;

REVOKE ALL ON FUNCTION public.record_local_answer(text, text, text, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_local_answer(text, text, text, uuid, integer) TO service_role;

-- Admin read side. One jsonb value, aggregates only.
CREATE OR REPLACE FUNCTION public.admin_assistant_local_answers(
  _days integer DEFAULT 14,
  _usd_per_1m_input_tokens numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _d      integer := LEAST(GREATEST(COALESCE(_days, 14), 1), 90);
  _since  date;
  _local  bigint;
  _tokens bigint;
  _calls  bigint;
  _by     jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  _since := (now() AT TIME ZONE 'UTC')::date - (_d - 1);

  SELECT COALESCE(sum(answers), 0), COALESCE(sum(est_avoided_input_tokens), 0)
    INTO _local, _tokens
    FROM public.assistant_local_answer_daily WHERE day >= _since;

  -- Provider attempts by the website assistant in the same window. A fallback
  -- chain is several attempts for one message, so this is attempts, not messages.
  SELECT count(*) INTO _calls
    FROM public.ai_usage_events
   WHERE function_name = 'ai-chat' AND occurred_at >= _since::timestamptz;

  SELECT COALESCE(jsonb_agg(r ORDER BY r.answers DESC), '[]'::jsonb) INTO _by
    FROM (
      SELECT channel, plan_class, intent, locale,
             sum(answers)::bigint AS answers
        FROM public.assistant_local_answer_daily
       WHERE day >= _since
       GROUP BY channel, plan_class, intent, locale
       ORDER BY sum(answers) DESC
       LIMIT 500
    ) r;

  RETURN jsonb_build_object(
    'days', _d,
    'local_answers', _local,
    'provider_attempts_ai_chat', _calls,
    'est_avoided_input_tokens', _tokens,
    'est_usd_avoided', CASE WHEN _usd_per_1m_input_tokens IS NULL THEN NULL
                            ELSE round(_tokens::numeric / 1000000 * _usd_per_1m_input_tokens, 6) END,
    'tokens_are_an_estimate', true,
    'confirmed_by', 'ai_usage_events showing fewer rows; this figure is not billing',
    'breakdown', _by
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_assistant_local_answers(integer, numeric) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_assistant_local_answers(integer, numeric) TO authenticated;
