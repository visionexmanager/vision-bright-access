-- ─── Library — Enterprise Platform: Notifications ──────────────────────────
-- Reuses the existing generic public.notifications table (already the
-- reused mechanism for Reading Community/Publishing Studio notifications)
-- with new category values — no parallel notification system.

CREATE OR REPLACE FUNCTION public.trg_notify_organization_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _org_name TEXT;
BEGIN
  SELECT name INTO _org_name FROM public.organizations WHERE id = NEW.organization_id;

  IF NEW.assigned_to_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, category)
    VALUES (NEW.assigned_to_user_id, 'New assignment', COALESCE(_org_name, 'Your organization') || ' assigned you: ' || NEW.title, 'info', 'organization_assignment');
  ELSIF NEW.assigned_to_group_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, category)
    SELECT gm.user_id, 'New assignment', COALESCE(_org_name, 'Your organization') || ' assigned your group: ' || NEW.title, 'info', 'organization_assignment'
    FROM public.organization_group_members gm WHERE gm.group_id = NEW.assigned_to_group_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organization_assignments_notify ON public.organization_assignments;
CREATE TRIGGER trg_organization_assignments_notify
  AFTER INSERT ON public.organization_assignments
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_organization_assignment();

-- Deadline reminders — every 15 minutes, notify anyone with an incomplete
-- assignment due within the next 24 hours (once only, via a reminder_sent
-- flag so the same job doesn't re-notify every run).
ALTER TABLE public.organization_assignments ADD COLUMN IF NOT EXISTS deadline_reminder_sent BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  PERFORM cron.schedule(
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
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- New non-confidential resource added to a group → notify that group's members.
CREATE OR REPLACE FUNCTION public.trg_notify_organization_resource()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.group_id IS NOT NULL AND NOT NEW.is_confidential THEN
    INSERT INTO public.notifications (user_id, title, body, type, category)
    SELECT gm.user_id, 'New resource available', NEW.title || ' was added to your group.', 'info', 'organization_resource'
    FROM public.organization_group_members gm WHERE gm.group_id = NEW.group_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organization_resources_notify ON public.organization_resources;
CREATE TRIGGER trg_organization_resources_notify
  AFTER INSERT ON public.organization_resources
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_organization_resource();

-- Organization-wide announcement broadcast — admin-triggered RPC (org
-- announcements are deliberate/authored, not an automatic side effect of
-- another table's insert, so this is a callable function rather than a
-- trigger).
CREATE OR REPLACE FUNCTION public.send_organization_announcement(_organization_id UUID, _title TEXT, _body TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _count INTEGER;
BEGIN
  IF NOT public.is_organization_admin(_organization_id) THEN
    RAISE EXCEPTION 'Not authorized to send announcements for this organization';
  END IF;

  INSERT INTO public.notifications (user_id, title, body, type, category)
  SELECT m.user_id, _title, _body, 'info', 'organization_announcement'
  FROM public.organization_members m WHERE m.organization_id = _organization_id AND m.status = 'active' AND m.user_id IS NOT NULL;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_organization_announcement(UUID, TEXT, TEXT) TO authenticated;

-- Certificate earned (organization_assignment type) → notify the recipient.
CREATE OR REPLACE FUNCTION public.trg_notify_organization_certificate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.certificate_type = 'organization_assignment' THEN
    INSERT INTO public.notifications (user_id, title, body, type, category)
    VALUES (NEW.user_id, 'Certificate earned', 'You earned a certificate for "' || NEW.title || '".', 'success', 'organization_certificate');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_library_certificates_organization_notify ON public.library_certificates;
CREATE TRIGGER trg_library_certificates_organization_notify
  AFTER INSERT ON public.library_certificates
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_organization_certificate();

-- Org-hosted event reminders (library_events.organization_id widened
-- earlier) — reuse the exact existing library-event-reminders job's shape,
-- just also covering org-hosted events (RSVPs still gate who gets notified,
-- unchanged from the existing job).
