-- ── Kids groups, voice rooms, multiplayer and quizzes: end the RLS recursion ─
--
-- Every read of these fourteen tables failed in production, for visitors and
-- signed-in children alike, with
--
--   42P17 infinite recursion detected in policy for relation "…"
--
--   kids_social_groups, kids_social_group_members, _messages, _materials,
--   _assignments, _assignment_submissions, kids_voice_rooms,
--   kids_voice_room_members, _bans, _recording_log, kids_multiplayer_rooms,
--   kids_multiplayer_room_players, kids_quizzes, kids_quiz_questions
--
-- The cause is the membership tables. Their read policies asked "is the caller
-- a member?" by querying themselves, and the parent tables' policies asked the
-- same question of the membership table, whose policy asked the parent. Any
-- policy that touched a membership table therefore never finished — which is
-- how quizzes, which only mention group membership, broke too.
--
-- The fix is the standard one. The question "what is *my* role here?" moves
-- into SECURITY DEFINER functions, which read the membership table without
-- re-entering its policies. Every policy below is the previous one with each
-- membership subquery replaced by that call, and nothing else changed: same
-- names, same commands, same roles, same conditions.
--
-- The functions only ever answer for auth.uid(). One taking a user id would let
-- anyone ask which groups a given child belongs to.
--
-- Reproduced and verified in PGlite against all prior migrations: before this
-- file every table above raises 42P17; after it, none does, and the membership
-- rules still hold (see src/test/kids-membership-policy-recursion.test.ts).

CREATE OR REPLACE FUNCTION public.kids_my_group_role(_group_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role
    FROM public.kids_social_group_members m
   WHERE m.group_id = _group_id
     AND m.user_id  = auth.uid()
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.kids_my_voice_room_role(_room_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role
    FROM public.kids_voice_room_members m
   WHERE m.room_id = _room_id
     AND m.user_id = auth.uid()
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.kids_am_multiplayer_player(_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.kids_multiplayer_room_players p
     WHERE p.room_id = _room_id
       AND p.user_id = auth.uid()
  )
$$;

-- Policies run as the caller, so the caller's role needs EXECUTE. The answer is
-- only ever about the caller themselves.
REVOKE ALL ON FUNCTION public.kids_my_group_role(uuid)          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kids_my_voice_room_role(uuid)     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.kids_am_multiplayer_player(uuid)  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kids_my_group_role(uuid)         TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kids_my_voice_room_role(uuid)    TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.kids_am_multiplayer_player(uuid) TO anon, authenticated, service_role;

-- ── Groups ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "kids_social_groups: public read" ON public.kids_social_groups;
CREATE POLICY "kids_social_groups: public read"
  ON public.kids_social_groups FOR SELECT
  USING (
    is_public = true
    OR public.has_role((SELECT auth.uid()), 'admin')
    OR public.kids_my_group_role(id) IS NOT NULL
  );

DROP POLICY IF EXISTS "kids_social_group_members: readable if group readable" ON public.kids_social_group_members;
CREATE POLICY "kids_social_group_members: readable if group readable"
  ON public.kids_social_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kids_social_groups g
       WHERE g.id = kids_social_group_members.group_id
         AND (g.is_public = true OR public.has_role((SELECT auth.uid()), 'admin'))
    )
    OR public.kids_my_group_role(group_id) IS NOT NULL
  );

DROP POLICY IF EXISTS "kids_social_group_messages: members read" ON public.kids_social_group_messages;
CREATE POLICY "kids_social_group_messages: members read"
  ON public.kids_social_group_messages FOR SELECT
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.kids_my_group_role(group_id) IS NOT NULL
  );

DROP POLICY IF EXISTS "kids_social_group_messages: members send if not restricted" ON public.kids_social_group_messages;
CREATE POLICY "kids_social_group_messages: members send if not restricted"
  ON public.kids_social_group_messages FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND NOT public.is_kids_user_restricted((SELECT auth.uid()), 'group', group_id)
    AND public.kids_my_group_role(group_id) IS NOT NULL
  );

DROP POLICY IF EXISTS "kids_social_group_messages: author or moderator deletes" ON public.kids_social_group_messages;
CREATE POLICY "kids_social_group_messages: author or moderator deletes"
  ON public.kids_social_group_messages FOR DELETE
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin')
    OR public.kids_my_group_role(group_id) IN ('owner', 'moderator')
  );

DROP POLICY IF EXISTS "kids_social_group_materials: members read" ON public.kids_social_group_materials;
CREATE POLICY "kids_social_group_materials: members read"
  ON public.kids_social_group_materials FOR SELECT
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.kids_my_group_role(group_id) IS NOT NULL
  );

DROP POLICY IF EXISTS "kids_social_group_materials: members upload" ON public.kids_social_group_materials;
CREATE POLICY "kids_social_group_materials: members upload"
  ON public.kids_social_group_materials FOR INSERT
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    AND public.kids_my_group_role(group_id) IS NOT NULL
  );

