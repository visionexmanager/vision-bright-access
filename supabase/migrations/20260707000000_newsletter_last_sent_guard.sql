-- Tracks the last calendar date each subscriber received the daily
-- newsletter. Without this, re-running news-generate?newsletter_only=true
-- twice in the same day (manual retry, or the GitHub Actions schedule
-- firing more than once) emails every subscriber a duplicate digest.
ALTER TABLE public.newsletter_subscribers ADD COLUMN IF NOT EXISTS last_sent_date date;
