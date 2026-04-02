
-- Simulations registry
CREATE TABLE public.simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  subcategory text NOT NULL DEFAULT 'General',
  slug text NOT NULL UNIQUE,
  points integer NOT NULL DEFAULT 50,
  difficulty text NOT NULL DEFAULT 'Beginner',
  estimated_duration integer NOT NULL DEFAULT 30,
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published simulations"
  ON public.simulations FOR SELECT TO public
  USING (published = true);

CREATE POLICY "Admins can manage simulations"
  ON public.simulations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- User progress per simulation
CREATE TABLE public.simulation_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  simulation_id uuid NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  current_step integer NOT NULL DEFAULT 0,
  decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed boolean NOT NULL DEFAULT false,
  score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, simulation_id)
);

ALTER TABLE public.simulation_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON public.simulation_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON public.simulation_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON public.simulation_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
