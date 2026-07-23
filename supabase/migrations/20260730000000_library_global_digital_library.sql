-- ============================================================
-- Migration: Global Digital Library (Phase 11)
--
-- Purpose: scale the existing Library catalog/collections/series/reading-
-- lists into a genuinely global digital library — wider content-type
-- coverage, AI auto-organization (topics/subtopics/reading level/related
-- books/learning paths), AI-suggested (review-gated) series linking,
-- per-book multi-language metadata, a public-domain import review queue
-- with dedup detection (reusing the EXISTING draft/review/approved/
-- published/scheduled/archived/rejected workflow rather than inventing a
-- parallel state machine), book-level edition/preservation history (kept
-- distinct from the existing CHAPTER-level library_book_versions), reading
-- list sharing, a persistent cross-book AI knowledge graph, academic
-- metadata (DOI/ISSN), a generic audit log, and a background-jobs queue so
-- heavy AI work runs async. Reuses has_role/touch_updated_at/
-- can_edit_library_book/is_library_book_owner/check_ai_rate_limit/
-- match_library_books_semantic throughout — no access primitive is
-- reinvented.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 1. library_books additions
-- ============================================================

-- Wider content-type coverage (spec: "Academic Journals", "Historical
-- Documents" — everything else the spec lists was already covered by the
-- Phase 9 content_format list: research/magazine/documentation/manual/
-- comic/children/etc.).
ALTER TABLE public.library_books DROP CONSTRAINT IF EXISTS library_books_content_format_check;
ALTER TABLE public.library_books ADD CONSTRAINT library_books_content_format_check
  CHECK (content_format IN ('novel', 'educational', 'scientific', 'research', 'magazine', 'comic',
                             'children', 'cookbook', 'documentation', 'manual', 'interactive', 'audiobook',
                             'journal', 'historical_document'));

ALTER TABLE public.library_books
  -- Academic support.
  ADD COLUMN IF NOT EXISTS doi TEXT,
  ADD COLUMN IF NOT EXISTS issn TEXT,
  -- AI auto-organization. keywords/reading_time_minutes/difficulty_level
  -- already existed (Phase 4/6.5) — topics/subtopics/reading_level are new,
  -- deliberately distinct: difficulty_level is skill-level (beginner/
  -- intermediate/advanced), reading_level is an age/grade band.
  ADD COLUMN IF NOT EXISTS topics TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subtopics TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reading_level TEXT
    CHECK (reading_level IS NULL OR reading_level IN ('early_reader', 'middle_grade', 'young_adult', 'adult', 'graduate')),
  ADD COLUMN IF NOT EXISTS auto_classified_at TIMESTAMPTZ,
  -- Public-domain import review: reuses the existing publish_status
  -- workflow ('review' is already a valid state — see guard_library_
  -- publish_status_transition in the Phase 9 migration) rather than a
  -- parallel queue/state machine. These columns just carry the review
  -- context alongside it.
  ADD COLUMN IF NOT EXISTS import_source TEXT,
  ADD COLUMN IF NOT EXISTS imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS potential_duplicate_of UUID REFERENCES public.library_books(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duplicate_checked_at TIMESTAMPTZ;

COMMENT ON COLUMN public.library_books.reading_level IS 'Age/grade band (early_reader/middle_grade/young_adult/adult/graduate) — distinct from difficulty_level (skill level within any age band).';
COMMENT ON COLUMN public.library_books.potential_duplicate_of IS 'Set by the import dedup check (find_potential_duplicate_book) at import time; the review UI surfaces this so a human decides merge vs. keep-both — never auto-merged.';

-- Scalability indexes not already covered by the Phase 3/4 migration
-- (category_id, publish_status, book_type, rating, published_date, and the
-- tsvector GIN index already exist — see 20260720000000).
--
-- Query-level scaling (these indexes, the background job queue below, and
-- caching at the React Query layer) is what this app's own code controls.
-- CDN edge caching and horizontal scaling of the API/DB tier are hosting
-- infrastructure decisions (e.g. Supabase's compute add-ons, a CDN in front
-- of Storage) made in a dashboard/ops layer, not something a SQL migration
-- or this codebase configures — stated plainly rather than implying this
-- migration provisions infrastructure it does not.
CREATE INDEX IF NOT EXISTS idx_library_books_language ON public.library_books(language);
CREATE INDEX IF NOT EXISTS idx_library_books_keywords_gin ON public.library_books USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_library_books_topics_gin ON public.library_books USING GIN(topics);
CREATE INDEX IF NOT EXISTS idx_library_books_title_trgm ON public.library_books USING GIN(title gin_trgm_ops);

-- Server-side dedup check for the import review queue: trigram title
-- similarity + same author (if known) + exact ISBN match, whichever is
-- strongest. SECURITY DEFINER since it must read across all books
-- regardless of the caller's own access (service-role only — the import
-- edge function calls this, never the client directly).
CREATE OR REPLACE FUNCTION public.find_potential_duplicate_book(_title TEXT, _author_id UUID, _isbn TEXT)
RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _match UUID;
BEGIN
  IF _isbn IS NOT NULL THEN
    SELECT id INTO _match FROM public.library_books WHERE isbn = _isbn LIMIT 1;
    IF _match IS NOT NULL THEN RETURN _match; END IF;
  END IF;

  SELECT id INTO _match
  FROM public.library_books
  WHERE (_author_id IS NULL OR author_id = _author_id)
    AND similarity(title, _title) > 0.6
  ORDER BY similarity(title, _title) DESC
  LIMIT 1;

  RETURN _match;
