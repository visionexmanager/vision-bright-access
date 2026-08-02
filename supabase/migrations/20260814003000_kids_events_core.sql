-- ============================================================
-- Migration: VisionKids Live Events & Kids Universe (Phase 8) — core event
-- catalog, registration with a server-enforced parental approval gate, and
-- attendance tracking.
--
-- Architecture note (same discipline as kids_explorer_locations, Phase 6,
-- and kids_social_groups, Phase 7): Live Events, Workshops, Competitions,
-- and Seasonal Events are NOT four separate tables — they share one
-- polymorphic kids_events table (event_type discriminator + a free-text
-- `category` for the sub-topic: a workshop's subject, a competition's
-- subject, or a seasonal event's occasion). Adding a 9th workshop subject
-- or a new seasonal occasion later is a data change, never a schema one —
-- directly satisfying "قابل للتوسع ليستوعب آلاف الفعاليات".
--
-- Reused, not redefined: public.kids_voice_rooms (Phase 7) — a Live Event
-- optionally points at one via voice_room_id, with the host as room owner
-- (publisher) and registered viewers joining as is_listener members
-- (subscribe-only) — no new WebRTC plumbing needed for live audio/video.
--
-- Parental approval (الحماية requirement): registering for an event is
-- gated server-side, not just in the UI — register_for_kids_event() below
-- checks whether the child has a linked parent (kids_parent_child_links,
-- Academy phase) and if so starts the registration as 'pending' rather
-- than 'approved', mirroring but strengthening the client-side-only
-- ParentalGate pattern from the Creative Studio (Phase 5).
-- ============================================================

-- ============================================================
-- kids_events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type       TEXT NOT NULL CHECK (event_type IN ('live', 'workshop', 'competition', 'seasonal')),
  category         TEXT NOT NULL,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  description      TEXT,
  emoji            TEXT NOT NULL DEFAULT '🎉',
  cover_image_url  TEXT,
  age_group        TEXT NOT NULL DEFAULT 'all' CHECK (age_group IN ('3-5', '6-8', '9-12', 'all')),
  language         TEXT NOT NULL DEFAULT 'en',
  level            TEXT NOT NULL DEFAULT 'all' CHECK (level IN ('beginner', 'intermediate', 'advanced', 'all')),
  host_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  voice_room_id    UUID REFERENCES public.kids_voice_rooms(id) ON DELETE SET NULL,
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'live', 'ended', 'cancelled')),
  capacity         INTEGER CHECK (capacity IS NULL OR capacity > 0),
  reward_xp        INTEGER NOT NULL DEFAULT 30 CHECK (reward_xp >= 0),
  reward_coins     INTEGER NOT NULL DEFAULT 15 CHECK (reward_coins >= 0),
  reaction_counts  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

ALTER TABLE public.kids_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_events: public read non-draft"
  ON public.kids_events FOR SELECT
  USING (status <> 'draft' OR public.has_role(auth.uid(), 'admin') OR auth.uid() = host_id);

CREATE POLICY "kids_events: admins or host manage"
  ON public.kids_events FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = host_id)
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = host_id);

CREATE INDEX IF NOT EXISTS idx_kids_events_type_starts ON public.kids_events(event_type, starts_at);
CREATE INDEX IF NOT EXISTS idx_kids_events_category ON public.kids_events(category);
CREATE INDEX IF NOT EXISTS idx_kids_events_status ON public.kids_events(status, starts_at);

-- ============================================================
-- kids_event_registrations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_event_registrations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                  UUID NOT NULL REFERENCES public.kids_events(id) ON DELETE CASCADE,
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status                    TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'waitlisted', 'cancelled')),
  parental_approval_status  TEXT NOT NULL DEFAULT 'not_required' CHECK (parental_approval_status IN ('not_required', 'pending', 'approved', 'denied')),
  registered_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at                TIMESTAMPTZ,
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.kids_event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_event_registrations: self reads"
  ON public.kids_event_registrations FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND e.host_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = kids_event_registrations.user_id AND pcl.parent_user_id = auth.uid())
  );

