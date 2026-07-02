-- ============================================================
-- Migration: notifications composite index
-- Purpose:   NotificationBell.tsx (Navbar, polls every 30s + realtime
--            subscription, every signed-in user) and the new Phase 9
--            NotificationHistoryList.tsx both run:
--              SELECT ... WHERE user_id = ? ORDER BY created_at DESC LIMIT n
--            with no supporting index today — a full table scan per call
--            that gets worse as the table grows. Purely additive, no
--            behavior change, no data migration needed.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);
