ALTER TABLE public.simulation_progress
  ADD COLUMN IF NOT EXISTS usage_seconds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_seconds integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.award_points(_points integer, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    WHEN _reason LIKE 'Game win reward%' THEN _max_points := 3;
    WHEN _reason LIKE 'Completed simulation%' THEN _max_points := 500;
    WHEN _reason LIKE 'Incubator Simulation%' THEN _max_points := 500;
    WHEN _reason LIKE 'Network NOC%' THEN _max_points := 500;
    WHEN _reason LIKE 'Engaged:%' THEN _max_points := 50;
    WHEN _reason = 'Signup bonus' THEN _max_points := 50;
    WHEN _reason LIKE 'Purchase:%' THEN _max_points := 1000;
    WHEN _reason LIKE 'Redeemed%' THEN _max_points := 0;
    WHEN _reason LIKE 'Pay with points%' THEN _max_points := 0;
    WHEN _reason LIKE 'VX Purchase:%' THEN _max_points := 0;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _points < 0 AND _reason NOT LIKE 'Redeemed%' AND _reason NOT LIKE 'Pay with points%' AND _reason NOT LIKE 'VX Purchase:%' THEN
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
$function$;
