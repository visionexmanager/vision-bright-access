-- A notification that names a specific order is deduplicated for a day, not ten minutes.
--
-- 20261081 treats the same user, shop, event, product and key within 10 minutes as a duplicate. For
-- `order_paid` the key is the ORDER id (the function verifies the caller owns a recent paid order),
-- and an order is announced to its seller once. With a 10-minute window a buyer holding one real
-- order could have it announced again every ten minutes for as long as the function accepts it (30
-- minutes), and the seller would read "New paid order" three times for one order. A keyed event is
-- one event: it is now a duplicate for 24 hours. Unkeyed events (messages, wishlist, add to cart,
-- reviews, disputes) keep the 10-minute window, and every ceiling is unchanged.
--
-- Idempotent (CREATE OR REPLACE). Writes nothing. Rollback: re-create bazaar_notify_claim from
-- 20261081000000_bazaar_notify_limits.sql (this only restores the 10-minute window for keyed events).

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
  _dup_window      interval;
BEGIN
  IF _user_id IS NULL OR _shop_id IS NULL OR _event_type IS NULL OR btrim(_event_type) = '' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid', 'external', false);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('bazaar_notify:shop:' || _shop_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('bazaar_notify:user:' || _user_id::text, 0));

  DELETE FROM public.bazaar_notification_log
   WHERE shop_id = _shop_id AND created_at < now() - interval '7 days';

  _dup_window := CASE WHEN _key IS NULL THEN interval '10 minutes' ELSE interval '24 hours' END;

  SELECT count(*) INTO _n
    FROM public.bazaar_notification_log
   WHERE user_id = _user_id AND shop_id = _shop_id AND event_type = _event_type
     AND product_id IS NOT DISTINCT FROM _product_id
     AND dedupe_key IS NOT DISTINCT FROM _key
     AND created_at > now() - _dup_window;
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
  'Atomic limit and ledger for a user-triggered seller notification: duplicate window of 10 minutes (24 hours when the event names an order), 5 per user per shop per hour, 30 per user per day, and e-mail/WhatsApp for at most 20 per shop per hour across all senders. Service role only.';

REVOKE ALL ON FUNCTION public.bazaar_notify_claim(uuid, uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bazaar_notify_claim(uuid, uuid, text, uuid, text) TO service_role;
