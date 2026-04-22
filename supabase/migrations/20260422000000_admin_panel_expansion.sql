-- Admin Panel Expansion Migration
-- Adds: user status/ban/suspend/verify, feature flags, admin logs, content reports, notifications

-- 1. Extend profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  ADD COLUMN IF NOT EXISTS ban_reason TEXT,
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 2. User feature flags table
CREATE TABLE IF NOT EXISTS public.user_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature_key)
);

ALTER TABLE public.user_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage user_features" ON public.user_features
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own features" ON public.user_features
  FOR SELECT USING (auth.uid() = user_id);

-- 3. Admin audit logs table
CREATE TABLE IF NOT EXISTS public.admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view admin_logs" ON public.admin_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert admin_logs" ON public.admin_logs
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Content reports table
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id),
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage content_reports" ON public.content_reports
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert content_reports" ON public.content_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users view own reports" ON public.content_reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- 5. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  sent_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notifications" ON public.notifications
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- 6. Function: log admin action
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action TEXT,
  _target_type TEXT DEFAULT NULL,
  _target_id TEXT DEFAULT NULL,
  _details JSONB DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_logs (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), _action, _target_type, _target_id, _details);
END;
$$;

-- 7. Function: ban user
CREATE OR REPLACE FUNCTION public.ban_user(_user_id UUID, _reason TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.profiles
  SET status = 'banned', ban_reason = _reason, banned_at = now()
  WHERE user_id = _user_id;

  PERFORM public.log_admin_action('ban_user', 'user', _user_id::TEXT,
    jsonb_build_object('reason', _reason));
END;
$$;

-- 8. Function: suspend user
CREATE OR REPLACE FUNCTION public.suspend_user(_user_id UUID, _until TIMESTAMPTZ, _reason TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.profiles
  SET status = 'suspended', suspended_until = _until, ban_reason = _reason
  WHERE user_id = _user_id;

  PERFORM public.log_admin_action('suspend_user', 'user', _user_id::TEXT,
    jsonb_build_object('until', _until, 'reason', _reason));
END;
$$;

-- 9. Function: unban/unsuspend user
CREATE OR REPLACE FUNCTION public.unban_user(_user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.profiles
  SET status = 'active', ban_reason = NULL, banned_at = NULL, suspended_until = NULL
  WHERE user_id = _user_id;

  PERFORM public.log_admin_action('unban_user', 'user', _user_id::TEXT, NULL);
END;
$$;

-- 10. Function: grant points (admin)
CREATE OR REPLACE FUNCTION public.admin_grant_points(_user_id UUID, _points INT, _reason TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO public.user_points (user_id, points, reason)
  VALUES (_user_id, _points, _reason);

  PERFORM public.log_admin_action('grant_points', 'user', _user_id::TEXT,
    jsonb_build_object('points', _points, 'reason', _reason));
END;
$$;

-- 11. Function: toggle user feature
CREATE OR REPLACE FUNCTION public.toggle_user_feature(_user_id UUID, _feature_key TEXT, _enabled BOOLEAN)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO public.user_features (user_id, feature_key, enabled, granted_by)
  VALUES (_user_id, _feature_key, _enabled, auth.uid())
  ON CONFLICT (user_id, feature_key)
  DO UPDATE SET enabled = _enabled, granted_by = auth.uid(), granted_at = now();

  PERFORM public.log_admin_action('toggle_feature', 'user', _user_id::TEXT,
    jsonb_build_object('feature', _feature_key, 'enabled', _enabled));
END;
$$;

-- 12. RLS update: admins can update profiles (for ban/verify)
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
