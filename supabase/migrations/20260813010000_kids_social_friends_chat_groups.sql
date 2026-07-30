-- ============================================================
-- Migration: VisionKids Social & Parents Hub (Phase 7) — friendships, mutes,
-- 1:1 safe chat, polymorphic clubs (study/reading/creative), and the
-- kids_quizzes extension that lets a club own a quiz.
--
-- Reused, not redefined: public.content_reports (site-wide, extended here
-- with a linked-parent visibility policy instead of a new kids_reports
-- table), public.kids_quizzes/kids_quiz_questions/kids_quiz_attempts
-- (Stories, extended a 4th time — story/lesson/course/location/group).
--
-- Chat safety model (documented once, applies to both kids_messages and
-- kids_social_group_messages): the REAL first line of defense is a
-- deterministic client-side keyword+PII filter run before a message is
-- ever sent (src/features/visionkids/utils/chatModeration.ts) — fast,
-- offline, no dependency on a third-party API being up. The existing
-- moderate-content edge function (AI-based, fails OPEN on provider error)
-- is called asynchronously afterward and only flips is_flagged for a
-- parent/moderator to review — it is never the sole gate on a child
-- message, precisely because "fail open" is not an acceptable default for
-- content children are reading.
-- ============================================================

-- ============================================================
-- kids_friendships — a single row per pair (pair_key prevents a duplicate
-- reverse row existing alongside the original request).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_friendships (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  blocked_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at  TIMESTAMPTZ,
  pair_key      TEXT GENERATED ALWAYS AS (LEAST(requester_id, addressee_id)::text || ':' || GREATEST(requester_id, addressee_id)::text) STORED,
  CHECK (requester_id <> addressee_id),
  UNIQUE (pair_key)
);

ALTER TABLE public.kids_friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_friendships: participants read"
  ON public.kids_friendships FOR SELECT
  USING (auth.uid() IN (requester_id, addressee_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_friendships: requester sends"
  ON public.kids_friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "kids_friendships: participants respond"
  ON public.kids_friendships FOR UPDATE
  USING (auth.uid() IN (requester_id, addressee_id))
  WITH CHECK (auth.uid() IN (requester_id, addressee_id));

CREATE POLICY "kids_friendships: participants remove"
  ON public.kids_friendships FOR DELETE
  USING (auth.uid() IN (requester_id, addressee_id));

CREATE INDEX IF NOT EXISTS idx_kids_friendships_addressee ON public.kids_friendships(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_kids_friendships_requester ON public.kids_friendships(requester_id, status);

-- ============================================================
-- kids_favorite_friends / kids_user_mutes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_favorite_friends (
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_user_id)
);

ALTER TABLE public.kids_favorite_friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_favorite_friends: owner manages own"
  ON public.kids_favorite_friends FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.kids_user_mutes (
  muter_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (muter_id, muted_user_id)
);

ALTER TABLE public.kids_user_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_user_mutes: owner manages own"
  ON public.kids_user_mutes FOR ALL
  USING (auth.uid() = muter_id) WITH CHECK (auth.uid() = muter_id);

-- ============================================================
-- kids_social_user_moderation — mirrors library_user_moderation
-- (20260801000000) but for the whole kids social surface (chat, groups,
-- voice rooms), with a kid-appropriate action set and a scope so a mute
-- can be room/group-specific or global.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_social_user_moderation (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action        TEXT NOT NULL CHECK (action IN ('warning', 'mute', 'ban')),
  reason        TEXT,
  scope_type    TEXT NOT NULL DEFAULT 'global' CHECK (scope_type IN ('global', 'group', 'room')),
  scope_id      UUID,
  moderator_id  UUID REFERENCES auth.users(id),
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_social_user_moderation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_social_user_moderation: admins manage"
  ON public.kids_social_user_moderation FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_social_user_moderation: user reads own"
  ON public.kids_social_user_moderation FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_kids_user_restricted(_user_id UUID, _scope_type TEXT DEFAULT 'global', _scope_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kids_social_user_moderation m
    WHERE m.user_id = _user_id
      AND m.action IN ('mute', 'ban')
      AND (m.expires_at IS NULL OR m.expires_at > now())
      AND (
        m.scope_type = 'global'
        OR (m.scope_type = _scope_type AND m.scope_id IS NOT DISTINCT FROM _scope_id)
      )
  );
$$;

-- ============================================================
-- kids_conversations / kids_messages — 1:1 safe chat. A conversation can
-- only be created between two users who are already ACCEPTED friends —
-- enforced in the INSERT policy itself, not just client-side, so a child
-- can never be DMed by (or DM) someone who isn't a mutual friend.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_conversations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_text   TEXT,
  last_message_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  pair_key            TEXT GENERATED ALWAYS AS (LEAST(user_a, user_b)::text || ':' || GREATEST(user_a, user_b)::text) STORED,
  CHECK (user_a <> user_b),
  UNIQUE (pair_key)
);

ALTER TABLE public.kids_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_conversations: participants read"
  ON public.kids_conversations FOR SELECT
  USING (auth.uid() IN (user_a, user_b) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_conversations: participants start if friends"
  ON public.kids_conversations FOR INSERT
  WITH CHECK (
    auth.uid() IN (user_a, user_b)
    AND EXISTS (
      SELECT 1 FROM public.kids_friendships f
      WHERE f.status = 'accepted'
        AND ((f.requester_id = user_a AND f.addressee_id = user_b) OR (f.requester_id = user_b AND f.addressee_id = user_a))
    )
  );

CREATE TABLE IF NOT EXISTS public.kids_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id     UUID NOT NULL REFERENCES public.kids_conversations(id) ON DELETE CASCADE,
  sender_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content             TEXT NOT NULL,
  was_filtered        BOOLEAN NOT NULL DEFAULT false,
  is_flagged          BOOLEAN NOT NULL DEFAULT false,
  flagged_categories  TEXT[] NOT NULL DEFAULT '{}',
  is_read             BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_messages: participants read"
  ON public.kids_messages FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.kids_conversations c WHERE c.id = conversation_id AND auth.uid() IN (c.user_a, c.user_b))
  );

CREATE POLICY "kids_messages: participants send if not restricted"
  ON public.kids_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND NOT public.is_kids_user_restricted(auth.uid())
    AND EXISTS (SELECT 1 FROM public.kids_conversations c WHERE c.id = conversation_id AND auth.uid() IN (c.user_a, c.user_b))
  );

