-- ─── Library — Final Release: Security Hardening Fixes ────────────────────
-- Fixes found by a dedicated security/RLS audit pass. Several UPDATE
-- policies across earlier phases had no WITH CHECK clause, so Postgres
-- silently reused USING for the new row — which never actually constrained
-- the row's scoping foreign key (context_id/club_id/topic_id/assignment_id/
-- organization role). The fix pattern throughout: require the NEW row to
-- ALSO satisfy the same membership/placement check its own INSERT policy
-- already requires — i.e. "you may edit your own row, but wherever you move
-- it must be somewhere you'd have been allowed to create it in the first
-- place" — rather than trying to compare NEW against OLD (which RLS WITH
-- CHECK clauses cannot do directly).

-- ============================================================================
-- 1. CRITICAL — organization_members: invited user could self-promote to
-- owner/admin while claiming their own invite, since the WITH CHECK only
-- pinned invited_email/user_id, never role/status.
-- ============================================================================

DROP POLICY IF EXISTS "organization_members: invited user claims own row" ON public.organization_members;

-- Replaced with a SECURITY DEFINER RPC that hardcodes exactly which columns
-- change (user_id, status) — the client can no longer supply role/status via
-- a raw UPDATE at all for this transition.
CREATE OR REPLACE FUNCTION public.claim_organization_invite(_organization_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.organization_members
  SET user_id = auth.uid(), status = 'active', joined_at = now()
  WHERE organization_id = _organization_id AND invited_email = auth.email() AND user_id IS NULL;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_organization_invite(UUID) TO authenticated;

-- ============================================================================
-- 2/3. HIGH — library_discussion_topics / library_discussion_replies:
-- author could reassign context_id/topic_id to plant content into a
-- private club they don't belong to.
-- ============================================================================

DROP POLICY IF EXISTS "library_discussion_topics: author/moderator/admin updates" ON public.library_discussion_topics;
CREATE POLICY "library_discussion_topics: author/moderator/admin updates"
  ON public.library_discussion_topics FOR UPDATE
  USING (
    auth.uid() = author_id
    OR (context_type = 'club' AND public.is_library_club_moderator(context_id))
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    -- Moderators/admins may edit in place without re-satisfying the
    -- author-placement rule (e.g. pinning/locking); authors moving/editing
    -- their own topic must land somewhere they could have posted it.
    public.is_library_club_moderator(context_id) OR public.has_role(auth.uid(), 'admin')
    OR (auth.uid() = author_id AND (context_type = 'book' OR public.is_library_club_member(context_id)))
  );

DROP POLICY IF EXISTS "library_discussion_replies: author/moderator/admin updates" ON public.library_discussion_replies;
CREATE POLICY "library_discussion_replies: author/moderator/admin updates"
  ON public.library_discussion_replies FOR UPDATE
  USING (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM public.library_discussion_topics t WHERE t.id = topic_id AND t.context_type = 'club' AND public.is_library_club_moderator(t.context_id))
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.library_discussion_topics t WHERE t.id = topic_id AND t.context_type = 'club' AND public.is_library_club_moderator(t.context_id))
    OR (auth.uid() = author_id AND public.can_access_library_discussion_topic(topic_id))
  );

-- ============================================================================
-- 4. MEDIUM — library_group_shared_notes: author could reassign club_id to
-- plant a note into a private club's shared-notes feed.
-- ============================================================================

DROP POLICY IF EXISTS "library_group_shared_notes: author or moderator updates" ON public.library_group_shared_notes;
CREATE POLICY "library_group_shared_notes: author or moderator updates"
  ON public.library_group_shared_notes FOR UPDATE
  USING (user_id = auth.uid() OR public.is_library_club_moderator(club_id))
  WITH CHECK (public.is_library_club_moderator(club_id) OR (user_id = auth.uid() AND public.is_library_club_member(club_id)));

-- ============================================================================
-- 5. LOW/MEDIUM — library_group_assignment_submissions: student could
-- reassign assignment_id to an assignment in a club they never joined.
-- ============================================================================

DROP POLICY IF EXISTS "library_group_assignment_submissions: user updates own before review" ON public.library_group_assignment_submissions;
CREATE POLICY "library_group_assignment_submissions: user updates own before review"
  ON public.library_group_assignment_submissions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.library_group_assignments a WHERE a.id = assignment_id AND public.is_library_club_member(a.club_id))
  );

