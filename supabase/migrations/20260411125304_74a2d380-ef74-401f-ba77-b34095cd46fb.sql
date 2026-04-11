-- Create vx_purchases table for purchase history
CREATE TABLE public.vx_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'other',
  item_id TEXT,
  item_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vx_purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
CREATE POLICY "Users can view own purchases"
ON public.vx_purchases
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all purchases
CREATE POLICY "Admins can view all purchases"
ON public.vx_purchases
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- No direct inserts from client - only via spend_vx function
-- (function uses SECURITY DEFINER)

-- Update award_points to accept VX Purchase reason
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

-- Create spend_vx function
CREATE OR REPLACE FUNCTION public.spend_vx(
  _amount INTEGER,
  _item_type TEXT,
  _item_id TEXT DEFAULT NULL,
  _item_name TEXT DEFAULT ''
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id UUID;
  _balance BIGINT;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Calculate current balance
  SELECT COALESCE(SUM(points), 0) INTO _balance
  FROM public.user_points
  WHERE user_id = _user_id;

  -- Check sufficient balance
  IF _balance < _amount THEN
    RAISE EXCEPTION 'Insufficient VX balance: have %, need %', _balance, _amount;
  END IF;

  -- Deduct points
  INSERT INTO public.user_points (user_id, points, reason)
  VALUES (_user_id, -_amount, 'VX Purchase: ' || _item_name);

  -- Record purchase
  INSERT INTO public.vx_purchases (user_id, amount, item_type, item_id, item_name)
  VALUES (_user_id, _amount, _item_type, _item_id, _item_name);

  RETURN TRUE;
END;
$function$;