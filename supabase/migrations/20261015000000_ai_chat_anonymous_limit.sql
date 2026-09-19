-- ── A ceiling for signed-out use of the website assistant ──────────────────
--
-- ai-chat serves the default Visionex assistant to visitors who have not
-- signed in. That is intended. What was not intended: those calls skipped both
-- check_ai_rate_limit (it needs a user id, and ai_usage_log.user_id references
-- auth.users) and check_ai_budget, so a script could call a paid model without
-- any limit at all.
--
-- Two ceilings, both over a rolling day:
--   per caller  20 — a caller is an HMAC of the client address, computed in
--                    the function with a server-side key. No address is stored.
--   platform  3000 — every signed-out call together. Rotating addresses gets a
--                    script past the first ceiling, never past this one.
--
-- Signed-in users keep their own 60 a day, untouched.
--
-- The table is an implementation detail: RLS on, no policy, service role only.
-- Do not add a policy "to make it work".

CREATE TABLE IF NOT EXISTS public.ai_anon_usage (
  id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  caller_hash   text        NOT NULL CHECK (char_length(caller_hash) BETWEEN 16 AND 128),
  function_name text        NOT NULL CHECK (char_length(function_name) BETWEEN 1 AND 50),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_anon_usage_caller
  ON public.ai_anon_usage (function_name, caller_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_anon_usage_recent
  ON public.ai_anon_usage (function_name, created_at DESC);

ALTER TABLE public.ai_anon_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_anon_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.ai_anon_usage TO service_role;

/**
 * TRUE when this signed-out caller may make one more call, and records it.
 * FALSE when the caller or the platform has used the day's allowance, or when
 * the arguments are malformed.
 */
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

  _per_caller := CASE _function_name WHEN 'ai-chat' THEN 20   ELSE 10  END;
  _platform   := CASE _function_name WHEN 'ai-chat' THEN 3000 ELSE 500 END;

  -- Two tabs from one caller must not both read "19" and both be let through.
  PERFORM pg_advisory_xact_lock(hashtext('ai_anon_usage:' || _function_name || ':' || _caller_hash));

  SELECT count(*) INTO _mine
    FROM public.ai_anon_usage
   WHERE function_name = _function_name
     AND caller_hash   = _caller_hash
     AND created_at   >= now() - interval '1 day';
  IF _mine >= _per_caller THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO _everyone
    FROM public.ai_anon_usage
   WHERE function_name = _function_name
     AND created_at   >= now() - interval '1 day';
  IF _everyone >= _platform THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_anon_usage (caller_hash, function_name)
  VALUES (_caller_hash, _function_name);

  RETURN true;
END;
$$;

-- FROM PUBLIC also removes service_role, which is the only caller.
REVOKE ALL ON FUNCTION public.check_ai_anon_rate_limit(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_anon_rate_limit(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.sweep_ai_anon_usage()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH gone AS (
    DELETE FROM public.ai_anon_usage
     WHERE created_at < now() - interval '2 days'
    RETURNING 1
  )
  SELECT count(*)::integer FROM gone;
$$;

REVOKE ALL ON FUNCTION public.sweep_ai_anon_usage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_ai_anon_usage() TO service_role;

DO $outer$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'pg_cron could not be installed (%): ai_anon_usage will not be swept.', SQLERRM;
    RETURN;
  END;

  PERFORM cron.schedule(
    'ai-anon-usage-sweep',
    '35 * * * *',
    $cron$SELECT public.sweep_ai_anon_usage()$cron$
  );
END
$outer$;
