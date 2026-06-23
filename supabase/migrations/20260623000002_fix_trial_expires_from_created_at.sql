-- ================================================================
-- Fix trial_expires_at for ALL users: anchor to profile created_at
-- ================================================================
-- Rule: each user gets exactly 30 days from their account creation date.
-- This corrects:
--   1. Users whose trial_expires_at was NULL (now set to created_at + 30d)
--   2. Users whose trial_expires_at was mistakenly set to NOW + 30d during
--      a later login instead of created_at + 30d
--
-- We only update rows where the stored value differs from the correct value
-- by more than 1 hour (to avoid touching rows that are already correct).
-- ================================================================

UPDATE public.profiles
SET trial_expires_at = (created_at + INTERVAL '30 days')
WHERE
  -- Case 1: NULL — was never set
  trial_expires_at IS NULL

  -- Case 2: Set incorrectly — differs from created_at + 30d by more than 1 hour
  OR ABS(
    EXTRACT(EPOCH FROM (trial_expires_at - (created_at + INTERVAL '30 days')))
  ) > 3600;
