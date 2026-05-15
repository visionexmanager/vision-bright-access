-- Backfill free trial for all users who registered before the trial feature was added.
-- Any user with NULL trial_expires_at has never had a trial set, so give them 30 days from now.
UPDATE public.profiles
SET trial_expires_at = now() + interval '30 days'
WHERE trial_expires_at IS NULL;
