-- ============================================================
-- Migration: Enable pg_cron + register the Library cron jobs for real.
--
-- Context: 20260801000000_library_reading_community.sql,
-- 20260806000004_library_enterprise_scheduled_reports.sql and
-- 20260806000005_library_enterprise_notifications.sql each schedule a
-- cron.schedule() job wrapped in `DO $$ ... EXCEPTION WHEN OTHERS THEN
-- NULL; END $$` so a missing "cron" schema doesn't abort the whole deploy.
-- That guard was necessary because pg_cron was not actually enabled on
-- this project, which means those three jobs silently no-op'd instead of
-- registering. Enabling the extension here and re-issuing the same three
-- cron.schedule() calls (idempotent — pg_cron upserts by job name) makes
-- them real.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. library-event-reminders (every 5 min) — 20260801000000_library_reading_community.sql
SELECT cron.schedule(
  'library-event-reminders',
  '*/5 * * * *',
  $cron$
    INSERT INTO public.notifications (user_id, title, body, type, category)
    SELECT r.user_id, 'Event starting soon', e.title || ' starts in 30 minutes', 'info', 'community_event'
    FROM public.library_event_rsvps r
    JOIN public.library_events e ON e.id = r.event_id
    WHERE r.status = 'going' AND r.reminder_sent = false
      AND e.is_cancelled = false
      AND e.scheduled_start BETWEEN now() AND now() + interval '30 minutes';

    UPDATE public.library_event_rsvps r
    SET reminder_sent = true
    FROM public.library_events e
    WHERE r.event_id = e.id AND r.status = 'going' AND r.reminder_sent = false
      AND e.is_cancelled = false
      AND e.scheduled_start BETWEEN now() AND now() + interval '30 minutes';
  $cron$
);

-- 2. organization-scheduled-reports (daily 06:00) — 20260806000004_library_enterprise_scheduled_reports.sql
SELECT cron.schedule(
  'organization-scheduled-reports',
  '0 6 * * *',
  'SELECT public.enqueue_due_organization_reports();'
);

-- 3. organization-assignment-deadline-reminders (every 15 min) — 20260806000005_library_enterprise_notifications.sql
SELECT cron.schedule(
  'organization-assignment-deadline-reminders',
  '*/15 * * * *',
  $cron$
    INSERT INTO public.notifications (user_id, title, body, type, category)
    SELECT DISTINCT COALESCE(a.assigned_to_user_id, gm.user_id), 'Assignment due soon',
      a.title || ' is due within 24 hours.', 'warning', 'organization_deadline'
    FROM public.organization_assignments a
    LEFT JOIN public.organization_group_members gm ON gm.group_id = a.assigned_to_group_id
    WHERE a.deadline_reminder_sent = false
      AND a.due_date IS NOT NULL
      AND a.due_date BETWEEN now() AND now() + INTERVAL '24 hours'
      AND (a.assigned_to_user_id IS NOT NULL OR gm.user_id IS NOT NULL);

    UPDATE public.organization_assignments SET deadline_reminder_sent = true
    WHERE deadline_reminder_sent = false AND due_date IS NOT NULL AND due_date BETWEEN now() AND now() + INTERVAL '24 hours';
  $cron$
);