DROP POLICY IF EXISTS "kids_social_group_materials: uploader or moderator deletes" ON public.kids_social_group_materials;
CREATE POLICY "kids_social_group_materials: uploader or moderator deletes"
  ON public.kids_social_group_materials FOR DELETE
  USING (
    uploaded_by = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin')
    OR public.kids_my_group_role(group_id) IN ('owner', 'moderator')
  );

DROP POLICY IF EXISTS "kids_social_group_assignments: members read" ON public.kids_social_group_assignments;
CREATE POLICY "kids_social_group_assignments: members read"
  ON public.kids_social_group_assignments FOR SELECT
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.kids_my_group_role(group_id) IS NOT NULL
  );

DROP POLICY IF EXISTS "kids_social_group_assignments: owner or moderator manage" ON public.kids_social_group_assignments;
CREATE POLICY "kids_social_group_assignments: owner or moderator manage"
  ON public.kids_social_group_assignments FOR ALL
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.kids_my_group_role(group_id) IN ('owner', 'moderator')
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.kids_my_group_role(group_id) IN ('owner', 'moderator')
  );

DROP POLICY IF EXISTS "kids_social_group_assignment_submissions: group leaders read all" ON public.kids_social_group_assignment_submissions;
CREATE POLICY "kids_social_group_assignment_submissions: group leaders read all"
  ON public.kids_social_group_assignment_submissions FOR SELECT
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.kids_social_group_assignments a
       WHERE a.id = kids_social_group_assignment_submissions.assignment_id
         AND public.kids_my_group_role(a.group_id) IN ('owner', 'moderator')
    )
  );

-- ── Quizzes (a quiz can belong to a group) ─────────────────────────────────

DROP POLICY IF EXISTS "kids_quizzes: readable if owner readable" ON public.kids_quizzes;
CREATE POLICY "kids_quizzes: readable if owner readable"
  ON public.kids_quizzes FOR SELECT
  USING (
    (story_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_stories s
       WHERE s.id = kids_quizzes.story_id
         AND (s.status = 'published' OR public.has_role((SELECT auth.uid()), 'admin'))
    ))
    OR (lesson_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id
       WHERE l.id = kids_quizzes.lesson_id
         AND (c.status = 'published' OR c.teacher_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))
    ))
    OR (course_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_courses c
       WHERE c.id = kids_quizzes.course_id
         AND (c.status = 'published' OR c.teacher_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))
    ))
    OR (location_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_explorer_locations loc
       WHERE loc.id = kids_quizzes.location_id
         AND (loc.status = 'published' OR public.has_role((SELECT auth.uid()), 'admin'))
    ))
    OR (group_id IS NOT NULL AND public.kids_my_group_role(group_id) IS NOT NULL)
    OR (group_id IS NOT NULL AND public.has_role((SELECT auth.uid()), 'admin'))
  );

DROP POLICY IF EXISTS "kids_quizzes: admins or owner manage" ON public.kids_quizzes;
CREATE POLICY "kids_quizzes: admins or owner manage"
  ON public.kids_quizzes FOR ALL
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR (lesson_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id
       WHERE l.id = kids_quizzes.lesson_id AND c.teacher_id = (SELECT auth.uid())
    ))
    OR (course_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_courses c
       WHERE c.id = kids_quizzes.course_id AND c.teacher_id = (SELECT auth.uid())
    ))
    OR (group_id IS NOT NULL AND public.kids_my_group_role(group_id) IN ('owner', 'moderator'))
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin')
    OR (lesson_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id
       WHERE l.id = kids_quizzes.lesson_id AND c.teacher_id = (SELECT auth.uid())
    ))
    OR (course_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_courses c
       WHERE c.id = kids_quizzes.course_id AND c.teacher_id = (SELECT auth.uid())
    ))
    OR (group_id IS NOT NULL AND public.kids_my_group_role(group_id) IN ('owner', 'moderator'))
  );

DROP POLICY IF EXISTS "kids_quiz_questions: readable if quiz readable" ON public.kids_quiz_questions;
CREATE POLICY "kids_quiz_questions: readable if quiz readable"
  ON public.kids_quiz_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_quizzes q
     WHERE q.id = kids_quiz_questions.quiz_id
       AND (
         (q.story_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.kids_stories s
            WHERE s.id = q.story_id
              AND (s.status = 'published' OR public.has_role((SELECT auth.uid()), 'admin'))
         ))
         OR (q.lesson_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id
            WHERE l.id = q.lesson_id
              AND (c.status = 'published' OR c.teacher_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))
         ))
         OR (q.course_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.kids_courses c
            WHERE c.id = q.course_id
              AND (c.status = 'published' OR c.teacher_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))
         ))
         OR (q.location_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.kids_explorer_locations loc
            WHERE loc.id = q.location_id
              AND (loc.status = 'published' OR public.has_role((SELECT auth.uid()), 'admin'))
         ))
         OR (q.group_id IS NOT NULL AND (
           public.has_role((SELECT auth.uid()), 'admin')
           OR public.kids_my_group_role(q.group_id) IS NOT NULL
         ))
       )
  ));