CREATE POLICY "kids_event_registrations: self cancels"
  ON public.kids_event_registrations FOR UPDATE
  USING (auth.uid() = user_id AND status <> 'cancelled')
  WITH CHECK (status = 'cancelled');

CREATE POLICY "kids_event_registrations: linked parent decides approval"
  ON public.kids_event_registrations FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = kids_event_registrations.user_id AND pcl.parent_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = kids_event_registrations.user_id AND pcl.parent_user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_kids_event_registrations_event ON public.kids_event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_kids_event_registrations_user ON public.kids_event_registrations(user_id);

-- Self-only registration. Sets parental_approval_status server-side based
-- on whether the caller has a linked parent — the client can never grant
-- itself 'approved' by passing a field, since this whole row is written
-- here, not via a raw client INSERT (there is no INSERT policy on this
-- table at all — this function is the only path in).
CREATE OR REPLACE FUNCTION public.register_for_kids_event(_event_id UUID)
RETURNS public.kids_event_registrations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _has_parent BOOLEAN;
  _capacity INTEGER;
  _registered_count INTEGER;
  _status TEXT := 'registered';
  _approval TEXT;
  _row public.kids_event_registrations;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  SELECT capacity INTO _capacity FROM public.kids_events WHERE id = _event_id;
  IF _capacity IS NOT NULL THEN
    SELECT count(*) INTO _registered_count FROM public.kids_event_registrations WHERE event_id = _event_id AND status = 'registered';
    IF _registered_count >= _capacity THEN
      _status := 'waitlisted';
    END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = _user_id) INTO _has_parent;
  _approval := CASE WHEN _has_parent THEN 'pending' ELSE 'not_required' END;

  INSERT INTO public.kids_event_registrations (event_id, user_id, status, parental_approval_status)
  VALUES (_event_id, _user_id, _status, _approval)
  ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_for_kids_event(UUID) TO authenticated;

-- Linked-parent-only approve/deny, self-only-checkable to avoid a raw
-- UPDATE letting a parent flip decided_at without actually deciding.
CREATE OR REPLACE FUNCTION public.decide_kids_event_registration(_registration_id UUID, _approve BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _parent_id UUID := auth.uid();
  _child_id UUID;
BEGIN
  IF _parent_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  SELECT user_id INTO _child_id FROM public.kids_event_registrations WHERE id = _registration_id;
  IF _child_id IS NULL THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = _child_id AND pcl.parent_user_id = _parent_id) THEN
    RAISE EXCEPTION 'Not authorized to decide this registration';
  END IF;

  UPDATE public.kids_event_registrations
  SET parental_approval_status = CASE WHEN _approve THEN 'approved' ELSE 'denied' END, decided_at = now()
  WHERE id = _registration_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decide_kids_event_registration(UUID, BOOLEAN) TO authenticated;

