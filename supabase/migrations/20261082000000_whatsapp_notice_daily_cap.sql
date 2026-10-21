-- A WhatsApp number is reminded at most six times a day, not up to 144.
--
-- Exactly when a sender receives the static subscription notice (ai_subscription_gate_whatsapp,
-- as 20261075 + 20261079 define it):
--   * an UNLINKED number (no whatsapp_identities row with an account): on its first message,
--     because it is the only way a subscriber learns the next step (link the number);
--   * a LINKED account whose free week has ended and has no active paid plan: same;
--   * a LINKED account in its free week: never (20261079);
--   * an active paid account, or the owner handset: it is authorized, no notice.
-- Any inbound message kind (text, voice note, picture) is judged the same way; the notice itself
-- is always a plain text message, never synthesised speech.
--
-- After the first notice the sender is silent, then re-told after 10 minutes of writing again
-- (20261075). Unbounded, that is up to 144 outbound messages a day to one number, and Meta may
-- bill outbound service messages beyond a free allowance whose size and rate for these markets are
-- not verified on its own pages. This migration bounds the re-telling:
--
--   * a re-notice happens only if 10 minutes have passed since the last notice AND fewer than 6
--     re-notices have been sent to that number in the current rolling 24 hours;
--   * the first notice to a new number is unaffected, and so is account linking: the typed
--     "link"/"unlink" flow does not go through the notice at all;
--   * an entitled or free-week verdict is unchanged.
--
-- So one number can receive at most 7 notices in a day (the first and six re-notices). The claim is
-- still one UPDATE ... WHERE, so concurrent messages race on the row lock and at most one wins.
-- Many different numbers each get their first notice: that is bounded by real senders (the
-- webhook verifies Meta's signature on every delivery) and is not capped here.
--
-- Idempotent. Adds two nullable-default columns to ai_subscription_gate_notices.
-- Rollback: re-create ai_subscription_gate_whatsapp from
-- 20261079000000_whatsapp_no_notice_for_free_week.sql; the two columns may stay (unused) or be
-- dropped with
--   ALTER TABLE public.ai_subscription_gate_notices DROP COLUMN IF EXISTS renotice_count, DROP COLUMN IF EXISTS renotice_window_start;

ALTER TABLE public.ai_subscription_gate_notices
  ADD COLUMN IF NOT EXISTS renotice_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS renotice_window_start timestamptz;

CREATE OR REPLACE FUNCTION public.ai_subscription_gate_whatsapp(_wa_phone text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _user_id uuid;
  _verdict text;
  _renoticed integer;
BEGIN
  IF _wa_phone IS NULL OR btrim(_wa_phone) = '' THEN RETURN 'blocked_silent'; END IF;

  IF public.whatsapp_is_owner_number(_wa_phone) THEN
    DELETE FROM public.ai_subscription_gate_notices
     WHERE channel = 'whatsapp' AND subject = _wa_phone;
    RETURN 'authorized';
  END IF;

  SELECT i.user_id INTO _user_id
    FROM public.whatsapp_identities i
   WHERE i.wa_phone = _wa_phone
     AND i.user_id IS NOT NULL;

  -- A linked account inside its free week: refused, and never told by message (20261079).
  IF _user_id IS NOT NULL AND public.plan_for_user(_user_id) = 'free_trial' THEN
    RETURN 'blocked_silent';
  END IF;

  _verdict := public.ai_subscription_gate('whatsapp', _wa_phone, _user_id);

  IF _verdict = 'blocked_silent' THEN
    UPDATE public.ai_subscription_gate_notices
       SET notified_at = now(),
           renotice_count = CASE
             WHEN renotice_window_start IS NULL OR renotice_window_start < now() - interval '24 hours' THEN 1
             ELSE renotice_count + 1 END,
           renotice_window_start = CASE
             WHEN renotice_window_start IS NULL OR renotice_window_start < now() - interval '24 hours' THEN now()
             ELSE renotice_window_start END
     WHERE channel = 'whatsapp'
       AND subject = _wa_phone
       AND notified_at < now() - interval '10 minutes'
       AND (renotice_window_start IS NULL
            OR renotice_window_start < now() - interval '24 hours'
            OR renotice_count < 6);
    GET DIAGNOSTICS _renoticed = ROW_COUNT;
    IF _renoticed = 1 THEN RETURN 'blocked_first_notice'; END IF;
  END IF;

  RETURN _verdict;
END;
$$;

COMMENT ON FUNCTION public.ai_subscription_gate_whatsapp(text) IS
  'ai_subscription_gate for a WhatsApp sender: owner handset, else the account proved by whatsapp_identities, else not entitled. A linked account in its free week is refused silently. Any other unentitled sender gets the static notice on its first message and at most six re-notices (10 minutes apart) in a rolling 24 hours.';

REVOKE ALL ON FUNCTION public.ai_subscription_gate_whatsapp(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_subscription_gate_whatsapp(text) TO service_role;
