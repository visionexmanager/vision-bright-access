-- Messenger and Instagram senders get the same treatment as WhatsApp
-- (20261075): the subscription notice is re-sent at most once per 10 minutes
-- instead of the sender being ignored for ever after the first one. The shared
-- ai_subscription_gate is unchanged; this wrapper only re-arms the notice row.
-- Static text, no model, no VX.

CREATE OR REPLACE FUNCTION public.ai_subscription_gate_meta(_sender_id text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _verdict text;
  _renoticed integer;
BEGIN
  IF _sender_id IS NULL OR btrim(_sender_id) = '' THEN RETURN 'blocked_silent'; END IF;

  _verdict := public.ai_subscription_gate('meta', _sender_id, NULL);

  IF _verdict = 'blocked_silent' THEN
    UPDATE public.ai_subscription_gate_notices
       SET notified_at = now()
     WHERE channel = 'meta'
       AND subject = _sender_id
       AND notified_at < now() - interval '10 minutes';
    GET DIAGNOSTICS _renoticed = ROW_COUNT;
    IF _renoticed = 1 THEN RETURN 'blocked_first_notice'; END IF;
  END IF;

  RETURN _verdict;
END;
$$;

COMMENT ON FUNCTION public.ai_subscription_gate_meta(text) IS
  'ai_subscription_gate for a Messenger/Instagram sender, re-sending the static notice at most once per 10 minutes.';

REVOKE ALL ON FUNCTION public.ai_subscription_gate_meta(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_subscription_gate_meta(text) TO service_role;
