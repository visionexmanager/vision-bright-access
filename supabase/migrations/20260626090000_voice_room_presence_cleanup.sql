-- Keep voice-room membership tied to active browser presence.
-- Empty rooms are deleted immediately, and stale member rows are swept so
-- rooms abandoned by page/browser close do not stay visible.

ALTER TABLE public.voice_room_members
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_voice_room_members_last_seen_at
  ON public.voice_room_members(last_seen_at);

CREATE OR REPLACE FUNCTION public.handle_voice_room_member_leave()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id   UUID;
  v_new_owner  UUID;
  v_count      INT;
BEGIN
  SELECT owner_id INTO v_owner_id
  FROM public.voice_rooms
  WHERE id = OLD.room_id;

  IF v_owner_id IS NOT NULL AND v_owner_id = OLD.user_id THEN
    SELECT user_id INTO v_new_owner
    FROM public.voice_room_members
    WHERE room_id = OLD.room_id
    ORDER BY joined_at ASC
    LIMIT 1;

    IF v_new_owner IS NOT NULL THEN
      UPDATE public.voice_rooms
      SET owner_id = v_new_owner
      WHERE id = OLD.room_id;
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.voice_room_members
  WHERE room_id = OLD.room_id;

  IF v_count = 0 THEN
    DELETE FROM public.voice_rooms
    WHERE id = OLD.room_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_voice_room_member_leave ON public.voice_room_members;
CREATE TRIGGER on_voice_room_member_leave
  AFTER DELETE ON public.voice_room_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_voice_room_member_leave();

CREATE OR REPLACE FUNCTION public.cleanup_voice_room(
  p_room_id UUID,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  DELETE FROM public.voice_room_members
  WHERE room_id = p_room_id AND user_id = p_user_id;

  SELECT COUNT(*) INTO v_count
  FROM public.voice_room_members
  WHERE room_id = p_room_id;

  IF v_count = 0 THEN
    DELETE FROM public.voice_rooms
    WHERE id = p_room_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_stale_voice_rooms(
  p_stale_after INTERVAL DEFAULT INTERVAL '2 minutes'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.voice_room_members
  WHERE last_seen_at < now() - p_stale_after;

  DELETE FROM public.voice_rooms r
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.voice_room_members m
    WHERE m.room_id = r.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_voice_room(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_voice_rooms(INTERVAL) TO anon, authenticated;

-- Apply the cleanup immediately when this migration is deployed.
SELECT public.cleanup_stale_voice_rooms(INTERVAL '2 minutes');
