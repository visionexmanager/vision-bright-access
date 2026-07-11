-- VisionEx Career Center — communities, mentors, freelance marketplace,
-- events, messaging, and reviews.
--
-- Note: a site-wide `public.notifications` table already exists
-- (20260422000000_admin_panel_expansion.sql) and is already on the realtime
-- publication. We reuse it rather than creating a parallel table — only an
-- additive, nullable `category` column is added so Career Center notices
-- (jobs/interviews/learning/salary/companies/visa/accessibility) can be
-- filtered without touching the existing `type` CHECK constraint or any
-- existing row.

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS idx_notifications_category ON public.notifications(category);

-- ── Enums ─────────────────────────────────────────────────────────────────
CREATE TYPE public.community_member_role AS ENUM ('member', 'moderator', 'admin');
CREATE TYPE public.mentor_booking_status AS ENUM ('requested', 'confirmed', 'completed', 'cancelled');
CREATE TYPE public.freelance_project_status AS ENUM ('open', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.freelance_proposal_status AS ENUM ('submitted', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE public.career_event_type AS ENUM ('career_fair', 'webinar', 'workshop', 'hackathon', 'networking', 'university', 'virtual');
CREATE TYPE public.review_target_type AS ENUM ('mentor', 'company', 'freelancer');

-- ── communities ──────────────────────────────────────────────────────────
CREATE TABLE public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text,
  color text,
  member_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Communities are publicly viewable"
  ON public.communities FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create a community"
  ON public.communities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators and admins can delete a community"
  ON public.communities FOR DELETE
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- ── community_members ────────────────────────────────────────────────────
CREATE TABLE public.community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.community_member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id)
);

ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Community membership is publicly viewable"
  ON public.community_members FOR SELECT
  USING (true);

CREATE POLICY "Users can join a community"
  ON public.community_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave a community"
  ON public.community_members FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Community admins can change member roles"
  ON public.community_members FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_id AND cm.user_id = auth.uid() AND cm.role = 'admin'
    )
  );

CREATE INDEX idx_community_members_community ON public.community_members(community_id);
CREATE INDEX idx_community_members_user ON public.community_members(user_id);

-- Depends on community_members, so must come after it's created above.
CREATE POLICY "Creators, moderators, and admins can update a community"
  ON public.communities FOR UPDATE
  USING (
    auth.uid() = created_by
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = id AND cm.user_id = auth.uid() AND cm.role IN ('moderator', 'admin')
    )
  );

-- ── mentors ──────────────────────────────────────────────────────────────
CREATE TABLE public.mentors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  specialties text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  bio text,
  hourly_rate numeric(10,2),
  free_sessions_offered integer NOT NULL DEFAULT 0,
  rating numeric(3,2),
  review_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentor profiles are publicly viewable"
  ON public.mentors FOR SELECT
  USING (true);

CREATE POLICY "Mentors can manage their own profile"
  ON public.mentors FOR ALL
  USING (auth.uid() = user_id AND public.has_career_role(auth.uid(), 'mentor'))
  WITH CHECK (auth.uid() = user_id AND public.has_career_role(auth.uid(), 'mentor'));

-- ── mentor_bookings ──────────────────────────────────────────────────────
CREATE TABLE public.mentor_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES public.mentors(id) ON DELETE CASCADE,
  booked_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  status public.mentor_booking_status NOT NULL DEFAULT 'requested',
  video_session_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mentor_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bookers can view their own bookings"
  ON public.mentor_bookings FOR SELECT
  USING (auth.uid() = booked_by);

CREATE POLICY "Mentors can view bookings made with them"
  ON public.mentor_bookings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.mentors m WHERE m.id = mentor_id AND m.user_id = auth.uid()));

CREATE POLICY "Users can request a mentor booking"
  ON public.mentor_bookings FOR INSERT
  WITH CHECK (auth.uid() = booked_by);

CREATE POLICY "Bookers and mentors can update a booking's status"
  ON public.mentor_bookings FOR UPDATE
  USING (
    auth.uid() = booked_by
    OR EXISTS (SELECT 1 FROM public.mentors m WHERE m.id = mentor_id AND m.user_id = auth.uid())
  );

CREATE INDEX idx_mentor_bookings_mentor ON public.mentor_bookings(mentor_id);
CREATE INDEX idx_mentor_bookings_booked_by ON public.mentor_bookings(booked_by);

