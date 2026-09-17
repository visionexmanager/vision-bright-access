-- ── A learning pipeline that cannot learn a falsehood by itself ────────────
--
--   User → assistant → answer → signal → repeated-failure detection
--        → candidate → human review → eval case + versioned knowledge
--        → tests → deploy → monitor (a candidate that fails again reopens)
--
-- Nothing in this file changes what an assistant says. Every table is
-- evidence for a person to act on; no prompt reads any of it, and a user can
-- only ever add a signal, never a fact.
--
--   ai_quality_signals    one row per rating, correction, failure or fallback.
--                         No user id, no phone, no raw message: a salted
--                         fingerprint of the question to cluster on, and — for
--                         negative signals only — a redacted 240-character
--                         excerpt, cleared after 30 days. Rows go at 90 days.
--   ai_learning_candidates  what detect_repeated_failures() finds: the same
--                         question failing for several people. Status is set
--                         by an admin; the detector only opens and reopens.
--   ai_eval_cases         CASE-001 …: expected, actual, fix, the regression
--                         test that pins it, status.
--   ai_knowledge_entries  versioned corrections with a required source. Content
--                         never changes after insert — a correction is a new
--                         version — and activation and rollback are functions.
--
-- A user's correction is stored as an unverified claim. Only an admin creates
-- knowledge, and only with a source.

-- ── Helpers ────────────────────────────────────────────────────────────────

/** Emails, links, long digit runs (phones, cards, ids) and @handles removed; capped. */
CREATE OR REPLACE FUNCTION public.redact_pii(_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT nullif(left(btrim(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(coalesce(_text, ''),
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email]', 'g'),
      '(https?://|www\.)[^[:space:]]+', '[link]', 'g'),
      '\+?[0-9٠-٩۰-۹][0-9٠-٩۰-۹ ().\-/]{4,}[0-9٠-٩۰-۹]', '[number]', 'g'),
      '@[A-Za-z0-9_.]{2,}', '[handle]', 'g')
  ), 240), '')
$$;

