-- ============================================================
-- Migration: VisionKids STEM & Innovation Center (Phase 11) — per-child
-- progress, projects (portfolio + gallery), likes, research reads, settings.
--
-- PRIVACY / SECURITY: every table here is per-child and protected by strict
-- owner-only RLS. The one exception is that a child can choose to make a
-- project PUBLIC — public projects are readable by everyone for the Inventor
-- Gallery, but only ever writable by their owner. No emails/names are stored;
-- projects carry only a display title/description the child writes and a
-- lightweight JSONB payload (robot programs, 3D configs, invention notes).
-- ============================================================

-- ============================================================
-- kids_experiment_progress — one row per (child, experiment). Tracks
-- completion and best quiz score. Owner-only.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_experiment_progress (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  experiment_id UUID NOT NULL REFERENCES public.kids_experiments(id) ON DELETE CASCADE,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  best_score    INTEGER NOT NULL DEFAULT 0,
  completed_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, experiment_id)
);

ALTER TABLE public.kids_experiment_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_experiment_progress: owner reads"
  ON public.kids_experiment_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_experiment_progress: owner writes"
  ON public.kids_experiment_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_experiment_progress: owner updates"
  ON public.kids_experiment_progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_kids_experiment_progress_user ON public.kids_experiment_progress(user_id);

-- ============================================================
-- kids_stem_projects — the Portfolio AND the Inventor Gallery. ONE table for
-- every kind of saved creation:
--   'invention' — an Innovation Challenge submission (challenge_id set),
--   'robot'     — a Robotics Workshop program,
--   'design'    — a 3D Design Studio model,
--   'experiment'— a saved experiment result / note.
-- `data` is the lightweight creation payload (robot commands, 3D config, notes).
-- A child owns and manages their own rows; when `is_public` AND status
-- 'published', anyone can read it for the gallery.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_stem_projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('invention', 'robot', 'design', 'experiment')),
  title         TEXT NOT NULL,
  description   TEXT,
  lab           TEXT,
  emoji         TEXT NOT NULL DEFAULT '🧪',
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  challenge_id  UUID REFERENCES public.kids_innovation_challenges(id) ON DELETE SET NULL,
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,
  likes         INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'published')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_stem_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_stem_projects: public read published"
  ON public.kids_stem_projects FOR SELECT
  USING ((is_public AND status = 'published') OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_stem_projects: owner inserts"
  ON public.kids_stem_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_stem_projects: owner updates"
  ON public.kids_stem_projects FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_stem_projects: owner deletes"
  ON public.kids_stem_projects FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "kids_stem_projects: admins manage"
  ON public.kids_stem_projects FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_stem_projects_user ON public.kids_stem_projects(user_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kids_stem_projects_gallery ON public.kids_stem_projects(status, is_public, created_at DESC) WHERE is_public AND status = 'published';

-- ============================================================
-- kids_project_likes — a child can "cheer" a public gallery project once.
-- Owner-only writes; the aggregate count lives on kids_stem_projects.likes
-- (kept in sync by toggle_kids_project_like in the gamification migration).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_project_likes (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES public.kids_stem_projects(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

ALTER TABLE public.kids_project_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_project_likes: owner reads"
  ON public.kids_project_likes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_project_likes: owner writes"
  ON public.kids_project_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_project_likes: owner deletes"
  ON public.kids_project_likes FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- kids_research_reads — which articles a child has read (for the "read" badge
-- and Research rank). Owner-only.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_research_reads (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id  UUID NOT NULL REFERENCES public.kids_research_articles(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, article_id)
);

ALTER TABLE public.kids_research_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_research_reads: owner reads"
  ON public.kids_research_reads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_research_reads: owner writes"
  ON public.kids_research_reads FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- kids_stem_settings — STEM-specific accessibility toggles. Most VisionKids
-- accessibility (text scale, reduce motion, high-contrast theme) is global and
-- client-side; these are the extra STEM comfort options a child can persist.
-- Owner-only.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_stem_settings (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_descriptions BOOLEAN NOT NULL DEFAULT FALSE,
  voice_commands     BOOLEAN NOT NULL DEFAULT FALSE,
  simple_language    BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_stem_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_stem_settings: owner reads"
  ON public.kids_stem_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_stem_settings: owner writes"
  ON public.kids_stem_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_stem_settings: owner updates"
  ON public.kids_stem_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