-- ── freelance_projects ───────────────────────────────────────────────────
CREATE TABLE public.freelance_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text,
  budget_min numeric(10,2),
  budget_max numeric(10,2),
  status public.freelance_project_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.freelance_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Freelance projects are publicly viewable"
  ON public.freelance_projects FOR SELECT
  USING (true);

CREATE POLICY "Clients can post a freelance project"
  ON public.freelance_projects FOR INSERT
  WITH CHECK (auth.uid() = client_user_id);

CREATE POLICY "Clients and admins can update or close a project"
  ON public.freelance_projects FOR UPDATE
  USING (auth.uid() = client_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients and admins can delete a project"
  ON public.freelance_projects FOR DELETE
  USING (auth.uid() = client_user_id OR public.has_role(auth.uid(), 'admin'));

-- ── freelance_proposals ──────────────────────────────────────────────────
CREATE TABLE public.freelance_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.freelance_projects(id) ON DELETE CASCADE,
  freelancer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cover_letter text,
  proposed_rate numeric(10,2),
  status public.freelance_proposal_status NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, freelancer_user_id)
);

ALTER TABLE public.freelance_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Freelancers can view their own proposals"
  ON public.freelance_proposals FOR SELECT
  USING (auth.uid() = freelancer_user_id);

CREATE POLICY "Project owners can view proposals to their project"
  ON public.freelance_proposals FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.freelance_projects p WHERE p.id = project_id AND p.client_user_id = auth.uid()));

CREATE POLICY "Freelancers can submit a proposal"
  ON public.freelance_proposals FOR INSERT
  WITH CHECK (auth.uid() = freelancer_user_id AND public.has_career_role(auth.uid(), 'freelancer'));

CREATE POLICY "Freelancers can withdraw their own proposal"
  ON public.freelance_proposals FOR UPDATE
  USING (auth.uid() = freelancer_user_id)
  WITH CHECK (auth.uid() = freelancer_user_id AND status = 'withdrawn');

CREATE POLICY "Project owners can accept or reject a proposal"
  ON public.freelance_proposals FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.freelance_projects p WHERE p.id = project_id AND p.client_user_id = auth.uid()));

CREATE INDEX idx_freelance_proposals_project ON public.freelance_proposals(project_id);

-- ── events ───────────────────────────────────────────────────────────────
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_type public.career_event_type NOT NULL DEFAULT 'webinar',
  location text,
  is_virtual boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  capacity integer,
  registered_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are publicly viewable"
  ON public.events FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can organize an event"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = organizer_user_id);

CREATE POLICY "Organizers and admins can update an event"
  ON public.events FOR UPDATE
  USING (auth.uid() = organizer_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Organizers and admins can delete an event"
  ON public.events FOR DELETE
  USING (auth.uid() = organizer_user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_events_starts_at ON public.events(starts_at);

-- ── event_registrations ──────────────────────────────────────────────────
CREATE TABLE public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_opt_in boolean NOT NULL DEFAULT true,
  registered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own registrations"
  ON public.event_registrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Organizers can view registrations to their event"
  ON public.event_registrations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.organizer_user_id = auth.uid()));

CREATE POLICY "Users can register for an event"
  ON public.event_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can cancel their own registration"
  ON public.event_registrations FOR DELETE
  USING (auth.uid() = user_id);

-- ── messages ─────────────────────────────────────────────────────────────
-- Candidate <-> Employer, Candidate <-> Mentor, and AI-authored messages
-- (is_ai_generated marks smart-reply / AI-composed content sent on the
-- sender's behalf — never sent without the sender's own confirmation).
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  attachment_url text,
  is_ai_generated boolean NOT NULL DEFAULT false,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_no_self_send CHECK (sender_id <> recipient_id)
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their own conversation"
  ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send a message as themselves"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can mark a message as read"
  ON public.messages FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_recipient ON public.messages(recipient_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- ── reviews ──────────────────────────────────────────────────────────────
-- Polymorphic by design (target_type + target_id) so one table covers
-- mentor, company, and freelancer reviews without three near-identical tables.
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.review_target_type NOT NULL,
  target_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (author_id, target_type, target_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are publicly viewable"
  ON public.reviews FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can leave a review"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors and admins can update or delete a review"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authors and admins can delete their review"
  ON public.reviews FOR DELETE
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_reviews_target ON public.reviews(target_type, target_id);
