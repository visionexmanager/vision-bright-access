-- The global AI spending brake reads the smallest of three usage stores.
--
-- `check_ai_budget()` sums `prompt_tokens + completion_tokens` from
-- `ai_interactions` — and `ai_interactions` is written by exactly two files,
-- both on the Career AI path (`_shared/careerAiChat.ts:49`,
-- `_shared/careerAiOrchestrator.ts:196`). Neither `ai-chat` nor
-- `whatsapp-webhook` writes a row there. So the 20,000,000-token /
-- 50,000-request daily ceiling governs Career AI and nothing else, while
-- `ai-chat` calls it as though it protected everything.
--
-- ── Where usage actually is ─────────────────────────────────────────────────
--
--   ai-chat and eight others → `ai_usage_log`, one row per request, via
--     `check_ai_rate_limit()`. No tokens, no cost, and the same function
--     **deletes rows older than 48 hours**, so it cannot support a budget.
--   WhatsApp → `whatsapp_usage`, per-day counts by kind, keyed on `wa_phone`
--     with no user id.
--   Career AI → `ai_interactions`, the only one carrying tokens.
--
-- ── The change ──────────────────────────────────────────────────────────────
--
-- A third ceiling, in the currency the platform now bills in: VX reserved
-- today across `vx_usage_ledger`, which is the one store that spans the
-- website, WhatsApp and any future API client, carries `source`, and does not
-- delete itself.
--
-- Nothing is replaced. The token and request ceilings still read
-- `ai_interactions` and still mean what they meant; `ai_usage_log` still
-- enforces the per-user daily limits; `whatsapp_usage` still enforces the
-- WhatsApp allowance. This adds the one ceiling that can see all of it, and
-- it is inert until a service is enabled — an empty ledger sums to zero.
--
-- Double counting is prevented structurally rather than by subtraction: one
-- reservation per billable request, including a free one, which writes a row
-- with `reserved_vx = 0`. A request is counted once because it reserves once.

ALTER TABLE public.ai_budgets
  ADD COLUMN IF NOT EXISTS daily_vx_limit bigint;

COMMENT ON COLUMN public.ai_budgets.daily_vx_limit IS
  'Platform-wide VX reserved per day, across every source. NULL disables this ceiling, which is the default — the token and request ceilings are unchanged.';

-- Left NULL on purpose. Turning it on is an admin decision taken once there is
-- a day of real numbers to set it from, not a value invented in a migration.

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
  _vx_used     bigint;
BEGIN
  SELECT * INTO _budget FROM public.ai_budgets WHERE scope = 'global' AND active LIMIT 1;
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  -- Tokens and requests, unchanged: `ai_interactions` is still the only store
  -- that carries a token count, and it is still the Career AI path that fills
  -- it. Narrowing that is a separate change with its own risk.
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

  -- The ceiling that can see every surface. Counted on reservations rather
  -- than settlements: a job in flight has to count, or a burst of parallel
  -- requests all read the same zero. Refunded and expired rows are excluded —
  -- VX that came back was not spent.
  IF _budget.daily_vx_limit IS NOT NULL THEN
    SELECT COALESCE(SUM(reserved_vx), 0) INTO _vx_used
      FROM public.vx_usage_ledger
     WHERE created_at >= date_trunc('day', now())
       AND status NOT IN ('refunded', 'expired');

    IF _vx_used >= _budget.daily_vx_limit THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  -- Unchanged, and the most important line in the function: a metering fault
  -- must not take the assistant offline for everybody.
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.check_ai_budget() IS
  'Platform-wide daily ceilings: tokens and requests from ai_interactions (Career AI), and VX reserved from vx_usage_ledger, which is the only store covering the website, WhatsApp and future API clients. Fails open by design.';

REVOKE ALL ON FUNCTION public.check_ai_budget() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_budget() TO service_role;

-- ── What this deliberately does NOT do ──────────────────────────────────────
--
-- It does not touch `check_ai_rate_limit()`, `check_ai_anon_rate_limit()`,
-- `whatsapp_entitlements()` or `whatsapp_meter()`. Every existing anti-abuse
-- limit stands exactly as it did: the per-user 60-a-day on `ai-chat`, the
-- keyed-address limit for signed-out callers, the WhatsApp free floor and its
-- repeat-message guard. This is one more ceiling above them, not a
-- replacement for any of them.
--
-- It also leaves the per-function daily limits hardcoded in
-- `check_ai_rate_limit`'s CASE. Moving those into
-- `central_pricing_registry.max_daily_usage` is the right end state and is a
-- change to make when a service is actually enabled, against a real number,
-- rather than as freight on this one.
