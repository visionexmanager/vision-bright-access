-- Limits on seller notifications triggered by a signed-in user.
--
-- `bazaar-notify-seller` let ANY signed-in account, for ANY shop id, create an in-app
-- notification, send an e-mail through Resend (a paid provider) and send a WhatsApp
-- message to the seller's number (Meta may bill outbound messages), all carrying text the
-- caller chose, with no limit of any kind. It also accepted `order_paid` and
-- `order_status` from anyone, so a stranger could tell a seller that an order had been
-- paid.
--
-- This migration adds the ledger and the single atomic decision the function now asks
-- before it does anything for a user-triggered event:
--
--   bazaar_notify_claim(user, shop, event, product, key)
--     -> { allowed, reason, external }
--
-- Rules (conservative; a normal buyer never meets them):
--   * the same user, shop, event, product and key within 10 minutes is a duplicate
--     (distinct orders carry distinct keys, so two real orders are both announced);
--   * at most 5 notifications per user per shop per hour;
--   * at most 30 notifications per user per day across all shops;
--   * `external` (e-mail and WhatsApp, the channels that cost money and reach a person
--     outside the site) is granted to at most 20 notifications per shop per hour across
--     ALL senders, so many accounts cannot flood one seller or one bill. The in-app
--     notification is not subject to the shop-wide external cap.
--
-- The decision and the insert are one transaction under advisory locks (shop first, then
-- user, a fixed order), so concurrent requests cannot all read the same count and pass.
-- Service-role-only: RLS on with no policy, and no grant to anon or authenticated.
-- Calls from the platform itself (the Stripe webhook, bearer = service role) are not
-- claimed and are not limited.
--
-- Idempotent. Rows older than 7 days for the shop are pruned on each claim.
-- Rollback (no data of value is lost: it is a rolling ledger):
--   DROP FUNCTION IF EXISTS public.bazaar_notify_claim(uuid, uuid, text, uuid, text);
--   DROP TABLE IF EXISTS public.bazaar_notification_log;
-- Reverting the Edge Function afterwards restores the unlimited behaviour.

CREATE TABLE IF NOT EXISTS public.bazaar_notification_log (
  id          bigserial PRIMARY KEY,
  user_id     uuid        NOT NULL,
  shop_id     uuid        NOT NULL,
  event_type  text        NOT NULL,
  product_id  uuid,
  dedupe_key  text,
  external    boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bazaar_notification_log_shop_idx ON public.bazaar_notification_log (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bazaar_notification_log_user_idx ON public.bazaar_notification_log (user_id, created_at DESC);

ALTER TABLE public.bazaar_notification_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bazaar_notification_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.bazaar_notification_log TO service_role;
REVOKE ALL ON SEQUENCE public.bazaar_notification_log_id_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON SEQUENCE public.bazaar_notification_log_id_seq TO service_role;

COMMENT ON TABLE public.bazaar_notification_log IS
  'Rolling ledger of user-triggered seller notifications, written only by bazaar_notify_claim(). RLS on with NO policy on purpose: service role only. Do not add a read policy.';

CREATE OR REPLACE FUNCTION public.bazaar_notify_claim(
  _user_id    uuid,
  _shop_id    uuid,
  _event_type text,
  _product_id uuid DEFAULT NULL,
  _key        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _per_shop_hour   constant integer := 5;
  _per_user_day    constant integer := 30;
  _external_hour   constant integer := 20;
  _n               integer;
  _external        boolean;
BEGIN
  IF _user_id IS NULL OR _shop_id IS NULL OR _event_type IS NULL OR btrim(_event_type) = '' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid', 'external', false);
  END IF;

  -- Fixed order (shop, then user): no two callers can wait on each other.
  PERFORM pg_advisory_xact_lock(hashtextextended('bazaar_notify:shop:' || _shop_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('bazaar_notify:user:' || _user_id::text, 0));

  DELETE FROM public.bazaar_notification_log
   WHERE shop_id = _shop_id AND created_at < now() - interval '7 days';

  SELECT count(*) INTO _n
    FROM public.bazaar_notification_log
   WHERE user_id = _user_id AND shop_id = _shop_id AND event_type = _event_type
     AND product_id IS NOT DISTINCT FROM _product_id
     AND dedupe_key IS NOT DISTINCT FROM _key
     AND created_at > now() - interval '10 minutes';
  IF _n > 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'duplicate', 'external', false);
  END IF;

  SELECT count(*) INTO _n
    FROM public.bazaar_notification_log
   WHERE user_id = _user_id AND shop_id = _shop_id AND created_at > now() - interval '1 hour';
  IF _n >= _per_shop_hour THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'user_shop_rate', 'external', false);
  END IF;

  SELECT count(*) INTO _n
    FROM public.bazaar_notification_log
   WHERE user_id = _user_id AND created_at > now() - interval '1 day';
  IF _n >= _per_user_day THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'user_daily', 'external', false);
  END IF;

  SELECT count(*) INTO _n
    FROM public.bazaar_notification_log
   WHERE shop_id = _shop_id AND external AND created_at > now() - interval '1 hour';
  _external := _n < _external_hour;

  INSERT INTO public.bazaar_notification_log (user_id, shop_id, event_type, product_id, dedupe_key, external)
  VALUES (_user_id, _shop_id, _event_type, _product_id, _key, _external);

  RETURN jsonb_build_object('allowed', true, 'reason', 'ok', 'external', _external);
END;
$$;

COMMENT ON FUNCTION public.bazaar_notify_claim(uuid, uuid, text, uuid, text) IS
  'Atomic limit and ledger for a user-triggered seller notification: 10-minute duplicate window, 5 per user per shop per hour, 30 per user per day, and e-mail/WhatsApp for at most 20 per shop per hour across all senders. Service role only.';

REVOKE ALL ON FUNCTION public.bazaar_notify_claim(uuid, uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bazaar_notify_claim(uuid, uuid, text, uuid, text) TO service_role;
