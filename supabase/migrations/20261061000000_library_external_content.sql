-- External content providers for the Library (open catalogues, museums,
-- archives and media APIs searched through library-research-assistant).
--
-- 1. A daily ceiling for the new search modes. `content_search` and
--    `content_item` count against 'library-content-search', not against the
--    research assistant's AI allowance: a media search costs no model call, so
--    it must not use up a reader's AI requests. 300 a day is a ceiling on
--    abuse of the shared provider quotas, not a price.
--
-- 2. library_external_provider_health — the admin panel's "last health
--    check". One row per provider, overwritten by each check. Written only by
--    the Edge Function (service role); read only by admins. It holds a state,
--    a latency and an error *code* — never a key, a URL or a query.
--
-- Nothing here stores external media or search results.

CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
  _user_id      UUID,
  _function_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _daily_count  BIGINT;
  _daily_limit  INTEGER;
BEGIN
  -- Serialise this user's calls to this function. Must precede the count.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('check_ai_rate_limit:' || _user_id::text || ':' || _function_name, 0)
  );

  _daily_limit := CASE _function_name
    WHEN 'ai-chat'              THEN 60
    WHEN 'academy-chat'         THEN 60
    WHEN 'ocr-scan'             THEN 20
    WHEN 'radar-ai'             THEN 20
    WHEN 'analyze-meal'         THEN 20
    WHEN 'generate-diet-plan'   THEN 10
    WHEN 'realtime-session'     THEN 10
    WHEN 'enrich-product'       THEN 50
    WHEN 'library-ai-assistant' THEN 40
    WHEN 'library-ai-chat'      THEN 60
    WHEN 'library-ai-writing-assistant' THEN 40
    WHEN 'voice-studio-clone'   THEN 5
    WHEN 'speech-generate'      THEN 20
    WHEN 'file-convert'         THEN 10
    WHEN 'ai-generate'          THEN 30
    WHEN 'analyze-image'        THEN 20
    WHEN 'speech-transcribe'    THEN 30
    WHEN 'image-generate'       THEN 20
    WHEN 'image-tools-generate' THEN 20
    WHEN 'video-studio'         THEN 5
    WHEN 'library-content-search' THEN 300
    ELSE 30
  END;

  SELECT COUNT(*) INTO _daily_count
  FROM public.ai_usage_log
  WHERE user_id       = _user_id
    AND function_name = _function_name
    AND created_at   >= current_date::timestamptz
    AND created_at   <  (current_date + interval '1 day')::timestamptz;

  IF _daily_count >= _daily_limit THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.ai_usage_log (user_id, function_name)
  VALUES (_user_id, _function_name);

  DELETE FROM public.ai_usage_log
  WHERE user_id = _user_id
    AND created_at < now() - interval '48 hours';

  RETURN TRUE;
END;
$$;


COMMENT ON FUNCTION public.check_ai_rate_limit(UUID, TEXT) IS
  'Per user, per function, per day, serialised per (user, function) by an advisory lock. Counts and records in ai_usage_log, prunes past 48h. The CASE holds every ceiling; a function not named here gets 30, and a function that never calls this gets none.';

REVOKE ALL ON FUNCTION public.check_ai_rate_limit(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID, TEXT) TO service_role;

CREATE TABLE IF NOT EXISTS public.library_external_provider_health (
  provider_id   TEXT PRIMARY KEY CHECK (provider_id ~ '^[a-z0-9_]{2,40}$'),
  state         TEXT NOT NULL CHECK (state IN ('healthy', 'degraded', 'down', 'not_configured')),
  latency_ms    INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  result_count  INTEGER NOT NULL DEFAULT 0 CHECK (result_count >= 0),
  error_code    TEXT CHECK (error_code IS NULL OR error_code IN ('timeout', 'rate_limited', 'http_error', 'network', 'invalid_response', 'not_configured')),
  checked_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.library_external_provider_health IS
  'Last health check per external content provider. Written by library-research-assistant (content_health, admin-only) with the service role; readable by admins only. Codes, never keys, URLs or queries.';

ALTER TABLE public.library_external_provider_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read provider health" ON public.library_external_provider_health;
CREATE POLICY "Admins read provider health"
  ON public.library_external_provider_health
  FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::public.app_role)));

-- No INSERT/UPDATE/DELETE policy on purpose: only the service role writes.
REVOKE ALL ON public.library_external_provider_health FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.library_external_provider_health FROM authenticated;
GRANT SELECT ON public.library_external_provider_health TO authenticated;
GRANT ALL ON public.library_external_provider_health TO service_role;
