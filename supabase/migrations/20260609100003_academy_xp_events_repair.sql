-- ============================================================
-- Migration: academy_xp_events — repair
-- Purpose:   `supabase db push` has failed on every deploy since
--            2026-07-01 with "relation public.academy_xp_events does
--            not exist" (SQLSTATE 42P01), even though
--            20260609100002_academy_xp_events.sql already defines it
--            and Supabase's migration history marks that file as
--            applied. Same class of history/schema drift already
--            fixed for tv_production_upgrade (d451f29) and
--            finance_tables (957764f) — a prior partial-apply run
--            left the tracking table out of sync with actual schema.
--            This blocks every migration queued after it, including
--            all Academy XP follow-ups and the entire Career Center
--            schema merged in bd614e3.
--
--            Idempotently re-creates exactly what 20260609100002
--            already defines (table, RLS, base policy, index) — a
--            no-op wherever it already exists correctly, and
--            self-healing wherever it doesn't. The award_academy_xp()
--            RPC itself is left alone: 20260705000000 already
--            recreates it via DROP FUNCTION IF EXISTS / CREATE OR
--            REPLACE, so it doesn't need repeating here.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.academy_xp_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      INTEGER     NOT NULL CHECK (amount > 0),
  reason      TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.academy_xp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "academy_xp: users read own events" ON public.academy_xp_events;
CREATE POLICY "academy_xp: users read own events"
  ON public.academy_xp_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_academy_xp_user_date
  ON public.academy_xp_events(user_id, created_at DESC);
