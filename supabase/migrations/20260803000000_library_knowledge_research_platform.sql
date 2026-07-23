-- ============================================================================
-- Knowledge & Research Platform: extends the existing Global Digital Library
-- knowledge graph (20260730000000) with more entity types, semantic entity
-- search, and non-book content links; adds timelines, saved searches,
-- multi-source AI research analyses, and a full research workspace
-- (projects/members/items/comments/versions). Sections:
--   1. Knowledge Graph enhancements
--   2. Timelines
--   3. Saved Searches + Search Suggestions
--   4. Research Analyses (multi-source AI outputs)
--   5. Research Workspace (projects, members, items, comments, versions)
--   6. Knowledge Map + Trending/Emerging RPCs
-- ============================================================================

-- ============================================================================
-- 1. KNOWLEDGE GRAPH ENHANCEMENTS
-- ============================================================================

-- New entity types the spec asks for (Technologies, Languages, Skills,
-- Publishers) beyond the 8 already seeded in the Global Digital Library
-- phase (author, topic, character, historical_event, scientific_concept,
-- location, organization, person). Safe: not used in any INSERT in this
-- same migration, so the same-transaction restriction on new enum values
-- doesn't apply here.
ALTER TYPE public.library_kg_entity_type ADD VALUE IF NOT EXISTS 'technology';
ALTER TYPE public.library_kg_entity_type ADD VALUE IF NOT EXISTS 'language';
ALTER TYPE public.library_kg_entity_type ADD VALUE IF NOT EXISTS 'skill';
ALTER TYPE public.library_kg_entity_type ADD VALUE IF NOT EXISTS 'publisher';

