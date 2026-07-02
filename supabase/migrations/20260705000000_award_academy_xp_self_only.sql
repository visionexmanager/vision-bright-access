-- ============================================================
-- Migration: award_academy_xp — derive target user from auth.uid()
-- Purpose:   Close a privilege-escalation gap flagged in the Phase 10
--            engineering audit: the original award_academy_xp(_user_id,
--            _amount, _reason) trusted a caller-supplied _user_id, so any
--            authenticated user calling the RPC directly (bypassing the UI)
--            could award XP/VX to an arbitrary account. Every real call
--            site (grep-verified: AcademyLearningPlayer.tsx,
--            useAcademyProfile.ts, useAcademyChat.ts, useGamificationTick.ts,
--            ProjectSubmissionForm.tsx) already only ever passes the
--            CURRENT user's own id, so switching to auth.uid() internally
--            is a pure security hardening with zero behavior change for
--            legitimate usage — same pattern already used by notify_self()
--            (20260703000000_academy_notify_self.sql).
--
--            Signature changes (UUID, INTEGER, TEXT) -> (INTEGER, TEXT), so
--            this must be a DROP + CREATE rather than CREATE OR REPLACE.
--            The client wrapper (awardAcademyXP() in academyService.ts) is
--            updated in the same commit to stop sending _user_id — its own
--            public JS signature (userId, reason) is unchanged, so none of
--            its ~12 call sites need to change.
-- ============================================================

DROP FUNCTION IF EXISTS public.award_academy_xp(UUID, INTEGER, TEXT);

-- CREATE OR REPLACE (not bare CREATE) so this migration is safely re-runnable
-- if a prior attempt got this far but failed on a later statement.
CREATE OR REPLACE FUNCTION public.award_academy_xp(
  _amount INTEGER,
  _reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  INSERT INTO public.academy_xp_events(user_id, amount, reason)
  VALUES (_user_id, _amount, _reason);

  INSERT INTO public.user_points(user_id, points, reason)
  VALUES (_user_id, _amount, _reason);

  UPDATE public.academy_profiles
  SET xp_total = xp_total + _amount,
      last_active = now()
  WHERE user_id = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_academy_xp(INTEGER, TEXT) TO authenticated;

COMMENT ON FUNCTION public.award_academy_xp(INTEGER, TEXT) IS
  'Self-only XP/VX award (auth.uid() derived internally, not caller-supplied) — mirrors notify_self()''s security model.';
