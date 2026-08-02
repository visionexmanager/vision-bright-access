-- ============================================================
-- Migration: VisionKids Social & Parents Hub (Phase 7) — kid-safe voice
-- rooms (reusing the existing LiveKit token edge function), the Challenges
-- Hub (group/individual challenges + leaderboard), and seed content.
--
-- Reused, not redefined: supabase/functions/livekit-token/index.ts (the
-- adult voice-room token issuer) — it already mints a token from `roomId`
-- + the caller's verified JWT identity with no room-type awareness, so
-- kids voice rooms reuse it as-is, namespacing room ids client-side
-- (`kids-<uuid>`) rather than needing a second edge function.
--
-- Honesty note on "recording with parental consent": this migration adds
-- a real consent gate (checked server-side against kids_child_settings
-- .recording_consent for every member in the room) and a real audit trail
-- (kids_voice_room_recording_log), but does NOT capture actual audio.
-- Server-side audio capture would go through LiveKit's Egress API, which
-- needs its own provisioned storage/credentials — out of scope here and
-- called out explicitly rather than faked. What ships is the permission
-- system a real recording feature would need to sit behind.
-- ============================================================

-- ============================================================
-- kids_voice_rooms / kids_voice_room_members / kids_voice_room_bans —
-- mirrors the shape of public.voice_rooms / voice_room_members /
-- voice_room_bans (adult site), but adds a real per-member `is_muted` the
-- adult version doesn't have (there it's all-or-nothing via a room-wide
-- allow_mic flag) — the brief explicitly asks for per-user mute here.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_voice_rooms (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  group_id                UUID REFERENCES public.kids_social_groups(id) ON DELETE SET NULL,
  room_name               TEXT NOT NULL,
  topic                   TEXT,
  max_users               INTEGER NOT NULL DEFAULT 12 CHECK (max_users > 0),
  is_private              BOOLEAN NOT NULL DEFAULT false,
  room_password           TEXT,
  allow_chat              BOOLEAN NOT NULL DEFAULT true,
  status                  TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('scheduled', 'live', 'ended')),
  scheduled_at            TIMESTAMPTZ,
  recording_active        BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at                TIMESTAMPTZ
);

ALTER TABLE public.kids_voice_rooms ENABLE ROW LEVEL SECURITY;

-- The SELECT policy for kids_voice_rooms reads kids_voice_room_members,
-- so it is declared after that table exists — see below.

CREATE POLICY "kids_voice_rooms: signed-in users create"
  ON public.kids_voice_rooms FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "kids_voice_rooms: owner or admin manage"
  ON public.kids_voice_rooms FOR UPDATE
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "kids_voice_rooms: owner or admin delete"
  ON public.kids_voice_rooms FOR DELETE
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.kids_voice_room_members (
  room_id     UUID NOT NULL REFERENCES public.kids_voice_rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('owner', 'moderator', 'participant')),
  is_muted    BOOLEAN NOT NULL DEFAULT false,
  is_listener BOOLEAN NOT NULL DEFAULT false,
  raised_at   TIMESTAMPTZ,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

ALTER TABLE public.kids_voice_room_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_voice_room_members: readable if room readable"
  ON public.kids_voice_room_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_voice_rooms r WHERE r.id = room_id
    AND ((r.is_private = false AND r.status IN ('scheduled', 'live')) OR public.has_role(auth.uid(), 'admin'))
  ) OR EXISTS (
    SELECT 1 FROM public.kids_voice_room_members me WHERE me.room_id = kids_voice_room_members.room_id AND me.user_id = auth.uid()
  ));

-- The INSERT policy for kids_voice_room_members reads kids_voice_room_bans,
-- so it is declared after that table exists — see below.

CREATE POLICY "kids_voice_room_members: self leaves or moderator removes"
  ON public.kids_voice_room_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.kids_voice_rooms r WHERE r.id = room_id AND r.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.kids_voice_room_members mod WHERE mod.room_id = kids_voice_room_members.room_id AND mod.user_id = auth.uid() AND mod.role = 'moderator')
  );

-- Anyone in the room can update their row (to raise/lower a hand), but a
-- trigger below reverts is_muted/role/is_listener back to OLD unless the
-- actor is the room owner/moderator/admin — same "lock privileged fields"
-- pattern as kids_creative_projects' parental-approval trigger (Phase 5).
CREATE POLICY "kids_voice_room_members: member updates own row"
  ON public.kids_voice_room_members FOR UPDATE
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.kids_voice_room_members mod WHERE mod.room_id = kids_voice_room_members.room_id AND mod.user_id = auth.uid() AND mod.role IN ('owner', 'moderator')
  ))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.kids_voice_room_members mod WHERE mod.room_id = kids_voice_room_members.room_id AND mod.user_id = auth.uid() AND mod.role IN ('owner', 'moderator')
  ));

