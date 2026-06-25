-- Atomic cleanup: removes the member and deletes the room if it becomes empty.
-- Called from the client on both intentional leave and beforeunload (tab/browser close).
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
  -- Only the authenticated user can clean up their own membership.
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Remove the member.
  DELETE FROM voice_room_members
  WHERE room_id = p_room_id AND user_id = p_user_id;

  -- Count remaining members.
  SELECT COUNT(*) INTO v_count
  FROM voice_room_members
  WHERE room_id = p_room_id;

  -- Delete the room if empty and not a default/seeded room.
  IF v_count = 0 THEN
    DELETE FROM voice_rooms
    WHERE id = p_room_id
      AND COALESCE(is_default, false) = false;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- If room deletion fails (e.g. FK constraint), silently continue.
  -- The member record was already removed; the room will be caught by the
  -- existing on_voice_room_member_leave trigger on the next cleanup pass.
  NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_voice_room(UUID, UUID) TO authenticated;
