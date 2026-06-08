-- ============================================================
-- Migration: academy_xp_events
-- Purpose:   Granular XP tracking for Academy interactions.
--            Separate from global user_points to allow
--            Academy-specific analytics and leaderboard.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.academy_xp_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      INTEGER     NOT NULL CHECK (amount > 0),
  reason      TEXT        NOT NULL,
  -- Valid reasons:
  --   'academy_message_sent'      — user sent a chat message to Munir
  --   'academy_aptitude_completed'— completed the career aptitude test
  --   'academy_streak'            — daily login streak in Academy
  --   'academy_scan_used'         — used the OCR scanner in Academy
  --   'academy_study_room'        — opened a study room session
  --   'academy_daily_login'       — first Academy visit of the day
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.academy_xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_xp: users read own events"
  ON public.academy_xp_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service-role only for inserts (done via RPC)
-- Frontend never inserts directly — goes through award_academy_xp() RPC below.

-- ── RPC: award_academy_xp ─────────────────────────────────
-- Called from frontend via supabase.rpc("award_academy_xp", { ... })
-- Uses SECURITY DEFINER to bypass RLS for the insert.
CREATE OR REPLACE FUNCTION public.award_academy_xp(
  _user_id UUID,
  _amount  INTEGER,
  _reason  TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert into academy_xp_events
  INSERT INTO public.academy_xp_events(user_id, amount, reason)
  VALUES (_user_id, _amount, _reason);

  -- Also add to global user_points so Navbar VX counter updates
  INSERT INTO public.user_points(user_id, points, reason)
  VALUES (_user_id, _amount, _reason);

  -- Update academy_profiles.xp_total
  UPDATE public.academy_profiles
  SET xp_total = xp_total + _amount,
      last_active = now()
  WHERE user_id = _user_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.award_academy_xp TO authenticated;

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_academy_xp_user_date
  ON public.academy_xp_events(user_id, created_at DESC);

COMMENT ON TABLE public.academy_xp_events IS
  'Academy-specific XP events. Also mirrors into user_points for global VX balance.';
