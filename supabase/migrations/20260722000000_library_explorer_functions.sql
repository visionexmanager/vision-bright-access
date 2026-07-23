-- ============================================================
-- Migration: Library Explorer support (Phase 4 backend gap-fill)
-- Purpose:   Categories & Books Explorer needs a few aggregates PostgREST
--            can't express (COUNT DISTINCT, SUM, GROUP BY) and a small
--            analytics log — same "additive SECURITY DEFINER functions,
--            no existing RLS touched" pattern as Phase 3's
--            20260721000000_library_home_stats_functions.sql.
--
-- Added: library_analytics_events (table), library_tag_popularity (view),
--   get_library_category_stats(), get_library_categories_with_stats().
-- Changed (CREATE OR REPLACE, behavior-preserving):
--   maintain_library_book_counts() now also touches the affected
--   category's updated_at whenever its book_count changes, so "category
--   last updated" is a real trigger-maintained signal, not a new query.
-- ============================================================

-- ============================================================
-- library_analytics_events — mirrors the existing
-- public.career_analytics_events table exactly (20260705050000_
-- career_center_ai_and_analytics_schema.sql), the established per-vertical
-- pattern in this codebase rather than one shared cross-app table.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_analytics_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id    TEXT,
  event_type    TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     UUID,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_analytics_events: anyone records an event"
  ON public.library_analytics_events FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "library_analytics_events: admin reads"
  ON public.library_analytics_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_analytics_events_type ON public.library_analytics_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_analytics_events_entity ON public.library_analytics_events(entity_type, entity_id);

COMMENT ON TABLE public.library_analytics_events IS 'Lightweight event log (page views, card clicks, searches, filter changes) for the Books Explorer. At true high-volume scale this would need partitioning/archival — out of scope for this phase, noted for future work.';

-- ============================================================
-- library_tag_popularity — regular VIEW (not materialized: tag popularity
-- should stay live, and the underlying tables are small/bounded), over the
-- already-public library_tags/library_book_tags.
-- ============================================================
CREATE OR REPLACE VIEW public.library_tag_popularity
WITH (security_invoker = true) AS
SELECT
  t.id AS tag_id,
  t.name,
  t.slug,
  COUNT(bt.book_id) AS usage_count
FROM public.library_tags t
LEFT JOIN public.library_book_tags bt ON bt.tag_id = t.id
GROUP BY t.id, t.name, t.slug
ORDER BY usage_count DESC;

-- ============================================================
-- get_library_category_stats — one category's author_count/total_views
-- (book_count is already denormalized on library_categories, reused as-is).
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_library_category_stats(_category_id uuid)
RETURNS TABLE (author_count integer, total_views bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COUNT(DISTINCT author_id)::integer,
    COALESCE(SUM(views_count), 0)::bigint
  FROM public.library_books
  WHERE category_id = _category_id AND publish_status = 'published'
$$;

GRANT EXECUTE ON FUNCTION public.get_library_category_stats(uuid) TO anon, authenticated;

-- ============================================================
-- get_library_categories_with_stats — same idea for the categories grid
-- page, all active categories in one call. Categories are a small, bounded
-- set regardless of catalog size, so this stays cheap "at scale."
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_library_categories_with_stats()
RETURNS TABLE (
  id             uuid,
  parent_id      uuid,
  name           text,
  slug           text,
  description    text,
  icon           text,
  image_url      text,
  display_order  integer,
  book_count     integer,
  author_count   integer,
  updated_at     timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id, c.parent_id, c.name, c.slug, c.description, c.icon, c.image_url, c.display_order,
    COUNT(b.id) FILTER (WHERE b.publish_status = 'published')::integer AS book_count,
    COUNT(DISTINCT b.author_id) FILTER (WHERE b.publish_status = 'published')::integer AS author_count,
    c.updated_at
  FROM public.library_categories c
  LEFT JOIN public.library_books b ON b.category_id = c.id
  WHERE c.is_active = true
  GROUP BY c.id
  ORDER BY c.display_order
$$;

GRANT EXECUTE ON FUNCTION public.get_library_categories_with_stats() TO anon, authenticated;

-- ============================================================
-- maintain_library_book_counts() — CREATE OR REPLACE, behavior-preserving
-- plus one addition: touch the affected category's updated_at whenever its
-- book_count changes. Same INSERT/DELETE/UPDATE branches as
-- 20260720000001_library_core_engagement.sql, only the two
-- library_categories UPDATE statements gain `updated_at = now()`.
-- ============================================================
CREATE OR REPLACE FUNCTION public.maintain_library_book_counts()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.author_id IS NOT NULL THEN
      UPDATE public.library_authors SET books_count = books_count + 1 WHERE id = NEW.author_id;
    END IF;
    IF NEW.category_id IS NOT NULL THEN
      UPDATE public.library_categories SET book_count = book_count + 1, updated_at = now() WHERE id = NEW.category_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.author_id IS NOT NULL THEN
      UPDATE public.library_authors SET books_count = GREATEST(books_count - 1, 0) WHERE id = OLD.author_id;
    END IF;
    IF OLD.category_id IS NOT NULL THEN
      UPDATE public.library_categories SET book_count = GREATEST(book_count - 1, 0), updated_at = now() WHERE id = OLD.category_id;
    END IF;
    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
      IF OLD.author_id IS NOT NULL THEN
        UPDATE public.library_authors SET books_count = GREATEST(books_count - 1, 0) WHERE id = OLD.author_id;
      END IF;
      IF NEW.author_id IS NOT NULL THEN
        UPDATE public.library_authors SET books_count = books_count + 1 WHERE id = NEW.author_id;
      END IF;
    END IF;
    IF NEW.category_id IS DISTINCT FROM OLD.category_id THEN
      IF OLD.category_id IS NOT NULL THEN
        UPDATE public.library_categories SET book_count = GREATEST(book_count - 1, 0), updated_at = now() WHERE id = OLD.category_id;
      END IF;
      IF NEW.category_id IS NOT NULL THEN
        UPDATE public.library_categories SET book_count = book_count + 1, updated_at = now() WHERE id = NEW.category_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;
-- Trigger definition itself (library_books_maintain_counts, AFTER INSERT OR
-- UPDATE OR DELETE ON library_books) is unchanged from Phase 2 — CREATE OR
-- REPLACE FUNCTION swaps the body in place, no need to re-create the trigger.