DROP POLICY IF EXISTS "kids_quiz_questions: admins or owner manage" ON public.kids_quiz_questions;
CREATE POLICY "kids_quiz_questions: admins or owner manage"
  ON public.kids_quiz_questions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.kids_quizzes q
     WHERE q.id = kids_quiz_questions.quiz_id
       AND (
         public.has_role((SELECT auth.uid()), 'admin')
         OR (q.lesson_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id
            WHERE l.id = q.lesson_id AND c.teacher_id = (SELECT auth.uid())
         ))
         OR (q.course_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.kids_courses c
            WHERE c.id = q.course_id AND c.teacher_id = (SELECT auth.uid())
         ))
         OR (q.group_id IS NOT NULL AND public.kids_my_group_role(q.group_id) IN ('owner', 'moderator'))
       )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kids_quizzes q
     WHERE q.id = kids_quiz_questions.quiz_id
       AND (
         public.has_role((SELECT auth.uid()), 'admin')
         OR (q.lesson_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id
            WHERE l.id = q.lesson_id AND c.teacher_id = (SELECT auth.uid())
         ))
         OR (q.course_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.kids_courses c
            WHERE c.id = q.course_id AND c.teacher_id = (SELECT auth.uid())
         ))
         OR (q.group_id IS NOT NULL AND public.kids_my_group_role(q.group_id) IN ('owner', 'moderator'))
       )
  ));

-- ── Voice rooms ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "kids_voice_rooms: public read" ON public.kids_voice_rooms;
CREATE POLICY "kids_voice_rooms: public read"
  ON public.kids_voice_rooms FOR SELECT
  USING (
    (is_private = false AND status IN ('scheduled', 'live'))
    OR public.has_role((SELECT auth.uid()), 'admin')
    OR public.kids_my_voice_room_role(id) IS NOT NULL
  );

DROP POLICY IF EXISTS "kids_voice_room_members: readable if room readable" ON public.kids_voice_room_members;
CREATE POLICY "kids_voice_room_members: readable if room readable"
  ON public.kids_voice_room_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kids_voice_rooms r
       WHERE r.id = kids_voice_room_members.room_id
         AND ((r.is_private = false AND r.status IN ('scheduled', 'live'))
              OR public.has_role((SELECT auth.uid()), 'admin'))
    )
    OR public.kids_my_voice_room_role(room_id) IS NOT NULL
  );

DROP POLICY IF EXISTS "kids_voice_room_members: member updates own row" ON public.kids_voice_room_members;
CREATE POLICY "kids_voice_room_members: member updates own row"
  ON public.kids_voice_room_members FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin')
    OR public.kids_my_voice_room_role(room_id) IN ('owner', 'moderator')
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin')
    OR public.kids_my_voice_room_role(room_id) IN ('owner', 'moderator')
  );

DROP POLICY IF EXISTS "kids_voice_room_members: self leaves or moderator removes" ON public.kids_voice_room_members;
CREATE POLICY "kids_voice_room_members: self leaves or moderator removes"
  ON public.kids_voice_room_members FOR DELETE
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.kids_voice_rooms r
       WHERE r.id = kids_voice_room_members.room_id AND r.owner_id = (SELECT auth.uid())
    )
    OR public.kids_my_voice_room_role(room_id) = 'moderator'
  );

DROP POLICY IF EXISTS "kids_voice_room_bans: owner or moderator manage" ON public.kids_voice_room_bans;
CREATE POLICY "kids_voice_room_bans: owner or moderator manage"
  ON public.kids_voice_room_bans FOR ALL
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.kids_voice_rooms r
       WHERE r.id = kids_voice_room_bans.room_id AND r.owner_id = (SELECT auth.uid())
    )
    OR public.kids_my_voice_room_role(room_id) = 'moderator'
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.kids_voice_rooms r
       WHERE r.id = kids_voice_room_bans.room_id AND r.owner_id = (SELECT auth.uid())
    )
    OR public.kids_my_voice_room_role(room_id) = 'moderator'
  );

DROP POLICY IF EXISTS "kids_voice_room_recording_log: room members read" ON public.kids_voice_room_recording_log;
CREATE POLICY "kids_voice_room_recording_log: room members read"
  ON public.kids_voice_room_recording_log FOR SELECT
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.kids_my_voice_room_role(room_id) IS NOT NULL
  );

-- ── Multiplayer rooms ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "kids_multiplayer_rooms: read public or own membership" ON public.kids_multiplayer_rooms;
CREATE POLICY "kids_multiplayer_rooms: read public or own membership"
  ON public.kids_multiplayer_rooms FOR SELECT
  USING (
    is_public = true
    OR host_id = (SELECT auth.uid())
    OR public.kids_am_multiplayer_player(id)
  );

DROP POLICY IF EXISTS "kids_multiplayer_room_players: read fellow room members" ON public.kids_multiplayer_room_players;
CREATE POLICY "kids_multiplayer_room_players: read fellow room members"
  ON public.kids_multiplayer_room_players FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR public.kids_am_multiplayer_player(room_id)
    OR EXISTS (
      SELECT 1 FROM public.kids_multiplayer_rooms r
       WHERE r.id = kids_multiplayer_room_players.room_id AND r.host_id = (SELECT auth.uid())
    )
  );
