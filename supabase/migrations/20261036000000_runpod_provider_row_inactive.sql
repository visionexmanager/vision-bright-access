-- RunPod exists as a provider Visionex knows about, and runs nothing.
--
-- One row in `ph_providers`, `status = 'inactive'`. That is the whole of the
-- database change: `providerRouter.resolveProvider` filters on
-- `status <> 'inactive'`, so this row is invisible to routing until somebody
-- deliberately activates it. No table is created, no CHECK is widened, no
-- existing row is touched.
--
-- ── Why `text_to_video` and not a new type ─────────────────────────────────
--
-- `ph_providers.type` is `CHECK (type IN ('tts', 'voice_cloning',
-- 'text_to_video'))`. Video generation is the workload with the clearest GPU
-- case and Visionex already has the service — `video-studio` — so the row fits
-- an existing type. Widening the CHECK to invent types for workloads nobody
-- has approved yet would be schema written for a plan rather than for a
-- system.
--
-- ── Why `endpoint_id` is null ──────────────────────────────────────────────
--
-- Because there is no endpoint. No RunPod account has been inspected, no
-- Serverless endpoint has been created, and `RUNPOD_API_KEY` is configured
-- nowhere — not in this repository, not in the deploy workflow's secret sync,
-- not in the GitHub secret list. `runpodReadiness()` reads a null endpoint as
-- `NOT_CONFIGURED` and refuses before any request is built, which is the
-- correct state for infrastructure that is deployed but not provisioned.
-- Filling it with a plausible-looking id would turn "not provisioned" into
-- "provisioned and broken".
--
-- ── The three switches, and why there are three ────────────────────────────
--
--   RUNPOD_ENABLED          env    the whole provider, off by default
--   ph_providers.status     row    this execution target
--   central_pricing_registry.enabled  row  the service a user asks for
--
-- Any one of them being off stops a request, and they are independent on
-- purpose: an operator can take RunPod out of rotation without disabling a
-- service that has another provider, and disable a service without taking the
-- provider away from the others.

INSERT INTO public.ph_providers
  (name, slug, type, status, priority, api_key_ref, base_url, default_model,
   capabilities, cost_per_request, cost_limit_daily_usd, is_system, config)
VALUES (
  'RunPod Serverless (video)',
  'runpod-video',
  'text_to_video',
  -- Inactive. The router will not see it; activation is a deliberate UPDATE
  -- made after an endpoint exists and a bounded smoke test has passed.
  'inactive',
  -- Higher number than every existing row, so that even if it were activated
  -- before anyone intended, it would not outrank an established provider.
  90,
  'RUNPOD_API_KEY',
  'https://api.runpod.ai/v2',
  null,
  ARRAY['gpu', 'async', 'scale_to_zero'],
  -- Zero rather than a guess. This column feeds the router's cost score and an
  -- admin's operating view; a number invented before an endpoint exists would
  -- be fiction in a field that influences routing. It is set from observed
  -- billing when the endpoint is real.
  0,
  -- No daily ceiling yet, because there is no spend to cap. Set with the same
  -- UPDATE that activates the row — before it, not after.
  0,
  true,
  jsonb_build_object(
    -- The shape an operator fills in. Null until a Serverless endpoint exists.
    'endpoint_id', null,
    'operation', 'generateVideo',
    'max_payload_bytes', 16777216,
    'timeout_ms', 600000,
    'notes', 'Set endpoint_id, then status=active, then RUNPOD_ENABLED=true. See .claude/references/runpod-architecture.md.'
  )
)
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE public.ph_providers IS
  'Execution targets for jobs that have a provider row — media, speech, OCR and GPU compute. Admin-read only; api_key_ref holds a secret NAME, never a value. A row with status=inactive is invisible to providerRouter.resolveProvider. Not the LLM/chat router, which is aiProvider.ts and stays code-defined.';
