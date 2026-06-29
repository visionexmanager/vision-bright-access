-- Make Visionex AI free for all users in voice rooms.
-- The 10,000 VX charge is removed; every authenticated user can activate.

CREATE OR REPLACE FUNCTION public.activate_voice_room_ai()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.voice_room_ai_purchases (user_id, price_vx, source)
  VALUES (_user_id, 0, 'free')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object('enabled', true, 'source', 'free', 'charged_vx', 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_voice_room_ai() TO authenticated;
