-- ============================================================
-- Migration: VisionKids AI Creative Studio — core (Phase 5)
-- Purpose:   ONE polymorphic kids_creative_projects table (a project_type
--            discriminator + a flexible JSONB content column) backs every
--            tool — drawings, characters, comics, stickers, music, voice,
--            video, cartoon scenes, and books/stories (which point back at
--            kids_ai_stories/kids_certificates-adjacent content). This is
--            deliberately NOT ten separate near-identical tables: the
--            brief explicitly asks for "add new creative tools later
--            without restructuring" — a type column + JSONB is exactly
--            that, whereas ten tables would mean a new migration + new
--            gallery UNION query every time.
--
-- Reused, not redefined: public.touch_updated_at(), public.has_role(),
-- public.kids_parent_child_links (Academy phase) for parental visibility.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.kids_creative_projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_type    TEXT NOT NULL CHECK (project_type IN (
    'story', 'book', 'drawing', 'character', 'comic', 'sticker', 'music', 'voice', 'video', 'cartoon_scene'
  )),
  title           TEXT NOT NULL DEFAULT 'Untitled',
  description     TEXT,
  thumbnail_url   TEXT,
  -- Tool-specific structured data (e.g. drawing: strokes/colors; character:
  -- chosen preset parts; book: pages[]; music: note sequence). Each tool's
  -- frontend component owns its own shape here — the table doesn't need to
  -- know it, which is what makes adding tool #11 a frontend-only change.
  content         JSONB NOT NULL DEFAULT '{}'::jsonb,
  asset_urls      TEXT[] NOT NULL DEFAULT '{}',
  is_public       BOOLEAN NOT NULL DEFAULT false,
  -- NULL = no decision needed yet (no linked parent, or not requested to
  -- publish); true/false = an explicit parental decision (see Parental
  -- Controls migration). Public visibility additionally requires this to
  -- not be false — see the SELECT policy below.
  parent_approved BOOLEAN,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_creative_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_creative_projects: owner manages own"
  ON public.kids_creative_projects FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kids_creative_projects: public reads published+approved"
  ON public.kids_creative_projects FOR SELECT
  USING (
    (is_public = true AND status = 'published' AND parent_approved IS DISTINCT FROM false)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "kids_creative_projects: linked parent reads child's projects"
  ON public.kids_creative_projects FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_parent_child_links pcl
    WHERE pcl.child_user_id = user_id AND pcl.parent_user_id = auth.uid()
  ));

-- A linked parent may only ever flip parent_approved — never edit the
-- child's actual content — enforced by the trigger below (mirrors the
-- kids_lock_submission_grading_fields pattern from Academy).
CREATE POLICY "kids_creative_projects: linked parent updates approval only"
  ON public.kids_creative_projects FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.kids_parent_child_links pcl
    WHERE pcl.child_user_id = user_id AND pcl.parent_user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kids_parent_child_links pcl
    WHERE pcl.child_user_id = user_id AND pcl.parent_user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.kids_lock_project_content_for_parent_updates()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM NEW.user_id THEN
    -- A parent (not the owning child) is doing this UPDATE — restrict it
    -- to parent_approved only; every other column snaps back to its
    -- previous value regardless of what was sent.
    NEW.title := OLD.title;
    NEW.description := OLD.description;
    NEW.thumbnail_url := OLD.thumbnail_url;
    NEW.content := OLD.content;
    NEW.asset_urls := OLD.asset_urls;
    NEW.is_public := OLD.is_public;
    NEW.status := OLD.status;
    NEW.project_type := OLD.project_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER kids_creative_projects_parent_update_lock
  BEFORE UPDATE ON public.kids_creative_projects
  FOR EACH ROW EXECUTE FUNCTION public.kids_lock_project_content_for_parent_updates();

CREATE TRIGGER kids_creative_projects_updated_at
  BEFORE UPDATE ON public.kids_creative_projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_kids_creative_projects_user ON public.kids_creative_projects(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_kids_creative_projects_type ON public.kids_creative_projects(project_type);
CREATE INDEX IF NOT EXISTS idx_kids_creative_projects_public ON public.kids_creative_projects(project_type, updated_at DESC) WHERE is_public = true AND status = 'published';

COMMENT ON TABLE public.kids_creative_projects IS 'Polymorphic container for every VisionKids Creative Studio tool. See project_type for the discriminator; content is tool-owned JSONB.';

-- ============================================================
-- kids_creative_project_versions — "Version History" (Performance section)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_creative_project_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.kids_creative_projects(id) ON DELETE CASCADE,
  content     JSONB NOT NULL,
  saved_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_creative_project_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_creative_project_versions: owner manages own"
  ON public.kids_creative_project_versions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.kids_creative_projects p WHERE p.id = project_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kids_creative_projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_kids_creative_project_versions_project ON public.kids_creative_project_versions(project_id, saved_at DESC);

-- Keep only the most recent 20 versions per project — auto-save shouldn't
-- grow this table unbounded.
CREATE OR REPLACE FUNCTION public.kids_trim_project_versions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.kids_creative_project_versions
  WHERE project_id = NEW.project_id
    AND id NOT IN (
      SELECT id FROM public.kids_creative_project_versions
      WHERE project_id = NEW.project_id
      ORDER BY saved_at DESC
      LIMIT 20
    );
  RETURN NEW;
END;
$$;

CREATE TRIGGER kids_creative_project_versions_trim
  AFTER INSERT ON public.kids_creative_project_versions
  FOR EACH ROW EXECUTE FUNCTION public.kids_trim_project_versions();

-- ============================================================
-- Storage: kids-studio-media — public read (published/shared work is meant
-- to be seen), owner-only write/delete under {user_id}/{project_id}/...
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kids-studio-media', 'kids-studio-media', true,
  52428800, -- 50 MB (video/audio exports)
  ARRAY['image/png','image/jpeg','image/webp','audio/webm','audio/mpeg','audio/wav','video/webm','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "kids_studio_media_read"
    ON storage.objects FOR SELECT TO anon, authenticated
    USING (bucket_id = 'kids-studio-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "kids_studio_media_owner_write"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'kids-studio-media' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "kids_studio_media_owner_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'kids-studio-media' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
