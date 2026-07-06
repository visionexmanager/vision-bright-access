-- One-time cleanup: repeated manual test-triggers of news-daily-cron.yml on
-- 2026-07-06 (verifying the RESEND_API_KEY fix) inserted the same daily
-- batch of ~21 articles four times, since the workflow had no guard against
-- being run twice in one day (fixed separately in news-daily-cron.yml and
-- news-generate/index.ts). Keeps the earliest row per (category, day),
-- deletes the rest. Safe to re-run — a no-op once duplicates are gone.

DELETE FROM public.news_articles a
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY category, DATE(COALESCE(published_at, created_at))
           ORDER BY created_at ASC
         ) AS rn
  FROM public.news_articles
) ranked
WHERE a.id = ranked.id
  AND ranked.rn > 1;
