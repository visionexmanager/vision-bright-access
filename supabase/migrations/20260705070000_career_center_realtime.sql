-- VisionEx Career Center — realtime publication
-- `notifications` and `messages` are already published (see the
-- notifications table itself and 20260705040000_career_center_social_schema.sql).
-- This adds the remaining tables the realtime spec calls for: live
-- application status changes, interview/booking updates, and AI job progress.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mentor_bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mentor_bookings;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'queue_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_jobs;
  END IF;
END $$;
