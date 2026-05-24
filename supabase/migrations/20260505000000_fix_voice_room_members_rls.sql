-- Fix infinite recursion in voice_room_members RLS policy.
-- The previous policy queried voice_room_members inside its own USING clause,
-- causing PostgreSQL to recurse infinitely. We break the cycle by moving the
-- subquery into a SECURITY DEFINER function that runs outside RLS.

CREATE OR REPLACE FUNCTION public.get_my_voice_room_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT room_id FROM public.voice_room_members WHERE user_id = auth.uid();
$$;

-- Replace the recursive policy with one that uses the helper function
DROP POLICY IF EXISTS "Users can view members of their rooms" ON public.voice_room_members;

CREATE POLICY "Users can view members of their rooms"
ON public.voice_room_members
FOR SELECT
TO authenticated
USING (room_id IN (SELECT public.get_my_voice_room_ids()));
