-- ============================================================
-- Migration: Library Reader Engine support (Phase 6 backend gap-fill)
--
-- Purpose: the one genuinely new piece of backend Phase 6 needs — reading
-- settings are book-independent (a user's font/theme choice applies across
-- every book), so they cannot correctly live on the per-(user_id,book_id)
-- library_reading_progress row without duplicating/desyncing across books.
-- Everything else Phase 6 needs (bookmarks, notes, highlights, chapters,
-- reading progress, signed file URLs) already exists from Phases 2-5.
--
-- Tables added: library_reader_settings.
-- Functions added: get_library_reader_analytics_summary.
-- ============================================================

-- ============================================================
-- library_reader_settings (one row per user, not per book — font, theme,
-- spacing, margins, scroll/page mode, all in one blob, mirroring the
-- last_position jsonb precedent already established on
-- library_reading_progress)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_reader_settings (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_reader_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_reader_settings: user manages own"
  ON public.library_reader_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER library_reader_settings_updated_at
  BEFORE UPDATE ON public.library_reader_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

COMMENT ON TABLE public.library_reader_settings IS 'One row per user (not per book) — reading preferences (font/theme/spacing/margins/scroll mode/page layout) that apply across every book the user reads, giving instant cross-device sync via the same upsert-and-refetch pattern used everywhere else in this app.';

-- ============================================================
-- get_library_reader_analytics_summary — self-scoped "your reading stats
-- for this book" aggregate. library_analytics_events SELECT is admin-only
-- (20260722000000_library_explorer_functions.sql), so a viewer's own client
-- cannot aggregate their own event history directly without this function —
-- same reasoning as every other SECURITY DEFINER aggregate RPC in this
-- codebase (get_library_trending_books, get_library_readers_also_read).
-- Cross-user aggregates ("most-read books" platform-wide, etc.) are
-- deliberately NOT added here — out of scope for a reader-experience phase,
-- left for a future admin-analytics phase.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_library_reader_analytics_summary(_book_id uuid)
RETURNS TABLE (
  reading_time_seconds  integer,
  pages_read            integer,
  sessions_count        integer,
  last_activity_at      timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(SUM((metadata->>'duration_seconds')::integer), 0)::integer,
    COALESCE(COUNT(*) FILTER (WHERE event_type = 'page_turned'), 0)::integer,
    COALESCE(COUNT(DISTINCT session_id), 0)::integer,
    MAX(created_at)
  FROM public.library_analytics_events
  WHERE user_id = auth.uid() AND entity_type = 'book' AND entity_id = _book_id
$$;

COMMENT ON FUNCTION public.get_library_reader_analytics_summary IS 'Self-scoped (auth.uid() derived internally, never caller-supplied) per-book reading stats aggregated from library_analytics_events, which is otherwise SELECT-admin-only.';

GRANT EXECUTE ON FUNCTION public.get_library_reader_analytics_summary(uuid) TO authenticated;
