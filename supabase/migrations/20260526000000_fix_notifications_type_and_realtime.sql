-- Fix 1: Allow 'promo' as a valid notification type
-- (AdminNotifications.tsx sends 'promo' but the CHECK only allowed info/warning/success/error)
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('info', 'warning', 'success', 'error', 'promo'));

-- Fix 2: Enable realtime publication for notifications table
-- so NotificationBell can receive live pushes without polling
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
