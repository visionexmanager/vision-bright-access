-- ============================================================
-- Migration: VisionKids Talent Hub (Phase 9) — per-user progress.
--
-- Every table here is strictly self-owned (auth.uid() = user_id) — a child's
-- assessment profile, skill/module progress, portfolio, and mentor requests
-- are private by default (privacy-first, same posture as the Social phase's
-- child settings). The reward side-effects (XP/coins/achievements/ranks) are
-- NOT written directly from the client — they go through the SECURITY DEFINER
-- RPCs added in 20260815020000, so caps can't be bypassed.
-- ============================================================

-- ============================================================
-- kids_talent_results — one row per child: their latest assessment profile.
-- domain_scores is { domain_slug: number }; top_domains is the 3 highest,
-- precomputed on submit so the hub/My Talents can render without re-sorting.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_talent_results (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  domain_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  top_domains   TEXT[] NOT NULL DEFAULT '{}',
  taken_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_talent_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_talent_results: user manages own"
  ON public.kids_talent_results FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- kids_skill_progress — a child's progress on each Skill Tree node.
-- completed_tasks counts checklist items ticked; status flips to 'completed'
-- (and rewards fire, via RPC) when all tasks are done.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_skill_progress (
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_slug      TEXT NOT NULL REFERENCES public.kids_skills(slug) ON DELETE CASCADE,
  completed_tasks INTEGER NOT NULL DEFAULT 0 CHECK (completed_tasks >= 0),
  status          TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  PRIMARY KEY (user_id, skill_slug)
);

ALTER TABLE public.kids_skill_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_skill_progress: user manages own"
  ON public.kids_skill_progress FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_kids_skill_progress_touch
  BEFORE UPDATE ON public.kids_skill_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- kids_track_module_progress — one row per completed module. Presence of a
-- row = completed (modules are marked done, not partially tracked), so a
-- track's percent-complete is COUNT(rows) / COUNT(modules).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_track_module_progress (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id     UUID NOT NULL REFERENCES public.kids_track_modules(id) ON DELETE CASCADE,
  track_slug    TEXT NOT NULL REFERENCES public.kids_talent_tracks(slug) ON DELETE CASCADE,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module_id)
);

ALTER TABLE public.kids_track_module_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_track_module_progress: user manages own"
  ON public.kids_track_module_progress FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_track_module_progress_track ON public.kids_track_module_progress(user_id, track_slug);

-- ============================================================
-- kids_portfolio_items — a child's saved work: projects, drawings, stories,
-- games, plus auto-collected certificates/awards. `kind` classifies it;
-- `source` records where it came from (a track project, the studio, a manual
-- add). `content` is free-form JSONB (text, a reference id, etc.).
-- Owner-only — a portfolio is private unless a parent later exports it.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_portfolio_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'project' CHECK (kind IN ('project', 'drawing', 'story', 'game', 'certificate', 'award', 'other')),
  title         TEXT NOT NULL,
  description   TEXT,
  emoji         TEXT NOT NULL DEFAULT '⭐',
  content       JSONB NOT NULL DEFAULT '{}'::jsonb,
  source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'track', 'studio', 'assessment', 'system')),
  track_slug    TEXT REFERENCES public.kids_talent_tracks(slug) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_portfolio_items: user manages own"
  ON public.kids_portfolio_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_portfolio_items_user ON public.kids_portfolio_items(user_id, created_at DESC);

-- ============================================================
-- kids_mentor_requests — a child (or their parent) asking to connect with a
-- mentor. This is the honest scaffold for future live mentoring: a request
-- is stored with status 'pending'; nothing auto-schedules a real session yet.
-- Child reads/creates own; admins manage all.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_mentor_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentor_slug   TEXT NOT NULL REFERENCES public.kids_mentors(slug) ON DELETE CASCADE,
  topic         TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_mentor_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_mentor_requests: user reads own"
  ON public.kids_mentor_requests FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_mentor_requests: user creates own"
  ON public.kids_mentor_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_mentor_requests: user cancels own, admin manages"
  ON public.kids_mentor_requests FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_mentor_requests: admin updates"
  ON public.kids_mentor_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_mentor_requests_user ON public.kids_mentor_requests(user_id, created_at DESC);
