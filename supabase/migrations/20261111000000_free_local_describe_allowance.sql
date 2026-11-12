-- A free daily allowance of photo descriptions, done on Visionex's own server.
--
-- The subscription gate still refuses every AI service to a number without a
-- paid plan. What this adds is one narrow thing the WhatsApp webhook may offer
-- those numbers after the gate has refused: a description of a photograph by the
-- small model that runs on Visionex's own server — no paid provider, no
-- fallback to one — ten a day per number.
--
-- Counted here, atomically, so two photos arriving together cannot both take the
-- last unit. A unit is handed back when nothing was produced, so a failure never
-- costs a try. Rows hold a count and a day, nothing else; they are service-role
-- only (RLS on, no policy, on purpose) and the take function deletes the same
-- number's rows from earlier days, so the table never grows beyond one row per
-- active number.
--
-- Additive and re-runnable.

CREATE TABLE IF NOT EXISTS public.free_local_describe_usage (
  wa_phone   text NOT NULL,
  usage_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc')::date),
  used       integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wa_phone, usage_date)
);
ALTER TABLE public.free_local_describe_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.free_local_describe_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.free_local_describe_usage TO service_role;
COMMENT ON TABLE public.free_local_describe_usage IS
  'Free local photo descriptions a WhatsApp number has taken today. Counts only. Service role only: no policy, deliberately.';

CREATE OR REPLACE FUNCTION public.free_local_describe_limit()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT 10 $$;

CREATE OR REPLACE FUNCTION public.free_local_describe_take(_wa_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limit integer := public.free_local_describe_limit();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _used  integer;
BEGIN
  IF _wa_phone IS NULL OR btrim(_wa_phone) = '' THEN
    RETURN jsonb_build_object('status', 'none');
  END IF;

  DELETE FROM public.free_local_describe_usage
   WHERE wa_phone = _wa_phone AND usage_date < _today;

  INSERT INTO public.free_local_describe_usage AS t (wa_phone, usage_date, used, updated_at)
  VALUES (_wa_phone, _today, 1, now())
  ON CONFLICT (wa_phone, usage_date) DO UPDATE SET used = t.used + 1, updated_at = now()
    WHERE t.used < _limit
  RETURNING t.used INTO _used;

  IF _used IS NULL THEN
    RETURN jsonb_build_object('status', 'exhausted', 'limit', _limit, 'used', _limit, 'remaining', 0);
  END IF;
  RETURN jsonb_build_object('status', 'ok', 'limit', _limit, 'used', _used, 'remaining', _limit - _used);
END;
$$;

CREATE OR REPLACE FUNCTION public.free_local_describe_release(_wa_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _used integer;
BEGIN
  UPDATE public.free_local_describe_usage u
     SET used = greatest(u.used - 1, 0), updated_at = now()
   WHERE u.wa_phone = _wa_phone
     AND u.usage_date = (now() AT TIME ZONE 'utc')::date
  RETURNING u.used INTO _used;
  IF _used IS NULL THEN RETURN jsonb_build_object('status', 'none'); END IF;
  RETURN jsonb_build_object('status', 'ok', 'used', _used);
END;
$$;

-- REVOKE FROM PUBLIC also revokes service_role, so grant it back explicitly,
-- and name anon and authenticated: PUBLIC alone is not isolation.
DO $$
DECLARE
  _sig text;
BEGIN
  FOREACH _sig IN ARRAY ARRAY[
    'public.free_local_describe_limit()',
    'public.free_local_describe_take(text)',
    'public.free_local_describe_release(text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', _sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', _sig);
  END LOOP;
END $$;
