-- ─── Library — Enterprise Platform: Analytics ──────────────────────────────
-- Deterministic SQL aggregates (no LLM) over existing reading/engagement
-- tables, scoped to an organization's active member roster — matches this
-- app's established "don't call an LLM for what's really a SQL aggregate"
-- precedent (get_library_trending_topics, get_library_reading_coach_stats).
--
-- All of these are admin-only (member-level engagement/reading data about
-- OTHER members is sensitive) — plpgsql (not plain sql) so each can assert
-- is_organization_admin() and RAISE EXCEPTION for non-admins, rather than a
-- plain-sql function silently returning empty/zero rows to anyone who calls
-- it with an org id they don't belong to.

CREATE OR REPLACE FUNCTION public.get_organization_reading_stats(_organization_id UUID)
RETURNS TABLE (total_reading_hours NUMERIC, total_books_completed BIGINT, active_member_count BIGINT, avg_completion_rate NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_organization_admin(_organization_id) THEN
    RAISE EXCEPTION 'Not authorized to view this organization''s analytics';
  END IF;

  RETURN QUERY
  WITH roster AS (
    SELECT m.user_id FROM public.organization_members m WHERE m.organization_id = _organization_id AND m.status = 'active' AND m.user_id IS NOT NULL
  ),
  activity AS (
    SELECT sum(a.minutes_read) AS total_minutes FROM public.library_reading_daily_activity a JOIN roster r ON r.user_id = a.user_id
  ),
  completions AS (
    SELECT count(*) AS completed FROM public.library_reading_progress p JOIN roster r ON r.user_id = p.user_id WHERE p.completed_at IS NOT NULL
  ),
  progress_rate AS (
    SELECT avg(p.percent_complete) AS avg_pct FROM public.library_reading_progress p JOIN roster r ON r.user_id = p.user_id
  )
  SELECT
    round(COALESCE((SELECT total_minutes FROM activity), 0) / 60.0, 1),
    COALESCE((SELECT completed FROM completions), 0),
    (SELECT count(*) FROM roster),
    round(COALESCE((SELECT avg_pct FROM progress_rate), 0), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_reading_stats(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_organization_popular_books(_organization_id UUID, _limit INTEGER DEFAULT 10)
RETURNS TABLE (book_id UUID, title TEXT, reader_count BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_organization_admin(_organization_id) THEN
    RAISE EXCEPTION 'Not authorized to view this organization''s analytics';
  END IF;

  RETURN QUERY
  SELECT p.book_id, b.title, count(DISTINCT p.user_id)
  FROM public.library_reading_progress p
  JOIN public.organization_members m ON m.user_id = p.user_id AND m.organization_id = _organization_id AND m.status = 'active'
  JOIN public.library_books b ON b.id = p.book_id
  GROUP BY p.book_id, b.title
  ORDER BY count(DISTINCT p.user_id) DESC
  LIMIT GREATEST(_limit, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_popular_books(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_organization_department_activity(_organization_id UUID)
RETURNS TABLE (department_id UUID, department_name TEXT, member_count BIGINT, total_reading_minutes NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_organization_admin(_organization_id) THEN
    RAISE EXCEPTION 'Not authorized to view this organization''s analytics';
  END IF;

  RETURN QUERY
  SELECT g.id, g.name, count(DISTINCT m.user_id), COALESCE(sum(a.minutes_read), 0)
  FROM public.organization_groups g
  JOIN public.organization_members m ON m.department_id = g.id AND m.status = 'active'
  LEFT JOIN public.library_reading_daily_activity a ON a.user_id = m.user_id
  WHERE g.organization_id = _organization_id AND g.group_type = 'department'
  GROUP BY g.id, g.name
  ORDER BY g.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_department_activity(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_organization_member_engagement(_organization_id UUID, _limit INTEGER DEFAULT 50)
RETURNS TABLE (user_id UUID, books_completed BIGINT, reading_minutes NUMERIC, assignments_completed BIGINT, last_active_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_organization_admin(_organization_id) THEN
    RAISE EXCEPTION 'Not authorized to view this organization''s analytics';
  END IF;

  RETURN QUERY
  SELECT m.user_id,
    COALESCE((SELECT count(*) FROM public.library_reading_progress p WHERE p.user_id = m.user_id AND p.completed_at IS NOT NULL), 0),
    COALESCE((SELECT sum(a.minutes_read) FROM public.library_reading_daily_activity a WHERE a.user_id = m.user_id), 0),
    COALESCE((SELECT count(*) FROM public.organization_assignment_completions c
      JOIN public.organization_assignments oa ON oa.id = c.assignment_id
      WHERE c.user_id = m.user_id AND oa.organization_id = _organization_id), 0),
    (SELECT max(p.last_read_at) FROM public.library_reading_progress p WHERE p.user_id = m.user_id)
  FROM public.organization_members m
  WHERE m.organization_id = _organization_id AND m.status = 'active' AND m.user_id IS NOT NULL
  ORDER BY (SELECT max(p.last_read_at) FROM public.library_reading_progress p WHERE p.user_id = m.user_id) DESC NULLS LAST
  LIMIT GREATEST(_limit, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_member_engagement(UUID, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_organization_training_completion(_organization_id UUID)
RETURNS TABLE (assignment_id UUID, title TEXT, assignment_type public.organization_assignment_type, assigned_count BIGINT, completed_count BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_organization_admin(_organization_id) THEN
    RAISE EXCEPTION 'Not authorized to view this organization''s analytics';
  END IF;

  RETURN QUERY
  WITH assigned AS (
    SELECT a.id, a.title, a.assignment_type,
      CASE WHEN a.assigned_to_user_id IS NOT NULL THEN 1
           ELSE (SELECT count(*) FROM public.organization_group_members gm WHERE gm.group_id = a.assigned_to_group_id)
      END AS assigned_count
    FROM public.organization_assignments a
    WHERE a.organization_id = _organization_id
  )
  SELECT a.id, a.title, a.assignment_type, a.assigned_count, COALESCE((SELECT count(*) FROM public.organization_assignment_completions c WHERE c.assignment_id = a.id), 0)
  FROM assigned a
  ORDER BY a.title;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_training_completion(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_organization_certificates_earned(_organization_id UUID)
RETURNS BIGINT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _count BIGINT;
BEGIN
  IF NOT public.is_organization_admin(_organization_id) THEN
    RAISE EXCEPTION 'Not authorized to view this organization''s analytics';
  END IF;

  SELECT count(*) INTO _count FROM public.library_certificates cert
  JOIN public.organization_assignments a ON a.id = cert.reference_id AND cert.certificate_type = 'organization_assignment'
  WHERE a.organization_id = _organization_id;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_organization_certificates_earned(UUID) TO authenticated;
