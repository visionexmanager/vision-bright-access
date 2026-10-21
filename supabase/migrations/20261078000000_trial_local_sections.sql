-- The free week and the Kids plan open the sections whose content is stored on Visionex.
--
-- Cost-aware trial policy (src/lib/access/policy.ts). 20261063 made the trial
-- the free set only (news, community, assistive products), which was safe but
-- also closed things that cost nothing to serve: lessons, books and their saved
-- answers, and games that run in the browser. A visitor on the free week could
-- not even read a library book or play a game.
--
-- This adds exactly three sections to `trial_sections()`: academy, library,
-- arcade, and the same three to the Kids plan row (approved 2026-10-21: a Kids
-- subscriber must not have less than the free week). It opens no billable
-- operation:
--
--   * AI is a separate question from the section. Every Edge Function that can
--     reach a paid provider asks `ai_subscription_gate` first, and the gate
--     accepts only an admin or an active Kids/Basic/Pro/Business subscription
--     (`ai_eligible_plans`). The trial is not on that list and still is not.
--   * A saved library answer is served before the gate and without a provider
--     (library-ai-assistant), so the trial can read what Visionex already holds.
--   * WhatsApp is untouched: `whatsapp_entitlements` still holds the trial
--     silent after one notice.
--
-- Mirrors TRIAL_SECTIONS and KIDS_PLAN in src/lib/billing/plans.ts. Idempotent
-- (re-running changes nothing). Touches ONE data row: billing_plans 'kids',
-- limits.sections only — its price, VX, WhatsApp allowance and every other plan
-- are untouched, and no subscription, order, balance or profile is written.
-- At the last read there were 0 subscriptions, so no live entitlement moves.
--
-- Rollback: re-create trial_sections() with the three-element array from
-- 20261063, and remove 'academy', 'library', 'arcade' from the kids row:
--   UPDATE public.billing_plans SET limits = jsonb_set(limits, '{sections}',
--     '["news","community","assistive","kids"]'::jsonb) WHERE id = 'kids';

CREATE OR REPLACE FUNCTION public.trial_sections()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT ARRAY['news', 'community', 'assistive', 'academy', 'library', 'arcade']::text[] $$;

COMMENT ON FUNCTION public.trial_sections() IS
  'The sections the free week opens: the free set plus the sections served from stored content (academy, library, arcade). Never "every section" and never an AI service — AI stays behind ai_subscription_gate. Mirrors TRIAL_SECTIONS in src/lib/billing/plans.ts.';

REVOKE ALL ON FUNCTION public.trial_sections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trial_sections() TO authenticated, service_role;

-- ── The Kids plan keeps what it had and gains the same three ───────────────
--
-- A union, not an overwrite: whatever the row lists today stays, and the three
-- are added if missing. The WHERE makes a second run a no-op.

UPDATE public.billing_plans p
   SET limits = jsonb_set(
         p.limits,
         '{sections}',
         (SELECT to_jsonb(array_agg(s ORDER BY s))
            FROM (
              SELECT jsonb_array_elements_text(COALESCE(p.limits -> 'sections', '[]'::jsonb)) AS s
              UNION
              SELECT unnest(ARRAY['academy', 'library', 'arcade'])
            ) u)
       )
 WHERE p.id = 'kids'
   AND NOT (COALESCE(p.limits -> 'sections', '[]'::jsonb) @> '["academy", "library", "arcade"]'::jsonb);
