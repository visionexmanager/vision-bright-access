-- ── AI Usage Tracking & Rate Limiting ──────────────────────────────────────
-- Tracks per-user, per-function daily usage to prevent API abuse.

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name TEXT        NOT NULL CHECK (char_length(function_name) <= 50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup: user + function + today
CREATE INDEX idx_ai_usage_user_fn_date
  ON public.ai_usage_log(user_id, function_name, created_at DESC);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Users can only see their own rows
CREATE POLICY "ai_usage_own_select"
  ON public.ai_usage_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ── RPC: check_ai_rate_limit ──────────────────────────────────────────────
-- Called from edge functions using service-role client.
-- _user_id is verified by the edge function before calling this.
-- Returns TRUE (allowed) or FALSE (rate limit exceeded).
--
-- Daily limits per function:
--   ai-chat / academy-chat  → 60
--   ocr-scan / radar-ai / analyze-meal → 20
--   generate-diet-plan / realtime-session → 10
--   enrich-product → 50
--   default → 30
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
  -- Per-function daily limits
  _daily_limit := CASE _function_name
    WHEN 'ai-chat'            THEN 60
    WHEN 'academy-chat'       THEN 60
    WHEN 'ocr-scan'           THEN 20
    WHEN 'radar-ai'           THEN 20
    WHEN 'analyze-meal'       THEN 20
    WHEN 'generate-diet-plan' THEN 10
    WHEN 'realtime-session'   THEN 10
    WHEN 'enrich-product'     THEN 50
    ELSE 30
  END;

  -- Count today's usage for this user + function
  SELECT COUNT(*) INTO _daily_count
  FROM public.ai_usage_log
  WHERE user_id       = _user_id
    AND function_name = _function_name
    AND created_at   >= current_date::timestamptz
    AND created_at   <  (current_date + interval '1 day')::timestamptz;

  IF _daily_count >= _daily_limit THEN
    RETURN FALSE;
  END IF;

  -- Log this request
  INSERT INTO public.ai_usage_log (user_id, function_name)
  VALUES (_user_id, _function_name);

  -- Opportunistically clean rows older than 48 h for this user
  DELETE FROM public.ai_usage_log
  WHERE user_id = _user_id
    AND created_at < now() - interval '48 hours';

  RETURN TRUE;
END;
$$;

-- Service role calls this on behalf of users — no need for authenticated grant
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID, TEXT) TO service_role;
