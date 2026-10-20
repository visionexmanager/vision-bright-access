-- A WhatsApp sender who is not entitled is no longer ignored for ever.
--
-- ai_subscription_gate told each number once and then returned
-- 'blocked_silent' for every later message. Two real senders hit that wall
-- (2026-10-18 and 2026-10-19): the first message got the notice, and then
-- "Menu", "I subscribed, send me the menu", two voice notes and "Hi" got
-- nothing at all. To a person who has subscribed but whose number is not
-- linked yet, that is indistinguishable from a broken bot, and a blind sender
-- has no other signal.
--
-- Still no model, no provider and no VX: the reply is the same static notice
-- (which names the «link account» step). It is just no longer one-shot. After
-- ten minutes of the same unentitled number writing again, it is told again.
-- The claim is one UPDATE ... WHERE notified_at < threshold, so concurrent
-- messages race on the row lock and exactly one of them wins the notice.
--
-- Scoped to WhatsApp: the shared ai_subscription_gate is unchanged, so the web
-- and Meta channels keep their one-notice behaviour.

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

  _verdict := public.ai_subscription_gate('whatsapp', _wa_phone, _user_id);

  IF _verdict = 'blocked_silent' THEN
    UPDATE public.ai_subscription_gate_notices
       SET notified_at = now()
     WHERE channel = 'whatsapp'
       AND subject = _wa_phone
       AND notified_at < now() - interval '10 minutes';
    GET DIAGNOSTICS _renoticed = ROW_COUNT;
    IF _renoticed = 1 THEN RETURN 'blocked_first_notice'; END IF;
  END IF;

  RETURN _verdict;
END;
$$;

COMMENT ON FUNCTION public.ai_subscription_gate_whatsapp(text) IS
  'ai_subscription_gate for a WhatsApp sender: owner handset, else the account proved by whatsapp_identities, else not entitled. An unentitled sender is re-sent the static notice at most once per 10 minutes instead of being ignored for ever.';

REVOKE ALL ON FUNCTION public.ai_subscription_gate_whatsapp(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_subscription_gate_whatsapp(text) TO service_role;
