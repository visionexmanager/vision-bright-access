-- Optional subscriber name, used to personalize the daily newsletter
-- greeting ("Hello, {name}!"). Nullable — falls back to a generic
-- greeting when unknown (anonymous subscribers who skipped the field).
ALTER TABLE public.newsletter_subscribers ADD COLUMN IF NOT EXISTS name text;