CREATE POLICY "kids_messages: participants update"
  ON public.kids_messages FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.kids_conversations c WHERE c.id = conversation_id AND auth.uid() IN (c.user_a, c.user_b)));

CREATE INDEX IF NOT EXISTS idx_kids_messages_conversation ON public.kids_messages(conversation_id, created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.kids_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kids_conversations;

CREATE OR REPLACE FUNCTION public.touch_kids_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.kids_conversations
  SET last_message_text = NEW.content, last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kids_message_touch_conversation
  AFTER INSERT ON public.kids_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_kids_conversation_last_message();

-- ============================================================
-- kids_social_groups — ONE polymorphic table for Study Groups, Reading
-- Clubs, and every Creative Club sub-type (drawing/stories/music/coding/
-- robotics), same "one table + a type discriminator" discipline used for
-- kids_explorer_locations (Phase 6) and kids_creative_projects (Phase 5).
-- Kids can create their own groups (owner_id), same self-service model as
-- kids_parent_link_codes' invite flow.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_social_groups (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_type       TEXT NOT NULL CHECK (group_type IN ('study', 'reading', 'creative_drawing', 'creative_stories', 'creative_music', 'creative_coding', 'creative_robotics')),
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  description      TEXT,
  emoji            TEXT NOT NULL DEFAULT '👥',
  owner_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_public        BOOLEAN NOT NULL DEFAULT true,
  max_members      INTEGER NOT NULL DEFAULT 30 CHECK (max_members > 0),
  story_of_week_id UUID REFERENCES public.kids_stories(id) ON DELETE SET NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_social_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_social_groups: public read"
  ON public.kids_social_groups FOR SELECT
  USING (is_public = true OR public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.kids_social_group_members m WHERE m.group_id = id AND m.user_id = auth.uid()
  ));

CREATE POLICY "kids_social_groups: signed-in users create"
  ON public.kids_social_groups FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "kids_social_groups: owner or admin manage"
  ON public.kids_social_groups FOR UPDATE
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_social_groups: owner or admin delete"
  ON public.kids_social_groups FOR DELETE
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_kids_social_groups_type ON public.kids_social_groups(group_type, status);

CREATE TABLE IF NOT EXISTS public.kids_social_group_members (
  group_id   UUID NOT NULL REFERENCES public.kids_social_groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE public.kids_social_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_social_group_members: readable if group readable"
  ON public.kids_social_group_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_social_groups g WHERE g.id = group_id AND (g.is_public = true OR public.has_role(auth.uid(), 'admin'))
  ) OR EXISTS (
    SELECT 1 FROM public.kids_social_group_members me WHERE me.group_id = kids_social_group_members.group_id AND me.user_id = auth.uid()
  ));

CREATE POLICY "kids_social_group_members: self joins"
  ON public.kids_social_group_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "kids_social_group_members: self leaves or owner removes"
  ON public.kids_social_group_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.kids_social_groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  );

