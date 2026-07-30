-- ============================================================
-- Migration: VisionKids Wellness (Phase 10) — per-child logs & companion.
--
-- PRIVACY-FIRST. Every table here is strictly self-owned
-- (auth.uid() = user_id) and deliberately minimal:
--   * Mood is stored as a simple emoji/color code + an OPTIONAL short note —
--     never a diagnosis, never analyzed or shared.
--   * Sleep is stored as times/minutes the child enters — no device tracking,
--     no biometrics.
--   * Nothing here is readable by other users, and none of it feeds parent
--     dashboards automatically (a parent uses the family device with the
--     child, by design). No sensitive health data beyond these self-entered,
--     self-visible wellness notes is collected.
-- Reward side-effects go exclusively through the SECURITY DEFINER RPCs in
-- 20260816020000 so caps/streaks can't be forged from the client.
-- ============================================================

-- ============================================================
-- kids_habit_logs — presence of a row = that habit/routine step was done on
-- that date. One row per (user, habit, day).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_habit_logs (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  habit_slug  TEXT NOT NULL REFERENCES public.kids_wellness_habits(slug) ON DELETE CASCADE,
  log_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, habit_slug, log_date)
);

ALTER TABLE public.kids_habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_habit_logs: user manages own"
  ON public.kids_habit_logs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_habit_logs_user_date ON public.kids_habit_logs(user_id, log_date);

-- ============================================================
-- kids_mood_logs — one self-entered mood per day (upsert). `mood` is a small
-- fixed set of kid-friendly feelings; `color` an optional palette pick;
-- `note` an OPTIONAL short private note. Nothing more.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_mood_logs (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  mood        TEXT NOT NULL CHECK (mood IN ('great', 'good', 'okay', 'sad', 'angry', 'worried', 'tired')),
  color       TEXT,
  note        TEXT CHECK (note IS NULL OR char_length(note) <= 280),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, log_date)
);

ALTER TABLE public.kids_mood_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_mood_logs: user manages own"
  ON public.kids_mood_logs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_kids_mood_logs_touch
  BEFORE UPDATE ON public.kids_mood_logs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- kids_sleep_logs — one self-entered sleep record per night. Times are plain
-- 'HH:MM' strings the child types; duration is derived on the client. No
-- device or biometric data.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_sleep_logs (
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  bedtime          TEXT,
  wake_time        TEXT,
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR (duration_minutes >= 0 AND duration_minutes <= 1440)),
  quality          TEXT CHECK (quality IS NULL OR quality IN ('great', 'ok', 'poor')),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, log_date)
);

ALTER TABLE public.kids_sleep_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_sleep_logs: user manages own"
  ON public.kids_sleep_logs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_kids_sleep_logs_touch
  BEFORE UPDATE ON public.kids_sleep_logs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- kids_wellness_sessions — a log of completed exercise / mindfulness
-- sessions (which lesson, how many minutes). Append-only usage history.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_wellness_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('exercise', 'mindfulness')),
  ref_slug    TEXT NOT NULL,
  minutes     INTEGER NOT NULL DEFAULT 1 CHECK (minutes >= 0 AND minutes <= 240),
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_wellness_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_wellness_sessions: user manages own"
  ON public.kids_wellness_sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_wellness_sessions_user ON public.kids_wellness_sessions(user_id, logged_at DESC);

-- ============================================================
-- kids_healthy_challenge_progress — a child's progress on a challenge for a
-- given period window (period_start pins the day/week). Presence with
-- completed=true means the reward was granted (once).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_healthy_challenge_progress (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id  UUID NOT NULL REFERENCES public.kids_healthy_challenges(id) ON DELETE CASCADE,
  period_start  DATE NOT NULL,
  progress      INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed     BOOLEAN NOT NULL DEFAULT false,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, challenge_id, period_start)
);

ALTER TABLE public.kids_healthy_challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_healthy_challenge_progress: user manages own"
  ON public.kids_healthy_challenge_progress FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_kids_healthy_challenge_progress_touch
  BEFORE UPDATE ON public.kids_healthy_challenge_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- kids_companion — the Smart Companion character. It "remembers" only what
-- the child chooses to tell it (name, avatar, hobbies, goals). Its
-- suggestions are computed client-side from the child's own public catalog
-- progress + these preferences — it is a friendly rules-based helper, not an
-- AI that stores or analyzes health data. One per child.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_companion (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Buddy',
  avatar      TEXT NOT NULL DEFAULT '🤖',
  hobbies     TEXT[] NOT NULL DEFAULT '{}',
  goals       TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_companion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_companion: user manages own"
  ON public.kids_companion FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_kids_companion_touch
  BEFORE UPDATE ON public.kids_companion
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- kids_wellness_settings — per-child wellness preferences: the country whose
-- emergency numbers to show, an optional family-set custom emergency contact,
-- and accessibility/reminder toggles. Self-owned.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_wellness_settings (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code      TEXT NOT NULL DEFAULT 'INTL',
  custom_emergency  JSONB NOT NULL DEFAULT '{}'::jsonb,
  reminders_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_wellness_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_wellness_settings: user manages own"
  ON public.kids_wellness_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_kids_wellness_settings_touch
  BEFORE UPDATE ON public.kids_wellness_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
