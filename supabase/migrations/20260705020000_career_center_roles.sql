-- VisionEx Career Center — role system
--
-- Additive only: introduces a dedicated `career_role` enum + `career_user_roles`
-- table so Career Center persona checks (candidate/employer/mentor/freelancer)
-- never touch the existing site-wide `app_role`/`user_roles`/`has_role()` system.
-- Platform admin authority continues to come from the existing has_role(uid,'admin').

CREATE TYPE public.career_role AS ENUM ('candidate', 'employer', 'mentor', 'freelancer');

CREATE TABLE public.career_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.career_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.career_user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_career_role(_user_id uuid, _role public.career_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.career_user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Convenience: does this user hold ANY career persona role at all?
CREATE OR REPLACE FUNCTION public.has_any_career_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.career_user_roles WHERE user_id = _user_id
  )
$$;

CREATE POLICY "Users can view their own career roles"
  ON public.career_user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can self-assign a career role"
  ON public.career_user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own career role"
  ON public.career_user_roles FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all career roles"
  ON public.career_user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_career_user_roles_user_id ON public.career_user_roles(user_id);
CREATE INDEX idx_career_user_roles_role ON public.career_user_roles(role);
