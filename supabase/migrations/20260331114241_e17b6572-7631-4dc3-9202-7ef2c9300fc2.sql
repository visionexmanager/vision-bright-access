CREATE TABLE public.page_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL DEFAULT 'page_view',
  page_path text NOT NULL,
  page_title text,
  user_id uuid,
  session_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.page_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert events (anonymous tracking)
CREATE POLICY "Anyone can insert page events"
  ON public.page_events FOR INSERT TO public
  WITH CHECK (true);

-- Admins can view all events
CREATE POLICY "Admins can view all page events"
  ON public.page_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for fast querying
CREATE INDEX idx_page_events_created_at ON public.page_events (created_at DESC);
CREATE INDEX idx_page_events_page_path ON public.page_events (page_path);
CREATE INDEX idx_page_events_event_type ON public.page_events (event_type);