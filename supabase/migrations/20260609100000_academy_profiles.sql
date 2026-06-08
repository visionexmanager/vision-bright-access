-- ============================================================
-- Migration: academy_profiles
-- Purpose:   Persist student onboarding profile for Academy.
--            Replaces ephemeral React state in Academy.tsx.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.academy_profiles (
  user_id       UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL DEFAULT '',
  gender        TEXT        NOT NULL DEFAULT 'male' CHECK (gender IN ('male', 'female')),
  country       TEXT        NOT NULL DEFAULT '',
  level         TEXT        NOT NULL DEFAULT '',
  xp_total      INTEGER     NOT NULL DEFAULT 0,
  streak_days   INTEGER     NOT NULL DEFAULT 0,
  last_active   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.academy_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academy_profiles: users manage own row"
  ON public.academy_profiles
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "academy_profiles: admins read all"
  ON public.academy_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── Auto-update updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_academy_profile()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER academy_profile_updated_at
  BEFORE UPDATE ON public.academy_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_academy_profile();

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_academy_profiles_last_active
  ON public.academy_profiles(last_active DESC);

COMMENT ON TABLE public.academy_profiles IS
  'Academy student onboarding data: name, country, level, XP, streak.';
