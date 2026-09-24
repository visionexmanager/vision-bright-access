-- Phase 2F-2: per-user ceilings on every paid-provider function a user can
-- reach, and a ceiling that concurrent requests cannot walk past.
--
-- ── The race this closes ────────────────────────────────────────────────────
--
-- `check_ai_rate_limit` counted today's rows, compared, then inserted. Two
-- requests from the same user arriving together both counted N-1, both passed
-- and both inserted: a ceiling of 5 video jobs was a ceiling of 5 *sequential*
-- jobs, and any number fired at once. The count-then-insert now runs under a
-- transaction-scoped advisory lock keyed on (user, function), so one caller's
-- concurrent requests queue behind each other for the few milliseconds the
-- check takes, and every other caller is untouched. The lock releases with the
-- RPC's own transaction; nothing can hold it past the call.
--
-- ── The new rows ────────────────────────────────────────────────────────────
--
-- Six edge functions already had a ceiling in this CASE and never called the
-- RPC (academy-chat, radar-ai, analyze-meal, generate-diet-plan,
-- realtime-session, and enrich-product — which is admin-only since #327 and
-- stays unwired). Five more call a paid provider and had no row at all. Their
-- numbers come off the bands the previous migration wrote down:
--
--   ai-generate           30  one structured generation — the default, named
--   analyze-image         20  one vision call, one answer — the radar-ai band
--   speech-transcribe     30  short voice clips, cheaper than a TTS asset
--   image-generate        20  one provider call, one stored image
--   image-tools-generate  20  one Replicate prediction, one stored image
--   video-studio           5  a video job is the most expensive thing Visionex
--                             submits — the voice-cloning band
--
-- `video-studio` and `image-tools-generate` are charged on job submission only;
-- polling, cancelling and deleting a job never reach this function.
--
-- These are ceilings on abuse, not prices. Nothing here reads or writes VX.

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
