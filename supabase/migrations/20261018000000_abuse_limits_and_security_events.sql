-- ── Abuse limits for public endpoints, and a record of abuse ────────────────
--
-- 1. check_ai_anon_rate_limit meters more than ai-chat. Every endpoint below
--    needs no account and costs money or sends mail:
--
--      endpoint                  per caller / day   everyone / day
--      ai-chat                                 20             3000
--      contact-form                            10              500   (sends two emails)
--      ai-search                              300            30000   (embedding per search)
--      library-semantic-search                300            30000   (embedding per search)
--      newsletter-signup                        5             1000   (subscribes an address)
--      anything else                           10              500
--
-- 2. security_events: one row per kind, source, caller and hour, with a count.
--    A flood of refusals becomes one row whose count rises, not a flood of
--    rows. Callers are keyed hashes; nothing here identifies a person.
--    RLS on, no policy: service role only. Read by security-monitor.yml.
--
-- 3. service_requests accepted INSERT from anyone with WITH CHECK (true), so a
--    stranger could file requests under any user id and skip every check the
--    contact form makes. The contact form now inserts with the service role;
--    the one direct writer left (travel requests) is signed in and files as
--    itself.
--
-- 4. newsletter_subscribers accepts inserts from visitors (the homepage form),
--    which let anyone subscribe any address, as often as they liked. A trigger
--    now meters visitor inserts per connection, using the address PostgREST
--    forwards, hashed with a salt that never leaves the database.

-- ── 2. Security events ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.security_events (
  kind         text        NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_.]{2,60}$'),
  source       text        NOT NULL CHECK (char_length(source) BETWEEN 1 AND 60),
  subject_hash text        NOT NULL DEFAULT '-' CHECK (char_length(subject_hash) BETWEEN 1 AND 128),
  hour         timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 1 CHECK (count > 0),
  first_at     timestamptz NOT NULL DEFAULT now(),
  last_at      timestamptz NOT NULL DEFAULT now(),
  detail       jsonb       NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(detail) <= 2000),
  PRIMARY KEY (kind, source, subject_hash, hour)
);

CREATE INDEX IF NOT EXISTS idx_security_events_hour ON public.security_events (hour DESC);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.security_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.security_events TO service_role;

