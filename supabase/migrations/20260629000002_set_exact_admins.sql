-- Set exactly 4 admin users; demote everyone else to regular user.
-- Admins: hello@visionex.app, visionexmanager@gmail.com,
--         asmaafawzy47@gmail.com, deadista24@gmail.com

-- 1. Remove ALL existing admin roles
DELETE FROM public.user_roles WHERE role = 'admin';

-- 2. Grant admin to the 4 designated emails (if their accounts exist)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email IN (
  'hello@visionex.app',
  'visionexmanager@gmail.com',
  'asmaafawzy47@gmail.com',
  'deadista24@gmail.com'
)
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Ensure every authenticated user has the 'user' role (backfill missing)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'
FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Add is_admin flag to profiles for fast frontend badge lookup
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Sync is_admin from user_roles
UPDATE public.profiles p
SET is_admin = EXISTS (
  SELECT 1 FROM public.user_roles r
  WHERE r.user_id = p.user_id AND r.role = 'admin'
);

-- Trigger to keep is_admin in sync automatically
CREATE OR REPLACE FUNCTION public.sync_profile_is_admin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.role = 'admin' THEN
    UPDATE public.profiles SET is_admin = true  WHERE user_id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' AND OLD.role = 'admin' THEN
    UPDATE public.profiles SET is_admin = false WHERE user_id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_is_admin ON public.user_roles;
CREATE TRIGGER trg_sync_profile_is_admin
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_is_admin();

-- 5. Function: admin gives VX coins to any user (admins only)
CREATE OR REPLACE FUNCTION public.admin_give_vx(
  _target_user_id uuid,
  _amount integer,
  _reason text DEFAULT 'Admin grant'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF NOT public.has_role(_caller, 'admin') THEN
    RAISE EXCEPTION 'Forbidden: admins only';
  END IF;

  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  UPDATE public.profiles
  SET vx_balance = COALESCE(vx_balance, 0) + _amount
  WHERE user_id = _target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  INSERT INTO public.admin_logs (admin_id, action, target_type, target_id, details)
  VALUES (_caller, 'give_vx', 'user', _target_user_id::text,
          jsonb_build_object('amount', _amount, 'reason', _reason));

  RETURN jsonb_build_object('success', true, 'amount', _amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_give_vx(uuid, integer, text) TO authenticated;
