-- The provider registry says what can actually run.
--
-- Three rows claimed `active` for providers that cannot serve anything, so the
-- Provider Hub listed video and two demo providers as available:
--
--   luma-video  LUMA_API_KEY is not set, and Luma is parked in code
--               (providerState.ts): no clip can be made. OpenAI is no
--               alternative — its Videos API answers 404 on this key
--               (live route contract, 2026-09-28), though `sora-2` is still
--               listed as a model.
--   mock-tts,   demo rows from 20260628500000. provider-hub scores a `mock*`
--   mock-vc     row as always healthy, so `resolveProvider("tts")` could name
--               it; speech-generate then maps the unknown slug back to OpenAI.
--               Nothing fake is produced, but the registry says otherwise.
--
-- No routing decision reads these rows' status (Luma is chosen by key and the
-- parked list; the rows are only recorded against), so this changes what the
-- registry reports and nothing that runs. Turning Luma on is still the same
-- reviewed change: its key, a smoke test, its line removed from
-- PARKED_PROVIDERS, and this row set back to active.

UPDATE public.ph_providers
   SET status     = 'inactive',
       config     = coalesce(config, '{}'::jsonb)
                    || jsonb_build_object('inactive_reason', 'LUMA_API_KEY not set; parked in providerState.ts (2026-09-28)'),
       updated_at = now()
 WHERE slug = 'luma-video'
   AND status = 'active';

UPDATE public.ph_providers
   SET status     = 'inactive',
       config     = coalesce(config, '{}'::jsonb)
                    || jsonb_build_object('inactive_reason', 'demo row: never serves production traffic (2026-09-28)'),
       updated_at = now()
 WHERE slug IN ('mock-tts', 'mock-vc')
   AND status = 'active';