CREATE OR REPLACE FUNCTION public.record_security_event(
  _kind         text,
  _source       text,
  _subject_hash text DEFAULT NULL,
  _detail       jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _kind IS NULL OR _kind !~ '^[a-z][a-z0-9_.]{2,60}$'
     OR _source IS NULL OR char_length(_source) NOT BETWEEN 1 AND 60 THEN
    RETURN;
  END IF;

  INSERT INTO public.security_events (kind, source, subject_hash, hour, detail)
  VALUES (
    _kind,
    _source,
    coalesce(left(_subject_hash, 128), '-'),
    date_trunc('hour', now()),
    CASE WHEN pg_column_size(coalesce(_detail, '{}'::jsonb)) <= 2000 THEN coalesce(_detail, '{}'::jsonb) ELSE '{}'::jsonb END
  )
  ON CONFLICT (kind, source, subject_hash, hour) DO UPDATE
    SET count   = public.security_events.count + 1,
        last_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.record_security_event(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_security_event(text, text, text, jsonb) TO service_role;

/** Counts only: what the monitor reads, and all it reads. */
CREATE OR REPLACE FUNCTION public.security_event_summary(_hours integer DEFAULT 1)
RETURNS TABLE (kind text, source text, events bigint, callers bigint, last_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.kind, e.source, sum(e.count)::bigint, count(DISTINCT e.subject_hash)::bigint, max(e.last_at)
    FROM public.security_events e
   WHERE e.hour >= date_trunc('hour', now()) - make_interval(hours => greatest(least(coalesce(_hours, 1), 720), 1) - 1)
   GROUP BY e.kind, e.source
   ORDER BY 3 DESC
$$;

REVOKE ALL ON FUNCTION public.security_event_summary(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_event_summary(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.sweep_security_events()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH gone AS (
    DELETE FROM public.security_events WHERE hour < now() - interval '30 days' RETURNING 1
  )
  SELECT count(*)::integer FROM gone;
$$;

REVOKE ALL ON FUNCTION public.sweep_security_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_security_events() TO service_role;

-- ── 1. The caller limiter, for every public endpoint that costs ──────────

CREATE OR REPLACE FUNCTION public.check_ai_anon_rate_limit(
  _caller_hash   text,
  _function_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _per_caller integer;
  _platform   integer;
  _mine       bigint;
  _everyone   bigint;
BEGIN
  IF _caller_hash IS NULL OR char_length(_caller_hash) NOT BETWEEN 16 AND 128
     OR _function_name IS NULL OR char_length(_function_name) NOT BETWEEN 1 AND 50 THEN
    RETURN false;
  END IF;

  _per_caller := CASE _function_name
    WHEN 'ai-chat'                 THEN 20
    WHEN 'contact-form'            THEN 10
    WHEN 'ai-search'               THEN 300
    WHEN 'library-semantic-search' THEN 300
    WHEN 'newsletter-signup'       THEN 5
    ELSE 10
  END;
  _platform := CASE _function_name
    WHEN 'ai-chat'                 THEN 3000
    WHEN 'contact-form'            THEN 500
    WHEN 'ai-search'               THEN 30000
    WHEN 'library-semantic-search' THEN 30000
    WHEN 'newsletter-signup'       THEN 1000
    ELSE 500
  END;

  -- Two tabs from one caller must not both read "19" and both be let through.
  PERFORM pg_advisory_xact_lock(hashtext('ai_anon_usage:' || _function_name || ':' || _caller_hash));

  SELECT count(*) INTO _mine
    FROM public.ai_anon_usage
   WHERE function_name = _function_name
     AND caller_hash   = _caller_hash
     AND created_at   >= now() - interval '1 day';
  IF _mine >= _per_caller THEN
    PERFORM public.record_security_event('rate_limit.caller', _function_name, _caller_hash, '{}'::jsonb);
    RETURN false;
  END IF;

  SELECT count(*) INTO _everyone
    FROM public.ai_anon_usage
   WHERE function_name = _function_name
     AND created_at   >= now() - interval '1 day';
  IF _everyone >= _platform THEN
    PERFORM public.record_security_event('rate_limit.platform', _function_name, NULL, '{}'::jsonb);
    RETURN false;
  END IF;

  INSERT INTO public.ai_anon_usage (caller_hash, function_name)
  VALUES (_caller_hash, _function_name);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_ai_anon_rate_limit(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_anon_rate_limit(text, text) TO service_role;

-- ── 3. service_requests: signed-in users file their own ───────────────────

DROP POLICY IF EXISTS "Anyone can insert service requests" ON public.service_requests;
-- Its sibling let visitors insert with no user id, which skipped the same
-- validation and limits. Nothing inserts as a visitor any more.
DROP POLICY IF EXISTS "Anyone can submit a service request" ON public.service_requests;
DROP POLICY IF EXISTS "service_requests: signed-in users file their own" ON public.service_requests;
CREATE POLICY "service_requests: signed-in users file their own"
  ON public.service_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'pending');

-- ── 4. Newsletter sign-ups from visitors are metered ──────────────────────

-- A salt for hashing connection addresses inside the database. Created once;
-- nothing grants it to anyone.
CREATE TABLE IF NOT EXISTS public.security_salt (
  id   boolean PRIMARY KEY DEFAULT true CHECK (id),
  salt text    NOT NULL DEFAULT (gen_random_uuid()::text || gen_random_uuid()::text)
);
ALTER TABLE public.security_salt ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.security_salt FROM PUBLIC, anon, authenticated;
INSERT INTO public.security_salt (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

/** The caller's connection as PostgREST forwarded it, hashed; NULL outside a request. */
CREATE OR REPLACE FUNCTION public.request_caller_hash()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _headers jsonb;
  _address text;
BEGIN
  BEGIN
    _headers := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  IF _headers IS NULL THEN
    RETURN NULL;
  END IF;
  _address := coalesce(
    nullif(_headers->>'cf-connecting-ip', ''),
    nullif(_headers->>'x-real-ip', ''),
    nullif(split_part(coalesce(_headers->>'x-forwarded-for', ''), ',', 1), '')
  );
  IF _address IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN encode(sha256(convert_to((SELECT salt FROM public.security_salt WHERE id) || ':' || trim(_address), 'UTF8')), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION public.request_caller_hash() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_caller_hash() TO service_role;

CREATE OR REPLACE FUNCTION public.meter_newsletter_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller text;
BEGIN
  -- Only requests from visitors and signed-in users are metered; the service
  -- role, migrations and cron are not. current_user is this function's owner
  -- here (SECURITY DEFINER), so the request's own role is what is read.
  IF coalesce(auth.role(), '') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  -- With no forwarded address, a shared bucket would stop every visitor after
  -- five; a unique one leaves only the platform-wide ceiling in force.
  _caller := coalesce(public.request_caller_hash(), 'no-address-' || gen_random_uuid()::text);
  -- Over the limit, the row is quietly not stored. Raising an error would roll
  -- back the security event the limiter just recorded, and would tell a
  -- script exactly when to rotate its address.
  IF NOT public.check_ai_anon_rate_limit(_caller, 'newsletter-signup') THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.meter_newsletter_signup() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS meter_newsletter_signup ON public.newsletter_subscribers;
CREATE TRIGGER meter_newsletter_signup
  BEFORE INSERT ON public.newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.meter_newsletter_signup();

-- ── Housekeeping ───────────────────────────────────────────────────────────

DO $outer$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'pg_cron could not be installed (%): security_events will not be swept.', SQLERRM;
    RETURN;
  END;

  PERFORM cron.schedule(
    'security-events-sweep',
    '40 3 * * *',
    $cron$SELECT public.sweep_security_events()$cron$
  );
END
$outer$;
