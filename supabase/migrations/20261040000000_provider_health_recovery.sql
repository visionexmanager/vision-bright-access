-- Phase 2J-1: a provider that degraded on its own can recover on its own, and
-- the demo video row stops being a routable provider.
--
-- ── The lifecycle, in the statuses the table already has ────────────────────
--
--   inactive  administrative. Set by a seed or by an admin (provider-hub
--             update_provider). No automation ever changes it — Phase 2J-0
--             made the health probe respect that; this keeps it true.
--   error     administrative too. Nothing in the code sets it; an admin can.
--             Automation leaves it alone for the same reason as `inactive`.
--   active    automatic, together with
--   degraded  — the pair automation moves between. ph_record_metric degrades
--             an active row after three consecutive failures; a successful
--             health probe restores it.
--
-- ── What was wrong ──────────────────────────────────────────────────────────
--
-- Recovery ran one way only. A real request that *failed* could degrade a
-- provider, but a real request that *succeeded* could not undo it: the
-- success reset consecutive_failures to 0 and raised health_score, and left
-- the status at `degraded` until an admin happened to run a probe. Nothing
-- schedules probes, so a provider degraded by a burst of failures stayed
-- `degraded` however well it then served.
--
-- The fix is the missing half of the existing rule: a successful result on a
-- `degraded` row returns it to `active`. It touches only `degraded`, so
-- `inactive` and `error` stay administrative. The rest of the function —
-- metrics, the ±5/−10 health arithmetic, the latency average, the success
-- rate, the three-failure auto-degrade — is byte-for-byte what it was.
--
-- Selection is unchanged by this: both routers (providerRouter.resolveProvider
-- and provider-hub's selectProviders) exclude only `inactive`, so `active`
-- and `degraded` rows were already equally eligible. The status difference
-- was accurate reporting, and now it is again.
--
-- ── mock-video ──────────────────────────────────────────────────────────────
--
-- Seeded active by 20260628500000 as "Demo Video", alongside mock-tts and
-- mock-vc. Nothing implements it: video-studio's getProvider knows openai,
-- luma and runpod and throws on anything else, and no test, fixture or client
-- names it. Its only effect was to be the sole *active* text_to_video row
-- until 20261039000000 added openai-video — the row any registry lookup for
-- video would have returned. It is set `inactive` (administratively disabled),
-- not deleted: ph_metrics / ph_logs rows may reference it, an admin can still
-- see it, and re-enabling it is one UPDATE. mock-tts and mock-vc are left as
-- they are — speech-generate maps only real TTS slugs and falls back to
-- OpenAI, so neither can be selected for real work, and changing them is not
-- this phase.

CREATE OR REPLACE FUNCTION public.ph_record_metric(
  p_provider_id   uuid,
  p_success       boolean,
  p_latency_ms    integer,
  p_cost_usd      numeric DEFAULT 0
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period timestamptz := date_trunc('minute', now());
BEGIN
  INSERT INTO ph_metrics (provider_id, period_start, requests, successes, failures, total_latency_ms, total_cost_usd)
  VALUES (p_provider_id, v_period, 1,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    COALESCE(p_latency_ms, 0),
    COALESCE(p_cost_usd, 0))
  ON CONFLICT (provider_id, period_start)
  DO UPDATE SET
    requests          = ph_metrics.requests + 1,
    successes         = ph_metrics.successes + CASE WHEN p_success THEN 1 ELSE 0 END,
    failures          = ph_metrics.failures  + CASE WHEN p_success THEN 0 ELSE 1 END,
    total_latency_ms  = ph_metrics.total_latency_ms + COALESCE(p_latency_ms, 0),
    total_cost_usd    = ph_metrics.total_cost_usd   + COALESCE(p_cost_usd, 0);

  -- Update rolling averages on the provider
  UPDATE ph_providers SET
    health_score = LEAST(100, GREATEST(0,
      health_score + CASE WHEN p_success THEN 5 ELSE -10 END)),
    avg_latency_ms = CASE
      WHEN p_latency_ms IS NOT NULL
      THEN (COALESCE(avg_latency_ms, 0) * 9 + p_latency_ms) / 10  -- EMA 10
      ELSE avg_latency_ms
    END,
    consecutive_failures = CASE WHEN p_success THEN 0 ELSE consecutive_failures + 1 END,
    last_failure_at = CASE WHEN p_success THEN last_failure_at ELSE now() END,
    success_rate = (
      SELECT CASE WHEN SUM(requests) = 0 THEN 100
             ELSE ROUND(SUM(successes)::numeric / SUM(requests) * 100, 2)
             END
      FROM ph_metrics
      WHERE provider_id = p_provider_id
        AND period_start >= now() - interval '1 hour'
    ),
    updated_at = now()
  WHERE id = p_provider_id;

  -- Auto-degrade if too many consecutive failures
  UPDATE ph_providers
  SET status = 'degraded', updated_at = now()
  WHERE id = p_provider_id
    AND consecutive_failures >= 3
    AND status = 'active';

  -- Auto-recover (Phase 2J-1): the other half of the rule above. Only the
  -- automatic state is undone; `inactive` and `error` are an admin's.
  IF p_success THEN
    UPDATE ph_providers
    SET status = 'active', updated_at = now()
    WHERE id = p_provider_id
      AND status = 'degraded';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.ph_record_metric(uuid, boolean, integer, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ph_record_metric(uuid, boolean, integer, numeric) TO service_role;

-- mock-video: administratively disabled. Only an `active` row is touched, so
-- a re-run is a no-op and an admin's own `error` marking is left alone.
UPDATE public.ph_providers
SET status = 'inactive', updated_at = now()
WHERE slug = 'mock-video'
  AND status = 'active';
