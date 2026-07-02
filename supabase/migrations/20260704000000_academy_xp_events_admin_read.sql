-- ============================================================
-- Migration: academy_xp_events admin read policy
-- Purpose:   Let admins read XP events across all students, for
--            the new Academy Admin analytics page (Phase 9). Mirrors
--            the existing "academy_profiles: admins read all" policy
--            (20260609100000_academy_profiles.sql) — same has_role
--            check, read-only, no write access granted.
-- ============================================================

DROP POLICY IF EXISTS "academy_xp_events: admins read all" ON public.academy_xp_events;

CREATE POLICY "academy_xp_events: admins read all"
  ON public.academy_xp_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