-- ============================================================================
-- 6. MEDIUM — get_library_weak_topics(_user_id) let any signed-in user pass
-- another user's id and read their quiz weak-topic analytics.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_library_weak_topics(_user_id UUID DEFAULT NULL)
RETURNS TABLE (topic TEXT, accuracy_percent NUMERIC, attempts_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH target AS (SELECT auth.uid() AS uid WHERE _user_id IS NULL OR _user_id = auth.uid())
  SELECT qq.topic,
         round(100.0 * sum(CASE WHEN (qa.answers -> qq.id::text) = qq.correct_answer THEN 1 ELSE 0 END) / count(*), 1) AS accuracy_percent,
         count(*) AS attempts_count
  FROM public.library_quiz_attempts qa
  JOIN public.library_quiz_questions qq ON qq.quiz_id = qa.quiz_id
  JOIN target t ON qa.user_id = t.uid
  WHERE qa.submitted_at IS NOT NULL AND qq.topic IS NOT NULL AND qq.question_type NOT IN ('essay')
  GROUP BY qq.topic
  HAVING count(*) >= 2 AND (sum(CASE WHEN (qa.answers -> qq.id::text) = qq.correct_answer THEN 1 ELSE 0 END)::NUMERIC / count(*)) < 0.7
  ORDER BY accuracy_percent ASC
$$;

-- ============================================================================
-- 7. LOW/MEDIUM — get_library_reading_streak(_user_id) had no authorization
-- check at all; any signed-in user could read anyone's streak length.
-- ============================================================================

-- Same exact bounded backward day-walk as the original function (only
-- change: an authorization check added at the top) — preserves behavior
-- precisely rather than reimplementing the streak algorithm.
CREATE OR REPLACE FUNCTION public.get_library_reading_streak(_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _streak INTEGER := 0;
  _day DATE := CURRENT_DATE;
  _iterations INTEGER := 0;
  _has_activity BOOLEAN;
BEGIN
  IF _user_id != auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized to view this user''s reading streak';
  END IF;

  LOOP
    _iterations := _iterations + 1;
    EXIT WHEN _iterations > 3660;

    SELECT EXISTS(SELECT 1 FROM public.library_reading_daily_activity WHERE user_id = _user_id AND activity_date = _day) INTO _has_activity;

    IF NOT _has_activity THEN
      IF _day = CURRENT_DATE THEN
        _day := _day - 1;
        CONTINUE;
      END IF;
      EXIT;
    END IF;

    _streak := _streak + 1;
    _day := _day - 1;
  END LOOP;

  RETURN _streak;
END;
$$;

-- ============================================================================
-- 8. MEDIUM — get_organization_seat_usage / get_organization_concurrent_count
-- had no authorization check, unlike every sibling RPC in the same file.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_organization_seat_usage(_organization_id UUID)
RETURNS TABLE (license_id UUID, license_type public.organization_license_type, seat_count INTEGER, seats_used BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_organization_admin(_organization_id) THEN
    RAISE EXCEPTION 'Not authorized to view this organization''s licenses';
  END IF;

  RETURN QUERY
  SELECT l.id, l.license_type, l.seat_count, count(a.user_id)
  FROM public.organization_licenses l
  LEFT JOIN public.organization_license_assignments a ON a.license_id = l.id
  WHERE l.organization_id = _organization_id AND l.is_active = true
  GROUP BY l.id, l.license_type, l.seat_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_organization_concurrent_count(_organization_id UUID)
RETURNS BIGINT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _count BIGINT;
BEGIN
  IF NOT public.is_organization_admin(_organization_id) THEN
    RAISE EXCEPTION 'Not authorized to view this organization''s sessions';
  END IF;

  SELECT count(*) INTO _count FROM public.organization_sessions
  WHERE organization_id = _organization_id AND ended_at IS NULL AND last_seen_at > now() - INTERVAL '5 minutes';
  RETURN _count;
END;
$$;

-- ============================================================================
-- 9. MEDIUM/HIGH — organization-resources storage bucket's SELECT policy was
-- weaker than the underlying table's RLS: any active org member could
-- download a confidential/group-scoped file by storage_path, bypassing the
-- table's own confidentiality/group gating.
-- ============================================================================

DROP POLICY IF EXISTS "organization_resources_read" ON storage.objects;
CREATE POLICY "organization_resources_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'organization-resources'
    AND EXISTS (
      SELECT 1 FROM public.organization_resources r
      WHERE r.storage_path = storage.objects.name
        AND (
          public.is_organization_admin(r.organization_id)
          OR (
            public.organization_member_has_permission(r.organization_id, 'view')
            AND (NOT r.is_confidential OR EXISTS (
              SELECT 1 FROM public.organization_members m WHERE m.organization_id = r.organization_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin', 'manager')
            ))
            AND (r.group_id IS NULL OR EXISTS (SELECT 1 FROM public.organization_group_members gm WHERE gm.group_id = r.group_id AND gm.user_id = auth.uid()))
          )
        )
    )
  );

-- ============================================================================
-- 10. MEDIUM — library-generate-quotes edge function had no rate limit
-- (fixed in the function itself, not here — see supabase/functions/
-- library-generate-quotes/index.ts). check_ai_rate_limit's default-30/day
-- fallback for unlisted function names covers it once the function calls it.
-- ============================================================================
