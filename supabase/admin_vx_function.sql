-- ============================================================
-- Admin VX Adjust Function
-- Run once in Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_adjust_vx(
  p_email  TEXT,
  p_points INT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, message TEXT, user_display_name TEXT, new_balance BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_name      TEXT;
  v_balance   BIGINT;
BEGIN
  -- 1. Caller must be admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN QUERY SELECT false, 'Unauthorized: admin access required', NULL::TEXT, NULL::BIGINT;
    RETURN;
  END IF;

  -- 2. Lookup user by email in auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(p_email);
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'User not found with that email', NULL::TEXT, NULL::BIGINT;
    RETURN;
  END IF;

  -- 3. Get display name
  SELECT display_name INTO v_name FROM public.profiles WHERE user_id = v_user_id;

  -- 4. Insert VX transaction
  INSERT INTO public.user_points (user_id, points, reason)
  VALUES (v_user_id, p_points, COALESCE(p_reason, CASE WHEN p_points > 0 THEN 'Admin grant' ELSE 'Admin deduction' END));

  -- 5. Compute new balance
  SELECT COALESCE(SUM(points), 0) INTO v_balance
  FROM public.user_points WHERE user_id = v_user_id;

  -- 6. Log the admin action
  INSERT INTO public.admin_logs (admin_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    CASE WHEN p_points > 0 THEN 'grant_vx' ELSE 'revoke_vx' END,
    'user',
    v_user_id::TEXT,
    jsonb_build_object('email', p_email, 'points', p_points, 'reason', p_reason, 'new_balance', v_balance)
  );

  RETURN QUERY SELECT true, 'Done', v_name, v_balance;
END;
$$;

SELECT 'admin_adjust_vx function created' AS result;