REVOKE ALL ON FUNCTION public.redact_pii(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redact_pii(text) TO authenticated, service_role;

/**
 * The same question, however it was punctuated or capitalised, gives the same
 * value. Salted, so a list of common questions cannot be hashed to read it.
 */
CREATE OR REPLACE FUNCTION public.question_fingerprint(_text text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _normal text;
BEGIN
  _normal := btrim(regexp_replace(lower(coalesce(_text, '')), '[[:punct:][:space:]،؛؟«»“”‘’…ـ]+', ' ', 'g'));
  IF char_length(_normal) < 3 THEN
    RETURN NULL;
  END IF;
  RETURN encode(sha256(convert_to((SELECT salt FROM public.security_salt WHERE id) || ':q:' || left(_normal, 500), 'UTF8')), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION public.question_fingerprint(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.question_fingerprint(text) TO service_role;

-- ── Signals ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_quality_signals (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  signal               text        NOT NULL CHECK (signal IN (
                         'thumbs_up', 'thumbs_down', 'correction', 'hallucination_report',
                         'failed_request', 'fallback', 'tool_failure', 'escalation',
                         'completed', 'abandoned', 'repeated_question')),
  channel              text        NOT NULL CHECK (channel IN ('website', 'whatsapp', 'messenger', 'voice', 'career', 'other')),
  assistant_id         text        NOT NULL DEFAULT '-' CHECK (assistant_id ~ '^[A-Za-z0-9._-]{1,100}$'),
  provider             text        CHECK (provider ~ '^[a-z0-9._-]{1,40}$'),
  model                text        CHECK (char_length(model) <= 100),
  latency_ms           integer     CHECK (latency_ms BETWEEN 0 AND 600000),
  question_fingerprint text        CHECK (question_fingerprint ~ '^[0-9a-f]{64}$'),
  excerpt              text        CHECK (char_length(excerpt) <= 240),
  -- What a correction is taken to be. Anything a user says is an unverified
  -- claim until a person has checked it against a source.
  claim_class          text        CHECK (claim_class IN (
                         'user_preference', 'temporary_context', 'verified_fact',
                         'unverified_claim', 'correction', 'system_behavior_issue')),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_quality_signals_created ON public.ai_quality_signals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_quality_signals_cluster
  ON public.ai_quality_signals (question_fingerprint, channel, assistant_id, created_at)
  WHERE question_fingerprint IS NOT NULL;

ALTER TABLE public.ai_quality_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_quality_signals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ai_quality_signals TO authenticated;
GRANT ALL ON TABLE public.ai_quality_signals TO service_role;

DROP POLICY IF EXISTS "ai_quality_signals: admins read" ON public.ai_quality_signals;
CREATE POLICY "ai_quality_signals: admins read"
  ON public.ai_quality_signals FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')));

/**
 * The one way a signal is written. Visitors and signed-in users may rate the
 * website assistant or report a wrong answer, a few times a day per
 * connection; Edge Functions (service role) may record any signal.
 */
CREATE OR REPLACE FUNCTION public.record_ai_signal(
  _signal       text,
  _channel      text DEFAULT 'website',
  _assistant_id text DEFAULT NULL,
  _question     text DEFAULT NULL,
  _note         text DEFAULT NULL,
  _provider     text DEFAULT NULL,
  _model        text DEFAULT NULL,
  _latency_ms   integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _server   boolean := coalesce(auth.role(), '') = 'service_role';
  _negative boolean := _signal IN ('thumbs_down', 'correction', 'hallucination_report', 'failed_request', 'tool_failure');
  _caller   text;
BEGIN
  IF _signal IS NULL OR _signal NOT IN (
       'thumbs_up', 'thumbs_down', 'correction', 'hallucination_report',
       'failed_request', 'fallback', 'tool_failure', 'escalation',
       'completed', 'abandoned', 'repeated_question') THEN
    RAISE EXCEPTION 'Unknown signal' USING ERRCODE = '22023';
  END IF;

  IF NOT _server THEN
    IF _signal NOT IN ('thumbs_up', 'thumbs_down', 'correction', 'hallucination_report')
       OR coalesce(_channel, '') <> 'website' THEN
      RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;
    _caller := coalesce(public.request_caller_hash(), 'no-address-' || gen_random_uuid()::text);
    -- Over the limit the signal is quietly dropped, as newsletter sign-ups are.
    IF NOT public.check_ai_anon_rate_limit(_caller, 'ai-feedback') THEN
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.ai_quality_signals (
    signal, channel, assistant_id, provider, model, latency_ms,
    question_fingerprint, excerpt, claim_class
  ) VALUES (
    _signal,
    coalesce(_channel, 'website'),
    CASE WHEN _assistant_id ~ '^[A-Za-z0-9._-]{1,100}$' THEN _assistant_id ELSE '-' END,
    CASE WHEN _provider ~ '^[a-z0-9._-]{1,40}$' THEN _provider END,
    left(_model, 100),
    CASE WHEN _latency_ms BETWEEN 0 AND 600000 THEN _latency_ms END,
    public.question_fingerprint(_question),
    CASE WHEN _negative THEN public.redact_pii(coalesce(nullif(btrim(_note), ''), _question)) END,
    CASE WHEN _signal IN ('correction', 'hallucination_report') THEN 'unverified_claim' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_ai_signal(text, text, text, text, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_ai_signal(text, text, text, text, text, text, text, integer) TO anon, authenticated, service_role;

-- The limiter's default for a name it does not list is 10 per connection and
-- 500 overall per day, which is what ratings get.

-- ── Candidates: the same question failing for several people ──────────────

CREATE TABLE IF NOT EXISTS public.ai_learning_candidates (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel              text        NOT NULL,
  assistant_id         text        NOT NULL,
  question_fingerprint text        NOT NULL,
  occurrences          integer     NOT NULL DEFAULT 0,
  signal_breakdown     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  sample_excerpt       text        CHECK (char_length(sample_excerpt) <= 240),
  first_seen           timestamptz NOT NULL DEFAULT now(),
  last_seen            timestamptz NOT NULL DEFAULT now(),
  status               text        NOT NULL DEFAULT 'new' CHECK (status IN (
                         'new', 'investigating', 'fix_proposed', 'approved', 'rejected', 'shipped')),
  regressed            boolean     NOT NULL DEFAULT false,
  probable_cause       text        CHECK (char_length(probable_cause) <= 2000),
  proposed_fix         text        CHECK (char_length(proposed_fix) <= 4000),
  shipped_at           timestamptz,
  reviewed_by          uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, assistant_id, question_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_ai_learning_candidates_status ON public.ai_learning_candidates (status, last_seen DESC);

ALTER TABLE public.ai_learning_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_learning_candidates FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON TABLE public.ai_learning_candidates TO authenticated;
GRANT ALL ON TABLE public.ai_learning_candidates TO service_role;

DROP POLICY IF EXISTS "ai_learning_candidates: admins read" ON public.ai_learning_candidates;
CREATE POLICY "ai_learning_candidates: admins read"
  ON public.ai_learning_candidates FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')));

DROP POLICY IF EXISTS "ai_learning_candidates: admins review" ON public.ai_learning_candidates;
CREATE POLICY "ai_learning_candidates: admins review"
  ON public.ai_learning_candidates FOR UPDATE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin')));

/** A reviewer changes the review fields only; the evidence stays what was detected. */
CREATE OR REPLACE FUNCTION public.ai_learning_candidates_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    NEW.channel              := OLD.channel;
    NEW.assistant_id         := OLD.assistant_id;
    NEW.question_fingerprint := OLD.question_fingerprint;
    NEW.occurrences          := OLD.occurrences;
    NEW.signal_breakdown     := OLD.signal_breakdown;
    NEW.sample_excerpt       := OLD.sample_excerpt;
    NEW.first_seen           := OLD.first_seen;
    NEW.last_seen            := OLD.last_seen;
    NEW.reviewed_by          := auth.uid();
    IF NEW.status = 'shipped' AND OLD.status IS DISTINCT FROM 'shipped' THEN
      NEW.shipped_at := now();
      NEW.regressed  := false;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_learning_candidates_guard ON public.ai_learning_candidates;
CREATE TRIGGER ai_learning_candidates_guard
  BEFORE UPDATE ON public.ai_learning_candidates
  FOR EACH ROW EXECUTE FUNCTION public.ai_learning_candidates_guard();

/**
 * Opens a candidate when one question drew at least _min_count negative
 * signals in _days, and reopens a shipped one that has failed since it
 * shipped. Returns how many candidates it touched.
 */
CREATE OR REPLACE FUNCTION public.detect_repeated_failures(_min_count integer DEFAULT 5, _days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _touched integer;
BEGIN
  WITH negative AS (
    SELECT s.channel, s.assistant_id, s.question_fingerprint, s.signal, s.excerpt, s.created_at
      FROM public.ai_quality_signals s
     WHERE s.question_fingerprint IS NOT NULL
       AND s.signal IN ('thumbs_down', 'correction', 'hallucination_report', 'failed_request', 'tool_failure')
       AND s.created_at >= now() - make_interval(days => greatest(least(coalesce(_days, 7), 90), 1))
  ), grouped AS (
    SELECT n.channel, n.assistant_id, n.question_fingerprint,
           count(*)::integer AS occurrences,
           (SELECT jsonb_object_agg(k.signal, k.c) FROM (
              SELECT m.signal, count(*) AS c FROM negative m
               WHERE m.channel = n.channel AND m.assistant_id = n.assistant_id
                 AND m.question_fingerprint = n.question_fingerprint
               GROUP BY m.signal) k) AS breakdown,
           (array_agg(n.excerpt ORDER BY n.created_at DESC) FILTER (WHERE n.excerpt IS NOT NULL))[1] AS sample,
           min(n.created_at) AS first_seen,
           max(n.created_at) AS last_seen
      FROM negative n
     GROUP BY n.channel, n.assistant_id, n.question_fingerprint
    HAVING count(*) >= greatest(coalesce(_min_count, 5), 2)
  ), upserted AS (
    INSERT INTO public.ai_learning_candidates AS c (
      channel, assistant_id, question_fingerprint, occurrences, signal_breakdown,
      sample_excerpt, first_seen, last_seen
    )
    SELECT channel, assistant_id, question_fingerprint, occurrences, coalesce(breakdown, '{}'::jsonb),
           sample, first_seen, last_seen
      FROM grouped
    ON CONFLICT (channel, assistant_id, question_fingerprint) DO UPDATE
      SET occurrences      = excluded.occurrences,
          signal_breakdown = excluded.signal_breakdown,
          sample_excerpt   = coalesce(excluded.sample_excerpt, c.sample_excerpt),
          last_seen        = excluded.last_seen,
          -- Failing again after the fix shipped is a regression, not history.
          regressed        = c.regressed OR (c.status = 'shipped' AND excluded.last_seen > c.shipped_at),
          status           = CASE WHEN c.status = 'shipped' AND excluded.last_seen > c.shipped_at
                                  THEN 'new' ELSE c.status END,
          updated_at       = now()
      WHERE c.last_seen IS DISTINCT FROM excluded.last_seen
    RETURNING 1
  )
  SELECT count(*)::integer INTO _touched FROM upserted;
  RETURN _touched;
END;
$$;

REVOKE ALL ON FUNCTION public.detect_repeated_failures(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_repeated_failures(integer, integer) TO service_role;

-- ── Evaluation cases ──────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.ai_eval_case_seq;

CREATE TABLE IF NOT EXISTS public.ai_eval_cases (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_ref          text        NOT NULL UNIQUE
                                DEFAULT ('CASE-' || lpad(nextval('public.ai_eval_case_seq')::text, 3, '0')),
  channel           text        NOT NULL DEFAULT 'website',
  assistant_id      text        NOT NULL DEFAULT '-',
  candidate_id      uuid        REFERENCES public.ai_learning_candidates (id) ON DELETE SET NULL,
  -- Written by a person, and redacted on the way in regardless.
  input             text        NOT NULL CHECK (char_length(input) BETWEEN 1 AND 240),
  expected_behavior text        NOT NULL CHECK (char_length(expected_behavior) BETWEEN 1 AND 2000),
  actual_behavior   text        CHECK (char_length(actual_behavior) <= 2000),
  fix               text        CHECK (char_length(fix) <= 2000),
  regression_test   text        CHECK (regression_test ~ '^[A-Za-z0-9_./-]{1,200}$'),
  status            text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'verified', 'wont_fix')),
  created_by        uuid        DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- "Verified" means a test pins it.
  CHECK (status <> 'verified' OR regression_test IS NOT NULL)
);

ALTER TABLE public.ai_eval_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_eval_cases FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_eval_cases TO authenticated;
GRANT ALL ON TABLE public.ai_eval_cases TO service_role;
GRANT USAGE ON SEQUENCE public.ai_eval_case_seq TO authenticated, service_role;

DROP POLICY IF EXISTS "ai_eval_cases: admins manage" ON public.ai_eval_cases;
CREATE POLICY "ai_eval_cases: admins manage"
  ON public.ai_eval_cases FOR ALL TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin')));

CREATE OR REPLACE FUNCTION public.ai_eval_cases_redact()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.input := coalesce(public.redact_pii(NEW.input), '[removed]');
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    NEW.case_ref   := OLD.case_ref;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_eval_cases_redact ON public.ai_eval_cases;
CREATE TRIGGER ai_eval_cases_redact
  BEFORE INSERT OR UPDATE ON public.ai_eval_cases
  FOR EACH ROW EXECUTE FUNCTION public.ai_eval_cases_redact();

-- ── Versioned knowledge ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_knowledge_entries (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_key      text        NOT NULL CHECK (entry_key ~ '^[a-z0-9][a-z0-9._-]{1,99}$'),
  version        integer     NOT NULL CHECK (version >= 1),
  content        text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  -- Evidence is required: a user saying so is not a source.
  source         text        NOT NULL CHECK (char_length(btrim(source)) BETWEEN 5 AND 1000),
  classification text        NOT NULL CHECK (classification IN ('verified_fact', 'system_behavior', 'policy')),
  status         text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'active', 'retired', 'rejected')),
  candidate_id   uuid        REFERENCES public.ai_learning_candidates (id) ON DELETE SET NULL,
  eval_case_id   uuid        REFERENCES public.ai_eval_cases (id) ON DELETE SET NULL,
  created_by     uuid        DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  validated_by   uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  activated_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_key, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_knowledge_entries_one_active
  ON public.ai_knowledge_entries (entry_key) WHERE status = 'active';

ALTER TABLE public.ai_knowledge_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_knowledge_entries FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_knowledge_entries TO authenticated;
GRANT ALL ON TABLE public.ai_knowledge_entries TO service_role;

DROP POLICY IF EXISTS "ai_knowledge_entries: admins read" ON public.ai_knowledge_entries;
CREATE POLICY "ai_knowledge_entries: admins read"
  ON public.ai_knowledge_entries FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')));

DROP POLICY IF EXISTS "ai_knowledge_entries: admins draft" ON public.ai_knowledge_entries;
CREATE POLICY "ai_knowledge_entries: admins draft"
  ON public.ai_knowledge_entries FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin')) AND status = 'draft');

DROP POLICY IF EXISTS "ai_knowledge_entries: admins review" ON public.ai_knowledge_entries;
CREATE POLICY "ai_knowledge_entries: admins review"
  ON public.ai_knowledge_entries FOR UPDATE TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin')))
  WITH CHECK ((SELECT public.has_role((SELECT auth.uid()), 'admin')));

/**
 * Nothing is ever overwritten: content, key, version and source are fixed at
 * insert. A direct update may only validate or reject a draft; activating and
 * retiring go through the two functions below, which set a transaction flag.
 */
CREATE OR REPLACE FUNCTION public.ai_knowledge_entries_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _via_function boolean := coalesce(current_setting('vx.knowledge_transition', true), '') = 'on';
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.version := coalesce(
      (SELECT max(e.version) + 1 FROM public.ai_knowledge_entries e WHERE e.entry_key = NEW.entry_key), 1);
    NEW.status := CASE WHEN _via_function OR coalesce(auth.role(), '') = 'service_role' THEN NEW.status ELSE 'draft' END;
    NEW.validated_by := NULL;
    NEW.activated_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.entry_key IS DISTINCT FROM OLD.entry_key OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.content IS DISTINCT FROM OLD.content OR NEW.source IS DISTINCT FROM OLD.source
     OR NEW.classification IS DISTINCT FROM OLD.classification OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'A knowledge entry is never edited; add a new version' USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT _via_function THEN
    IF NOT (OLD.status = 'draft' AND NEW.status IN ('validated', 'rejected')) THEN
      RAISE EXCEPTION 'Use activate_knowledge_entry or rollback_knowledge_entry' USING ERRCODE = '42501';
    END IF;
    NEW.validated_by := auth.uid();
  END IF;
  IF NOT _via_function THEN
    NEW.activated_at := OLD.activated_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_knowledge_entries_guard ON public.ai_knowledge_entries;
CREATE TRIGGER ai_knowledge_entries_guard
  BEFORE INSERT OR UPDATE ON public.ai_knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION public.ai_knowledge_entries_guard();

CREATE OR REPLACE FUNCTION public.activate_knowledge_entry(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _entry public.ai_knowledge_entries%ROWTYPE;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _entry FROM public.ai_knowledge_entries WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR _entry.status <> 'validated' THEN
    RAISE EXCEPTION 'Only a validated entry can be activated' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('vx.knowledge_transition', 'on', true);
  UPDATE public.ai_knowledge_entries SET status = 'retired'
   WHERE entry_key = _entry.entry_key AND status = 'active';
  UPDATE public.ai_knowledge_entries SET status = 'active', activated_at = now() WHERE id = _id;
  PERFORM set_config('vx.knowledge_transition', '', true);
END;
$$;

/** Retires the active version and reactivates the one that was active before it. */
CREATE OR REPLACE FUNCTION public.rollback_knowledge_entry(_entry_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current  public.ai_knowledge_entries%ROWTYPE;
  _previous uuid;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _current FROM public.ai_knowledge_entries
   WHERE entry_key = _entry_key AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nothing is active for that key' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO _previous FROM public.ai_knowledge_entries
   WHERE entry_key = _entry_key AND status = 'retired' AND activated_at IS NOT NULL
     AND version < _current.version
   ORDER BY version DESC LIMIT 1;

  PERFORM set_config('vx.knowledge_transition', 'on', true);
  UPDATE public.ai_knowledge_entries SET status = 'retired' WHERE id = _current.id;
  IF _previous IS NOT NULL THEN
    UPDATE public.ai_knowledge_entries SET status = 'active', activated_at = now() WHERE id = _previous;
  END IF;
  PERFORM set_config('vx.knowledge_transition', '', true);
  RETURN _previous;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_knowledge_entry(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rollback_knowledge_entry(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_knowledge_entry(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rollback_knowledge_entry(text) TO authenticated, service_role;

-- ── What an admin sees ───────────────────────────────────────────────────

/**
 * Counts for the owner dashboard. No excerpt, no fingerprint, no message: the
 * candidate list is read separately, by an admin, under its own policy.
 */
CREATE OR REPLACE FUNCTION public.ai_learning_dashboard(_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _since timestamptz := now() - make_interval(days => greatest(least(coalesce(_days, 7), 90), 1));
  _result jsonb;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'days', greatest(least(coalesce(_days, 7), 90), 1),
    'requests', (SELECT count(*) FROM public.ai_interactions WHERE created_at >= _since),
    'tokens', (SELECT coalesce(sum(coalesce(prompt_tokens, 0) + coalesce(completion_tokens, 0)), 0)
                 FROM public.ai_interactions WHERE created_at >= _since),
    'avg_latency_ms', (SELECT round(avg(latency_ms)) FROM public.ai_interactions
                        WHERE created_at >= _since AND latency_ms IS NOT NULL),
    'signals', coalesce((SELECT jsonb_object_agg(signal, n) FROM (
                 SELECT signal, count(*) AS n FROM public.ai_quality_signals
                  WHERE created_at >= _since GROUP BY signal) s), '{}'::jsonb),
    'failures_by_channel', coalesce((SELECT jsonb_object_agg(channel, n) FROM (
                 SELECT channel, count(*) AS n FROM public.ai_quality_signals
                  WHERE created_at >= _since AND signal IN ('failed_request', 'tool_failure')
                  GROUP BY channel) s), '{}'::jsonb),
    'providers', coalesce((SELECT jsonb_agg(p ORDER BY p->>'provider', p->>'model') FROM (
                 SELECT jsonb_build_object(
                          'provider', i.provider,
                          'model', coalesce(i.model, '-'),
                          'requests', count(*),
                          'avg_latency_ms', round(avg(i.latency_ms)),
                          'p95_latency_ms', round((percentile_cont(0.95) WITHIN GROUP (ORDER BY i.latency_ms))::numeric),
                          'tokens', coalesce(sum(coalesce(i.prompt_tokens, 0) + coalesce(i.completion_tokens, 0)), 0)
                        ) AS p
                   FROM public.ai_interactions i
                  WHERE i.created_at >= _since
                  GROUP BY i.provider, i.model) x), '[]'::jsonb),
    'provider_failures', coalesce((SELECT jsonb_object_agg(provider, n) FROM (
                 SELECT provider, count(*) AS n FROM public.ai_quality_signals
                  WHERE created_at >= _since AND provider IS NOT NULL
                    AND signal IN ('failed_request', 'fallback')
                  GROUP BY provider) s), '{}'::jsonb),
    'candidates', coalesce((SELECT jsonb_object_agg(status, n) FROM (
                 SELECT status, count(*) AS n FROM public.ai_learning_candidates GROUP BY status) s), '{}'::jsonb),
    'regressions', (SELECT count(*) FROM public.ai_learning_candidates WHERE regressed AND status = 'new'),
    'eval_cases', coalesce((SELECT jsonb_object_agg(status, n) FROM (
                 SELECT status, count(*) AS n FROM public.ai_eval_cases GROUP BY status) s), '{}'::jsonb),
    'security_events', (SELECT coalesce(sum(count), 0) FROM public.security_events WHERE hour >= _since)
  ) INTO _result;
  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_learning_dashboard(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_learning_dashboard(integer) TO authenticated, service_role;

-- ── Retention and schedule ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sweep_ai_quality_signals()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _gone integer;
BEGIN
  UPDATE public.ai_quality_signals SET excerpt = NULL
   WHERE excerpt IS NOT NULL AND created_at < now() - interval '30 days';
  DELETE FROM public.ai_quality_signals WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS _gone = ROW_COUNT;
  RETURN _gone;
END;
$$;

REVOKE ALL ON FUNCTION public.sweep_ai_quality_signals() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_ai_quality_signals() TO service_role;

DO $outer$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'pg_cron could not be installed (%): learning jobs will not run.', SQLERRM;
    RETURN;
  END;

  PERFORM cron.schedule('ai-repeated-failures', '23 * * * *',
    $cron$SELECT public.detect_repeated_failures()$cron$);
  PERFORM cron.schedule('ai-quality-signals-sweep', '50 3 * * *',
    $cron$SELECT public.sweep_ai_quality_signals()$cron$);
END
$outer$;
