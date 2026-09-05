-- Work that cannot be done inside a webhook.
--
-- ── Why this table has to exist before anything uses the conversion routes ──
--
-- Meta redelivers a webhook that does not answer promptly. The processing
-- service will spend up to 90 s on a video transcode, and an Edge Function
-- holding a WhatsApp delivery open for 90 s is not slow — it is a *duplicate
-- reply generator*: Meta gives up, sends the same message again, and the second
-- delivery starts the same transcode. That is why `/convert` shipped with
-- nothing calling it. This is the missing half.
--
-- The shape is deliberately the one this repository already uses.
-- `library_background_jobs` is a table of rows with a status, an attempt count
-- and an error, claimed by a worker and swept on a schedule; it works, it is
-- understood here, and a second queueing technology would be a second thing to
-- operate. What is different is only what this queue's work needs: a lease, so
-- a worker that dies does not strand a job forever, and a claim that is atomic
-- under concurrency, which a `SELECT` followed by an `UPDATE` is not.
--
-- ── What is deliberately NOT here: the file ─────────────────────────────────
--
-- No output path, no bucket, no expiry sweep for objects. The worker hands the
-- converted bytes straight to Meta's media endpoint and sends the message, so
-- the result never rests on Visionex infrastructure at all. That removes the
-- entire storage lifecycle — upload, permissions, cross-user access, expiry,
-- cleanup — rather than implementing it carefully, and it is strictly better
-- for somebody whose file this is. The row records that work happened and how
-- it ended. It does not record what was in the file.

-- ── The queue ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.whatsapp_media_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,

  -- The inbound message that asked for this. Unique, so a Meta redelivery
  -- cannot enqueue the same work twice — the webhook already refuses a repeat
  -- id, and this is the same guarantee held one layer down where the expensive
  -- thing actually happens.
  wa_message_id   text NOT NULL UNIQUE,

  -- What to do, and to what. Both are checked against the same allowlists the
  -- processing service enforces; this is a record, not a second policy.
  operation       text NOT NULL DEFAULT 'convert' CHECK (operation IN ('convert')),
  target          text NOT NULL,
  options         jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Meta's id for the file, not the file. It expires on Meta's own clock, which
  -- is a feature: a job that sat in this table for a month cannot be replayed
  -- against a download that no longer exists.
  source_media_id text NOT NULL,
  source_mime     text,
  source_bytes    integer,

  -- How to answer, carried on the job because the worker runs long after the
  -- delivery that created it and cannot re-derive either from the message.
  language        text NOT NULL DEFAULT 'en',
  spoken_input    boolean NOT NULL DEFAULT false,

  status          text NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued', 'running', 'done', 'failed')),
  attempts        integer NOT NULL DEFAULT 0,

  -- A code, never a message. `whatsappTelemetry.ts` and the processing service
  -- both log outcomes as labels for the same reason: this repository is public
  -- and an error string from ffmpeg quotes the path it was given.
  error_code      text,

  -- Whoever holds this until then owns the job. A worker that is killed mid-run
  -- leaves the row `running` with a lease in the past, and the next claim takes
  -- it — which is the difference between a crash costing one retry and a crash
  -- costing a stuck row nobody notices.
  lease_until     timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  finished_at     timestamptz
);

-- The claim order, and the sweep's reading of it. Partial on the two live
-- states because `done` and `failed` rows are never scanned by either.
CREATE INDEX IF NOT EXISTS idx_whatsapp_media_jobs_claimable
  ON public.whatsapp_media_jobs (created_at)
  WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS idx_whatsapp_media_jobs_finished
  ON public.whatsapp_media_jobs (finished_at)
  WHERE finished_at IS NOT NULL;

ALTER TABLE public.whatsapp_media_jobs ENABLE ROW LEVEL SECURITY;

-- ── Who may read this ────────────────────────────────────────────────────────
--
-- The service role, which is the webhook and the worker, and nobody else. Not
-- the sender: there is no Visionex account behind a WhatsApp number, and a
-- policy keyed on a phone number would be exactly the identity mistake the
-- assistant refuses everywhere else — a number on an order is not proof of who
-- is holding the phone.
--
-- Not admins either, unlike `library_background_jobs`. That table's rows
-- describe books; these describe that a particular person sent a particular
-- file at a particular time, which is closer to the transcript than to a job
-- board. An operator who needs to know whether the queue is healthy is asking
-- an aggregate question, and `whatsapp_media_queue_health()` below answers it
-- without exposing a row.
DROP POLICY IF EXISTS "whatsapp_media_jobs: service role only" ON public.whatsapp_media_jobs;
CREATE POLICY "whatsapp_media_jobs: service role only"
  ON public.whatsapp_media_jobs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Claiming one job ─────────────────────────────────────────────────────────

/**
 * Take the oldest job that is available, atomically.
 *
 * `FOR UPDATE SKIP LOCKED` is the whole point. Two workers running a second
 * apart with a plain `SELECT ... WHERE status = 'queued'` followed by an
 * `UPDATE` will both read the same row and both transcode it, and the sender
 * gets the file twice — which for somebody who cannot see their screen is two
 * notifications and no way to tell which one to open.
 *
 * A row is available when it is queued, or when it is running and its lease has
 * expired. The second case is a worker that died: nothing else will finish that
 * job, and leaving it `running` forever is how a queue quietly stops.
 *
 * `_max_attempts` is enforced here rather than by the caller so that a job
 * cannot be picked up a fourth time by a worker that forgot to check.
 */
