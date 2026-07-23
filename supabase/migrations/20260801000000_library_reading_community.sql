-- ============================================================
-- Phase 12: Reading Community
-- Reader profiles, follows, book clubs, discussion boards, reading
-- goals/streaks, community challenges, review enhancements, live events
-- (real LiveKit rooms via the existing voice_rooms infra), leaderboards,
-- and community moderation.
-- ============================================================

-- ============================================================
-- 1. Reader profiles
-- Deliberately a NEW table rather than extending the shared `profiles`
-- table (used by Finance/Academy/Admin/etc.) — keeps Library-only fields
-- (genres, authors, languages, privacy toggles) isolated from an app-wide
-- table with its own unrelated concerns (trial billing, bans, device
-- enforcement). Joined to `profiles` for display_name/avatar_url.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_reader_profiles (
  user_id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bio                     TEXT,
  favorite_genres         UUID[] NOT NULL DEFAULT '{}',   -- library_categories.id values
  favorite_authors        UUID[] NOT NULL DEFAULT '{}',   -- library_authors.id values
  languages               TEXT[] NOT NULL DEFAULT '{}',
  is_public               BOOLEAN NOT NULL DEFAULT true,
  show_reading_activity   BOOLEAN NOT NULL DEFAULT true,
  show_reviews            BOOLEAN NOT NULL DEFAULT true,
  show_reading_lists      BOOLEAN NOT NULL DEFAULT true,
  show_followers          BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_reader_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_reader_profiles: read own or public"
  ON public.library_reader_profiles FOR SELECT
  USING (is_public OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_reader_profiles: user manages own"
  ON public.library_reader_profiles FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS library_reader_profiles_updated_at ON public.library_reader_profiles;
CREATE TRIGGER library_reader_profiles_updated_at
  BEFORE UPDATE ON public.library_reader_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 2. Reader-to-reader follows
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_follows (
  follower_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

ALTER TABLE public.library_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_follows: public read" ON public.library_follows FOR SELECT USING (true);
CREATE POLICY "library_follows: user manages own"
  ON public.library_follows FOR ALL
  USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS idx_library_follows_followee ON public.library_follows(followee_id);

-- Notify the followee — SECURITY DEFINER trigger inserting directly into
-- notifications, same shape as trg_notify_library_review/trg_notify_library_sale
-- (20260728000000_library_publishing_studio.sql).
CREATE OR REPLACE FUNCTION public.trg_notify_library_follow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _follower_name TEXT;
BEGIN
  SELECT display_name INTO _follower_name FROM public.profiles WHERE user_id = NEW.follower_id;
  INSERT INTO public.notifications (user_id, title, body, type, category)
  VALUES (NEW.followee_id, 'New follower', COALESCE(_follower_name, 'A reader') || ' started following you.', 'info', 'community_follow');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_follows_notify ON public.library_follows;
CREATE TRIGGER trg_library_follows_notify
  AFTER INSERT ON public.library_follows
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_library_follow();

-- ============================================================
-- 3. Book Clubs
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.library_club_visibility AS ENUM ('public', 'private', 'invite_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.library_club_member_role AS ENUM ('owner', 'moderator', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.library_club_member_status AS ENUM ('active', 'invited', 'requested', 'banned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.library_clubs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  cover_image_url TEXT,
  visibility      public.library_club_visibility NOT NULL DEFAULT 'public',
  rules           TEXT,
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Starts at 0, not 1 — trg_library_club_auto_owner_member's insert into
  -- library_club_members fires trg_bump_library_club_member_count right
  -- after row creation, which brings this to 1. Defaulting to 1 here would
  -- double-count the owner.
  member_count    INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.library_club_members (
  club_id    UUID NOT NULL REFERENCES public.library_clubs(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.library_club_member_role NOT NULL DEFAULT 'member',
  status     public.library_club_member_status NOT NULL DEFAULT 'active',
  invited_by UUID REFERENCES auth.users(id),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);

CREATE OR REPLACE FUNCTION public.is_library_club_member(_club_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_club_members
    WHERE club_id = _club_id AND user_id = auth.uid() AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_library_club_moderator(_club_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_club_members
    WHERE club_id = _club_id AND user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'moderator')
  )
$$;

ALTER TABLE public.library_clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_clubs: read public/private listing or member/admin"
  ON public.library_clubs FOR SELECT
  USING (
    visibility IN ('public', 'private')
    OR public.is_library_club_member(id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "library_clubs: authenticated creates own"
  ON public.library_clubs FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "library_clubs: moderator/admin updates"
  ON public.library_clubs FOR UPDATE
  USING (public.is_library_club_moderator(id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_clubs: owner/admin deletes"
  ON public.library_clubs FOR DELETE
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS library_clubs_updated_at ON public.library_clubs;
CREATE TRIGGER library_clubs_updated_at
  BEFORE UPDATE ON public.library_clubs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-add the creator as the owner/active member of their own club.
CREATE OR REPLACE FUNCTION public.trg_library_club_auto_owner_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.library_club_members (club_id, user_id, role, status)
  VALUES (NEW.id, NEW.owner_id, 'owner', 'active');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_clubs_auto_owner ON public.library_clubs;
CREATE TRIGGER trg_library_clubs_auto_owner
  AFTER INSERT ON public.library_clubs
  FOR EACH ROW EXECUTE FUNCTION public.trg_library_club_auto_owner_member();

ALTER TABLE public.library_club_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_club_members: member/own/admin reads"
  ON public.library_club_members FOR SELECT
  USING (public.is_library_club_member(club_id) OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- All writes to membership go through the RPCs below (join/invite/approve/
-- leave/set-role/ban), never direct client inserts — the authorization
-- branching (public vs. private vs. invite-only) doesn't fit a single
-- RLS WITH CHECK cleanly. Only service_role and the SECURITY DEFINER RPCs
-- (which run as the table owner) can write here.
CREATE POLICY "library_club_members: service role writes"
  ON public.library_club_members FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Keep library_clubs.member_count in sync with active memberships.
CREATE OR REPLACE FUNCTION public.trg_bump_library_club_member_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'active' THEN
      UPDATE public.library_clubs SET member_count = member_count + 1 WHERE id = NEW.club_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != 'active' AND NEW.status = 'active' THEN
      UPDATE public.library_clubs SET member_count = member_count + 1 WHERE id = NEW.club_id;
    ELSIF OLD.status = 'active' AND NEW.status != 'active' THEN
      UPDATE public.library_clubs SET member_count = GREATEST(member_count - 1, 0) WHERE id = NEW.club_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'active' THEN
      UPDATE public.library_clubs SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.club_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_club_members_count ON public.library_club_members;
CREATE TRIGGER trg_library_club_members_count
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.library_club_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_library_club_member_count();

-- join_library_club: public clubs join instantly, private clubs create a
-- pending request, invite_only clubs cannot be self-joined at all.
CREATE OR REPLACE FUNCTION public.join_library_club(_club_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _visibility public.library_club_visibility;
  _status public.library_club_member_status;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  SELECT visibility INTO _visibility FROM public.library_clubs WHERE id = _club_id;
  IF _visibility IS NULL THEN RAISE EXCEPTION 'Club not found'; END IF;
  IF _visibility = 'invite_only' THEN RAISE EXCEPTION 'This club is invite-only'; END IF;

  IF EXISTS (SELECT 1 FROM public.library_club_members WHERE club_id = _club_id AND user_id = auth.uid() AND status = 'banned') THEN
    RAISE EXCEPTION 'You cannot rejoin this club';
  END IF;

  _status := CASE WHEN _visibility = 'public' THEN 'active' ELSE 'requested' END;

  INSERT INTO public.library_club_members (club_id, user_id, role, status)
  VALUES (_club_id, auth.uid(), 'member', _status)
  ON CONFLICT (club_id, user_id) DO UPDATE SET status = EXCLUDED.status
  WHERE public.library_club_members.status NOT IN ('active', 'banned');

  RETURN _status;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_library_club(_club_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.library_clubs WHERE id = _club_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Club owners must delete the club or transfer ownership before leaving';
  END IF;
  DELETE FROM public.library_club_members WHERE club_id = _club_id AND user_id = auth.uid();
END;
$$;

-- Resolves the invited email to a user_id server-side (same pattern as
-- share_library_reading_list) — never exposes an email->user_id oracle.
CREATE OR REPLACE FUNCTION public.invite_to_library_club(_club_id UUID, _email TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _target_user_id UUID;
  _club_name TEXT;
BEGIN
  IF NOT public.is_library_club_moderator(_club_id) THEN
    RAISE EXCEPTION 'Only club moderators can invite members';
  END IF;

  SELECT id INTO _target_user_id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF _target_user_id IS NULL THEN RETURN false; END IF;

  INSERT INTO public.library_club_members (club_id, user_id, role, status, invited_by)
  VALUES (_club_id, _target_user_id, 'member', 'invited', auth.uid())
  ON CONFLICT (club_id, user_id) DO UPDATE SET status = 'invited', invited_by = auth.uid()
  WHERE public.library_club_members.status NOT IN ('active', 'banned');

  SELECT name INTO _club_name FROM public.library_clubs WHERE id = _club_id;
  INSERT INTO public.notifications (user_id, title, body, type, category)
  VALUES (_target_user_id, 'Club invitation', 'You''ve been invited to join "' || _club_name || '".', 'info', 'community_club_invite');

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_library_club_invite(_club_id UUID, _accept BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _accept THEN
    UPDATE public.library_club_members SET status = 'active'
    WHERE club_id = _club_id AND user_id = auth.uid() AND status = 'invited';
  ELSE
    DELETE FROM public.library_club_members WHERE club_id = _club_id AND user_id = auth.uid() AND status = 'invited';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_library_club_join_request(_club_id UUID, _user_id UUID, _approve BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _club_name TEXT;
BEGIN
  IF NOT public.is_library_club_moderator(_club_id) THEN
    RAISE EXCEPTION 'Only club moderators can review join requests';
  END IF;

  SELECT name INTO _club_name FROM public.library_clubs WHERE id = _club_id;

  IF _approve THEN
    UPDATE public.library_club_members SET status = 'active'
    WHERE club_id = _club_id AND user_id = _user_id AND status = 'requested';
    INSERT INTO public.notifications (user_id, title, body, type, category)
    VALUES (_user_id, 'Join request approved', 'Your request to join "' || _club_name || '" was approved.', 'success', 'community_club_invite');
  ELSE
    DELETE FROM public.library_club_members WHERE club_id = _club_id AND user_id = _user_id AND status = 'requested';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_library_club_member_role(_club_id UUID, _user_id UUID, _role public.library_club_member_role)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.library_clubs WHERE id = _club_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the club owner can change member roles';
  END IF;
  IF _role = 'owner' THEN RAISE EXCEPTION 'Ownership transfer is not supported here'; END IF;

  UPDATE public.library_club_members SET role = _role
  WHERE club_id = _club_id AND user_id = _user_id AND status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.set_library_club_member_ban(_club_id UUID, _user_id UUID, _banned BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_library_club_moderator(_club_id) THEN
    RAISE EXCEPTION 'Only club moderators can manage bans';
  END IF;
  IF EXISTS (SELECT 1 FROM public.library_clubs WHERE id = _club_id AND owner_id = _user_id) THEN
    RAISE EXCEPTION 'Cannot ban the club owner';
  END IF;

  IF _banned THEN
    INSERT INTO public.library_club_members (club_id, user_id, role, status)
    VALUES (_club_id, _user_id, 'member', 'banned')
    ON CONFLICT (club_id, user_id) DO UPDATE SET status = 'banned';
  ELSE
    DELETE FROM public.library_club_members WHERE club_id = _club_id AND user_id = _user_id AND status = 'banned';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.join_library_club(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_library_club(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invite_to_library_club(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_to_library_club_invite(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_library_club_join_request(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_library_club_member_role(UUID, UUID, public.library_club_member_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_library_club_member_ban(UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_library_club(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_library_club(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_to_library_club(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_library_club_invite(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_library_club_join_request(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_library_club_member_role(UUID, UUID, public.library_club_member_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_library_club_member_ban(UUID, UUID, BOOLEAN) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_library_club_members_user ON public.library_club_members(user_id, status);

-- Club announcements (pinned posts) — member-only content.
CREATE TABLE IF NOT EXISTS public.library_club_announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    UUID NOT NULL REFERENCES public.library_clubs(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  is_pinned  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_club_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_club_announcements: member/admin reads"
  ON public.library_club_announcements FOR SELECT
  USING (public.is_library_club_member(club_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_club_announcements: moderator manages"
  ON public.library_club_announcements FOR ALL
  USING (public.is_library_club_moderator(club_id))
  WITH CHECK (public.is_library_club_moderator(club_id) AND auth.uid() = author_id);

DROP TRIGGER IF EXISTS library_club_announcements_updated_at ON public.library_club_announcements;
CREATE TRIGGER library_club_announcements_updated_at
  BEFORE UPDATE ON public.library_club_announcements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_library_club_announcements_club ON public.library_club_announcements(club_id, is_pinned DESC, created_at DESC);

-- Shared reading schedule — the book a club is currently (or was previously)
-- reading together. Per-member progress reuses the existing
-- library_reading_progress table (see get_library_club_reading_progress
-- below) rather than a duplicate progress table.
CREATE TABLE IF NOT EXISTS public.library_club_reading_schedule (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             UUID NOT NULL REFERENCES public.library_clubs(id) ON DELETE CASCADE,
  book_id             UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  start_date          DATE NOT NULL,
  end_date            DATE,
  target_description  TEXT,
  is_current          BOOLEAN NOT NULL DEFAULT true,
  created_by          UUID NOT NULL REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_club_reading_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_club_reading_schedule: member/admin reads"
  ON public.library_club_reading_schedule FOR SELECT
  USING (public.is_library_club_member(club_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_club_reading_schedule: moderator manages"
  ON public.library_club_reading_schedule FOR ALL
  USING (public.is_library_club_moderator(club_id))
  WITH CHECK (public.is_library_club_moderator(club_id));

CREATE INDEX IF NOT EXISTS idx_library_club_reading_schedule_club ON public.library_club_reading_schedule(club_id, is_current DESC, start_date DESC);

-- Per-member progress for the club's current scheduled book, reusing
-- library_reading_progress — SECURITY DEFINER so a member can see fellow
-- members' progress on the shared book without needing a public read
-- policy on everyone's personal reading_progress rows.
CREATE OR REPLACE FUNCTION public.get_library_club_reading_progress(_club_id UUID)
RETURNS TABLE(user_id UUID, display_name TEXT, avatar_url TEXT, percent_complete NUMERIC, completed_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _book_id UUID;
BEGIN
  IF NOT public.is_library_club_member(_club_id) THEN
    RAISE EXCEPTION 'Only club members can view shared reading progress';
  END IF;

  SELECT s.book_id INTO _book_id FROM public.library_club_reading_schedule s
  WHERE s.club_id = _club_id AND s.is_current = true ORDER BY s.start_date DESC LIMIT 1;
  IF _book_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT m.user_id, pr.display_name, pr.avatar_url, COALESCE(p.percent_complete, 0), p.completed_at
    FROM public.library_club_members m
    LEFT JOIN public.profiles pr ON pr.user_id = m.user_id
    LEFT JOIN public.library_reading_progress p ON p.user_id = m.user_id AND p.book_id = _book_id
    WHERE m.club_id = _club_id AND m.status = 'active'
    ORDER BY COALESCE(p.percent_complete, 0) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_library_club_reading_progress(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_library_club_reading_progress(UUID) TO authenticated;

-- ============================================================
-- 3b. Community moderation — defined here (before discussions, which
-- reference is_library_user_muted() in their INSERT policies) rather than
-- later, purely for statement ordering. Extends the generic
-- content_reports table (no schema change needed there, content_type is
-- free TEXT) with a real warnings/mutes/bans record and enforcement.
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.library_moderation_action AS ENUM ('warning', 'mute', 'ban');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.library_user_moderation (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id      UUID REFERENCES public.library_clubs(id) ON DELETE CASCADE,
  action       public.library_moderation_action NOT NULL,
  reason       TEXT NOT NULL,
  moderator_id UUID NOT NULL REFERENCES auth.users(id),
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.is_library_user_muted(_user_id UUID, _club_id UUID DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_user_moderation
    WHERE user_id = _user_id
      AND action IN ('mute', 'ban')
      AND (club_id IS NOT DISTINCT FROM _club_id OR club_id IS NULL)
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

ALTER TABLE public.library_user_moderation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_user_moderation: own/moderator/admin reads"
  ON public.library_user_moderation FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR (club_id IS NOT NULL AND public.is_library_club_moderator(club_id))
  );

CREATE POLICY "library_user_moderation: moderator/admin writes"
  ON public.library_user_moderation FOR INSERT
  WITH CHECK (
    auth.uid() = moderator_id
    AND (public.has_role(auth.uid(), 'admin') OR (club_id IS NOT NULL AND public.is_library_club_moderator(club_id)))
  );

CREATE INDEX IF NOT EXISTS idx_library_user_moderation_user ON public.library_user_moderation(user_id, club_id);

-- ============================================================
-- 4. Discussion boards — shared by per-book discussions (public) and
-- per-club discussions (member-only).
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.library_discussion_context AS ENUM ('book', 'club');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.library_discussion_topics (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type     public.library_discussion_context NOT NULL,
  context_id       UUID NOT NULL,
  author_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  body             TEXT,
  is_pinned        BOOLEAN NOT NULL DEFAULT false,
  is_locked        BOOLEAN NOT NULL DEFAULT false,
  is_spoiler       BOOLEAN NOT NULL DEFAULT false,
  reply_count      INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_vector    TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))) STORED,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.can_access_library_discussion_topic(_topic_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx_type public.library_discussion_context;
  _ctx_id UUID;
BEGIN
  SELECT context_type, context_id INTO _ctx_type, _ctx_id
  FROM public.library_discussion_topics WHERE id = _topic_id;
  IF _ctx_type IS NULL THEN RETURN false; END IF;
  IF _ctx_type = 'book' THEN RETURN true; END IF;
  RETURN public.is_library_club_member(_ctx_id) OR public.has_role(auth.uid(), 'admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_library_discussion_reply(_reply_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_access_library_discussion_topic(topic_id) FROM public.library_discussion_replies WHERE id = _reply_id
$$;

ALTER TABLE public.library_discussion_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_discussion_topics: read by context"
  ON public.library_discussion_topics FOR SELECT
  USING (
    context_type = 'book'
    OR (context_type = 'club' AND public.is_library_club_member(context_id))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "library_discussion_topics: create by context"
  ON public.library_discussion_topics FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND NOT public.is_library_user_muted(auth.uid(), CASE WHEN context_type = 'club' THEN context_id ELSE NULL END)
    AND (context_type = 'book' OR public.is_library_club_member(context_id))
  );

CREATE POLICY "library_discussion_topics: author/moderator/admin updates"
  ON public.library_discussion_topics FOR UPDATE
  USING (
    auth.uid() = author_id
    OR (context_type = 'club' AND public.is_library_club_moderator(context_id))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "library_discussion_topics: author/moderator/admin deletes"
  ON public.library_discussion_topics FOR DELETE
  USING (
    auth.uid() = author_id
    OR (context_type = 'club' AND public.is_library_club_moderator(context_id))
    OR public.has_role(auth.uid(), 'admin')
  );

DROP TRIGGER IF EXISTS library_discussion_topics_updated_at ON public.library_discussion_topics;
CREATE TRIGGER library_discussion_topics_updated_at
  BEFORE UPDATE ON public.library_discussion_topics
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_library_discussion_topics_context ON public.library_discussion_topics(context_type, context_id, is_pinned DESC, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_discussion_topics_search ON public.library_discussion_topics USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_library_discussion_topics_title_trgm ON public.library_discussion_topics USING GIN(title gin_trgm_ops);

-- Cheap, deterministic duplicate-topic detection (trigram similarity),
-- reusing the same pg_trgm approach as find_potential_duplicate_book —
-- no AI call needed for this.
CREATE OR REPLACE FUNCTION public.find_similar_library_discussion_topics(_context_type public.library_discussion_context, _context_id UUID, _title TEXT, _match_limit INTEGER DEFAULT 5)
RETURNS TABLE(id UUID, title TEXT, similarity REAL)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.title, similarity(t.title, _title)
  FROM public.library_discussion_topics t
  WHERE t.context_type = _context_type AND t.context_id = _context_id
    AND similarity(t.title, _title) > 0.35
  ORDER BY similarity(t.title, _title) DESC
  LIMIT GREATEST(_match_limit, 1)
$$;

REVOKE ALL ON FUNCTION public.find_similar_library_discussion_topics(public.library_discussion_context, UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_similar_library_discussion_topics(public.library_discussion_context, UUID, TEXT, INTEGER) TO authenticated;

CREATE TABLE IF NOT EXISTS public.library_discussion_replies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id            UUID NOT NULL REFERENCES public.library_discussion_topics(id) ON DELETE CASCADE,
  parent_reply_id     UUID REFERENCES public.library_discussion_replies(id) ON DELETE CASCADE,
  quoted_reply_id     UUID REFERENCES public.library_discussion_replies(id) ON DELETE SET NULL,
  author_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body                TEXT NOT NULL,
  mentioned_user_ids  UUID[] NOT NULL DEFAULT '{}',
  image_urls          TEXT[] NOT NULL DEFAULT '{}',
  is_spoiler          BOOLEAN NOT NULL DEFAULT false,
  likes_count         INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_discussion_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_discussion_replies: read if topic accessible"
  ON public.library_discussion_replies FOR SELECT
  USING (public.can_access_library_discussion_topic(topic_id));

CREATE POLICY "library_discussion_replies: create if topic accessible and unlocked"
  ON public.library_discussion_replies FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND public.can_access_library_discussion_topic(topic_id)
    AND NOT EXISTS (SELECT 1 FROM public.library_discussion_topics t WHERE t.id = topic_id AND t.is_locked)
    AND NOT public.is_library_user_muted(auth.uid(), (
      SELECT CASE WHEN t.context_type = 'club' THEN t.context_id ELSE NULL END
      FROM public.library_discussion_topics t WHERE t.id = topic_id
    ))
  );

CREATE POLICY "library_discussion_replies: author/moderator/admin updates"
  ON public.library_discussion_replies FOR UPDATE
  USING (
    auth.uid() = author_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.library_discussion_topics t
      WHERE t.id = topic_id AND t.context_type = 'club' AND public.is_library_club_moderator(t.context_id)
    )
  );

CREATE POLICY "library_discussion_replies: author/moderator/admin deletes"
  ON public.library_discussion_replies FOR DELETE
  USING (
    auth.uid() = author_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.library_discussion_topics t
      WHERE t.id = topic_id AND t.context_type = 'club' AND public.is_library_club_moderator(t.context_id)
    )
  );

DROP TRIGGER IF EXISTS library_discussion_replies_updated_at ON public.library_discussion_replies;
CREATE TRIGGER library_discussion_replies_updated_at
  BEFORE UPDATE ON public.library_discussion_replies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_library_discussion_replies_topic ON public.library_discussion_replies(topic_id, created_at);
CREATE INDEX IF NOT EXISTS idx_library_discussion_replies_parent ON public.library_discussion_replies(parent_reply_id);

-- Maintain topic reply_count/last_activity_at, and notify the topic author,
-- the quoted/parent reply author, and every @mentioned user.
CREATE OR REPLACE FUNCTION public.trg_library_discussion_reply_side_effects()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _topic_author UUID;
  _topic_title TEXT;
  _reply_author_name TEXT;
  _parent_author UUID;
  _mentioned UUID;
BEGIN
  UPDATE public.library_discussion_topics
  SET reply_count = reply_count + 1, last_activity_at = now()
  WHERE id = NEW.topic_id
  RETURNING author_id, title INTO _topic_author, _topic_title;

  SELECT display_name INTO _reply_author_name FROM public.profiles WHERE user_id = NEW.author_id;

  IF _topic_author IS NOT NULL AND _topic_author <> NEW.author_id THEN
    INSERT INTO public.notifications (user_id, title, body, type, category)
    VALUES (_topic_author, 'New reply', COALESCE(_reply_author_name, 'Someone') || ' replied to "' || _topic_title || '"', 'info', 'community_reply');
  END IF;

  IF NEW.parent_reply_id IS NOT NULL THEN
    SELECT author_id INTO _parent_author FROM public.library_discussion_replies WHERE id = NEW.parent_reply_id;
    IF _parent_author IS NOT NULL AND _parent_author <> NEW.author_id AND _parent_author <> _topic_author THEN
      INSERT INTO public.notifications (user_id, title, body, type, category)
      VALUES (_parent_author, 'New reply', COALESCE(_reply_author_name, 'Someone') || ' replied to your comment', 'info', 'community_reply');
    END IF;
  END IF;

  IF NEW.mentioned_user_ids IS NOT NULL THEN
    FOREACH _mentioned IN ARRAY NEW.mentioned_user_ids LOOP
      IF _mentioned <> NEW.author_id THEN
        INSERT INTO public.notifications (user_id, title, body, type, category)
        VALUES (_mentioned, 'You were mentioned', COALESCE(_reply_author_name, 'Someone') || ' mentioned you in "' || _topic_title || '"', 'info', 'community_mention');
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_discussion_replies_side_effects ON public.library_discussion_replies;
CREATE TRIGGER trg_library_discussion_replies_side_effects
  AFTER INSERT ON public.library_discussion_replies
  FOR EACH ROW EXECUTE FUNCTION public.trg_library_discussion_reply_side_effects();

CREATE TABLE IF NOT EXISTS public.library_discussion_reply_likes (
  reply_id   UUID NOT NULL REFERENCES public.library_discussion_replies(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (reply_id, user_id)
);

ALTER TABLE public.library_discussion_reply_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_discussion_reply_likes: read if reply accessible"
  ON public.library_discussion_reply_likes FOR SELECT
  USING (public.can_access_library_discussion_reply(reply_id));

CREATE POLICY "library_discussion_reply_likes: user manages own"
  ON public.library_discussion_reply_likes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND public.can_access_library_discussion_reply(reply_id));

CREATE OR REPLACE FUNCTION public.trg_bump_library_discussion_reply_likes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.library_discussion_replies SET likes_count = likes_count + 1 WHERE id = NEW.reply_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.library_discussion_replies SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.reply_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_discussion_reply_likes_count ON public.library_discussion_reply_likes;
CREATE TRIGGER trg_library_discussion_reply_likes_count
  AFTER INSERT OR DELETE ON public.library_discussion_reply_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_library_discussion_reply_likes();

-- Polls
CREATE TABLE IF NOT EXISTS public.library_discussion_polls (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id   UUID NOT NULL UNIQUE REFERENCES public.library_discussion_topics(id) ON DELETE CASCADE,
  question   TEXT NOT NULL,
  options    JSONB NOT NULL,
  closes_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_discussion_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_discussion_polls: read if topic accessible"
  ON public.library_discussion_polls FOR SELECT
  USING (public.can_access_library_discussion_topic(topic_id));

CREATE POLICY "library_discussion_polls: topic author manages"
  ON public.library_discussion_polls FOR ALL
  USING (EXISTS (SELECT 1 FROM public.library_discussion_topics t WHERE t.id = topic_id AND t.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.library_discussion_topics t WHERE t.id = topic_id AND t.author_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.library_discussion_poll_votes (
  poll_id    UUID NOT NULL REFERENCES public.library_discussion_polls(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_id  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

ALTER TABLE public.library_discussion_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_discussion_poll_votes: read if poll's topic accessible"
  ON public.library_discussion_poll_votes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.library_discussion_polls p WHERE p.id = poll_id AND public.can_access_library_discussion_topic(p.topic_id)));

CREATE POLICY "library_discussion_poll_votes: user votes own, poll open"
  ON public.library_discussion_poll_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.library_discussion_polls p
      WHERE p.id = poll_id AND public.can_access_library_discussion_topic(p.topic_id)
        AND (p.closes_at IS NULL OR p.closes_at > now())
    )
  );

-- Lets a voter change their vote while the poll is still open — without
-- this, an upsert on a repeat vote would fail (no UPDATE policy existed).
CREATE POLICY "library_discussion_poll_votes: user changes own vote while open"
  ON public.library_discussion_poll_votes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.library_discussion_polls p
      WHERE p.id = poll_id AND (p.closes_at IS NULL OR p.closes_at > now())
    )
  );

-- ============================================================
-- 5. Reading goals + real reading-activity streaks
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.library_goal_type AS ENUM
    ('books_per_month', 'pages_per_day', 'listening_minutes_per_day', 'minutes_per_day', 'sessions_per_week', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.library_reading_goals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type    public.library_goal_type NOT NULL,
  target       INTEGER NOT NULL CHECK (target > 0),
  custom_label TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_reading_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_reading_goals: user manages own"
  ON public.library_reading_goals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "library_reading_goals: admin reads"
  ON public.library_reading_goals FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS library_reading_goals_updated_at ON public.library_reading_goals;
CREATE TRIGGER library_reading_goals_updated_at
  BEFORE UPDATE ON public.library_reading_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.library_reading_daily_activity (
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  pages_read    INTEGER NOT NULL DEFAULT 0,
  minutes_read  INTEGER NOT NULL DEFAULT 0,
  sessions      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, activity_date)
);

ALTER TABLE public.library_reading_daily_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_reading_daily_activity: user manages own"
  ON public.library_reading_daily_activity FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "library_reading_daily_activity: admin reads"
  ON public.library_reading_daily_activity FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Self-scoped upsert of today's reading activity — called from the reader
-- whenever a reading/listening session ends.
CREATE OR REPLACE FUNCTION public.log_library_reading_activity(_pages INTEGER DEFAULT 0, _minutes INTEGER DEFAULT 0)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _pages < 0 OR _minutes < 0 THEN RAISE EXCEPTION 'pages/minutes must be non-negative'; END IF;

  INSERT INTO public.library_reading_daily_activity (user_id, activity_date, pages_read, minutes_read, sessions)
  VALUES (auth.uid(), CURRENT_DATE, _pages, _minutes, 1)
  ON CONFLICT (user_id, activity_date) DO UPDATE
  SET pages_read = public.library_reading_daily_activity.pages_read + EXCLUDED.pages_read,
      minutes_read = public.library_reading_daily_activity.minutes_read + EXCLUDED.minutes_read,
      sessions = public.library_reading_daily_activity.sessions + 1;
END;
$$;

-- Bounded backward day-walk, same shape as the audiobook listening-stats
-- streak computation (get_library_listening_stats) — "today" not yet
-- logged doesn't break the streak, any earlier gap does.
CREATE OR REPLACE FUNCTION public.get_library_reading_streak(_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _streak INTEGER := 0;
  _day DATE := CURRENT_DATE;
  _iterations INTEGER := 0;
  _has_activity BOOLEAN;
BEGIN
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

REVOKE ALL ON FUNCTION public.log_library_reading_activity(INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_library_reading_streak(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_library_reading_activity(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_library_reading_streak(UUID) TO authenticated;

-- ============================================================
-- 6. Community/custom reading challenges — extends the existing
-- admin-only library_challenges rather than a parallel table.
-- ============================================================
ALTER TABLE public.library_challenges
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'admin' CHECK (scope IN ('admin', 'community', 'custom')),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cadence TEXT NOT NULL DEFAULT 'custom' CHECK (cadence IN ('daily', 'weekly', 'monthly', 'yearly', 'custom')),
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.library_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.library_authors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS participant_count INTEGER NOT NULL DEFAULT 0;

-- Additive INSERT policy (OR'd with the existing admin-only policy) — any
-- authenticated user may create a community/custom challenge for themself.
CREATE POLICY "library_challenges: users create community/custom"
  ON public.library_challenges FOR INSERT
  WITH CHECK (auth.uid() = created_by AND scope IN ('community', 'custom'));

CREATE OR REPLACE FUNCTION public.trg_bump_library_challenge_participants()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.library_challenges SET participant_count = participant_count + 1 WHERE id = NEW.challenge_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.library_challenges SET participant_count = GREATEST(participant_count - 1, 0) WHERE id = OLD.challenge_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_challenge_progress_participants ON public.library_challenge_progress;
CREATE TRIGGER trg_library_challenge_progress_participants
  AFTER INSERT OR DELETE ON public.library_challenge_progress
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_library_challenge_participants();

CREATE INDEX IF NOT EXISTS idx_library_challenges_scope ON public.library_challenges(scope, is_active);

-- ============================================================
-- 7. Review enhancements — pros/cons + explicit spoiler flag. Video
-- attachments already work via the existing library_review_media table's
-- media_type CHECK(image|video), no schema change needed for that.
-- ============================================================
ALTER TABLE public.library_reviews
  ADD COLUMN IF NOT EXISTS pros TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cons TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS has_spoilers BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 8. Live Events — reuses the existing voice_rooms + LiveKit
-- infrastructure for real in-app "Live Audio Rooms" rather than a
-- parallel system.
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.library_event_type AS ENUM
    ('author_qa', 'book_launch', 'reading_session', 'live_audio', 'webinar', 'workshop', 'meetup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.library_event_rsvp_status AS ENUM ('going', 'interested', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.library_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      public.library_event_type NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  host_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id         UUID REFERENCES public.library_clubs(id) ON DELETE CASCADE,
  book_id         UUID REFERENCES public.library_books(id) ON DELETE SET NULL,
  author_id       UUID REFERENCES public.library_authors(id) ON DELETE SET NULL,
  cover_image_url TEXT,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end   TIMESTAMPTZ,
  voice_room_id   UUID REFERENCES public.voice_rooms(id) ON DELETE SET NULL,
  max_attendees   INTEGER,
  is_cancelled    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_events: read public or member/admin"
  ON public.library_events FOR SELECT
  USING (club_id IS NULL OR public.is_library_club_member(club_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_events: host creates"
  ON public.library_events FOR INSERT
  WITH CHECK (
    auth.uid() = host_id
    AND (club_id IS NULL OR public.is_library_club_moderator(club_id))
  );

CREATE POLICY "library_events: host/moderator/admin updates"
  ON public.library_events FOR UPDATE
  USING (
    auth.uid() = host_id
    OR public.has_role(auth.uid(), 'admin')
    OR (club_id IS NOT NULL AND public.is_library_club_moderator(club_id))
  );

CREATE POLICY "library_events: host/admin deletes"
  ON public.library_events FOR DELETE
  USING (auth.uid() = host_id OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS library_events_updated_at ON public.library_events;
CREATE TRIGGER library_events_updated_at
  BEFORE UPDATE ON public.library_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_library_events_scheduled ON public.library_events(scheduled_start) WHERE NOT is_cancelled;
CREATE INDEX IF NOT EXISTS idx_library_events_club ON public.library_events(club_id);

CREATE TABLE IF NOT EXISTS public.library_event_rsvps (
  event_id      UUID NOT NULL REFERENCES public.library_events(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        public.library_event_rsvp_status NOT NULL DEFAULT 'going',
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

ALTER TABLE public.library_event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_event_rsvps: own row or event host or admin reads"
  ON public.library_event_rsvps FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.library_events e WHERE e.id = event_id AND e.host_id = auth.uid())
  );

CREATE POLICY "library_event_rsvps: user manages own"
  ON public.library_event_rsvps FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Self-service RSVP RPC — enforces max_attendees when going.
CREATE OR REPLACE FUNCTION public.rsvp_library_event(_event_id UUID, _status public.library_event_rsvp_status)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _max_attendees INTEGER;
  _current_going INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  IF _status = 'going' THEN
    SELECT max_attendees INTO _max_attendees FROM public.library_events WHERE id = _event_id;
    IF _max_attendees IS NOT NULL THEN
      SELECT COUNT(*) INTO _current_going FROM public.library_event_rsvps
      WHERE event_id = _event_id AND status = 'going' AND user_id <> auth.uid();
      IF _current_going >= _max_attendees THEN
        RAISE EXCEPTION 'This event is full';
      END IF;
    END IF;
  END IF;

  INSERT INTO public.library_event_rsvps (event_id, user_id, status)
  VALUES (_event_id, auth.uid(), _status)
  ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status;
END;
$$;

-- Host-only: creates a real voice_rooms row and links it to the event —
-- reuses the exact same infra VoiceRooms.tsx/VoiceRoom.tsx already use.
CREATE OR REPLACE FUNCTION public.start_library_event_voice_room(_event_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _event RECORD;
  _room_id UUID;
BEGIN
  SELECT * INTO _event FROM public.library_events WHERE id = _event_id;
  IF _event IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF _event.host_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only the event host can start the live room';
  END IF;

  IF _event.voice_room_id IS NOT NULL THEN RETURN _event.voice_room_id; END IF;

  INSERT INTO public.voice_rooms (owner_id, room_name, room_topic, is_private, room_mode)
  VALUES (
    _event.host_id,
    _event.title,
    _event.description,
    _event.club_id IS NOT NULL,
    CASE WHEN _event.event_type IN ('author_qa', 'webinar', 'workshop') THEN 'stage' ELSE 'conversation' END
  )
  RETURNING id INTO _room_id;

  UPDATE public.library_events SET voice_room_id = _room_id WHERE id = _event_id;
  RETURN _room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rsvp_library_event(UUID, public.library_event_rsvp_status) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_library_event_voice_room(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rsvp_library_event(UUID, public.library_event_rsvp_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_library_event_voice_room(UUID) TO authenticated;

-- Real, executed reminder job — direct SQL only (no net.http_post; that
-- has zero precedent in this codebase). Mirrors the proven
-- 'activate-scheduled-voice-rooms' cron job exactly.
SELECT cron.schedule(
  'library-event-reminders',
  '*/5 * * * *',
  $$
    INSERT INTO public.notifications (user_id, title, body, type, category)
    SELECT r.user_id, 'Event starting soon', e.title || ' starts in 30 minutes', 'info', 'community_event'
    FROM public.library_event_rsvps r
    JOIN public.library_events e ON e.id = r.event_id
    WHERE r.status = 'going' AND r.reminder_sent = false
      AND e.is_cancelled = false
      AND e.scheduled_start BETWEEN now() AND now() + interval '30 minutes';

    UPDATE public.library_event_rsvps r
    SET reminder_sent = true
    FROM public.library_events e
    WHERE r.event_id = e.id AND r.status = 'going' AND r.reminder_sent = false
      AND e.is_cancelled = false
      AND e.scheduled_start BETWEEN now() AND now() + interval '30 minutes';
  $$
);

-- ============================================================
-- 9. Leaderboards — pure aggregation RPCs, no new tables.
-- ============================================================
-- entity_id is TEXT, not UUID — readers/authors put a UUID's text form in
-- it (routed by id), clubs put a slug (routed by slug); one polymorphic
-- column keeps the frontend's row-linking logic uniform across metrics.
CREATE OR REPLACE FUNCTION public.get_library_leaderboard(_metric TEXT, _period TEXT DEFAULT 'all')
RETURNS TABLE(entity_id TEXT, name TEXT, image_url TEXT, score BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _since TIMESTAMPTZ;
BEGIN
  _since := CASE _period
    WHEN 'week' THEN now() - interval '7 days'
    WHEN 'month' THEN now() - interval '30 days'
    WHEN 'year' THEN now() - interval '365 days'
    ELSE '-infinity'::timestamptz
  END;

  -- library_reader_profiles.is_public defaults to true, so a user who
  -- never created one still appears (no explicit opt-out); a user who set
  -- is_public=false is excluded from every reader-scoped leaderboard.
  IF _metric = 'readers' THEN
    RETURN QUERY
      SELECT p.user_id::text, pr.display_name, pr.avatar_url, COUNT(*)::BIGINT
      FROM public.library_reading_progress p
      LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
      LEFT JOIN public.library_reader_profiles lrp ON lrp.user_id = p.user_id
      WHERE p.completed_at IS NOT NULL AND p.completed_at >= _since
        AND COALESCE(lrp.is_public, true)
      GROUP BY p.user_id, pr.display_name, pr.avatar_url
      ORDER BY 4 DESC LIMIT 50;

  ELSIF _metric = 'reviewers' THEN
    RETURN QUERY
      SELECT r.user_id::text, pr.display_name, pr.avatar_url, COUNT(*)::BIGINT
      FROM public.library_reviews r
      LEFT JOIN public.profiles pr ON pr.user_id = r.user_id
      LEFT JOIN public.library_reader_profiles lrp ON lrp.user_id = r.user_id
      WHERE r.created_at >= _since
        AND COALESCE(lrp.is_public, true)
      GROUP BY r.user_id, pr.display_name, pr.avatar_url
      ORDER BY 4 DESC LIMIT 50;

  ELSIF _metric = 'helpful' THEN
    RETURN QUERY
      SELECT r.user_id::text, pr.display_name, pr.avatar_url, COALESCE(SUM(r.helpful_count), 0)::BIGINT
      FROM public.library_reviews r
      LEFT JOIN public.profiles pr ON pr.user_id = r.user_id
      LEFT JOIN public.library_reader_profiles lrp ON lrp.user_id = r.user_id
      WHERE r.created_at >= _since
        AND COALESCE(lrp.is_public, true)
      GROUP BY r.user_id, pr.display_name, pr.avatar_url
      ORDER BY 4 DESC LIMIT 50;

  ELSIF _metric = 'clubs' THEN
    RETURN QUERY
      SELECT c.slug, c.name, c.cover_image_url, c.member_count::BIGINT
      FROM public.library_clubs c
      WHERE c.is_active AND c.visibility IN ('public', 'private')
      ORDER BY 4 DESC LIMIT 50;

  ELSIF _metric = 'authors' THEN
    IF _period = 'all' THEN
      RETURN QUERY
        SELECT a.id::text, a.name, a.photo_url, a.follower_count::BIGINT
        FROM public.library_authors a
        ORDER BY 4 DESC LIMIT 50;
    ELSE
      RETURN QUERY
        SELECT a.id::text, a.name, a.photo_url, COUNT(f.*)::BIGINT
        FROM public.library_authors a
        JOIN public.library_author_followers f ON f.author_id = a.id AND f.created_at >= _since
        GROUP BY a.id, a.name, a.photo_url
        ORDER BY 4 DESC LIMIT 50;
    END IF;

  ELSE
    RAISE EXCEPTION 'Unknown leaderboard metric: %', _metric;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_library_leaderboard(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_library_leaderboard(TEXT, TEXT) TO anon, authenticated;

-- ============================================================
-- 11. New achievement badges — reuses the existing library_achievements /
-- library_user_achievements tables (Phase 6.5/10), no schema change.
-- ============================================================
INSERT INTO public.library_achievements (code, name, description, icon, criteria, reward_vx) VALUES
  ('reading_streak_7',   'Week Streak',       'Read 7 days in a row.',                       'flame',   '{"streak_days": 7}'::jsonb,   30),
  ('reading_streak_30',  'Month Streak',      'Read 30 days in a row.',                      'flame',   '{"streak_days": 30}'::jsonb,  150),
  ('genre_explorer',     'Genre Explorer',    'Finished books in 5 different genres.',       'compass', '{"genre_count": 5}'::jsonb,   50),
  ('genre_master',       'Genre Master',      'Finished 10 books in a single genre.',        'award',   '{"same_genre_count": 10}'::jsonb, 75),
  ('top_reviewer',       'Top Reviewer',      'Wrote 50 book reviews.',                      'star',    '{"review_count": 50}'::jsonb, 100),
  ('community_helper',   'Community Helper',  'Posted 100 discussion replies.',              'heart-handshake', '{"reply_count": 100}'::jsonb, 60),
  ('author_supporter',   'Author Supporter',  'Followed 10 different authors.',              'users',   '{"followed_authors": 10}'::jsonb, 40)
ON CONFLICT (code) DO NOTHING;

-- Generic checker, callable from any trigger — mirrors the marketplace
-- phase's achievement-award trigger shape (insert-if-criteria-met,
-- ON CONFLICT DO NOTHING since library_user_achievements is PK'd on
-- (user_id, achievement_id)).
CREATE OR REPLACE FUNCTION public.check_and_award_library_achievement(_user_id UUID, _code TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _achievement_id UUID;
BEGIN
  SELECT id INTO _achievement_id FROM public.library_achievements WHERE code = _code;
  IF _achievement_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.library_user_achievements (user_id, achievement_id)
  VALUES (_user_id, _achievement_id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_award_library_achievement(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Reading streak badges — checked right where the streak is computed.
CREATE OR REPLACE FUNCTION public.trg_check_library_reading_streak_achievements()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _streak INTEGER;
BEGIN
  _streak := public.get_library_reading_streak(NEW.user_id);
  IF _streak >= 7 THEN PERFORM public.check_and_award_library_achievement(NEW.user_id, 'reading_streak_7'); END IF;
  IF _streak >= 30 THEN PERFORM public.check_and_award_library_achievement(NEW.user_id, 'reading_streak_30'); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_reading_daily_activity_streaks ON public.library_reading_daily_activity;
CREATE TRIGGER trg_library_reading_daily_activity_streaks
  AFTER INSERT OR UPDATE ON public.library_reading_daily_activity
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_library_reading_streak_achievements();

-- Community helper — every 100th discussion reply.
CREATE OR REPLACE FUNCTION public.trg_check_library_community_helper_achievement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _reply_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO _reply_count FROM public.library_discussion_replies WHERE author_id = NEW.author_id;
  IF _reply_count >= 100 THEN
    PERFORM public.check_and_award_library_achievement(NEW.author_id, 'community_helper');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_discussion_replies_achievements ON public.library_discussion_replies;
CREATE TRIGGER trg_library_discussion_replies_achievements
  AFTER INSERT ON public.library_discussion_replies
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_library_community_helper_achievement();

-- Author supporter — every 10th distinct author followed.
CREATE OR REPLACE FUNCTION public.trg_check_library_author_supporter_achievement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _followed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO _followed_count FROM public.library_author_followers WHERE user_id = NEW.user_id;
  IF _followed_count >= 10 THEN
    PERFORM public.check_and_award_library_achievement(NEW.user_id, 'author_supporter');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_author_followers_achievements ON public.library_author_followers;
CREATE TRIGGER trg_library_author_followers_achievements
  AFTER INSERT ON public.library_author_followers
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_library_author_supporter_achievement();

-- Top reviewer — every 50th review.
CREATE OR REPLACE FUNCTION public.trg_check_library_top_reviewer_achievement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _review_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO _review_count FROM public.library_reviews WHERE user_id = NEW.user_id;
  IF _review_count >= 50 THEN
    PERFORM public.check_and_award_library_achievement(NEW.user_id, 'top_reviewer');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_reviews_top_reviewer_achievement ON public.library_reviews;
CREATE TRIGGER trg_library_reviews_top_reviewer_achievement
  AFTER INSERT ON public.library_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_library_top_reviewer_achievement();

-- Genre explorer / genre master — checked whenever a book is marked
-- completed, joined against the book's category.
CREATE OR REPLACE FUNCTION public.trg_check_library_genre_achievements()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _distinct_genres INTEGER;
  _same_genre_count INTEGER;
  _category_id UUID;
BEGIN
  IF NEW.completed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Checked as a standalone IF (not combined into one boolean expression)
  -- so OLD is only ever referenced during an actual UPDATE invocation —
  -- referencing OLD unconditionally in code that also fires on INSERT is
  -- a classic PL/pgSQL trigger bug.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.completed_at IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT COUNT(DISTINCT b.category_id) INTO _distinct_genres
  FROM public.library_reading_progress p
  JOIN public.library_books b ON b.id = p.book_id
  WHERE p.user_id = NEW.user_id AND p.completed_at IS NOT NULL AND b.category_id IS NOT NULL;

  IF _distinct_genres >= 5 THEN
    PERFORM public.check_and_award_library_achievement(NEW.user_id, 'genre_explorer');
  END IF;

  SELECT category_id INTO _category_id FROM public.library_books WHERE id = NEW.book_id;
  IF _category_id IS NOT NULL THEN
    SELECT COUNT(*) INTO _same_genre_count
    FROM public.library_reading_progress p
    JOIN public.library_books b ON b.id = p.book_id
    WHERE p.user_id = NEW.user_id AND p.completed_at IS NOT NULL AND b.category_id = _category_id;

    IF _same_genre_count >= 10 THEN
      PERFORM public.check_and_award_library_achievement(NEW.user_id, 'genre_master');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_reading_progress_genre_achievements ON public.library_reading_progress;
CREATE TRIGGER trg_library_reading_progress_genre_achievements
  AFTER INSERT OR UPDATE OF completed_at ON public.library_reading_progress
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_library_genre_achievements();

-- ============================================================
-- 12. Widen award_library_xp()'s reason whitelist for community actions.
-- Every existing WHEN branch is preserved unchanged (established
-- convention — see 20260725000000/20260726000000).
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_library_xp(_amount INTEGER, _reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_id UUID := auth.uid();
  _max_amount INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  CASE
    WHEN _reason LIKE 'Book completed:%'      THEN _max_amount := 100;
    WHEN _reason LIKE 'Review written:%'      THEN _max_amount := 25;
    WHEN _reason LIKE 'Reading streak:%'      THEN _max_amount := 50;
    WHEN _reason LIKE 'Challenge completed:%' THEN _max_amount := 300;
    WHEN _reason LIKE 'Daily reading goal:%'  THEN _max_amount := 20;
    WHEN _reason LIKE 'Summary completed:%'   THEN _max_amount := 10;
    WHEN _reason LIKE 'Quiz completed:%'      THEN _max_amount := 50;
    WHEN _reason LIKE 'Flashcards created:%'  THEN _max_amount := 15;
    WHEN _reason LIKE 'Weekly reading goal:%' THEN _max_amount := 40;
    WHEN _reason LIKE 'Listening streak:%'    THEN _max_amount := 50;
    WHEN _reason LIKE 'Club created:%'        THEN _max_amount := 20;
    WHEN _reason LIKE 'Event attended:%'      THEN _max_amount := 30;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN
    RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason;
  END IF;

  INSERT INTO public.library_xp_events(user_id, amount, reason)
  VALUES (_user_id, _amount, _reason);

  INSERT INTO public.user_points(user_id, points, reason)
  VALUES (_user_id, _amount, _reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_library_xp(INTEGER, TEXT) TO authenticated;

-- ============================================================
-- 13. Public profile name/avatar lookups for the whole Community feature.
--
-- `profiles` itself only has a self-read + admin-read SELECT policy (see
-- 20260320041852/20260323150121) — there is no "any authenticated user can
-- view another user's display_name/avatar_url" policy anywhere in this
-- codebase. That means every Community surface that shows another
-- person's name (club members, discussion authors, event hosts, followers/
-- following lists) would silently render blank/fallback names under plain
-- RLS. Rather than widening `profiles` itself (which would also expose
-- ban_reason/is_admin/trial billing fields to any authenticated user),
-- this narrow SECURITY DEFINER function exposes ONLY user_id/display_name/
-- avatar_url for a batch of ids — the one safe way Phase 12's client code
-- resolves other users' names. (The same underlying gap affects some
-- pre-existing Library code, e.g. library_reviews' reviewer names for
-- other users — that is a separate, already-shipped issue, not touched
-- here.)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_library_public_profile_summaries(_user_ids UUID[])
RETURNS TABLE(user_id UUID, display_name TEXT, avatar_url TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
$$;

REVOKE ALL ON FUNCTION public.get_library_public_profile_summaries(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_library_public_profile_summaries(UUID[]) TO authenticated;

-- Aggregate profile stats respecting the viewed user's privacy toggles —
-- a user without a library_reader_profiles row is treated as fully public
-- (is_public/show_* all default to true).
CREATE OR REPLACE FUNCTION public.get_library_reader_profile_stats(_target_user_id UUID)
RETURNS TABLE(books_read_count BIGINT, books_reading_count BIGINT, wishlist_count BIGINT, reviews_count BIGINT, followers_count BIGINT, following_count BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _is_self BOOLEAN := auth.uid() = _target_user_id;
  _profile RECORD;
  _show_activity BOOLEAN;
  _show_reviews BOOLEAN;
  _show_followers BOOLEAN;
BEGIN
  SELECT * INTO _profile FROM public.library_reader_profiles WHERE user_id = _target_user_id;

  IF NOT _is_self AND _profile.user_id IS NOT NULL AND NOT _profile.is_public THEN
    RAISE EXCEPTION 'This profile is private';
  END IF;

  _show_activity := _is_self OR _profile.user_id IS NULL OR _profile.show_reading_activity;
  _show_reviews := _is_self OR _profile.user_id IS NULL OR _profile.show_reviews;
  _show_followers := _is_self OR _profile.user_id IS NULL OR _profile.show_followers;

  RETURN QUERY SELECT
    (CASE WHEN _show_activity THEN (SELECT COUNT(*) FROM public.library_reading_progress WHERE user_id = _target_user_id AND completed_at IS NOT NULL) ELSE 0 END),
    (CASE WHEN _show_activity THEN (SELECT COUNT(*) FROM public.library_reading_progress WHERE user_id = _target_user_id AND completed_at IS NULL) ELSE 0 END),
    (CASE WHEN _show_activity THEN (SELECT COUNT(*) FROM public.library_wishlist WHERE user_id = _target_user_id) ELSE 0 END),
    (CASE WHEN _show_reviews THEN (SELECT COUNT(*) FROM public.library_reviews WHERE user_id = _target_user_id) ELSE 0 END),
    (CASE WHEN _show_followers THEN (SELECT COUNT(*) FROM public.library_follows WHERE followee_id = _target_user_id) ELSE 0 END),
    (CASE WHEN _show_followers THEN (SELECT COUNT(*) FROM public.library_follows WHERE follower_id = _target_user_id) ELSE 0 END);
END;
$$;

REVOKE ALL ON FUNCTION public.get_library_reader_profile_stats(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_library_reader_profile_stats(UUID) TO authenticated;