END;
$$;

REVOKE ALL ON FUNCTION public.find_potential_duplicate_book(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_potential_duplicate_book(TEXT, UUID, TEXT) TO service_role;

-- Typo-tolerant fallback for the public catalog search: title-similarity
-- ranked match, used only when a plain ILIKE search returns nothing (see
-- fetchFuzzyBookMatches in catalog.ts) so the common exact-substring path
-- stays a simple ILIKE with no ranking overhead.
CREATE OR REPLACE FUNCTION public.fuzzy_search_library_books(_query TEXT, _match_count INTEGER DEFAULT 20)
RETURNS TABLE (book_id UUID, similarity_score REAL)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, similarity(title, _query)
  FROM public.library_books
  WHERE publish_status = 'published' AND similarity(title, _query) > 0.25
  ORDER BY similarity(title, _query) DESC
  LIMIT GREATEST(_match_count, 1)
$$;

GRANT EXECUTE ON FUNCTION public.fuzzy_search_library_books(TEXT, INTEGER) TO anon, authenticated;

-- ============================================================
-- 2. Related books cache (populated by library-ai-classify-book from the
-- existing embedding similarity — match_library_books_semantic already
-- computes this; this table just caches the top matches instead of
-- recomputing per page view).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_related_books (
  book_id         UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  related_book_id UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  similarity      NUMERIC NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (book_id, related_book_id),
  CHECK (book_id <> related_book_id)
);

ALTER TABLE public.library_related_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "library_related_books: public read" ON public.library_related_books FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_library_related_books_book ON public.library_related_books(book_id, similarity DESC);

-- ============================================================
-- 3. Learning paths — curated, ordered book sequences.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_learning_paths (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  cover_image_url TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published    BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_learning_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "library_learning_paths: public read published" ON public.library_learning_paths FOR SELECT USING (is_published OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "library_learning_paths: admin manages" ON public.library_learning_paths FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS library_learning_paths_updated_at ON public.library_learning_paths;
CREATE TRIGGER library_learning_paths_updated_at
  BEFORE UPDATE ON public.library_learning_paths
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.library_learning_path_books (
  path_id       UUID NOT NULL REFERENCES public.library_learning_paths(id) ON DELETE CASCADE,
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  order_index   INTEGER NOT NULL DEFAULT 0,
  note          TEXT,
  PRIMARY KEY (path_id, book_id)
);

ALTER TABLE public.library_learning_path_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "library_learning_path_books: public read" ON public.library_learning_path_books FOR SELECT USING (true);
CREATE POLICY "library_learning_path_books: admin manages" ON public.library_learning_path_books FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_learning_path_books_path ON public.library_learning_path_books(path_id, order_index);

-- ============================================================
-- 4. Series suggestions — AI proposes, author/admin reviews (confirmed
-- choice: no fully-automatic linking). Approving one sets library_books.
-- series_id/series_position directly from the edge function/hook, not a
-- trigger, so the reviewer's edits (e.g. adjusted position) are what gets
-- applied.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_series_suggestions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id                UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  suggested_series_id    UUID REFERENCES public.library_series(id) ON DELETE CASCADE,
  suggested_series_title TEXT,
  suggested_position     INTEGER,
  confidence             NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  reasoning              TEXT,
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (suggested_series_id IS NOT NULL OR suggested_series_title IS NOT NULL)
);

ALTER TABLE public.library_series_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_series_suggestions: owner/admin read"
  ON public.library_series_suggestions FOR SELECT
  USING (public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_series_suggestions: owner/admin review"
  ON public.library_series_suggestions FOR UPDATE
  USING (public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_series_suggestions_book ON public.library_series_suggestions(book_id);
CREATE INDEX IF NOT EXISTS idx_library_series_suggestions_status ON public.library_series_suggestions(status);

-- ============================================================
-- 5. Multi-language per-book metadata. language on library_books stays the
-- book's ORIGINAL language; this table holds AI- or human-translated
-- metadata for other languages, read as an overlay by the frontend
-- (original row is always the fallback).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_book_translations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id           UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  language_code     TEXT NOT NULL,
  title             TEXT NOT NULL,
  subtitle          TEXT,
  description       TEXT,
  description_long  TEXT,
  keywords          TEXT[] NOT NULL DEFAULT '{}',
  translated_by     TEXT NOT NULL DEFAULT 'ai' CHECK (translated_by IN ('ai', 'human')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, language_code)
);

ALTER TABLE public.library_book_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "library_book_translations: public read" ON public.library_book_translations FOR SELECT USING (true);
CREATE POLICY "library_book_translations: owner/admin manage"
  ON public.library_book_translations FOR ALL
  USING (public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS library_book_translations_updated_at ON public.library_book_translations;
CREATE TRIGGER library_book_translations_updated_at
  BEFORE UPDATE ON public.library_book_translations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_library_book_translations_book ON public.library_book_translations(book_id);

CREATE TABLE IF NOT EXISTS public.library_category_translations (
  category_id   UUID NOT NULL REFERENCES public.library_categories(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  PRIMARY KEY (category_id, language_code)
);

ALTER TABLE public.library_category_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "library_category_translations: public read" ON public.library_category_translations FOR SELECT USING (true);
CREATE POLICY "library_category_translations: admin manages" ON public.library_category_translations FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 6. Reading list sharing — extends the existing is_public-only model.
-- list_type is purely a display/browse label (course/school badge);
-- visibility is what actually gates access. is_public is kept in sync via
-- trigger so every existing read site (RLS policies, fetchReadingLists,
-- etc.) keeps working unchanged.
-- ============================================================
ALTER TABLE public.library_reading_lists
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'public')),
  ADD COLUMN IF NOT EXISTS list_type TEXT NOT NULL DEFAULT 'personal' CHECK (list_type IN ('personal', 'course', 'school'));

-- ADD COLUMN ... DEFAULT 'private' backfills every existing row (including
-- already-public lists) with 'private' — reconcile from the pre-existing
-- is_public flag now, once, before the sync trigger below takes over.
UPDATE public.library_reading_lists SET visibility = 'public' WHERE is_public = true AND visibility = 'private';

CREATE OR REPLACE FUNCTION public.sync_library_reading_list_is_public()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.is_public := (NEW.visibility = 'public');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_reading_lists_sync_is_public ON public.library_reading_lists;
CREATE TRIGGER library_reading_lists_sync_is_public
  BEFORE INSERT OR UPDATE OF visibility ON public.library_reading_lists
  FOR EACH ROW EXECUTE FUNCTION public.sync_library_reading_list_is_public();

CREATE TABLE IF NOT EXISTS public.library_reading_list_shares (
  list_id             UUID NOT NULL REFERENCES public.library_reading_lists(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, shared_with_user_id)
);

ALTER TABLE public.library_reading_list_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_reading_list_shares: owner or shared-with reads"
  ON public.library_reading_list_shares FOR SELECT
  USING (auth.uid() = shared_with_user_id OR public.is_library_reading_list_owner(list_id));

CREATE POLICY "library_reading_list_shares: owner manages"
  ON public.library_reading_list_shares FOR ALL
  USING (public.is_library_reading_list_owner(list_id))
  WITH CHECK (public.is_library_reading_list_owner(list_id));

-- The owner only has the recipient's email, not their user_id — this
-- resolves + inserts in one atomic, owner-only-callable step so the
-- resolution never becomes a general-purpose email-existence oracle (same
-- reasoning as find_user_id_by_email, just exposed narrowly to
-- authenticated owners instead of only service_role since the caller here
-- is already authorizing a real, visible side effect, not a probe).
CREATE OR REPLACE FUNCTION public.share_library_reading_list(_list_id UUID, _email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _target_user_id UUID;
BEGIN
  IF NOT public.is_library_reading_list_owner(_list_id) THEN
    RAISE EXCEPTION 'Not authorized to share this list';
  END IF;

  SELECT id INTO _target_user_id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _target_user_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.library_reading_list_shares (list_id, shared_with_user_id)
  VALUES (_list_id, _target_user_id)
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.share_library_reading_list(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_library_reading_list(UUID, TEXT) TO authenticated;

-- Widen visibility to also cover 'shared' — CREATE OR REPLACE, same
-- signature as the Phase 3 original.
CREATE OR REPLACE FUNCTION public.is_library_reading_list_visible(_list_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_reading_lists l
    WHERE l.id = _list_id
      AND (
        l.visibility = 'public'
        OR l.user_id = auth.uid()
        OR (l.visibility = 'shared' AND EXISTS (
          SELECT 1 FROM public.library_reading_list_shares s WHERE s.list_id = l.id AND s.shared_with_user_id = auth.uid()
        ))
      )
  )
$$;

-- The existing "read own or public" SELECT policy on library_reading_lists
-- only covers is_public/owner — add shared-with-me visibility explicitly.
CREATE POLICY "library_reading_lists: shared-with-me reads"
  ON public.library_reading_lists FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.library_reading_list_shares s WHERE s.list_id = id AND s.shared_with_user_id = auth.uid()));

-- ============================================================
-- 7. Digital preservation — book-level edition history, distinct from
-- library_book_versions (which is chapter-DRAFT history inside the
-- editor). This tracks published editions of a whole book over time.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_book_editions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id        UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  edition_label  TEXT NOT NULL,
  change_summary TEXT,
  is_current     BOOLEAN NOT NULL DEFAULT true,
  archived_at    TIMESTAMPTZ,
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_book_editions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_book_editions: read if book visible"
  ON public.library_book_editions FOR SELECT
  USING (public.is_library_book_published(book_id) OR public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_book_editions: owner/admin manage"
  ON public.library_book_editions FOR ALL
  USING (public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_book_editions_book ON public.library_book_editions(book_id, created_at DESC);

-- Archiving a new current edition retires the previous one — one function
-- call from the UI (services/library layer), not a trigger, so the author
-- explicitly chooses when an edition is superseded rather than it happening
-- as a side effect of an unrelated update.
CREATE OR REPLACE FUNCTION public.create_library_book_edition(_book_id UUID, _edition_label TEXT, _change_summary TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _new_id UUID;
BEGIN
  IF NOT (public.can_edit_library_book(_book_id) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized to create an edition for this book';
  END IF;

  UPDATE public.library_book_editions
  SET is_current = false, archived_at = now()
  WHERE book_id = _book_id AND is_current = true;

  INSERT INTO public.library_book_editions (book_id, edition_label, change_summary, created_by)
  VALUES (_book_id, _edition_label, _change_summary, auth.uid())
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_library_book_edition(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_library_book_edition(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 8. AI Knowledge Graph — persistent, cross-book. Distinct from the
-- existing per-book on-the-fly AI modes (character-explorer/concepts-
-- explorer/timeline in library-ai-assistant), which generate fresh text per
-- request and store nothing. This is real graph data other books/entities
-- can be looked up and navigated through.
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.library_kg_entity_type AS ENUM
    ('author', 'topic', 'character', 'historical_event', 'scientific_concept', 'location', 'organization', 'person');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.library_kg_entities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.library_kg_entity_type NOT NULL,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, name)
);

ALTER TABLE public.library_kg_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "library_kg_entities: public read" ON public.library_kg_entities FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_library_kg_entities_type ON public.library_kg_entities(entity_type);

CREATE TABLE IF NOT EXISTS public.library_kg_book_entities (
  book_id    UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  entity_id  UUID NOT NULL REFERENCES public.library_kg_entities(id) ON DELETE CASCADE,
  context    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (book_id, entity_id)
);

ALTER TABLE public.library_kg_book_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "library_kg_book_entities: public read" ON public.library_kg_book_entities FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_library_kg_book_entities_entity ON public.library_kg_book_entities(entity_id);

CREATE TABLE IF NOT EXISTS public.library_kg_entity_relations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id_a   UUID NOT NULL REFERENCES public.library_kg_entities(id) ON DELETE CASCADE,
  entity_id_b   UUID NOT NULL REFERENCES public.library_kg_entities(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  weight        NUMERIC NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (entity_id_a <> entity_id_b),
  UNIQUE (entity_id_a, entity_id_b, relation_type)
);

ALTER TABLE public.library_kg_entity_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "library_kg_entity_relations: public read" ON public.library_kg_entity_relations FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_library_kg_entity_relations_a ON public.library_kg_entity_relations(entity_id_a);
CREATE INDEX IF NOT EXISTS idx_library_kg_entity_relations_b ON public.library_kg_entity_relations(entity_id_b);

-- Only service-role writes the graph tables (populated by
-- library-build-knowledge-graph, never directly by a client).
CREATE POLICY "library_kg_entities: service role manages" ON public.library_kg_entities FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "library_kg_book_entities: service role manages" ON public.library_kg_book_entities FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "library_kg_entity_relations: service role manages" ON public.library_kg_entity_relations FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 9. Generic audit log — app-wide (not library-prefixed), first wired up
-- to the most sensitive Library admin actions (task #69). Insert-only from
-- the client's perspective; only admins can read it.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs: admin reads" ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "audit_logs: service role inserts" ON public.audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Lets an authenticated client log its OWN action (actor_id is always
-- auth.uid(), never client-supplied) despite the INSERT policy above being
-- service_role-only. Deliberately not admin-gated: e.g. an author submitting
-- a book for review is a legitimate audit event too, not just admin
-- moderation actions — only *reading* the trail back is admin-only.
CREATE OR REPLACE FUNCTION public.log_library_audit_event(_action TEXT, _entity_type TEXT, _entity_id UUID, _metadata JSONB DEFAULT '{}'::jsonb)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in to log an audit event';
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), _action, _entity_type, _entity_id, _metadata);
END;
$$;

REVOKE ALL ON FUNCTION public.log_library_audit_event(TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_library_audit_event(TEXT, TEXT, UUID, JSONB) TO authenticated;

-- ============================================================
-- 10. Background jobs queue — lets the classify/series-detect/translate/
-- knowledge-graph edge functions enqueue heavy AI work instead of blocking
-- the request that triggered it (e.g. right after an import). A simple
-- poll-based worker (a scheduled edge function invocation) claims pending
-- rows; no external queue service needed at this scale.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_background_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type    TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts    INTEGER NOT NULL DEFAULT 0,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_background_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "library_background_jobs: admin reads" ON public.library_background_jobs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "library_background_jobs: service role manages" ON public.library_background_jobs FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS library_background_jobs_updated_at ON public.library_background_jobs;
CREATE TRIGGER library_background_jobs_updated_at
  BEFORE UPDATE ON public.library_background_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_library_background_jobs_status ON public.library_background_jobs(status, created_at);

-- Admin-only enqueue path — the client (e.g. the import-review "approve"
-- action) runs as an authenticated admin, not service_role, so it can't
-- insert into library_background_jobs directly under the policy above.
CREATE OR REPLACE FUNCTION public.enqueue_library_background_job(_job_type TEXT, _payload JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _job_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can enqueue background jobs';
  END IF;

  INSERT INTO public.library_background_jobs (job_type, payload)
  VALUES (_job_type, _payload)
  RETURNING id INTO _job_id;

  RETURN _job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_library_background_job(TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_library_background_job(TEXT, JSONB) TO authenticated;

-- ============================================================
-- 11. Search-inside-book — full-text index on chapter content, scoped
-- per-book at query time. content_text already exists on library_chapters
-- (Phase 5); this just adds the tsvector + GIN index needed to search it
-- efficiently instead of a sequential ILIKE scan.
-- ============================================================
ALTER TABLE public.library_chapters
  ADD COLUMN IF NOT EXISTS content_search_vector TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', coalesce(content_text, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_library_chapters_content_search ON public.library_chapters USING GIN(content_search_vector);

-- \x01/\x02 mark the matched term in `snippet` instead of the default <b></b>,
-- so the client parses plain markers into React nodes rather than rendering
-- book content as raw HTML.
CREATE OR REPLACE FUNCTION public.search_inside_library_book(_book_id UUID, _query TEXT)
RETURNS TABLE (chapter_id UUID, chapter_title TEXT, chapter_number INTEGER, snippet TEXT, rank REAL)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id,
    c.title,
    c.chapter_number,
    ts_headline('simple', coalesce(c.content_text, ''), websearch_to_tsquery('simple', _query), E'StartSel=\x01, StopSel=\x02, MaxFragments=1,MinWords=8,MaxWords=24'),
    ts_rank(c.content_search_vector, websearch_to_tsquery('simple', _query))
  FROM public.library_chapters c
  WHERE c.book_id = _book_id
    AND c.content_search_vector @@ websearch_to_tsquery('simple', _query)
    AND (c.is_free_preview OR public.can_access_library_book_content(_book_id))
  ORDER BY ts_rank(c.content_search_vector, websearch_to_tsquery('simple', _query)) DESC
  LIMIT 20
$$;

GRANT EXECUTE ON FUNCTION public.search_inside_library_book(UUID, TEXT) TO anon, authenticated;