-- ============================================================
-- kids_event_attendance
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_event_attendance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES public.kids_events(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at           TIMESTAMPTZ,
  duration_seconds  INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.kids_event_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_event_attendance: self manages own"
  ON public.kids_event_attendance FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "kids_event_attendance: host or parent reads"
  ON public.kids_event_attendance FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND e.host_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.kids_parent_child_links pcl WHERE pcl.child_user_id = kids_event_attendance.user_id AND pcl.parent_user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_kids_event_attendance_event ON public.kids_event_attendance(event_id);

-- ============================================================
-- Seed: real, curated event content across all 4 types.
-- ============================================================

-- Seasonal Events (category = occasion key)
INSERT INTO public.kids_events (event_type, category, slug, title, description, emoji, age_group, starts_at, ends_at, status, reward_xp, reward_coins) VALUES
('seasonal', 'ramadan', 'ramadan-kids-celebration', 'Ramadan Kids Celebration', 'Stories, crafts, and games celebrating the spirit of Ramadan.', '🌙', 'all', now() + interval '10 days', now() + interval '10 days 2 hours', 'scheduled', 40, 20),
('seasonal', 'eid', 'eid-fun-fest', 'Eid Fun Fest', 'A festive celebration with games, music, and prizes for Eid.', '🎉', 'all', now() + interval '40 days', now() + interval '40 days 2 hours', 'scheduled', 40, 20),
('seasonal', 'summer', 'summer-kickoff-party', 'Summer Kickoff Party', 'Splash into summer with outdoor-themed games and challenges.', '☀️', 'all', now() + interval '5 days', now() + interval '5 days 2 hours', 'scheduled', 35, 18),
('seasonal', 'back_to_school', 'back-to-school-bash', 'Back to School Bash', 'Get excited for a new school year with fun icebreakers and prizes.', '🎒', 'all', now() + interval '60 days', now() + interval '60 days 2 hours', 'scheduled', 35, 18),
('seasonal', 'spring', 'spring-bloom-festival', 'Spring Bloom Festival', 'Celebrate spring with nature crafts and a planting challenge.', '🌸', 'all', now() + interval '20 days', now() + interval '20 days 2 hours', 'scheduled', 30, 15),
('seasonal', 'child_day', 'world-childrens-day', 'World Children''s Day', 'A special day celebrating every child, with games and surprises.', '🧒', 'all', now() + interval '15 days', now() + interval '15 days 2 hours', 'scheduled', 45, 25),
('seasonal', 'book_day', 'world-book-day-readathon', 'World Book Day Read-a-thon', 'A read-a-thon celebrating the joy of reading, with story time and prizes.', '📚', 'all', now() + interval '25 days', now() + interval '25 days 2 hours', 'scheduled', 40, 20),
('seasonal', 'environment_day', 'world-environment-day', 'World Environment Day', 'Learn how to protect our planet with eco-challenges and games.', '🌍', 'all', now() + interval '30 days', now() + interval '30 days 2 hours', 'scheduled', 40, 20)
ON CONFLICT (slug) DO NOTHING;

-- Workshops (category = subject)
INSERT INTO public.kids_events (event_type, category, slug, title, description, emoji, age_group, level, starts_at, ends_at, status, reward_xp, reward_coins, capacity) VALUES
('workshop', 'drawing', 'workshop-drawing-basics', 'Drawing Basics Workshop', 'Learn simple shapes and shading to bring your drawings to life.', '🎨', '6-8', 'beginner', now() + interval '3 days', now() + interval '3 days 1 hour', 'scheduled', 25, 12, 30),
('workshop', 'coding', 'workshop-first-steps-coding', 'First Steps in Coding', 'A beginner-friendly introduction to how code makes things happen.', '💻', '9-12', 'beginner', now() + interval '4 days', now() + interval '4 days 1 hour', 'scheduled', 30, 15, 30),
('workshop', 'robotics', 'workshop-build-a-robot-friend', 'Build a Robot Friend', 'Design a simple robot character and learn how real robots move.', '🤖', '9-12', 'beginner', now() + interval '6 days', now() + interval '6 days 1 hour', 'scheduled', 30, 15, 25),
('workshop', 'science', 'workshop-kitchen-science', 'Kitchen Science Experiments', 'Safe, simple science experiments using things from your kitchen.', '🧪', '6-8', 'beginner', now() + interval '2 days', now() + interval '2 days 1 hour', 'scheduled', 25, 12, 30),
('workshop', 'music', 'workshop-make-your-own-beat', 'Make Your Own Beat', 'Learn simple rhythm patterns and create your own short tune.', '🎵', 'all', 'beginner', now() + interval '7 days', now() + interval '7 days 1 hour', 'scheduled', 25, 12, 30),
('workshop', 'stories', 'workshop-storytelling-magic', 'Storytelling Magic', 'Discover how to build an exciting story with a beginning, middle, and end.', '📖', 'all', 'beginner', now() + interval '8 days', now() + interval '8 days 1 hour', 'scheduled', 25, 12, 30),
('workshop', 'english', 'workshop-english-word-explorers', 'English Word Explorers', 'A fun, interactive session building English vocabulary through play.', '🔤', '6-8', 'beginner', now() + interval '9 days', now() + interval '9 days 1 hour', 'scheduled', 25, 12, 30),
('workshop', 'ai', 'workshop-meet-ai-friend', 'Meet Your AI Friend', 'A simple, safe introduction to what artificial intelligence is.', '🤖', '9-12', 'beginner', now() + interval '11 days', now() + interval '11 days 1 hour', 'scheduled', 30, 15, 30),
('workshop', 'mental_math', 'workshop-speedy-mental-math', 'Speedy Mental Math', 'Fun tricks to add, subtract, and multiply quickly in your head.', '🧮', '6-8', 'beginner', now() + interval '12 days', now() + interval '12 days 1 hour', 'scheduled', 25, 12, 30)
ON CONFLICT (slug) DO NOTHING;

-- Competitions (category = subject)
INSERT INTO public.kids_events (event_type, category, slug, title, description, emoji, age_group, starts_at, ends_at, status, reward_xp, reward_coins, capacity) VALUES
('competition', 'reading', 'competition-reading-champion', 'Reading Champion Challenge', 'Read the most stories this month and become a Reading Champion!', '📚', 'all', now() + interval '1 day', now() + interval '14 days', 'scheduled', 60, 30, 200),
('competition', 'drawing', 'competition-young-artist', 'Young Artist Competition', 'Submit your best drawing on this month''s theme for a chance to win.', '🎨', 'all', now() + interval '1 day', now() + interval '14 days', 'scheduled', 60, 30, 200),
('competition', 'coding', 'competition-mini-coder', 'Mini Coder Challenge', 'Solve fun coding puzzles and climb the leaderboard.', '💻', '9-12', now() + interval '1 day', now() + interval '14 days', 'scheduled', 65, 35, 200),
('competition', 'math', 'competition-math-masters', 'Math Masters Challenge', 'Test your math skills against other VisionKids explorers.', '🧮', 'all', now() + interval '1 day', now() + interval '14 days', 'scheduled', 60, 30, 200),
('competition', 'puzzles', 'competition-puzzle-quest', 'Puzzle Quest', 'Solve a new brain-teasing puzzle every day for two weeks.', '🧩', 'all', now() + interval '1 day', now() + interval '14 days', 'scheduled', 55, 28, 200),
('competition', 'science', 'competition-junior-scientist', 'Junior Scientist Fair', 'Share a fun science experiment or fact for a chance to be featured.', '🔬', 'all', now() + interval '1 day', now() + interval '14 days', 'scheduled', 60, 30, 200),
('competition', 'music', 'competition-tiny-composers', 'Tiny Composers Competition', 'Create your own short tune using the Music Studio and enter to win.', '🎵', 'all', now() + interval '1 day', now() + interval '14 days', 'scheduled', 60, 30, 200),
('competition', 'stories', 'competition-story-stars', 'Story Stars Competition', 'Write or record an original short story for a chance to be published.', '⭐', 'all', now() + interval '1 day', now() + interval '14 days', 'scheduled', 60, 30, 200)
ON CONFLICT (slug) DO NOTHING;

-- Live Events (category = topic; a few upcoming broadcasts)
INSERT INTO public.kids_events (event_type, category, slug, title, description, emoji, age_group, starts_at, ends_at, status, reward_xp, reward_coins, capacity) VALUES
('live', 'stories', 'live-storytime-with-friends', 'Live Storytime with Friends', 'Join a live read-aloud with games and a Q&A afterward.', '📖', 'all', now() + interval '2 days', now() + interval '2 days 1 hour', 'scheduled', 30, 15, 500),
('live', 'science', 'live-amazing-science-show', 'The Amazing Science Show', 'A live science show full of experiments and surprises.', '🔬', 'all', now() + interval '5 days', now() + interval '5 days 1 hour', 'scheduled', 35, 18, 500),
('live', 'music', 'live-sing-along-party', 'Live Sing-Along Party', 'Sing, dance, and play along in this live music party.', '🎵', 'all', now() + interval '9 days', now() + interval '9 days 1 hour', 'scheduled', 30, 15, 500)
ON CONFLICT (slug) DO NOTHING;
