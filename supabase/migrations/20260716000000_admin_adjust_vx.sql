-- admin_adjust_vx — grant or revoke VX (points) for a user by email, from the
-- admin VX panel (src/pages/admin/AdminVX.tsx). VX balance is the sum of
-- public.user_points rows for a user (see src/hooks/usePoints.ts) — there is
-- no standalone balance column, so this inserts a signed row rather than
-- updating a counter. Supports negative amounts (revoke), unlike
-- admin_give_vx which only supports positive grants.

CREATE OR REPLACE FUNCTION public.admin_adjust_vx(
  p_email  text,
  p_points integer,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller             uuid := auth.uid();
  _target_user_id     uuid;
  _target_display_name text;
  _new_balance        numeric;
BEGIN
  IF NOT public.has_role(_caller, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Forbidden: admins only');
  END IF;

  IF p_points = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Amount must not be zero');
  END IF;

  SELECT id INTO _target_user_id FROM auth.users WHERE lower(email) = lower(p_email);
  IF _target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  INSERT INTO public.user_points (user_id, points, reason)
  VALUES (
    _target_user_id,
    p_points,
    COALESCE(NULLIF(p_reason, ''), CASE WHEN p_points > 0 THEN 'Admin grant' ELSE 'Admin deduction' END)
  );

  SELECT COALESCE(SUM(points), 0) INTO _new_balance
  FROM public.user_points
  WHERE user_id = _target_user_id;

  SELECT display_name INTO _target_display_name
  FROM public.profiles
  WHERE user_id = _target_user_id;

  INSERT INTO public.admin_logs (admin_id, action, target_type, target_id, details)
  VALUES (
    _caller, 'adjust_vx', 'user', _target_user_id::text,
    jsonb_build_object('amount', p_points, 'reason', p_reason)
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_display_name', COALESCE(_target_display_name, p_email),
    'new_balance', _new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_vx(text, integer, text) TO authenticated;
