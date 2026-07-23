-- ============================================================
-- Migration: Library discovery & analytics (Phase 2 backend)
-- Purpose:   Recommendation cache, search history, recently-viewed, and a
--            single daily-grain analytics fact table with weekly/monthly/
--            yearly rollups (see Phase 2 plan's "Scope decisions" — four
--            independently-maintained physical tables would drift out of
--            sync; one fact table + derived views is the standard pattern).
--
-- Tables added: library_book_recommendations, library_search_history,
--   library_recently_viewed, library_book_daily_stats.
-- Views added: library_book_stats_weekly, library_book_stats_monthly
--   (MATERIALIZED), library_book_stats_yearly.
-- ============================================================

-- ============================================================
-- library_book_recommendations (cache, populated by the
-- library-recommend-books edge function via its service-role client — no
-- direct-write policy for regular users, same "system writes, user reads"
-- pattern as library_xp_events)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_book_recommendations (
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id         UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  score           NUMERIC NOT NULL DEFAULT 0,
  reason          TEXT,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);

ALTER TABLE public.library_book_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_book_recommendations: user reads own"
  ON public.library_book_recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_recommendations_user_score ON public.library_book_recommendations(user_id, score DESC);

-- ============================================================
-- library_search_history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_search_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query             TEXT NOT NULL,
  results_count     INTEGER,
  searched_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_search_history: user manages own"
  ON public.library_search_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_search_history_user ON public.library_search_history(user_id, searched_at DESC);

-- ============================================================
-- library_recently_viewed (upserted on each book-detail view)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_recently_viewed (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  viewed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);

ALTER TABLE public.library_recently_viewed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_recently_viewed: user manages own"
  ON public.library_recently_viewed FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_recently_viewed_user ON public.library_recently_viewed(user_id, viewed_at DESC);

