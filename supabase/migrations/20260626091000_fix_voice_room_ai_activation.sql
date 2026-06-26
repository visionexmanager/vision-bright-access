-- Fix voice-room AI activation billing.
-- The prior function passed spend_vx item_id/item_name in the wrong order.

CREATE OR REPLACE FUNCTION public.activate_voice_room_ai()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _is_admin boolean := false;
  _is_trial boolean := false;
  _has_purchase boolean := false;
  _price integer := 10000;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT public.has_role(_user_id, 'admin') INTO _is_admin;

  SELECT COALESCE(trial_expires_at, created_at + INTERVAL '30 days') > now()
  INTO _is_trial
  FROM public.profiles
  WHERE user_id = _user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.voice_room_ai_purchases WHERE user_id = _user_id
  ) INTO _has_purchase;

  IF _is_admin THEN
    RETURN jsonb_build_object('enabled', true, 'source', 'admin', 'charged_vx', 0);
  END IF;

  IF COALESCE(_is_trial, false) THEN
    RETURN jsonb_build_object('enabled', true, 'source', 'trial', 'charged_vx', 0);
  END IF;

  IF _has_purchase THEN
    RETURN jsonb_build_object('enabled', true, 'source', 'purchased', 'charged_vx', 0);
  END IF;

  PERFORM public.spend_vx(
    _price,
    'voice_room_ai',
    'visionex-ai-room-companion',
    'Visionex AI voice room companion'
  );

  INSERT INTO public.voice_room_ai_purchases (user_id, price_vx, source)
  VALUES (_user_id, _price, 'vx')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('enabled', true, 'source', 'purchased', 'charged_vx', _price);
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_voice_room_ai() TO authenticated;
