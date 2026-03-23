
CREATE TABLE public.service_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  service_type TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a request
CREATE POLICY "Anyone can insert service requests"
  ON public.service_requests FOR INSERT
  TO public
  WITH CHECK (true);

-- Authenticated users can view their own requests
CREATE POLICY "Users can view their own requests"
  ON public.service_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
