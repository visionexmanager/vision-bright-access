
-- Add joined_at for ownership-transfer ordering
ALTER TABLE public.voice_room_members
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Add raise_hand flag
ALTER TABLE public.voice_room_members
  ADD COLUMN IF NOT EXISTS raise_hand BOOLEAN NOT NULL DEFAULT false;

-- Allow members to update their own row (raise_hand toggle)
DROP POLICY IF EXISTS "Members can update their own status" ON public.voice_room_members;
CREATE POLICY "Members can update their own status"
ON public.voice_room_members FOR UPDATE
TO authenticated
USING  (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ──────────────────────────────────────────────────────────────────
-- Trigger: ownership transfer + auto-delete empty non-default rooms
-- ──────────────────────────────────────────────────────────────────
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
  -- Who owns this room right now?
  SELECT owner_id INTO v_owner_id
  FROM public.voice_rooms
  WHERE id = OLD.room_id;

  -- If the leaving user was the owner, pass ownership to the earliest joiner
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

  -- How many members remain?
  SELECT COUNT(*) INTO v_count
  FROM public.voice_room_members
  WHERE room_id = OLD.room_id;

  -- Delete user-created rooms when the last member leaves
  IF v_count = 0 THEN
    DELETE FROM public.voice_rooms
    WHERE id = OLD.room_id
      AND COALESCE(is_default, false) = false;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_voice_room_member_leave ON public.voice_room_members;
CREATE TRIGGER on_voice_room_member_leave
  AFTER DELETE ON public.voice_room_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_voice_room_member_leave();