CREATE OR REPLACE FUNCTION public.kids_lock_voice_room_member_privileged_fields()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _is_moderator BOOLEAN;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.kids_voice_room_members mod WHERE mod.room_id = NEW.room_id AND mod.user_id = auth.uid() AND mod.role IN ('owner', 'moderator')
  ) INTO _is_moderator;

  IF NOT _is_moderator THEN
    NEW.is_muted := OLD.is_muted;
    NEW.is_listener := OLD.is_listener;
    NEW.role := OLD.role;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kids_voice_room_member_lock_fields
  BEFORE UPDATE ON public.kids_voice_room_members
  FOR EACH ROW EXECUTE FUNCTION public.kids_lock_voice_room_member_privileged_fields();

CREATE TABLE IF NOT EXISTS public.kids_voice_room_bans (
  room_id     UUID NOT NULL REFERENCES public.kids_voice_rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by   UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

ALTER TABLE public.kids_voice_room_bans ENABLE ROW LEVEL SECURITY;

-- Deferred from the blocks above: both policies read a table that only exists
-- as of this point in the migration.
CREATE POLICY "kids_voice_rooms: public read"
  ON public.kids_voice_rooms FOR SELECT
  USING (
    (is_private = false AND status IN ('scheduled', 'live'))
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.kids_voice_room_members m
      WHERE m.room_id = kids_voice_rooms.id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "kids_voice_room_members: self joins if not banned"
  ON public.kids_voice_room_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.kids_voice_room_bans b
      WHERE b.room_id = kids_voice_room_members.room_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "kids_voice_room_bans: owner or moderator manage"
  ON public.kids_voice_room_bans FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.kids_voice_rooms r WHERE r.id = room_id AND r.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.kids_voice_room_members m WHERE m.room_id = kids_voice_room_bans.room_id AND m.user_id = auth.uid() AND m.role = 'moderator')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.kids_voice_rooms r WHERE r.id = room_id AND r.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.kids_voice_room_members m WHERE m.room_id = kids_voice_room_bans.room_id AND m.user_id = auth.uid() AND m.role = 'moderator')
  );

