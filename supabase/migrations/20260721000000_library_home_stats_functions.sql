-- ============================================================
-- Migration: Library home-page aggregate functions (Phase 3 backend gap-fix)
-- Purpose:   Three home-page sections need aggregates over tables that are
--            deliberately RLS'd to owner/admin or per-user-own in Phase 2
--            (library_book_daily_stats: owner/admin only;
--            library_reading_progress / library_search_history: own rows
--            only) — a visitor's anon-key client cannot compute "trending
--            books this week," "total readers," or "popular search terms"
--            directly. These three SECURITY DEFINER functions expose only
--            aggregated, non-personal results (never a raw per-user row),
--            same pattern as the existing has_role()/is_academy_course_
--            owner() helpers. No table is created, no existing RLS policy
--            is touched.
--
-- Functions added: get_library_trending_books, get_library_home_stats,
--   get_library_popular_searches.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_library_trending_books(_limit integer DEFAULT 10, _days integer DEFAULT 7)
RETURNS SETOF public.library_books
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.*
  FROM public.library_books b
  JOIN (
    SELECT book_id,
           SUM(views + downloads * 2 + purchases * 3 + favorites_added * 2 + reviews_added * 3) AS score
    FROM public.library_book_daily_stats
    WHERE stat_date >= CURRENT_DATE - _days
    GROUP BY book_id
  ) s ON s.book_id = b.id
  WHERE b.publish_status = 'published'
  ORDER BY s.score DESC
  LIMIT _limit
$$;

COMMENT ON FUNCTION public.get_library_trending_books IS 'Published books ranked by a weighted activity score (views/downloads/purchases/favorites/reviews) over the last _days days. Aggregates library_book_daily_stats (owner/admin-only RLS) into a public-safe ranked list — no per-day/per-owner figures are exposed.';

GRANT EXECUTE ON FUNCTION public.get_library_trending_books(integer, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_library_home_stats()
RETURNS TABLE (
  total_books        integer,
  total_authors      integer,
  total_readers      integer,
  total_reviews      integer,
  total_categories   integer,
  total_audiobooks   integer,
  total_pages        bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::integer FROM public.library_books WHERE publish_status = 'published'),
    (SELECT COUNT(*)::integer FROM public.library_authors),
    (SELECT COUNT(DISTINCT user_id)::integer FROM public.library_reading_progress),
    (SELECT COUNT(*)::integer FROM public.library_reviews),
    (SELECT COUNT(*)::integer FROM public.library_categories WHERE is_active = true),
    (SELECT COUNT(*)::integer FROM public.library_audiobooks),
    (SELECT COALESCE(SUM(page_count), 0)::bigint FROM public.library_books WHERE publish_status = 'published')
$$;

COMMENT ON FUNCTION public.get_library_home_stats IS 'Single-row platform-wide catalog stats for the home page hero/statistics sections. total_readers is a distinct-user COUNT over library_reading_progress (owner-only RLS) — this function exposes only the count, never which users or their individual progress.';

GRANT EXECUTE ON FUNCTION public.get_library_home_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_library_popular_searches(_limit integer DEFAULT 10)
RETURNS TABLE (query text, search_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT query, COUNT(*)::integer AS search_count
  FROM public.library_search_history
  WHERE searched_at >= now() - interval '30 days'
    AND length(trim(query)) > 0
  GROUP BY query
  ORDER BY search_count DESC, query ASC
  LIMIT _limit
$$;

COMMENT ON FUNCTION public.get_library_popular_searches IS 'Most-searched terms across all users in the last 30 days, for Smart Search''s "popular searches" suggestions. Aggregates library_search_history (own-rows-only RLS) into a public-safe term/count list — no per-user query history is exposed.';

GRANT EXECUTE ON FUNCTION public.get_library_popular_searches(integer) TO anon, authenticated;
