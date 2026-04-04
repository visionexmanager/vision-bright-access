
CREATE TABLE public.driver_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  driver_name TEXT NOT NULL DEFAULT 'Captain Mohamed R.',
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  pickup_location TEXT,
  destination_location TEXT,
  service_type TEXT NOT NULL DEFAULT 'ride',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own ratings"
  ON public.driver_ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own ratings"
  ON public.driver_ratings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all ratings"
  ON public.driver_ratings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
