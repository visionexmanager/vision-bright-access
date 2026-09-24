-- Phase 2J-0: a registry row for the provider that actually serves video.
--
-- `video-studio`'s "auto" resolves to OpenAI Sora whenever OPENAI_API_KEY is
-- set, which it is — so Sora renders production video, and the WhatsApp owner
-- `/video` command renders with it too. Yet `ph_providers` had rows only for
-- Luma (inactive), RunPod (inactive) and a demo (`mock-video`): the one vendor
-- doing the work was invisible to the registry, so nothing could be recorded
-- against it and no future routing decision could know it exists.
--
-- ── What this row is for ────────────────────────────────────────────────────
--
-- Recording. `video-studio` and `contentMedia.generateVideo` now write each
-- job's outcome against it (and against `luma-video` / `runpod-video` when
-- those run). Nothing selects a video provider from the registry: `video-studio`
-- still picks from its environment keys exactly as before, and no code calls
-- `resolveProvider('text_to_video')`. Whether one ever should is Phase 2J's
-- open design question, not this row's.
--
-- ── Why these values ────────────────────────────────────────────────────────
--
--   status 'active'   — true: it is in service. It changes no behaviour,
--                       because no video path reads status to choose.
--   priority 10       — the same as `luma-video`, the other real vendor, and
--                       well ahead of the demo row's 99.
--   cost_per_request 0 — unknown, and deliberately not guessed. Sora is priced
--                       per second of output; a flat per-request figure would
--                       be fiction in a column the router's cost score reads.
--                       Set from observed billing, like `runpod-video`'s.
--   api_key_ref       — the secret's NAME. Never a value; the code does not
--                       use this column to choose a key.
--
-- Data only: no schema change, no grant change. Re-runnable.

INSERT INTO public.ph_providers
  (name, slug, type, status, priority, api_key_ref, base_url, default_model,
   capabilities, cost_per_request, cost_limit_daily_usd, is_system, config)
VALUES (
  'OpenAI Sora (video)',
  'openai-video',
  'text_to_video',
  'active',
  10,
  'OPENAI_API_KEY',
  'https://api.openai.com/v1',
  'sora-2',
  ARRAY['text-to-video', 'async', '720p'],
  0,
  0,
  true,
  jsonb_build_object(
    'notes', 'Recording only (Phase 2J-0). video-studio selects by environment key, not from this row.'
  )
)
ON CONFLICT (slug) DO NOTHING;
