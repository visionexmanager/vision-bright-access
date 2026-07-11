-- VisionEx Career Center — core schema
-- Profiles, companies, skills catalog, jobs, applications, certificates.
-- Additive only. No existing table is modified.

-- ── Enums ─────────────────────────────────────────────────────────────────
CREATE TYPE public.career_job_type AS ENUM ('full_time', 'part_time', 'contract', 'temporary', 'internship', 'freelance');
CREATE TYPE public.career_experience_level AS ENUM ('entry', 'mid', 'senior', 'lead');
CREATE TYPE public.career_job_status AS ENUM ('draft', 'active', 'paused', 'closed');
CREATE TYPE public.career_application_status AS ENUM ('applied', 'reviewing', 'interview', 'offer', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE public.career_verification_status AS ENUM ('unverified', 'pending', 'verified');

-- ── career_profiles ──────────────────────────────────────────────────────
-- Domain-specific extension of the site-wide `profiles` table, mirroring the
-- existing academy_profiles precedent — one row per candidate/professional.
CREATE TABLE public.career_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  headline text,
  bio text,
  location text,
  avatar_url text,
  resume_url text,
  portfolio_url text,
  github_url text,
  linkedin_url text,
  website_url text,
  skills text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  years_experience integer,
  followers_count integer NOT NULL DEFAULT 0,
  following_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.career_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Career profiles are publicly viewable"
  ON public.career_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own career profile"
  ON public.career_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_career_profiles_user_id ON public.career_profiles(user_id);
CREATE INDEX idx_career_profiles_skills ON public.career_profiles USING GIN(skills);

-- ── companies ────────────────────────────────────────────────────────────
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  industry text,
  size text,
  website text,
  description text,
  logo_url text,
  location text,
  accessibility_rating numeric(3,1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Companies are publicly viewable"
  ON public.companies FOR SELECT
  USING (true);

CREATE POLICY "Employers can create their own company page"
  ON public.companies FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id AND public.has_career_role(auth.uid(), 'employer'));

CREATE POLICY "Owners can update their own company page"
  ON public.companies FOR UPDATE
  USING (auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners and admins can delete a company page"
  ON public.companies FOR DELETE
  USING (auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_companies_owner ON public.companies(owner_user_id);
CREATE INDEX idx_companies_slug ON public.companies(slug);

-- ── skills (reference catalog) ──────────────────────────────────────────
CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Skills catalog is publicly viewable"
  ON public.skills FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage the skills catalog"
  ON public.skills FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── jobs ─────────────────────────────────────────────────────────────────
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  posted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  location text,
  salary_min integer,
  salary_max integer,
  currency text NOT NULL DEFAULT 'USD',
  job_type public.career_job_type NOT NULL DEFAULT 'full_time',
  remote boolean NOT NULL DEFAULT false,
  visa_sponsorship boolean NOT NULL DEFAULT false,
  accessibility_friendly boolean NOT NULL DEFAULT false,
  skills_required text[] NOT NULL DEFAULT '{}',
  experience_level public.career_experience_level NOT NULL DEFAULT 'mid',
  status public.career_job_status NOT NULL DEFAULT 'draft',
  applicant_count integer NOT NULL DEFAULT 0,
  optimization_score integer,
  source text NOT NULL DEFAULT 'internal',
  external_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jobs_salary_range_check CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active jobs are publicly viewable, owners and admins see all statuses"
  ON public.jobs FOR SELECT
  USING (status = 'active' OR auth.uid() = posted_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employers can post jobs for companies they own"
  ON public.jobs FOR INSERT
  WITH CHECK (
    auth.uid() = posted_by
    AND public.has_career_role(auth.uid(), 'employer')
    AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_user_id = auth.uid())
  );

CREATE POLICY "Job owners and admins can update a job"
  ON public.jobs FOR UPDATE
  USING (auth.uid() = posted_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = posted_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Job owners and admins can delete a job"
  ON public.jobs FOR DELETE
  USING (auth.uid() = posted_by OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_jobs_company ON public.jobs(company_id);
CREATE INDEX idx_jobs_posted_by ON public.jobs(posted_by);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_skills ON public.jobs USING GIN(skills_required);
CREATE INDEX idx_jobs_created_at ON public.jobs(created_at DESC);

-- ── applications ─────────────────────────────────────────────────────────
CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status public.career_application_status NOT NULL DEFAULT 'applied',
  resume_snapshot text,
  cover_letter text,
  ai_score integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Candidates can view their own applications"
  ON public.applications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Employers can view applications to their own jobs"
  ON public.applications FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.posted_by = auth.uid()));

CREATE POLICY "Admins can view all applications"
  ON public.applications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Candidates can submit their own applications"
  ON public.applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Candidates can withdraw their own applications"
  ON public.applications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status = 'withdrawn');

CREATE POLICY "Employers can update the status of applications to their jobs"
  ON public.applications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.posted_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND j.posted_by = auth.uid()));

CREATE INDEX idx_applications_user ON public.applications(user_id);
CREATE INDEX idx_applications_job ON public.applications(job_id);
CREATE INDEX idx_applications_status ON public.applications(status);

-- ── certificates ─────────────────────────────────────────────────────────
CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  issuer text,
  issue_date date,
  expiry_date date,
  credential_id text,
  credential_url text,
  file_url text,
  verification_status public.career_verification_status NOT NULL DEFAULT 'unverified',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and anyone viewing a verified certificate can see it"
  ON public.certificates FOR SELECT
  USING (auth.uid() = user_id OR verification_status = 'verified');

CREATE POLICY "Users can manage their own certificates"
  ON public.certificates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_certificates_user ON public.certificates(user_id);

-- ── updated_at maintenance ───────────────────────────────────────────────
-- Reuses the convention of a single trigger function shared across tables.
CREATE OR REPLACE FUNCTION public.career_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_career_profiles_updated_at BEFORE UPDATE ON public.career_profiles
  FOR EACH ROW EXECUTE FUNCTION public.career_set_updated_at();
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.career_set_updated_at();
CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.career_set_updated_at();
CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.career_set_updated_at();
