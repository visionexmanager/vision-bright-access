-- An optional, configurable, database-wide budget for the WhatsApp subscription notice.
--
-- 20261082 bounds the notice PER NUMBER (the first, then at most six re-notices a day). It does
-- not bound the AGGREGATE: many different numbers each get a first notice, so a flood from many
-- distinct senders produces many outbound messages, and Meta may bill outbound service messages
-- beyond a free allowance whose size and rate for these markets are not verified. This adds the
-- missing aggregate control, without inventing a number:
--
--   ops_limits('whatsapp_notice_global_per_hour')
--       absent / NULL  -> no global limit: exactly today's behaviour (the default)
--       0              -> kill switch: no notice is sent at all
--       N              -> at most N notices (first notices and re-notices together) in any
--                         rolling hour, across every sender
--
-- To set it (service role / SQL editor; a business decision, not made here):
--   INSERT INTO public.ops_limits (key, value_int, note)
--   VALUES ('whatsapp_notice_global_per_hour', 60, 'proposed')
--   ON CONFLICT (key) DO UPDATE SET value_int = EXCLUDED.value_int, updated_at = now();
-- and to remove the limit again:
--   DELETE FROM public.ops_limits WHERE key = 'whatsapp_notice_global_per_hour';
--
-- When the budget is spent the sender is refused silently ('blocked_silent'): no notice is sent,
-- and a first notice that was claimed is handed back (its row deleted) so the number is told as
-- soon as budget returns. The check, the claim and the counter are one transaction under one
-- advisory lock (only taken when a limit is configured), so concurrent messages cannot spend the
-- same slot twice. If the limit row cannot be read the function raises, the webhook treats that as
-- "unavailable", and nothing is sent: the notice fails CLOSED. The typed account-linking flow does
-- not use this function's verdict to send anything and is unaffected.
--
-- `whatsapp_notice_log` holds only a timestamp and a kind per notice: no number, no text, no
-- account. It is the aggregate counter (select kind, count(*) ... group by 1) and prunes itself.
--
-- Also: the number is normalised to digits for the notice key and the identity lookup, so
-- "+96170000000" and "96170000000" are one sender (every existing notice row is already digits-only).
--
-- Idempotent. Rollback (restores the 20261082 behaviour; no data of value is lost):
--   re-create ai_subscription_gate_whatsapp from 20261082000000_whatsapp_notice_daily_cap.sql, then
--   DROP TABLE IF EXISTS public.whatsapp_notice_log;
--   DROP TABLE IF EXISTS public.ops_limits;   -- only if nothing else has started to use it

