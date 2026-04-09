
-- 1. SECURITY DEFINER function for awarding points
CREATE OR REPLACE FUNCTION public.award_points(
  _points integer,
  _reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _max_points integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  CASE
    WHEN _reason = 'Daily login bonus' THEN _max_points := 10;
    WHEN _reason = 'Watched an ad' THEN _max_points := 5;
    WHEN _reason LIKE 'Quiz Challenge%' THEN _max_points := 100;
    WHEN _reason LIKE 'Memory Game%' THEN _max_points := 100;
    WHEN _reason LIKE 'Word Puzzle%' THEN _max_points := 100;
    WHEN _reason LIKE 'Completed simulation%' THEN _max_points := 500;
    WHEN _reason LIKE 'Incubator Simulation%' THEN _max_points := 500;
    WHEN _reason LIKE 'Network NOC%' THEN _max_points := 500;
    WHEN _reason LIKE 'Engaged:%' THEN _max_points := 50;
    WHEN _reason = 'Signup bonus' THEN _max_points := 50;
    WHEN _reason LIKE 'Purchase:%' THEN _max_points := 1000;
    WHEN _reason LIKE 'Redeemed%' THEN _max_points := 0;
    WHEN _reason LIKE 'Pay with points%' THEN _max_points := 0;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _points < 0 AND _reason NOT LIKE 'Redeemed%' AND _reason NOT LIKE 'Pay with points%' THEN
    RAISE EXCEPTION 'Negative points not allowed for this reason';
  END IF;

  IF _points > 0 AND _points > _max_points THEN
    RAISE EXCEPTION 'Points exceed maximum (%) for reason: %', _max_points, _reason;
  END IF;

  IF _reason = 'Daily login bonus' THEN
    IF EXISTS (
      SELECT 1 FROM public.user_points
      WHERE user_id = auth.uid()
        AND reason = 'Daily login bonus'
        AND created_at >= (current_date)::timestamptz
        AND created_at < (current_date + interval '1 day')::timestamptz
    ) THEN
      RAISE EXCEPTION 'Daily login bonus already claimed today';
    END IF;
  END IF;

  INSERT INTO public.user_points (user_id, points, reason)
  VALUES (auth.uid(), _points, _reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_points(integer, text) TO authenticated;

-- Remove permissive INSERT policy
DROP POLICY IF EXISTS "Users can insert their own points" ON public.user_points;

-- 2. Fix service_requests INSERT policy
DROP POLICY IF EXISTS "Anyone can submit a service request" ON public.service_requests;
CREATE POLICY "Anyone can submit a service request"
ON public.service_requests
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = user_id OR user_id IS NULL
);

-- 3. Add diet_plans UPDATE policy
CREATE POLICY "Users can update their own diet plans"
ON public.diet_plans
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Restrict page_events INSERT
DROP POLICY IF EXISTS "Anyone can insert page events" ON public.page_events;
CREATE POLICY "Anyone can insert page events"
ON public.page_events
FOR INSERT
TO public
WITH CHECK (
  event_type IN ('page_view', 'click', 'scroll', 'navigation', 'form_submit', 'search')
);
