
-- Restrict voice_room_members SELECT to users who are in the same room
DROP POLICY IF EXISTS "Authenticated users can view room members" ON public.voice_room_members;

CREATE POLICY "Users can view members of their rooms"
ON public.voice_room_members
FOR SELECT
TO authenticated
USING (
  room_id IN (
    SELECT vrm.room_id FROM public.voice_room_members vrm WHERE vrm.user_id = auth.uid()
  )
);
