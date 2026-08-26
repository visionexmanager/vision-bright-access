-- ─── WhatsApp retention: schedule the four jobs that were only ever written ──
--
-- Four housekeeping functions exist and none of them has ever run:
--
--   whatsapp_prune_transcripts(days)   20260916020000
--   whatsapp_forget_locations(hours)   20260918000000
--   sweep_whatsapp_geo_cache()         20260925000000
--   sweep_whatsapp_speech_cache()      20260926000000
--
-- Each was left with its `cron.schedule` call commented out and the same
-- reason written above it: pg_cron is enabled per environment, and a migration
-- that assumes it fails on the ones without it.
--
-- **That reason expired on 2026-08-08.** `20260808000000_library_enable_pg_cron.sql`
-- runs `CREATE EXTENSION IF NOT EXISTS pg_cron` and registers three Library jobs
-- with bare `SELECT cron.schedule(...)` calls. The extension is installed on this
-- project; the WhatsApp jobs simply never followed. Until this migration,
-- transcripts were retained forever and a sender's coordinates stayed on their
-- conversation row indefinitely — the read path stops using them after six hours
-- (`LOCATION_TTL_MS`), which means the data was unusable *and* still there. That
-- is the worst of both.
--
-- ── Why this migration does not swallow the error ───────────────────────────
--
-- The Library migration's own header records what a silent guard cost: three
-- jobs wrapped in `EXCEPTION WHEN OTHERS THEN NULL` "silently no-op'd instead of
-- registering" and nobody found out for months. A missing extension here is
-- still not a reason to fail a whole deploy — retention is not the schema — but
-- it *is* a reason to say so in the deploy log, loudly, once. `RAISE WARNING`
-- reaches the migration output; `NULL` reaches nobody.
--
-- ── Idempotence ─────────────────────────────────────────────────────────────
--
-- `cron.schedule(jobname, schedule, command)` upserts on the job name (pg_cron
-- 1.4+, which is what Supabase ships), so re-running this migration re-points
-- the same four jobs rather than creating a fifth copy. No unschedule needed.

DO $outer$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    -- A shadow database or a local Postgres without the pg_cron binaries. The
    -- functions below still work when called by hand; only the timer is absent.
    RAISE WARNING 'pg_cron could not be installed (%): WhatsApp retention jobs are NOT scheduled in this database. Transcripts, locations and both media caches will grow without bound until it is.', SQLERRM;
    RETURN;
  END;

  -- 03:30 daily. Ninety days, which is the retention the function documents and
  -- its own floor (7) refuses to go below. The conversation row and its rolling
  -- summary survive: continuity is carried by the summary, not the transcript.
  PERFORM cron.schedule(
    'whatsapp-prune-transcripts',
    '30 3 * * *',
    $cron$SELECT public.whatsapp_prune_transcripts(90)$cron$
  );

  -- Every hour at :15, with **six** hours rather than the twenty-four the
  -- original comment suggested. Six is `LOCATION_TTL_MS` in
  -- `_shared/whatsappLocation.ts` — the age at which the webhook stops reading a
  -- pin at all. Holding a coordinate for eighteen further hours after the last
  -- code that would look at it has stopped looking is retention without a
  -- purpose, and this is the one WhatsApp table that stores where somebody
  -- physically was.
  PERFORM cron.schedule(
    'whatsapp-forget-locations',
    '15 * * * *',
    $cron$SELECT public.whatsapp_forget_locations(6)$cron$
  );

  -- Both caches are keyed housekeeping: every read already ignores an expired
  -- row, so these only reclaim space. Daily, staggered after the prune so the
  -- three deletes are not competing for the same autovacuum window.
  PERFORM cron.schedule(
    'whatsapp-sweep-geo-cache',
    '40 3 * * *',
    $cron$SELECT public.sweep_whatsapp_geo_cache()$cron$
  );

  PERFORM cron.schedule(
    'whatsapp-sweep-speech-cache',
    '45 3 * * *',
    $cron$SELECT public.sweep_whatsapp_speech_cache()$cron$
  );

  RAISE NOTICE 'WhatsApp retention scheduled: prune-transcripts 03:30 daily (90d), forget-locations hourly (6h), geo-cache sweep 03:40, speech-cache sweep 03:45.';
END
$outer$;