CREATE OR REPLACE FUNCTION public.whatsapp_claim_media_job(
  _lease_seconds integer DEFAULT 180,
  _max_attempts  integer DEFAULT 3
)
RETURNS SETOF public.whatsapp_media_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'whatsapp_claim_media_job is service-role only';
  END IF;

  SELECT j.id INTO _id
  FROM public.whatsapp_media_jobs j
  WHERE (j.status = 'queued' OR (j.status = 'running' AND j.lease_until < now()))
    AND j.attempts < GREATEST(_max_attempts, 1)
  ORDER BY j.created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF _id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.whatsapp_media_jobs
     SET status      = 'running',
         attempts    = attempts + 1,
         started_at  = COALESCE(started_at, now()),
         lease_until = now() + make_interval(secs => GREATEST(_lease_seconds, 10))
   WHERE id = _id
  RETURNING *;
END;
$$;

/**
 * Record how a job ended.
 *
 * A failure that is worth retrying goes back to `queued` and will be claimed
 * again until `attempts` runs out; one that is not — an unsupported target, a
 * file the demuxer cannot open — is `failed` immediately, because trying it two
 * more times produces the same answer three minutes later.
 *
 * The decision of *which* is not made here. It belongs with the error codes
 * themselves, in `_shared/whatsappMediaJobs.ts`, where it is a pure function the
 * suite can enumerate; this records what the caller decided.
 */
CREATE OR REPLACE FUNCTION public.whatsapp_finish_media_job(
  _id         uuid,
  _status     text,
  _error_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'whatsapp_finish_media_job is service-role only';
  END IF;

  IF _status NOT IN ('queued', 'done', 'failed') THEN
    RAISE EXCEPTION 'whatsapp_finish_media_job: unexpected status %', _status;
  END IF;

  UPDATE public.whatsapp_media_jobs
     SET status      = _status,
         error_code  = _error_code,
         -- Released either way. A job going back to the queue with its lease
         -- still held would wait out the lease before anybody could take it.
         lease_until = NULL,
         finished_at = CASE WHEN _status IN ('done', 'failed') THEN now() ELSE NULL END
   WHERE id = _id;
END;
$$;

-- ── Housekeeping ─────────────────────────────────────────────────────────────

/**
 * Forget finished work, and fail what has run out of road.
 *
 * Two jobs in one because they are the same sweep: a row that finished a day
 * ago has served its purpose, and a row still queued after a day is never going
 * to be answered — Meta's media id behind it has expired and the sender has
 * long since moved on. Marking it `failed` rather than deleting it keeps the
 * count visible to the health check for one more day, which is how a queue that
 * has stopped draining is noticed at all.
 */
CREATE OR REPLACE FUNCTION public.sweep_whatsapp_media_jobs(_hours integer DEFAULT 24)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cutoff timestamptz := now() - make_interval(hours => GREATEST(_hours, 1));
  _removed integer;
BEGIN
  UPDATE public.whatsapp_media_jobs
     SET status = 'failed', error_code = COALESCE(error_code, 'abandoned'),
         finished_at = now(), lease_until = NULL
   WHERE status IN ('queued', 'running')
     AND created_at < _cutoff;

  DELETE FROM public.whatsapp_media_jobs
   WHERE finished_at IS NOT NULL
     AND finished_at < _cutoff;

  GET DIAGNOSTICS _removed = ROW_COUNT;
  RETURN _removed;
END;
$$;

/**
 * Is the queue draining?
 *
 * Counts and the age of the oldest waiting job. No ids, no phone numbers, no
 * targets — an aggregate is what "is this healthy" actually needs, and it is
 * the only shape of this data that can be shown to an operator without showing
 * them who sent what.
 */
CREATE OR REPLACE FUNCTION public.whatsapp_media_queue_health()
RETURNS TABLE (queued bigint, running bigint, failed_recently bigint, oldest_wait_seconds integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE status = 'queued'),
    count(*) FILTER (WHERE status = 'running'),
    count(*) FILTER (WHERE status = 'failed' AND finished_at > now() - interval '1 hour'),
    COALESCE(
      EXTRACT(EPOCH FROM (now() - min(created_at) FILTER (WHERE status = 'queued')))::integer,
      0
    )
  FROM public.whatsapp_media_jobs;
$$;

-- `REVOKE ... FROM PUBLIC` also revokes it from service_role, and every one of
-- these is called by the service role. Naming anon and authenticated as well is
-- not redundant: a role that was granted directly keeps its grant when PUBLIC
-- loses one.
REVOKE ALL ON FUNCTION public.whatsapp_claim_media_job(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_finish_media_job(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sweep_whatsapp_media_jobs(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_media_queue_health() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.whatsapp_claim_media_job(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_finish_media_job(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sweep_whatsapp_media_jobs(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_media_queue_health() TO service_role;

-- ── The timer ────────────────────────────────────────────────────────────────
--
-- Same shape as `20260927000000_whatsapp_retention_schedule.sql`: a missing
-- pg_cron is a warning and not a failed deploy, because the sweep is
-- housekeeping and not the schema — but it is a warning that reaches the
-- migration output, because the Library migration's own header records what
-- `EXCEPTION WHEN OTHERS THEN NULL` cost when three jobs silently never
-- registered and nobody found out for months.

DO $outer$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'pg_cron could not be installed (%): the WhatsApp media queue will NOT be swept. Finished jobs accumulate and an abandoned one stays queued forever.', SQLERRM;
    RETURN;
  END;

  -- Hourly at :50, after the two cache sweeps rather than beside them. A day is
  -- long enough that a sender who asked in the morning can still be answered by
  -- a queue that was briefly stuck, and short enough that nothing here
  -- describes a message old enough to have left the transcript's own window.
  PERFORM cron.schedule(
    'whatsapp-sweep-media-jobs',
    '50 * * * *',
    $cron$SELECT public.sweep_whatsapp_media_jobs(24)$cron$
  );

  RAISE NOTICE 'WhatsApp media queue sweep scheduled hourly at :50 (24h).';
END
$outer$;
