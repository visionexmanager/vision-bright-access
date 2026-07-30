-- ============================================================
-- Migration: VisionKids Live Events (Phase 8) — live chat, polls, Q&A,
-- emoji reactions, and the Replay Library.
--
-- Chat safety model: identical to kids_messages / kids_social_group_messages
-- (Phase 7) — the real gate is the client-side keyword+PII filter
-- (chatModeration.ts) run before send, the AI moderate-content edge
-- function only flags afterward for review. Sending also requires the
-- caller's event registration to be approved (or not requiring approval),
-- so a child whose parent hasn't yet approved can watch but not chat.
-- ============================================================

-- ============================================================
-- kids_event_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_event_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES public.kids_events(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content             TEXT NOT NULL,
  was_filtered        BOOLEAN NOT NULL DEFAULT false,
  is_flagged          BOOLEAN NOT NULL DEFAULT false,
  flagged_categories  TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_event_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_event_messages: readable if event readable"
  ON public.kids_event_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND (e.status <> 'draft' OR public.has_role(auth.uid(), 'admin') OR e.host_id = auth.uid())
  ));

CREATE POLICY "kids_event_messages: approved registrants send if not restricted"
  ON public.kids_event_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND NOT public.is_kids_user_restricted(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND e.host_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.kids_event_registrations r
        WHERE r.event_id = kids_event_messages.event_id AND r.user_id = auth.uid()
          AND r.status <> 'cancelled' AND r.parental_approval_status IN ('not_required', 'approved')
      )
    )
  );

CREATE POLICY "kids_event_messages: author or host deletes"
  ON public.kids_event_messages FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND e.host_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_kids_event_messages_event ON public.kids_event_messages(event_id, created_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.kids_event_messages;

-- ============================================================
-- kids_event_polls / kids_event_poll_votes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_event_polls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.kids_events(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  options     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  closes_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_event_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_event_polls: readable if event readable"
  ON public.kids_event_polls FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND (e.status <> 'draft' OR public.has_role(auth.uid(), 'admin') OR e.host_id = auth.uid())));

CREATE POLICY "kids_event_polls: host or admin manage"
  ON public.kids_event_polls FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND e.host_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND e.host_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.kids_event_polls;

CREATE TABLE IF NOT EXISTS public.kids_event_poll_votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id       UUID NOT NULL REFERENCES public.kids_event_polls(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index  INTEGER NOT NULL CHECK (option_index >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

ALTER TABLE public.kids_event_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_event_poll_votes: readable if poll readable"
  ON public.kids_event_poll_votes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kids_event_polls p JOIN public.kids_events e ON e.id = p.event_id
    WHERE p.id = poll_id AND (e.status <> 'draft' OR public.has_role(auth.uid(), 'admin') OR e.host_id = auth.uid())
  ));

CREATE POLICY "kids_event_poll_votes: self votes once"
  ON public.kids_event_poll_votes FOR INSERT
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.kids_event_polls p WHERE p.id = poll_id AND p.is_active));

ALTER PUBLICATION supabase_realtime ADD TABLE public.kids_event_poll_votes;

-- ============================================================
-- kids_event_questions / kids_event_question_upvotes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_event_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.kids_events(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question      TEXT NOT NULL,
  upvote_count  INTEGER NOT NULL DEFAULT 0,
  is_answered   BOOLEAN NOT NULL DEFAULT false,
  answer_text   TEXT,
  answered_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_event_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_event_questions: readable if event readable"
  ON public.kids_event_questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND (e.status <> 'draft' OR public.has_role(auth.uid(), 'admin') OR e.host_id = auth.uid())));

CREATE POLICY "kids_event_questions: approved registrants ask if not restricted"
  ON public.kids_event_questions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND NOT public.is_kids_user_restricted(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.kids_event_registrations r
        WHERE r.event_id = kids_event_questions.event_id AND r.user_id = auth.uid()
          AND r.status <> 'cancelled' AND r.parental_approval_status IN ('not_required', 'approved')
      )
    )
  );

CREATE POLICY "kids_event_questions: host answers"
  ON public.kids_event_questions FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND e.host_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND e.host_id = auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.kids_event_questions;

CREATE TABLE IF NOT EXISTS public.kids_event_question_upvotes (
  question_id  UUID NOT NULL REFERENCES public.kids_event_questions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);

ALTER TABLE public.kids_event_question_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_event_question_upvotes: self manages own"
  ON public.kids_event_question_upvotes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_kids_event_question_upvote_count()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.kids_event_questions SET upvote_count = upvote_count + 1 WHERE id = NEW.question_id;
    RETURN NEW;
  ELSE
    UPDATE public.kids_event_questions SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = OLD.question_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER trg_kids_event_question_upvote_insert
  AFTER INSERT ON public.kids_event_question_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.touch_kids_event_question_upvote_count();

CREATE TRIGGER trg_kids_event_question_upvote_delete
  AFTER DELETE ON public.kids_event_question_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.touch_kids_event_question_upvote_count();

-- ============================================================
-- Emoji reactions — a live, ephemeral UX (like YouTube/Discord floating
-- reactions), so individual taps are broadcast client-side via Supabase
-- Realtime's broadcast channel, NOT persisted per-tap (writing a row per
-- emoji tap would be a write-heavy anti-pattern at "hundreds of thousands
-- of participants" scale). Only a running total per emoji is kept, on
-- kids_events.reaction_counts, for basic display after the fact.
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_kids_event_reaction(_event_id UUID, _emoji TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  IF length(_emoji) > 8 THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;

  UPDATE public.kids_events
  SET reaction_counts = jsonb_set(
    reaction_counts, ARRAY[_emoji],
    to_jsonb(COALESCE((reaction_counts ->> _emoji)::INTEGER, 0) + 1)
  )
  WHERE id = _event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_kids_event_reaction(UUID, TEXT) TO authenticated;

-- ============================================================
-- kids_event_replays / kids_replay_progress
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_event_replays (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL UNIQUE REFERENCES public.kids_events(id) ON DELETE CASCADE,
  video_url         TEXT,
  thumbnail_url     TEXT,
  captions_url      TEXT,
  duration_seconds  INTEGER NOT NULL DEFAULT 0,
  view_count        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_event_replays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_event_replays: readable if event readable"
  ON public.kids_event_replays FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND (e.status <> 'draft' OR public.has_role(auth.uid(), 'admin') OR e.host_id = auth.uid())));

CREATE POLICY "kids_event_replays: host or admin manage"
  ON public.kids_event_replays FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND e.host_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.kids_events e WHERE e.id = event_id AND e.host_id = auth.uid()));

-- Any viewer can bump the view counter (there's no participant UPDATE
-- policy on kids_event_replays itself — this is the only path in).
CREATE OR REPLACE FUNCTION public.increment_kids_replay_view(_replay_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  UPDATE public.kids_event_replays SET view_count = view_count + 1 WHERE id = _replay_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_kids_replay_view(UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.kids_replay_progress (
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  replay_id         UUID NOT NULL REFERENCES public.kids_event_replays(id) ON DELETE CASCADE,
  position_seconds  INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, replay_id)
);

ALTER TABLE public.kids_replay_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_replay_progress: self manages own"
  ON public.kids_replay_progress FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_kids_replay_progress_touch
  BEFORE UPDATE ON public.kids_replay_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
