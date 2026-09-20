-- Two functions that could be called without limit, given the limit everything
-- else already has.
--
-- `check_ai_rate_limit` has counted per user per function per day since
-- 20260602, against `ai_usage_log`, with a CASE of per-function ceilings and a
-- default of 30. `speech-generate` and `file-convert` never called it, so
-- neither had any ceiling at all — not even the default, which only applies to
-- functions that ask.
--
-- This adds two rows to that CASE. No new table, no second counter, no parallel
-- mechanism: the two functions now call the same RPC every other metered
-- endpoint calls.
--
-- ── Why 20 and 10 ───────────────────────────────────────────────────────────
--
-- Read off the bands already in the table rather than invented:
--
--   60  ai-chat, academy-chat, library-ai-chat      a conversational turn
--   40–50  enrich-product, library-ai-assistant     an assisted edit
--   20  ocr-scan, radar-ai, analyze-meal            one provider call, one artifact
--   10  generate-diet-plan, realtime-session        slow and heavyweight
--    5  voice-studio-clone                          trains a model
--
-- `speech-generate` is one provider TTS call, bounded at 4,096 characters,
-- producing one stored audio asset — the same shape as `ocr-scan`, so the same
-- number: **20**. It is not the 5 band; that is for cloning, which trains a
-- voice model from uploaded samples.
--
-- `file-convert` is the only one of the four that spends *our* CPU rather than
-- a provider's. It accepts up to `MAX_CONVERT_UPLOAD_BYTES` — 16 MB — and its
-- targets include video and archive formats, transcoded on the same VPS that
-- serves the website. Its own header describes a conversion as "90 s of four
-- dedicated cores shared with the website itself". That belongs in the
-- heavyweight band beside `realtime-session`: **10**. Ten full-size transcodes
-- a day is far beyond any real File Studio session and far short of what would
-- hurt the box.
--
-- Both are ceilings on abuse, not on use. Neither charges VX; these two
-- functions remain outside the VX economy in this change.

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
    -- One provider call, one stored asset, 4,096 characters — the ocr-scan band.
    WHEN 'speech-generate'      THEN 20
    -- 16 MB of our own CPU, video included — the heavyweight band.
    WHEN 'file-convert'         THEN 10
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
  'Per user, per function, per day. Counts and records in ai_usage_log, prunes past 48h. The CASE holds every ceiling; a function not named here gets 30, and a function that never calls this gets none.';

REVOKE ALL ON FUNCTION public.check_ai_rate_limit(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID, TEXT) TO service_role;