CREATE POLICY "kids_social_group_members: owner promotes"
  ON public.kids_social_group_members FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.kids_social_groups g WHERE g.id = group_id AND g.owner_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.kids_social_groups g WHERE g.id = group_id AND g.owner_id = auth.uid()));

-- New group owner automatically becomes its first 'owner' member row, so
-- membership checks (readable-if-member, message-if-member) work for them
-- immediately without a second client round-trip.
CREATE OR REPLACE FUNCTION public.kids_social_group_add_owner_member()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.kids_social_group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kids_social_group_add_owner
  AFTER INSERT ON public.kids_social_groups
  FOR EACH ROW EXECUTE FUNCTION public.kids_social_group_add_owner_member();

CREATE TABLE IF NOT EXISTS public.kids_social_group_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id            UUID NOT NULL REFERENCES public.kids_social_groups(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content             TEXT NOT NULL,
  was_filtered        BOOLEAN NOT NULL DEFAULT false,
  is_flagged          BOOLEAN NOT NULL DEFAULT false,
  flagged_categories  TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_social_group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_social_group_messages: members read"
  ON public.kids_social_group_messages FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.kids_social_group_members m WHERE m.group_id = kids_social_group_messages.group_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "kids_social_group_messages: members send if not restricted"
  ON public.kids_social_group_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND NOT public.is_kids_user_restricted(auth.uid(), 'group', group_id)
    AND EXISTS (SELECT 1 FROM public.kids_social_group_members m WHERE m.group_id = kids_social_group_messages.group_id AND m.user_id = auth.uid())
  );

CREATE POLICY "kids_social_group_messages: author or moderator deletes"
  ON public.kids_social_group_messages FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.kids_social_group_members m WHERE m.group_id = kids_social_group_messages.group_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'moderator'))
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.kids_social_group_messages;

CREATE INDEX IF NOT EXISTS idx_kids_social_group_messages_group ON public.kids_social_group_messages(group_id, created_at);

CREATE TABLE IF NOT EXISTS public.kids_social_group_materials (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES public.kids_social_groups(id) ON DELETE CASCADE,
  uploaded_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  file_url     TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_social_group_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_social_group_materials: members read"
  ON public.kids_social_group_materials FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.kids_social_group_members m WHERE m.group_id = kids_social_group_materials.group_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "kids_social_group_materials: members upload"
  ON public.kids_social_group_materials FOR INSERT
  WITH CHECK (uploaded_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.kids_social_group_members m WHERE m.group_id = kids_social_group_materials.group_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "kids_social_group_materials: uploader or moderator deletes"
  ON public.kids_social_group_materials FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.kids_social_group_members m WHERE m.group_id = kids_social_group_materials.group_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'moderator'))
  );

CREATE TABLE IF NOT EXISTS public.kids_social_group_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES public.kids_social_groups(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  due_at       TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_social_group_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_social_group_assignments: members read"
  ON public.kids_social_group_assignments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.kids_social_group_members m WHERE m.group_id = kids_social_group_assignments.group_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "kids_social_group_assignments: owner or moderator manage"
  ON public.kids_social_group_assignments FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.kids_social_group_members m WHERE m.group_id = kids_social_group_assignments.group_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'moderator')
  ))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.kids_social_group_members m WHERE m.group_id = kids_social_group_assignments.group_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'moderator')
  ));

CREATE TABLE IF NOT EXISTS public.kids_social_group_assignment_submissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id  UUID NOT NULL REFERENCES public.kids_social_group_assignments(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content        TEXT,
  file_url       TEXT,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, user_id)
);

ALTER TABLE public.kids_social_group_assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_social_group_assignment_submissions: submitter manages own"
  ON public.kids_social_group_assignment_submissions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kids_social_group_assignment_submissions: group leaders read all"
  ON public.kids_social_group_assignment_submissions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.kids_social_group_assignments a
    JOIN public.kids_social_group_members m ON m.group_id = a.group_id
    WHERE a.id = assignment_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'moderator')
  ));

-- ============================================================
-- Extend kids_quizzes (Stories/Academy/Explorer) so a club can own a
-- weekly/topic quiz too — Reading Clubs' "كل أسبوع: قصة جديدة، مناقشة،
-- اختبار" maps directly onto this.
-- ============================================================
ALTER TABLE public.kids_quizzes ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.kids_social_groups(id) ON DELETE CASCADE;

