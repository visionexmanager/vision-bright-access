
-- 1. Fix user_achievements: Remove direct INSERT, create SECURITY DEFINER function
DROP POLICY IF EXISTS "Users can insert own achievements" ON public.user_achievements;

CREATE OR REPLACE FUNCTION public.award_achievement(_achievement_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _completed_count integer;
  _threshold integer;
  _valid_keys text[] := ARRAY['first_sim','sim_5','sim_10','sim_15','sim_all'];
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate key
  IF _achievement_key != ALL(_valid_keys) THEN
    RAISE EXCEPTION 'Invalid achievement key: %', _achievement_key;
  END IF;

  -- Check if already unlocked
  IF EXISTS (
    SELECT 1 FROM public.user_achievements
    WHERE user_id = _user_id AND achievement_key = _achievement_key
  ) THEN
    RETURN; -- Already unlocked, no-op
  END IF;

  -- Get completed simulation count
  SELECT COUNT(*) INTO _completed_count
  FROM public.simulation_progress
  WHERE user_id = _user_id AND completed = true;

  -- Map key to threshold
  CASE _achievement_key
    WHEN 'first_sim' THEN _threshold := 1;
    WHEN 'sim_5' THEN _threshold := 5;
    WHEN 'sim_10' THEN _threshold := 10;
    WHEN 'sim_15' THEN _threshold := 15;
    WHEN 'sim_all' THEN _threshold := 20;
    ELSE RAISE EXCEPTION 'Unknown achievement key';
  END CASE;

  -- Validate threshold
  IF _completed_count < _threshold THEN
    RAISE EXCEPTION 'Achievement criteria not met: need % completions, have %', _threshold, _completed_count;
  END IF;

  INSERT INTO public.user_achievements (user_id, achievement_key)
  VALUES (_user_id, _achievement_key);
END;
$$;

-- 2. Fix service_requests: Remove the overly permissive INSERT policy
DROP POLICY IF EXISTS "Anyone can insert service requests" ON public.service_requests;

-- 3. Fix page_events: Add size constraints
ALTER TABLE public.page_events
  ADD CONSTRAINT page_events_metadata_size CHECK (pg_column_size(metadata) < 4096),
  ADD CONSTRAINT page_events_page_path_length CHECK (char_length(page_path) <= 500),
  ADD CONSTRAINT page_events_session_id_length CHECK (session_id IS NULL OR char_length(session_id) <= 100);

-- 4. Fix voice_room_members: Restrict SELECT to authenticated
DROP POLICY IF EXISTS "Anyone can view room members" ON public.voice_room_members;

CREATE POLICY "Authenticated users can view room members"
ON public.voice_room_members
FOR SELECT
TO authenticated
USING (true);
