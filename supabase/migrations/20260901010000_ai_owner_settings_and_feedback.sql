-- Phase 1: owner contact configuration (§13), agent feedback (§14) and AI
-- cost control (§15).
--
-- No owner phone number appears in this file or anywhere in the repository.
-- The row below is created empty; an admin fills it in through the existing
-- site_settings surface, and can change it later without a deploy.

-- ── §13 Owner contact ───────────────────────────────────────────────────────
--
-- site_settings already exists with an admin-only write policy and a public
-- read policy. A phone number is not public, so the value is stored under a
-- key the client never reads and the RLS below removes it from public reads.

INSERT INTO public.site_settings (key, value)
SELECT 'owner_contact', '{"whatsapp_number": null, "notify_escalations": true, "notify_content_proposals": true, "notify_failures": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'owner_contact');

-- "Anyone can view site settings" was written when every setting was public.
-- The owner's phone number is not, so public reads now exclude private keys.
-- Admins keep full access through the existing management policy.
DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;
CREATE POLICY "Anyone can view public site settings"
  ON public.site_settings FOR SELECT TO public
  USING (key NOT IN ('owner_contact'));

-- ── §14 Agent feedback ──────────────────────────────────────────────────────
--
-- A record of how AI actions turned out, so later phases can measure and
-- improve behaviour. This table is evidence, never instructions: nothing reads
-- it back into a prompt in Phase 1, and the AI cannot write to it directly.

CREATE TABLE IF NOT EXISTS public.ai_feedback_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    text NOT NULL CHECK (event_type IN (
                  'owner_correction', 'owner_approval', 'owner_rejection',
                  'action_succeeded', 'action_failed', 'human_escalation',
                  'customer_correction', 'content_performance')),
  channel       text NOT NULL DEFAULT 'website',
  assistant_id  text,
  user_id       uuid REFERENCES auth.users ON DELETE SET NULL,
  subject_type  text,
  subject_id    text,
  summary       text NOT NULL,
  detail        jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_feedback_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'ai_feedback_events' AND policyname = 'Admins read ai feedback'
  ) THEN
    CREATE POLICY "Admins read ai feedback"
      ON public.ai_feedback_events FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ai_feedback_events_type_idx
  ON public.ai_feedback_events (event_type, created_at DESC);

-- ── §15 Cost control ────────────────────────────────────────────────────────
--
-- ai_interactions already records provider, model, tokens and latency. What
-- was missing is a ceiling: a runaway loop or an abusive client could spend
-- without limit on a single shared OPENAI_API_KEY.
--
-- Budgets are rows, not constants, so an admin can raise a limit during a
-- launch without a deploy.

CREATE TABLE IF NOT EXISTS public.ai_budgets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope              text NOT NULL UNIQUE CHECK (scope IN ('global', 'per_user', 'per_channel')),
  daily_token_limit  bigint,
  daily_request_limit integer,
  active             boolean NOT NULL DEFAULT true,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_budgets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename = 'ai_budgets' AND policyname = 'Admins manage ai budgets'
  ) THEN
    CREATE POLICY "Admins manage ai budgets"
      ON public.ai_budgets FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

INSERT INTO public.ai_budgets (scope, daily_token_limit, daily_request_limit)
SELECT 'global', 20000000, 50000
WHERE NOT EXISTS (SELECT 1 FROM public.ai_budgets WHERE scope = 'global');

/**
 * Returns true when the global daily AI budget still has room.
 *
 * Deliberately fails OPEN: if the budget row is missing or the count cannot be
 * read, AI keeps working. A metering bug taking the assistant offline for
 * every user is worse than a day of overspend, which is visible and
 * recoverable. The ceiling exists to stop runaway loops, not to gate normal use.
 */
CREATE OR REPLACE FUNCTION public.check_ai_budget()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _budget      public.ai_budgets%ROWTYPE;
  _tokens_used bigint;
  _requests    integer;
BEGIN
  SELECT * INTO _budget FROM public.ai_budgets WHERE scope = 'global' AND active LIMIT 1;
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  SELECT COALESCE(SUM(COALESCE(prompt_tokens, 0) + COALESCE(completion_tokens, 0)), 0),
         COUNT(*)
    INTO _tokens_used, _requests
    FROM public.ai_interactions
   WHERE created_at >= date_trunc('day', now());

  IF _budget.daily_token_limit IS NOT NULL AND _tokens_used >= _budget.daily_token_limit THEN
    RETURN false;
  END IF;
  IF _budget.daily_request_limit IS NOT NULL AND _requests >= _budget.daily_request_limit THEN
    RETURN false;
  END IF;

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_ai_budget() TO service_role;

COMMENT ON TABLE public.ai_budgets IS
  'Daily ceilings for AI spend. check_ai_budget() fails open on error by design — a metering fault must not take the assistant offline platform-wide.';