-- ============================================================
-- library_book_daily_stats (the single source-of-truth fact table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_book_daily_stats (
  book_id                       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  stat_date                     DATE NOT NULL,
  views                         INTEGER NOT NULL DEFAULT 0,
  downloads                     INTEGER NOT NULL DEFAULT 0,
  purchases                     INTEGER NOT NULL DEFAULT 0,
  favorites_added               INTEGER NOT NULL DEFAULT 0,
  reviews_added                 INTEGER NOT NULL DEFAULT 0,
  reading_sessions_started      INTEGER NOT NULL DEFAULT 0,
  reading_sessions_completed    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (book_id, stat_date)
);

ALTER TABLE public.library_book_daily_stats ENABLE ROW LEVEL SECURITY;

-- Internal analytics — book owner (author) or admin only, never public/reader.
CREATE POLICY "library_book_daily_stats: owner/admin reads"
  ON public.library_book_daily_stats FOR SELECT
  USING (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_book_daily_stats_date ON public.library_book_daily_stats(stat_date);

-- Writes happen exclusively through this SECURITY DEFINER helper (called by
-- the triggers below, and available to edge functions via RPC for events
-- with no dedicated table, e.g. a raw page view). _column is identifier-
-- quoted via format(%I), not string-interpolated, so this is not
-- SQL-injectable despite being dynamic SQL.
CREATE OR REPLACE FUNCTION public.bump_library_daily_stat(_book_id uuid, _column text, _delta integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.library_book_daily_stats (book_id, stat_date)
  VALUES (_book_id, CURRENT_DATE)
  ON CONFLICT (book_id, stat_date) DO NOTHING;

  EXECUTE format(
    'UPDATE public.library_book_daily_stats SET %I = %I + $1 WHERE book_id = $2 AND stat_date = $3',
    _column, _column
  ) USING _delta, _book_id, CURRENT_DATE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_library_daily_stat(uuid, text, integer) TO authenticated;

-- ── Automatic stat triggers on tables from earlier migrations ──────────────
-- (valid to add now — all target tables exist by this point in the
-- migration sequence)

CREATE OR REPLACE FUNCTION public.trg_bump_library_stat_views()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.bump_library_daily_stat(NEW.book_id, 'views', 1); RETURN NEW; END;
$$;
CREATE TRIGGER library_recently_viewed_bump_stat
  AFTER INSERT ON public.library_recently_viewed
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_library_stat_views();

CREATE OR REPLACE FUNCTION public.trg_bump_library_stat_favorites()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.bump_library_daily_stat(NEW.book_id, 'favorites_added', 1); RETURN NEW; END;
$$;
CREATE TRIGGER library_favorites_bump_stat
  AFTER INSERT ON public.library_favorites
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_library_stat_favorites();

CREATE OR REPLACE FUNCTION public.trg_bump_library_stat_reviews()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.bump_library_daily_stat(NEW.book_id, 'reviews_added', 1); RETURN NEW; END;
$$;
CREATE TRIGGER library_reviews_bump_stat
  AFTER INSERT ON public.library_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_library_stat_reviews();

CREATE OR REPLACE FUNCTION public.trg_bump_library_stat_downloads()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.bump_library_daily_stat(NEW.book_id, 'downloads', 1); RETURN NEW; END;
$$;
CREATE TRIGGER library_downloads_bump_stat
  AFTER INSERT ON public.library_downloads
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_library_stat_downloads();

-- Purchases: only count real completions, not every pending attempt.
CREATE OR REPLACE FUNCTION public.trg_bump_library_stat_purchases()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('paid','completed') AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('paid','completed')) THEN
    PERFORM public.bump_library_daily_stat(NEW.book_id, 'purchases', 1);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER library_purchases_bump_stat
  AFTER INSERT OR UPDATE OF status ON public.library_purchases
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_library_stat_purchases();

-- Reading sessions: started on first progress row, completed when
-- completed_at transitions from NULL to set.
CREATE OR REPLACE FUNCTION public.trg_bump_library_stat_reading_started()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM public.bump_library_daily_stat(NEW.book_id, 'reading_sessions_started', 1); RETURN NEW; END;
$$;
CREATE TRIGGER library_reading_progress_bump_started
  AFTER INSERT ON public.library_reading_progress
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_library_stat_reading_started();

CREATE OR REPLACE FUNCTION public.trg_bump_library_stat_reading_completed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    PERFORM public.bump_library_daily_stat(NEW.book_id, 'reading_sessions_completed', 1);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER library_reading_progress_bump_completed
  AFTER UPDATE OF completed_at ON public.library_reading_progress
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_library_stat_reading_completed();

-- ============================================================
-- Rollup views. Regular views use security_invoker so they enforce the
-- QUERYING user's RLS (owner/admin only) rather than the view owner's
-- privileges — without this, a view created by a privileged migration role
-- can silently bypass the base table's RLS for every caller.
-- ============================================================

CREATE OR REPLACE VIEW public.library_book_stats_weekly
WITH (security_invoker = true) AS
SELECT
  book_id,
  date_trunc('week', stat_date)::date AS period_start,
  SUM(views) AS views,
  SUM(downloads) AS downloads,
  SUM(purchases) AS purchases,
  SUM(favorites_added) AS favorites_added,
  SUM(reviews_added) AS reviews_added,
  SUM(reading_sessions_started) AS reading_sessions_started,
  SUM(reading_sessions_completed) AS reading_sessions_completed
FROM public.library_book_daily_stats
GROUP BY book_id, date_trunc('week', stat_date);

CREATE OR REPLACE VIEW public.library_book_stats_yearly
WITH (security_invoker = true) AS
SELECT
  book_id,
  date_trunc('year', stat_date)::date AS period_start,
  SUM(views) AS views,
  SUM(downloads) AS downloads,
  SUM(purchases) AS purchases,
  SUM(favorites_added) AS favorites_added,
  SUM(reviews_added) AS reviews_added,
  SUM(reading_sessions_started) AS reading_sessions_started,
  SUM(reading_sessions_completed) AS reading_sessions_completed
FROM public.library_book_daily_stats
GROUP BY book_id, date_trunc('year', stat_date);

-- Monthly is a MATERIALIZED VIEW (highest read volume of the three rollups
-- for an admin analytics dashboard) — but materialized views do NOT enforce
-- the base table's RLS for anyone with SELECT on them, so access is locked
-- down explicitly below rather than exposed to anon/authenticated at all;
-- the library-book-analytics edge function (service-role client) is the
-- only intended reader.
CREATE MATERIALIZED VIEW IF NOT EXISTS public.library_book_stats_monthly AS
SELECT
  book_id,
  date_trunc('month', stat_date)::date AS period_start,
  SUM(views) AS views,
  SUM(downloads) AS downloads,
  SUM(purchases) AS purchases,
  SUM(favorites_added) AS favorites_added,
  SUM(reviews_added) AS reviews_added,
  SUM(reading_sessions_started) AS reading_sessions_started,
  SUM(reading_sessions_completed) AS reading_sessions_completed
FROM public.library_book_daily_stats
GROUP BY book_id, date_trunc('month', stat_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_library_book_stats_monthly_pk ON public.library_book_stats_monthly(book_id, period_start);

REVOKE ALL ON public.library_book_stats_monthly FROM PUBLIC;
REVOKE ALL ON public.library_book_stats_monthly FROM anon, authenticated;
GRANT SELECT ON public.library_book_stats_monthly TO service_role;

-- Requires the pg_cron extension enabled in the Supabase dashboard (a
-- project-level toggle, not something a SQL migration can turn on) —
-- schedule with:
--   select cron.schedule('refresh-library-monthly-stats', '0 3 * * *',
--     $$select public.refresh_library_monthly_stats()$$);
-- Until pg_cron is enabled, a scheduled edge function can call this RPC
-- instead (service-role client, since PUBLIC/authenticated have no EXECUTE
-- grant on it below).
CREATE OR REPLACE FUNCTION public.refresh_library_monthly_stats()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.library_book_stats_monthly;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_library_monthly_stats() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_library_monthly_stats() TO service_role;