-- Semantic entity matching (entities had no embedding column before).
ALTER TABLE public.library_kg_entities ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE OR REPLACE FUNCTION public.match_library_kg_entities_semantic(_query_embedding vector(1536), _match_count INTEGER DEFAULT 10)
RETURNS TABLE (entity_id UUID, similarity FLOAT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, 1 - (embedding <=> _query_embedding)
  FROM public.library_kg_entities
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> _query_embedding
  LIMIT GREATEST(_match_count, 1)
$$;

GRANT EXECUTE ON FUNCTION public.match_library_kg_entities_semantic(vector, INTEGER) TO anon, authenticated;

-- library_kg_book_entities already links books to entities. Audiobooks and
-- Academy courses need the same "this content is about this entity" edge —
-- polymorphic rather than adding a book_entities-shaped table per content
-- type. Same access/write convention as the existing kg_* tables (public
-- read, service_role-only write — no authenticated-write policy at all,
-- matching 20260730000000's kg tables exactly).
CREATE TABLE IF NOT EXISTS public.library_kg_content_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES public.library_kg_entities(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('audiobook', 'academy_course')),
  content_id UUID NOT NULL,
  context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_library_kg_content_links_content ON public.library_kg_content_links(content_type, content_id);

ALTER TABLE public.library_kg_content_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_kg_content_links: public read"
  ON public.library_kg_content_links FOR SELECT USING (true);

-- ============================================================================
-- 2. TIMELINES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.library_timelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  timeline_type TEXT NOT NULL CHECK (timeline_type IN
    ('historical', 'scientific_discovery', 'book_series', 'author_life', 'technology_evolution')),
  description TEXT,
  kg_entity_id UUID REFERENCES public.library_kg_entities(id) ON DELETE SET NULL,
  series_id UUID REFERENCES public.library_series(id) ON DELETE SET NULL,
  is_ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_timelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_timelines: public read"
  ON public.library_timelines FOR SELECT USING (true);

CREATE POLICY "library_timelines: creator manages"
  ON public.library_timelines FOR ALL
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.library_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_id UUID NOT NULL REFERENCES public.library_timelines(id) ON DELETE CASCADE,
  event_date_or_period TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  kg_entity_id UUID REFERENCES public.library_kg_entities(id) ON DELETE SET NULL,
  source_book_id UUID REFERENCES public.library_books(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_timeline_events_timeline ON public.library_timeline_events(timeline_id, order_index);

ALTER TABLE public.library_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_timeline_events: public read"
  ON public.library_timeline_events FOR SELECT USING (true);

CREATE POLICY "library_timeline_events: timeline creator manages"
  ON public.library_timeline_events FOR ALL
  USING (EXISTS (SELECT 1 FROM public.library_timelines t WHERE t.id = timeline_id AND (t.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.library_timelines t WHERE t.id = timeline_id AND (t.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- ============================================================================
-- 3. SAVED SEARCHES + SEARCH SUGGESTIONS
-- ============================================================================

-- Distinct from library_search_history (an append-only log with no name/
-- save concept) — this is an explicitly named, reusable saved search.
CREATE TABLE IF NOT EXISTS public.library_saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_saved_searches: user manages own"
  ON public.library_saved_searches FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_library_search_suggestions(_prefix TEXT, _limit INTEGER DEFAULT 8)
RETURNS TABLE (suggestion TEXT, suggestion_type TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  (SELECT title, 'book' FROM public.library_books
    WHERE title ILIKE _prefix || '%' AND publish_status = 'published'
    ORDER BY title LIMIT _limit)
  UNION ALL
  (SELECT name, entity_type::TEXT FROM public.library_kg_entities
    WHERE name ILIKE _prefix || '%'
    ORDER BY name LIMIT _limit)
  LIMIT GREATEST(_limit, 1)
$$;

GRANT EXECUTE ON FUNCTION public.get_library_search_suggestions(TEXT, INTEGER) TO anon, authenticated;

-- ============================================================================
-- 4. RESEARCH ANALYSES (persisted multi-source AI outputs — unlike Learning
--    Hub's ephemeral single-book timeline/flashcard AI output, a multi-book
--    comparison/lit-review is expensive to regenerate and worth revisiting).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.library_research_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN
    ('summarize_multiple', 'compare_books', 'compare_authors', 'literature_review', 'research_outline', 'knowledge_gaps')),
  title TEXT NOT NULL,
  book_ids UUID[] NOT NULL DEFAULT '{}',
  author_ids UUID[] NOT NULL DEFAULT '{}',
  topic TEXT,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_research_analyses_user ON public.library_research_analyses(user_id, created_at DESC);

ALTER TABLE public.library_research_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_research_analyses: user manages own"
  ON public.library_research_analyses FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 5. RESEARCH WORKSPACE (projects, members, items, comments, versions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.library_research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.library_research_project_members (
  project_id UUID NOT NULL REFERENCES public.library_research_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE OR REPLACE FUNCTION public.is_library_research_project_member(_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.library_research_project_members WHERE project_id = _project_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.library_research_projects WHERE id = _project_id AND owner_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_library_research_project_editor(_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.library_research_project_members
      WHERE project_id = _project_id AND user_id = auth.uid() AND role IN ('owner', 'editor')
    )
    OR EXISTS (SELECT 1 FROM public.library_research_projects WHERE id = _project_id AND owner_id = auth.uid())
$$;

ALTER TABLE public.library_research_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_research_projects: member reads"
  ON public.library_research_projects FOR SELECT
  USING (public.is_library_research_project_member(id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_research_projects: owner creates"
  ON public.library_research_projects FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "library_research_projects: editor updates"
  ON public.library_research_projects FOR UPDATE
  USING (public.is_library_research_project_editor(id));

CREATE POLICY "library_research_projects: owner deletes"
  ON public.library_research_projects FOR DELETE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER library_research_projects_updated_at
  BEFORE UPDATE ON public.library_research_projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.trg_library_research_project_auto_owner_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.library_research_project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (project_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_library_research_projects_auto_owner
  AFTER INSERT ON public.library_research_projects
  FOR EACH ROW EXECUTE FUNCTION public.trg_library_research_project_auto_owner_member();

ALTER TABLE public.library_research_project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_research_project_members: member reads"
  ON public.library_research_project_members FOR SELECT
  USING (public.is_library_research_project_member(project_id));

CREATE POLICY "library_research_project_members: owner manages"
  ON public.library_research_project_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.library_research_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.library_research_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TABLE IF NOT EXISTS public.library_research_project_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.library_research_projects(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('book', 'note', 'highlight', 'reference', 'saved_search', 'analysis')),
  book_id UUID REFERENCES public.library_books(id) ON DELETE CASCADE,
  note_id UUID REFERENCES public.library_notes(id) ON DELETE CASCADE,
  highlight_id UUID REFERENCES public.library_highlights(id) ON DELETE CASCADE,
  saved_search_id UUID REFERENCES public.library_saved_searches(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES public.library_research_analyses(id) ON DELETE CASCADE,
  citation_text TEXT,
  added_by UUID NOT NULL REFERENCES auth.users(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_research_project_items_project ON public.library_research_project_items(project_id, added_at DESC);

ALTER TABLE public.library_research_project_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_research_project_items: member reads"
  ON public.library_research_project_items FOR SELECT
  USING (public.is_library_research_project_member(project_id));

CREATE POLICY "library_research_project_items: editor inserts"
  ON public.library_research_project_items FOR INSERT
  WITH CHECK (public.is_library_research_project_editor(project_id) AND added_by = auth.uid());

CREATE POLICY "library_research_project_items: editor updates"
  ON public.library_research_project_items FOR UPDATE
  USING (public.is_library_research_project_editor(project_id));

CREATE POLICY "library_research_project_items: editor deletes"
  ON public.library_research_project_items FOR DELETE
  USING (public.is_library_research_project_editor(project_id));

CREATE TABLE IF NOT EXISTS public.library_research_project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.library_research_projects(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.library_research_project_items(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_research_project_comments_project ON public.library_research_project_comments(project_id, created_at);

ALTER TABLE public.library_research_project_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_research_project_comments: member reads"
  ON public.library_research_project_comments FOR SELECT
  USING (public.is_library_research_project_member(project_id));

CREATE POLICY "library_research_project_comments: member writes own"
  ON public.library_research_project_comments FOR INSERT
  WITH CHECK (author_id = auth.uid() AND public.is_library_research_project_member(project_id));

CREATE POLICY "library_research_project_comments: author or owner deletes"
  ON public.library_research_project_comments FOR DELETE
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.library_research_projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.library_research_project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.library_research_projects(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  note TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_research_project_versions_project ON public.library_research_project_versions(project_id, created_at DESC);

ALTER TABLE public.library_research_project_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_research_project_versions: member reads"
  ON public.library_research_project_versions FOR SELECT
  USING (public.is_library_research_project_member(project_id));

CREATE POLICY "library_research_project_versions: editor writes"
  ON public.library_research_project_versions FOR INSERT
  WITH CHECK (public.is_library_research_project_editor(project_id) AND created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.snapshot_library_research_project(_project_id UUID, _note TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _snapshot JSONB;
  _version_id UUID;
BEGIN
  IF NOT public.is_library_research_project_editor(_project_id) THEN
    RAISE EXCEPTION 'Not authorized to snapshot this project';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'item_type', item_type, 'book_id', book_id, 'note_id', note_id,
    'highlight_id', highlight_id, 'saved_search_id', saved_search_id,
    'analysis_id', analysis_id, 'citation_text', citation_text
  )), '[]'::jsonb) INTO _snapshot
  FROM public.library_research_project_items WHERE project_id = _project_id;

  INSERT INTO public.library_research_project_versions (project_id, snapshot, note, created_by)
  VALUES (_project_id, _snapshot, _note, auth.uid())
  RETURNING id INTO _version_id;

  RETURN _version_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.snapshot_library_research_project(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.invite_to_library_research_project(_project_id UUID, _email TEXT, _role TEXT DEFAULT 'viewer')
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _target_user_id UUID;
BEGIN
  IF NOT public.is_library_research_project_editor(_project_id) THEN
    RAISE EXCEPTION 'Not authorized to invite members';
  END IF;
  IF _role NOT IN ('editor', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT id INTO _target_user_id FROM auth.users WHERE email = _email;
  IF _target_user_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.library_research_project_members (project_id, user_id, role)
  VALUES (_project_id, _target_user_id, _role)
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_to_library_research_project(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 6. KNOWLEDGE MAP + TRENDING/EMERGING RPCs
-- ============================================================================

-- Traverses library_kg_entity_relations (undirected edges) up to _max_depth,
-- restricted to relation types that express a learning-path-like structure.
-- "is_unlocked" reuses Learning Hub's completion signal (library_reading_
-- progress) so a Knowledge Map's prerequisite gating reflects real reading
-- history rather than a separate progress system.
CREATE OR REPLACE FUNCTION public.get_library_knowledge_map(_root_entity_id UUID, _max_depth INTEGER DEFAULT 2)
RETURNS TABLE (entity_id UUID, name TEXT, entity_type TEXT, depth INTEGER, relation_type TEXT, is_unlocked BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user UUID := auth.uid();
BEGIN
  RETURN QUERY
  WITH RECURSIVE map AS (
    SELECT _root_entity_id AS id, 0 AS depth, NULL::TEXT AS relation_type
    UNION ALL
    SELECT
      CASE WHEN r.entity_id_a = map.id THEN r.entity_id_b ELSE r.entity_id_a END,
      map.depth + 1,
      r.relation_type
    FROM public.library_kg_entity_relations r
    JOIN map ON (r.entity_id_a = map.id OR r.entity_id_b = map.id)
    WHERE map.depth < _max_depth
      AND r.relation_type IN ('prerequisite_of', 'leads_to', 'advanced_version_of', 'related_to')
  )
  SELECT DISTINCT ON (e.id)
    e.id, e.name, e.entity_type::TEXT, map.depth, map.relation_type,
    (map.depth = 0 OR EXISTS (
      SELECT 1 FROM public.library_kg_book_entities kbe
      JOIN public.library_reading_progress rp ON rp.book_id = kbe.book_id
      WHERE kbe.entity_id = e.id AND rp.user_id = _user AND rp.completed_at IS NOT NULL
    )) AS is_unlocked
  FROM map
  JOIN public.library_kg_entities e ON e.id = map.id
  ORDER BY e.id, map.depth ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_library_knowledge_map(UUID, INTEGER) TO anon, authenticated;

-- Serves both "trending" (recent_mentions volume) and "emerging" (growth_
-- ratio vs. the prior week) — one deterministic query, two ways to sort/
-- label it in the UI, rather than a vague "AI-detected" claim.
CREATE OR REPLACE FUNCTION public.get_library_trending_topics(_limit INTEGER DEFAULT 10)
RETURNS TABLE (entity_id UUID, name TEXT, entity_type TEXT, recent_mentions BIGINT, growth_ratio NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH recent AS (
    SELECT kbe.entity_id, count(*) AS recent_count
    FROM public.library_kg_book_entities kbe
    JOIN public.library_analytics_events ae ON ae.entity_id = kbe.book_id AND ae.entity_type = 'book'
    WHERE ae.created_at >= now() - INTERVAL '7 days'
    GROUP BY kbe.entity_id
  ),
  prior AS (
    SELECT kbe.entity_id, count(*) AS prior_count
    FROM public.library_kg_book_entities kbe
    JOIN public.library_analytics_events ae ON ae.entity_id = kbe.book_id AND ae.entity_type = 'book'
    WHERE ae.created_at >= now() - INTERVAL '14 days' AND ae.created_at < now() - INTERVAL '7 days'
    GROUP BY kbe.entity_id
  )
  SELECT e.id, e.name, e.entity_type::TEXT, recent.recent_count,
    round(recent.recent_count::NUMERIC / GREATEST(prior.prior_count, 1), 2) AS growth_ratio
  FROM recent
  JOIN public.library_kg_entities e ON e.id = recent.entity_id
  LEFT JOIN prior ON prior.entity_id = recent.entity_id
  WHERE recent.recent_count >= 3
  ORDER BY growth_ratio DESC, recent.recent_count DESC
  LIMIT GREATEST(_limit, 1)
$$;

GRANT EXECUTE ON FUNCTION public.get_library_trending_topics(INTEGER) TO anon, authenticated;
