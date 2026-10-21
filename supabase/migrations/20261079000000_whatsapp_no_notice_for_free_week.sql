-- A WhatsApp sender whose linked account is in its free week is never sent the
-- subscription notice.
--
-- Why: the notice is an outbound WhatsApp message, and since 2026-10-01 Meta
-- bills delivered service messages beyond 1,000 a month per business number.
-- The rate for Visionex's markets is not verified, so the exposure of sending
-- notices to accounts that cannot become paying customers by reading one cannot
-- be ruled out. A linked free-week account already has an account and a plan
-- page; the notice adds nothing a person can act on in the chat, and it is the
-- one message the webhook sent to them unprompted.
--
-- What does NOT change:
--   * the notice for a paid-but-not-yet-linked number, and for any unlinked
--     number, exactly as 20261075 made it (first message, then at most once per
--     10 minutes). Such a sender cannot be told apart from a subscriber who has
--     not linked yet, and linking is the only way out.
--   * an entitled sender is authorized, an owner handset is authorized.
--   * no model, no provider and no VX is reached for anyone refused.
--
-- A free-week sender is answered 'blocked_silent' before the shared gate is
-- called, so no notice row is created and no renotice clock starts. The
-- webhook's separate account-linking turn (typed "link" / "unlink") is
-- unchanged: it is user-initiated, one reply per message.
--
-- Idempotent (CREATE OR REPLACE). Writes no row. Rollback: re-create the
-- function from 20261075000000_whatsapp_gate_renotice.sql.

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

  -- A linked account inside its free week: refused, and never told by message.
  IF _user_id IS NOT NULL AND public.plan_for_user(_user_id) = 'free_trial' THEN
    RETURN 'blocked_silent';
  END IF;

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
  'ai_subscription_gate for a WhatsApp sender: owner handset, else the account proved by whatsapp_identities, else not entitled. A linked account in its free week is refused silently and never sent the notice (Meta may bill outbound service messages). Any other unentitled sender is re-sent the static notice at most once per 10 minutes.';

REVOKE ALL ON FUNCTION public.ai_subscription_gate_whatsapp(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_subscription_gate_whatsapp(text) TO service_role;
