-- ============================================================
-- Migration: notify_self RPC
-- Purpose:   Let a signed-in user insert a notification for
--            THEMSELVES ONLY into the existing public.notifications
--            table (same table NotificationBell.tsx / AdminNotifications.tsx
--            already use — no new notifications system is introduced).
--            Needed because public.notifications' RLS only allows
--            admins to INSERT ("Admins manage notifications" is FOR ALL,
--            which also gates INSERT) — regular students/instructors have
--            no way to notify themselves about client-triggered Academy
--            events (e.g. certificate earned) without this RPC.
--            SECURITY DEFINER, but scoped to auth.uid() internally (not a
--            caller-supplied user_id) so it can only ever target the
--            calling user — no cross-user notification spam vector.
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_self(
  _title TEXT,
  _body  TEXT,
  _type  TEXT DEFAULT 'info'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  IF _type NOT IN ('info', 'warning', 'success', 'error') THEN
    _type := 'info';
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, sent_by)
  VALUES (auth.uid(), _title, _body, _type, auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_self TO authenticated;

COMMENT ON FUNCTION public.notify_self IS
  'Self-only notification insert for client-triggered events (e.g. Academy certificate earned, achievement unlocked). Always targets auth.uid() — cannot notify another user.';