CREATE TABLE IF NOT EXISTS public.ops_limits (
  key         text PRIMARY KEY,
  value_int   integer CHECK (value_int IS NULL OR value_int >= 0),
  note        text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ops_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ops_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ops_limits TO service_role;
COMMENT ON TABLE public.ops_limits IS
  'Owner-set operational ceilings, one integer per key. No row = no limit. RLS on with NO policy on purpose: service role only.';

CREATE TABLE IF NOT EXISTS public.whatsapp_notice_log (
  id       bigserial PRIMARY KEY,
  sent_at  timestamptz NOT NULL DEFAULT now(),
  kind     text        NOT NULL CHECK (kind IN ('first', 'renotice'))
);
CREATE INDEX IF NOT EXISTS whatsapp_notice_log_sent_at_idx ON public.whatsapp_notice_log (sent_at DESC);
ALTER TABLE public.whatsapp_notice_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_notice_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.whatsapp_notice_log TO service_role;
REVOKE ALL ON SEQUENCE public.whatsapp_notice_log_id_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON SEQUENCE public.whatsapp_notice_log_id_seq TO service_role;
COMMENT ON TABLE public.whatsapp_notice_log IS
  'One row per WhatsApp subscription notice allowed while a global budget is configured: a timestamp and a kind, never a number or text. Written only by ai_subscription_gate_whatsapp(). Service role only.';

CREATE OR REPLACE FUNCTION public.ai_subscription_gate_whatsapp(_wa_phone text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _norm      text;
  _user_id   uuid;
  _verdict   text;
  _renoticed integer;
  _cap       integer;
  _used      integer;
BEGIN
  IF _wa_phone IS NULL OR btrim(_wa_phone) = '' THEN RETURN 'blocked_silent'; END IF;
  _norm := regexp_replace(_wa_phone, '[^0-9]', '', 'g');
  IF _norm = '' THEN RETURN 'blocked_silent'; END IF;

  IF public.whatsapp_is_owner_number(_wa_phone) THEN
    DELETE FROM public.ai_subscription_gate_notices
     WHERE channel = 'whatsapp' AND subject IN (_wa_phone, _norm);
    RETURN 'authorized';
  END IF;

  SELECT i.user_id INTO _user_id
    FROM public.whatsapp_identities i
   WHERE (i.wa_phone = _wa_phone OR regexp_replace(i.wa_phone, '[^0-9]', '', 'g') = _norm)
     AND i.user_id IS NOT NULL
   LIMIT 1;

  -- A linked account inside its free week: refused, and never told by message (20261079).
  IF _user_id IS NOT NULL AND public.plan_for_user(_user_id) = 'free_trial' THEN
    RETURN 'blocked_silent';
  END IF;

  -- The optional aggregate budget. Absent = no limit (today's behaviour).
  SELECT value_int INTO _cap FROM public.ops_limits WHERE key = 'whatsapp_notice_global_per_hour';

  _verdict := public.ai_subscription_gate('whatsapp', _norm, _user_id);

  IF _verdict = 'blocked_first_notice' THEN
    -- A first notice has just been claimed. Spend a slot of the budget, or hand the claim back.
    IF _cap IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(hashtextextended('whatsapp_notice_global', 0));
      DELETE FROM public.whatsapp_notice_log WHERE sent_at < now() - interval '2 days';
      SELECT count(*) INTO _used FROM public.whatsapp_notice_log WHERE sent_at > now() - interval '1 hour';
      IF _used >= _cap THEN
        DELETE FROM public.ai_subscription_gate_notices WHERE channel = 'whatsapp' AND subject = _norm;
        RETURN 'blocked_silent';
      END IF;
      INSERT INTO public.whatsapp_notice_log (kind) VALUES ('first');
    END IF;
    RETURN 'blocked_first_notice';
  END IF;

  IF _verdict = 'blocked_silent' THEN
    IF _cap IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(hashtextextended('whatsapp_notice_global', 0));
      SELECT count(*) INTO _used FROM public.whatsapp_notice_log WHERE sent_at > now() - interval '1 hour';
      IF _used >= _cap THEN RETURN 'blocked_silent'; END IF;
    END IF;

    UPDATE public.ai_subscription_gate_notices
       SET notified_at = now(),
           renotice_count = CASE
             WHEN renotice_window_start IS NULL OR renotice_window_start < now() - interval '24 hours' THEN 1
             ELSE renotice_count + 1 END,
           renotice_window_start = CASE
             WHEN renotice_window_start IS NULL OR renotice_window_start < now() - interval '24 hours' THEN now()
             ELSE renotice_window_start END
     WHERE channel = 'whatsapp'
       AND subject = _norm
       AND notified_at < now() - interval '10 minutes'
       AND (renotice_window_start IS NULL
            OR renotice_window_start < now() - interval '24 hours'
            OR renotice_count < 6);
    GET DIAGNOSTICS _renoticed = ROW_COUNT;
    IF _renoticed = 1 THEN
      IF _cap IS NOT NULL THEN INSERT INTO public.whatsapp_notice_log (kind) VALUES ('renotice'); END IF;
      RETURN 'blocked_first_notice';
    END IF;
  END IF;

  RETURN _verdict;
END;
$$;

COMMENT ON FUNCTION public.ai_subscription_gate_whatsapp(text) IS
  'ai_subscription_gate for a WhatsApp sender (number normalised to digits): owner handset, else the account proved by whatsapp_identities, else not entitled. A linked free-week account is refused silently. Any other unentitled sender gets the static notice on its first message and at most six re-notices in a rolling 24 hours, and, when ops_limits(whatsapp_notice_global_per_hour) is set, only while that database-wide hourly budget lasts.';

REVOKE ALL ON FUNCTION public.ai_subscription_gate_whatsapp(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_subscription_gate_whatsapp(text) TO service_role;