ALTER TABLE public.kids_quizzes DROP CONSTRAINT IF EXISTS kids_quizzes_one_owner;
ALTER TABLE public.kids_quizzes ADD CONSTRAINT kids_quizzes_one_owner CHECK (
  (CASE WHEN story_id IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN lesson_id IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN course_id IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN location_id IS NOT NULL THEN 1 ELSE 0 END) +
  (CASE WHEN group_id IS NOT NULL THEN 1 ELSE 0 END) = 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kids_quizzes_group_unique ON public.kids_quizzes(group_id) WHERE group_id IS NOT NULL;

DROP POLICY IF EXISTS "kids_quizzes: readable if owner readable" ON public.kids_quizzes;
CREATE POLICY "kids_quizzes: readable if owner readable"
  ON public.kids_quizzes FOR SELECT
  USING (
    (story_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_stories s WHERE s.id = story_id AND (s.status = 'published' OR public.has_role(auth.uid(), 'admin'))))
    OR (lesson_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id
      WHERE l.id = lesson_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    ))
    OR (course_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    ))
    OR (location_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_explorer_locations loc WHERE loc.id = location_id AND (loc.status = 'published' OR public.has_role(auth.uid(), 'admin'))
    ))
    OR (group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.kids_social_group_members m WHERE m.group_id = kids_quizzes.group_id AND m.user_id = auth.uid()
    ))
    OR (group_id IS NOT NULL AND public.has_role(auth.uid(), 'admin'))
  );

DROP POLICY IF EXISTS "kids_quizzes: admins or course owner manage" ON public.kids_quizzes;
CREATE POLICY "kids_quizzes: admins or owner manage"
  ON public.kids_quizzes FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (lesson_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id WHERE l.id = lesson_id AND c.teacher_id = auth.uid()))
    OR (course_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND c.teacher_id = auth.uid()))
    OR (group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_social_group_members m WHERE m.group_id = kids_quizzes.group_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'moderator')))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (lesson_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id WHERE l.id = lesson_id AND c.teacher_id = auth.uid()))
    OR (course_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = course_id AND c.teacher_id = auth.uid()))
    OR (group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_social_group_members m WHERE m.group_id = kids_quizzes.group_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'moderator')))
  );

DROP POLICY IF EXISTS "kids_quiz_questions: readable if quiz readable" ON public.kids_quiz_questions;
CREATE POLICY "kids_quiz_questions: readable if quiz readable"
  ON public.kids_quiz_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_quizzes q WHERE q.id = quiz_id
    AND (
      (q.story_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_stories s WHERE s.id = q.story_id AND (s.status = 'published' OR public.has_role(auth.uid(), 'admin'))))
      OR (q.lesson_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id
        WHERE l.id = q.lesson_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
      ))
      OR (q.course_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.kids_courses c WHERE c.id = q.course_id AND (c.status = 'published' OR c.teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
      ))
      OR (q.location_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.kids_explorer_locations loc WHERE loc.id = q.location_id AND (loc.status = 'published' OR public.has_role(auth.uid(), 'admin'))
      ))
      OR (q.group_id IS NOT NULL AND (
        public.has_role(auth.uid(), 'admin')
        OR EXISTS (SELECT 1 FROM public.kids_social_group_members m WHERE m.group_id = q.group_id AND m.user_id = auth.uid())
      ))
    )
  ));

DROP POLICY IF EXISTS "kids_quiz_questions: admins or course owner manage" ON public.kids_quiz_questions;
CREATE POLICY "kids_quiz_questions: admins or owner manage"
  ON public.kids_quiz_questions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.kids_quizzes q WHERE q.id = quiz_id AND (
      public.has_role(auth.uid(), 'admin')
      OR (q.lesson_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id WHERE l.id = q.lesson_id AND c.teacher_id = auth.uid()))
      OR (q.course_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = q.course_id AND c.teacher_id = auth.uid()))
      OR (q.group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_social_group_members m WHERE m.group_id = q.group_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'moderator')))
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kids_quizzes q WHERE q.id = quiz_id AND (
      public.has_role(auth.uid(), 'admin')
      OR (q.lesson_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_lessons l JOIN public.kids_courses c ON c.id = l.course_id WHERE l.id = q.lesson_id AND c.teacher_id = auth.uid()))
      OR (q.course_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_courses c WHERE c.id = q.course_id AND c.teacher_id = auth.uid()))
      OR (q.group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.kids_social_group_members m WHERE m.group_id = q.group_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'moderator')))
    )
  ));

-- ============================================================
-- Extend content_reports (site-wide, 20260422000000) so a linked parent
-- can see the reports THEIR child has filed (not reports about the child,
-- which stay admin-only for now — a reasonable privacy default).
-- ============================================================
CREATE POLICY "kids: linked parent views own child filed reports"
  ON public.content_reports FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = content_reports.reporter_id AND pcl.parent_user_id = auth.uid()
  ));
