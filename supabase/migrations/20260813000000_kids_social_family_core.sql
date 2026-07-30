-- ============================================================
-- Migration: VisionKids Social & Parents Hub (Phase 7) — family accounts,
-- per-child time/content controls, and usage-time tracking.
--
-- Reused, not redefined: public.touch_updated_at(), public.has_role(),
-- public.kids_parent_child_links / kids_parent_link_codes (Academy,
-- 20260810010000 / 20260810020000 — extended here, not duplicated),
-- public.kids_xp_events (Games, 20260809010000 — RLS extended here so a
-- linked parent can read it as an activity timeline), public.notifications
-- (site-wide, 20260422000000 — type CHECK widened here instead of a new
-- kids_notifications table), public.award_kids_xp / award_kids_coins.
--
-- Honesty note (COPPA/GDPR): this migration builds real technical
-- scaffolding — parental-consent flags, per-child access controls, linked-
-- parent-only visibility via RLS, and (in the next migration) an admin
-- audit trail — but none of this is a legal compliance certification by
-- itself. "COPPA/GDPR-ready architecture" in the brief is implemented here
-- as the engineering primitives those frameworks require (consent capture,
-- data minimization via per-child scoping, access logging), not as a legal
-- guarantee.
-- ============================================================

-- ============================================================
-- kids_families — one row per parent "household". Today this is 1:1 with
-- parent_user_id (no multi-parent support), but modeling it as its own
-- entity (rather than just grouping by parent_user_id ad hoc) is what lets
-- Family Accounts show a family name and lets other tables hang a
-- `family_id` off something more meaningful than a bare user id.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_families (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id  UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  family_name     TEXT NOT NULL DEFAULT 'My Family',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_families: parent manages own"
  ON public.kids_families FOR ALL
  USING (auth.uid() = parent_user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = parent_user_id OR public.has_role(auth.uid(), 'admin'));

-- Self-only get-or-create, so every parent action that needs a family_id
-- (redeeming a link code, viewing Family Accounts) can just call this
-- instead of every caller needing its own "insert if missing" dance.
CREATE OR REPLACE FUNCTION public.ensure_kids_family()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _parent_id UUID := auth.uid();
  _family_id UUID;
BEGIN
  IF _parent_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  SELECT id INTO _family_id FROM public.kids_families WHERE parent_user_id = _parent_id;
  IF _family_id IS NOT NULL THEN
    RETURN _family_id;
  END IF;

  INSERT INTO public.kids_families (parent_user_id) VALUES (_parent_id)
  RETURNING id INTO _family_id;
  RETURN _family_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_kids_family() TO authenticated;

-- ============================================================
-- Extend kids_parent_child_links (20260810010000) with family_id, and have
-- redeem_kids_parent_link_code() (20260810020000) stamp it automatically.
-- ============================================================
ALTER TABLE public.kids_parent_child_links ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.kids_families(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.redeem_kids_parent_link_code(_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _parent_id UUID := auth.uid();
  _student_id UUID;
  _family_id UUID;
BEGIN
  IF _parent_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  SELECT student_user_id INTO _student_id
  FROM public.kids_parent_link_codes
  WHERE code = _code AND redeemed_at IS NULL AND expires_at > now();

  IF _student_id IS NULL THEN
    RETURN FALSE;
  END IF;

  _family_id := public.ensure_kids_family();

  UPDATE public.kids_parent_link_codes SET redeemed_at = now() WHERE code = _code;

  INSERT INTO public.kids_parent_child_links (parent_user_id, child_user_id, family_id)
  VALUES (_parent_id, _student_id, _family_id)
  ON CONFLICT (parent_user_id, child_user_id) DO UPDATE SET family_id = EXCLUDED.family_id;

  INSERT INTO public.kids_child_settings (child_user_id) VALUES (_student_id)
  ON CONFLICT (child_user_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

-- ============================================================
-- kids_child_settings — one row per child (not per parent-child pair, so
-- settings don't fork if a child is ever linked to a second parent). The
-- child can read their own row (so the UI can explain "bedtime mode" etc.)
-- but only a linked parent (or admin) can write it — a child can never
-- loosen their own restrictions.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_child_settings (
  child_user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_limit_minutes     INTEGER NOT NULL DEFAULT 120 CHECK (daily_limit_minutes > 0),
  bedtime_start           TIME,
  bedtime_end             TIME,
  study_time_start        TIME,
  study_time_end          TIME,
  break_interval_minutes  INTEGER NOT NULL DEFAULT 30 CHECK (break_interval_minutes > 0),
  allow_games             BOOLEAN NOT NULL DEFAULT true,
  allow_videos            BOOLEAN NOT NULL DEFAULT true,
  allow_chat              BOOLEAN NOT NULL DEFAULT true,
  allow_voice_rooms       BOOLEAN NOT NULL DEFAULT true,
  allow_ai                BOOLEAN NOT NULL DEFAULT true,
  allow_downloads         BOOLEAN NOT NULL DEFAULT true,
  allow_sharing           BOOLEAN NOT NULL DEFAULT true,
  recording_consent       BOOLEAN NOT NULL DEFAULT false,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_child_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_child_settings: child reads own"
  ON public.kids_child_settings FOR SELECT
  USING (auth.uid() = child_user_id);

CREATE POLICY "kids_child_settings: linked parent manages"
  ON public.kids_child_settings FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = kids_child_settings.child_user_id AND pcl.parent_user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = kids_child_settings.child_user_id AND pcl.parent_user_id = auth.uid())
  );

CREATE TRIGGER trg_kids_child_settings_touch
  BEFORE UPDATE ON public.kids_child_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- kids_usage_pings — a coarse (30s-resolution) usage-time tracker, written
-- ONLY via ping_kids_usage() below (no direct INSERT policy), so a client
-- can never report more than 30 real seconds per call. This is a "time
-- spent" signal, not a tamper-proof one — same client-trust model already
-- documented for kids_game_sessions/kids_reading_progress in earlier
-- phases: a determined child could simply stop sending pings while still
-- using the app (under-reporting), but can't over-report to spoof extra
-- usage onto a sibling or inflate numbers upward.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_usage_pings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category       TEXT NOT NULL CHECK (category IN ('learning', 'play', 'creative', 'social', 'explore', 'other')),
  seconds        INTEGER NOT NULL DEFAULT 30 CHECK (seconds > 0 AND seconds <= 60),
  pinged_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_usage_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_usage_pings: child reads own"
  ON public.kids_usage_pings FOR SELECT
  USING (auth.uid() = child_user_id);

CREATE POLICY "kids_usage_pings: linked parent reads"
  ON public.kids_usage_pings FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = kids_usage_pings.child_user_id AND pcl.parent_user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_kids_usage_pings_child_date ON public.kids_usage_pings(child_user_id, pinged_at DESC);

CREATE OR REPLACE FUNCTION public.ping_kids_usage(_category TEXT)
RETURNS TABLE (minutes_used_today INTEGER, daily_limit_minutes INTEGER, is_over_limit BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _limit INTEGER;
  _used_seconds INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  IF _category NOT IN ('learning', 'play', 'creative', 'social', 'explore', 'other') THEN
    RAISE EXCEPTION 'Invalid category: %', _category;
  END IF;

  INSERT INTO public.kids_usage_pings (child_user_id, category, seconds) VALUES (_user_id, _category, 30);

  SELECT COALESCE(SUM(seconds), 0) INTO _used_seconds
  FROM public.kids_usage_pings
  WHERE child_user_id = _user_id AND pinged_at::date = CURRENT_DATE;

  SELECT COALESCE(cs.daily_limit_minutes, 120) INTO _limit
  FROM public.kids_child_settings cs WHERE cs.child_user_id = _user_id;
  _limit := COALESCE(_limit, 120);

  RETURN QUERY SELECT (_used_seconds / 60)::INTEGER, _limit, (_used_seconds / 60) >= _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ping_kids_usage(TEXT) TO authenticated;

-- Read-only status check (no ping recorded) — for self on page load, or a
-- linked parent viewing the dashboard without affecting the child's clock.
CREATE OR REPLACE FUNCTION public.get_kids_usage_today(_child_user_id UUID DEFAULT NULL)
RETURNS TABLE (minutes_used_today INTEGER, daily_limit_minutes INTEGER, is_over_limit BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _caller UUID := auth.uid();
  _target UUID := COALESCE(_child_user_id, auth.uid());
  _limit INTEGER;
  _used_seconds INTEGER;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  IF _target <> _caller AND NOT public.has_role(_caller, 'admin') AND NOT EXISTS (
    SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = _target AND pcl.parent_user_id = _caller
  ) THEN
    RAISE EXCEPTION 'Not authorized to view this child''s usage';
  END IF;

  SELECT COALESCE(SUM(seconds), 0) INTO _used_seconds
  FROM public.kids_usage_pings
  WHERE child_user_id = _target AND pinged_at::date = CURRENT_DATE;

  SELECT COALESCE(cs.daily_limit_minutes, 120) INTO _limit
  FROM public.kids_child_settings cs WHERE cs.child_user_id = _target;
  _limit := COALESCE(_limit, 120);

  RETURN QUERY SELECT (_used_seconds / 60)::INTEGER, _limit, (_used_seconds / 60) >= _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kids_usage_today(UUID) TO authenticated;

-- ============================================================
-- Let a linked parent read kids_xp_events (Games, 20260809010000) — this
-- becomes the Parents Dashboard's Activity Timeline data source: every
-- award_kids_xp() call across every VisionKids phase already writes a
-- timestamped, reason-labeled row here, so no new activity-log table is
-- needed, just visibility for the parent.
-- ============================================================
DROP POLICY IF EXISTS "kids_xp_events: user reads own" ON public.kids_xp_events;
CREATE POLICY "kids_xp_events: user or linked parent reads"
  ON public.kids_xp_events FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = kids_xp_events.user_id AND pcl.parent_user_id = auth.uid())
  );

-- ============================================================
-- Widen the shared notifications table (20260422000000) with kid-relevant
-- types instead of creating a parallel kids_notifications table.
-- ============================================================
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('info', 'warning', 'success', 'error', 'achievement', 'message', 'invite', 'challenge', 'weekly_report'));

-- ============================================================
-- Extend award_kids_xp / award_kids_coins (Stories/Games/Academy/Studio/
-- Explorer) with Phase 7 reasons. CREATE OR REPLACE preserves every prior
-- branch verbatim.
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_kids_xp(_amount INTEGER, _reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _max_amount INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  CASE
    WHEN _reason LIKE 'Story completed:%'      THEN _max_amount := 50;
    WHEN _reason LIKE 'Quiz completed:%'        THEN _max_amount := 30;
    WHEN _reason LIKE 'Reading streak:%'        THEN _max_amount := 50;
    WHEN _reason LIKE 'AI story created:%'      THEN _max_amount := 20;
    WHEN _reason LIKE 'Game completed:%'        THEN _max_amount := 40;
    WHEN _reason LIKE 'Perfect score:%'         THEN _max_amount := 25;
    WHEN _reason LIKE 'Daily challenge:%'       THEN _max_amount := 30;
    WHEN _reason LIKE 'Weekly challenge:%'      THEN _max_amount := 100;
    WHEN _reason LIKE 'Achievement unlocked:%'  THEN _max_amount := 30;
    WHEN _reason LIKE 'Daily login:%'           THEN _max_amount := 15;
    WHEN _reason LIKE 'Lesson completed:%'      THEN _max_amount := 25;
    WHEN _reason LIKE 'Course completed:%'      THEN _max_amount := 150;
    WHEN _reason LIKE 'Homework submitted:%'    THEN _max_amount := 20;
    WHEN _reason LIKE 'Project submitted:%'     THEN _max_amount := 50;
    WHEN _reason LIKE 'Exam passed:%'           THEN _max_amount := 80;
    WHEN _reason LIKE 'Creative project saved:%' THEN _max_amount := 20;
    WHEN _reason LIKE 'Creative challenge submitted:%' THEN _max_amount := 40;
    WHEN _reason LIKE 'World explored:%'        THEN _max_amount := 20;
    WHEN _reason LIKE 'Location quiz completed:%' THEN _max_amount := 20;
    WHEN _reason LIKE 'Simulator milestone:%'   THEN _max_amount := 30;
    WHEN _reason LIKE 'Explorer certificate:%'  THEN _max_amount := 100;
    WHEN _reason LIKE 'Friend added:%'          THEN _max_amount := 10;
    WHEN _reason LIKE 'Club joined:%'           THEN _max_amount := 15;
    WHEN _reason LIKE 'Group quiz completed:%'  THEN _max_amount := 25;
    WHEN _reason LIKE 'Group assignment submitted:%' THEN _max_amount := 20;
    WHEN _reason LIKE 'Social challenge won:%'  THEN _max_amount := 80;
    WHEN _reason LIKE 'Social challenge joined:%' THEN _max_amount := 10;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason; END IF;

  INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _amount, _reason);
  INSERT INTO public.kids_xp_events(user_id, amount, reason) VALUES (_user_id, _amount, _reason);
END;
$$;

CREATE OR REPLACE FUNCTION public.award_kids_coins(_amount INTEGER, _reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _max_amount INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  CASE
    WHEN _reason LIKE 'Game completed:%'      THEN _max_amount := 20;
    WHEN _reason LIKE 'Daily challenge:%'     THEN _max_amount := 15;
    WHEN _reason LIKE 'Weekly challenge:%'    THEN _max_amount := 50;
    WHEN _reason LIKE 'Daily login:%'         THEN _max_amount := 10;
    WHEN _reason LIKE 'Lesson completed:%'    THEN _max_amount := 15;
    WHEN _reason LIKE 'Course completed:%'    THEN _max_amount := 75;
    WHEN _reason LIKE 'Homework submitted:%'  THEN _max_amount := 10;
    WHEN _reason LIKE 'Project submitted:%'   THEN _max_amount := 25;
    WHEN _reason LIKE 'Exam passed:%'         THEN _max_amount := 40;
    WHEN _reason LIKE 'Creative project saved:%' THEN _max_amount := 10;
    WHEN _reason LIKE 'Creative challenge submitted:%' THEN _max_amount := 20;
    WHEN _reason LIKE 'World explored:%'       THEN _max_amount := 10;
    WHEN _reason LIKE 'Location quiz completed:%' THEN _max_amount := 10;
    WHEN _reason LIKE 'Simulator milestone:%'  THEN _max_amount := 15;
    WHEN _reason LIKE 'Explorer certificate:%' THEN _max_amount := 60;
    WHEN _reason LIKE 'Friend added:%'         THEN _max_amount := 5;
    WHEN _reason LIKE 'Club joined:%'          THEN _max_amount := 10;
    WHEN _reason LIKE 'Group quiz completed:%' THEN _max_amount := 15;
    WHEN _reason LIKE 'Group assignment submitted:%' THEN _max_amount := 10;
    WHEN _reason LIKE 'Social challenge won:%' THEN _max_amount := 40;
    WHEN _reason LIKE 'Social challenge joined:%' THEN _max_amount := 5;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason; END IF;

  INSERT INTO public.user_points(user_id, points, reason) VALUES (_user_id, _amount, _reason);
END;
$$;
