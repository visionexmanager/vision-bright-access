CREATE TABLE public.aptitude_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  analysis_text TEXT NOT NULL DEFAULT '',
  student_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.aptitude_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own results"
  ON public.aptitude_results FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own results"
  ON public.aptitude_results FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own results"
  ON public.aptitude_results FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);