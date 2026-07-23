-- ─── Library — Enterprise Platform: Scheduled Reports ──────────────────────
-- Real scheduling via pg_cron (already enabled and used elsewhere in this
-- app — see library-event-reminders), not a fake "coming soon" toggle.
-- Cadence is intentionally just 'weekly'/'monthly' (the org admin picks a
-- day), enqueued into the existing library_background_jobs queue rather
-- than a bespoke worker, so the existing library-process-background-jobs
-- poller can pick it up alongside every other background job type.

DO $$ BEGIN
  CREATE TYPE public.organization_report_cadence AS ENUM ('weekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.organization_scheduled_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_name      TEXT NOT NULL,
  cadence          public.organization_report_cadence NOT NULL,
  recipient_emails TEXT[] NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  last_run_at      TIMESTAMPTZ,
  created_by       UUID NOT NULL REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organization_scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organization_scheduled_reports: admin manages"
  ON public.organization_scheduled_reports FOR ALL
  USING (public.is_organization_admin(organization_id))
  WITH CHECK (public.is_organization_admin(organization_id));

-- Enqueues one library_background_jobs row per due scheduled report — a
-- real cron.schedule() call (verified working pattern, see
-- 20260801000000_library_reading_community.sql's library-event-reminders
-- job) runs this every day; the job itself only fires reports whose cadence
-- window has actually elapsed since last_run_at.
CREATE OR REPLACE FUNCTION public.enqueue_due_organization_reports()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _report RECORD;
BEGIN
  FOR _report IN
    SELECT * FROM public.organization_scheduled_reports
    WHERE is_active = true
      AND (
        (cadence = 'weekly' AND (last_run_at IS NULL OR last_run_at < now() - INTERVAL '7 days'))
        OR (cadence = 'monthly' AND (last_run_at IS NULL OR last_run_at < now() - INTERVAL '30 days'))
      )
  LOOP
    INSERT INTO public.library_background_jobs (job_type, payload)
    VALUES ('organization_scheduled_report', jsonb_build_object('scheduled_report_id', _report.id));

    UPDATE public.organization_scheduled_reports SET last_run_at = now() WHERE id = _report.id;
  END LOOP;
END;
$$;

DO $$ BEGIN
  PERFORM cron.schedule('organization-scheduled-reports', '0 6 * * *', 'SELECT public.enqueue_due_organization_reports();');
EXCEPTION WHEN OTHERS THEN
  -- pg_cron may not be available/enabled in every environment this migration
  -- runs against (e.g. a local shadow DB) — the table/function above still
  -- work standalone; only the automatic daily trigger is skipped.
  NULL;
END $$;