CREATE POLICY "kids_voice_room_bans: banned user checks own"
  ON public.kids_voice_room_bans FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.kids_voice_room_add_owner_member()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.kids_voice_room_members (room_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (room_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kids_voice_room_add_owner
  AFTER INSERT ON public.kids_voice_rooms
  FOR EACH ROW EXECUTE FUNCTION public.kids_voice_room_add_owner_member();

ALTER PUBLICATION supabase_realtime ADD TABLE public.kids_voice_room_members;

-- ============================================================
-- kids_voice_room_recording_log — the consent-gated, audit-logged
-- recording toggle described in this file's header comment.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_voice_room_recording_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES public.kids_voice_rooms(id) ON DELETE CASCADE,
  action      TEXT NOT NULL CHECK (action IN ('started', 'stopped', 'denied_no_consent')),
  actor_id    UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_voice_room_recording_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_voice_room_recording_log: room members read"
  ON public.kids_voice_room_recording_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.kids_voice_room_members m WHERE m.room_id = kids_voice_room_recording_log.room_id AND m.user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.set_kids_voice_room_recording(_room_id UUID, _active BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _is_moderator BOOLEAN;
  _missing_consent INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.kids_voice_room_members m WHERE m.room_id = _room_id AND m.user_id = _user_id AND m.role IN ('owner', 'moderator')
  ) INTO _is_moderator;

  IF NOT _is_moderator THEN
    RAISE EXCEPTION 'Only the room owner or a moderator can control recording';
  END IF;

  IF NOT _active THEN
    UPDATE public.kids_voice_rooms SET recording_active = false WHERE id = _room_id;
    INSERT INTO public.kids_voice_room_recording_log (room_id, action, actor_id) VALUES (_room_id, 'stopped', _user_id);
    RETURN TRUE;
  END IF;

  SELECT count(*) INTO _missing_consent
  FROM public.kids_voice_room_members m
  LEFT JOIN public.kids_child_settings cs ON cs.child_user_id = m.user_id
  WHERE m.room_id = _room_id AND COALESCE(cs.recording_consent, false) = false;

  IF _missing_consent > 0 THEN
    INSERT INTO public.kids_voice_room_recording_log (room_id, action, actor_id) VALUES (_room_id, 'denied_no_consent', _user_id);
    RETURN FALSE;
  END IF;

  UPDATE public.kids_voice_rooms SET recording_active = true WHERE id = _room_id;
  INSERT INTO public.kids_voice_room_recording_log (room_id, action, actor_id) VALUES (_room_id, 'started', _user_id);
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_kids_voice_room_recording(UUID, BOOLEAN) TO authenticated;

-- ============================================================
-- kids_social_challenges / kids_social_challenge_participants — admin-
-- curated (same model as Studio's weekly Creative Challenges), individual
-- or team-scoped (via group_id), with a public leaderboard.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_social_challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  challenge_type  TEXT NOT NULL DEFAULT 'individual' CHECK (challenge_type IN ('individual', 'team')),
  group_id        UUID REFERENCES public.kids_social_groups(id) ON DELETE SET NULL,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at         TIMESTAMPTZ NOT NULL,
  reward_xp       INTEGER NOT NULL DEFAULT 50 CHECK (reward_xp >= 0),
  reward_coins    INTEGER NOT NULL DEFAULT 25 CHECK (reward_coins >= 0),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_social_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_social_challenges: public read"
  ON public.kids_social_challenges FOR SELECT USING (true);

CREATE POLICY "kids_social_challenges: admins manage"
  ON public.kids_social_challenges FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.kids_social_challenge_participants (
  challenge_id  UUID NOT NULL REFERENCES public.kids_social_challenges(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score         INTEGER NOT NULL DEFAULT 0,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  PRIMARY KEY (challenge_id, user_id)
);

ALTER TABLE public.kids_social_challenge_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_social_challenge_participants: public read"
  ON public.kids_social_challenge_participants FOR SELECT USING (true);

CREATE POLICY "kids_social_challenge_participants: self joins"
  ON public.kids_social_challenge_participants FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Self-only, capped increment (never a raw score set) — same anti-spoof
-- shape as ping_kids_usage(): the client can only ever ask to add a small
-- amount, never assign an arbitrary final score.
CREATE OR REPLACE FUNCTION public.bump_kids_social_challenge_score(_challenge_id UUID, _increment INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _new_score INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _increment <= 0 OR _increment > 10 THEN RAISE EXCEPTION 'Increment must be between 1 and 10'; END IF;

  INSERT INTO public.kids_social_challenge_participants (challenge_id, user_id, score)
  VALUES (_challenge_id, _user_id, _increment)
  ON CONFLICT (challenge_id, user_id) DO UPDATE SET score = kids_social_challenge_participants.score + _increment
  RETURNING score INTO _new_score;

  RETURN _new_score;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_kids_social_challenge_score(UUID, INTEGER) TO authenticated;

-- ============================================================
-- Seed: Social achievements (shared kids_achievements table).
-- ============================================================
INSERT INTO public.kids_achievements (key, title, description, icon, reward_vx) VALUES
  ('first_friend',       'First Friend',        'Add your first friend.',                       'UserPlus',   15),
  ('social_butterfly',   'Social Butterfly',    'Add 10 friends.',                               'Users',      30),
  ('club_joiner',        'Club Joiner',         'Join your first club.',                         'Users2',     15),
  ('club_starter',       'Club Starter',        'Create your own club.',                         'PlusCircle', 25),
  ('safe_chatter',       'Safe Chatter',        'Send your first message the safe way.',         'MessageCircle', 10),
  ('challenge_champion', 'Challenge Champion',  'Win a social challenge.',                        'Trophy',     50),
  ('voice_room_host',    'Voice Room Host',     'Host your first voice room.',                    'Mic',        20)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Seed: a few public, admin-owned starter clubs (owner_id NULL — no
-- personal "creator" — and one example social challenge, so the
-- Community Home / Challenges Hub aren't empty on first load.
-- ============================================================
INSERT INTO public.kids_social_groups (group_type, slug, name, description, emoji, owner_id, is_public) VALUES
  ('study',             'homework-helpers',      'Homework Helpers',        'A friendly group to study together and help each other with homework.', '📚', NULL, true),
  ('reading',           'weekly-story-circle',   'Weekly Story Circle',     'A new story every week, with discussion and a fun quiz.',               '📖', NULL, true),
  ('creative_drawing',  'sketch-squad',          'Sketch Squad',            'Share your drawings and get inspired by other young artists.',         '🎨', NULL, true),
  ('creative_stories',  'story-spinners',        'Story Spinners',         'Write and share short stories together.',                               '✍️', NULL, true),
  ('creative_music',    'young-composers',       'Young Composers',        'Share the songs and tunes you make.',                                   '🎵', NULL, true),
  ('creative_coding',   'young-coders',          'Young Coders',           'Talk about coding projects and learn from each other.',                 '💻', NULL, true),
  ('creative_robotics', 'robo-builders',         'Robo Builders',          'For kids who love robots and building things.',                        '🤖', NULL, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.kids_social_challenges (title, description, challenge_type, starts_at, ends_at, reward_xp, reward_coins) VALUES
  ('Kindness Week', 'Be a good friend this week — help a friend, join a club activity, or cheer someone on!', 'individual', now(), now() + interval '7 days', 60, 30)
ON CONFLICT DO NOTHING;
