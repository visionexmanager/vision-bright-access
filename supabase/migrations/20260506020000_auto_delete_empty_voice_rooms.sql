-- Auto-delete voice rooms when they become empty.

CREATE OR REPLACE FUNCTION public.delete_empty_voice_room()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  remaining_members integer;
BEGIN
  SELECT COUNT(*) INTO remaining_members
  FROM public.voice_room_members
  WHERE room_id = OLD.room_id;

  IF remaining_members = 0 THEN
    DELETE FROM public.voice_rooms WHERE id = OLD.room_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_delete_empty_voice_room ON public.voice_room_members;

CREATE TRIGGER trg_auto_delete_empty_voice_room
AFTER DELETE ON public.voice_room_members
FOR EACH ROW
EXECUTE FUNCTION public.delete_empty_voice_room();
