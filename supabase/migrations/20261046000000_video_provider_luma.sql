-- Video moves from OpenAI Sora to Luma.
--
-- OpenAI removed the Videos API and every sora-2 model on 2026-09-24, with no
-- successor. video-studio's "auto" and the owner's /video now run on Luma
-- (ray-2), so the registry rows say the same:
--
--   * openai-video → inactive. It served production until yesterday; kept,
--     not deleted, because ph_logs and ph_metrics rows reference it.
--   * luma-video   → active, on the model the API actually accepts. The row
--     from 20260628500000 named 'dream-machine', which Luma's API no longer
--     takes — `model` must be "ray-2" or "ray-flash-2".
--
-- The registry stays advisory: video-studio chooses its provider from the
-- environment (LUMA_API_KEY), never from these rows, and shadow mode is off.
-- Re-runnable: both statements are plain UPDATEs keyed by slug.

UPDATE public.ph_providers
   SET status     = 'inactive',
       config     = coalesce(config, '{}'::jsonb)
                    || jsonb_build_object('retired', '2026-09-24',
                                          'notes', 'OpenAI removed the Videos API and sora-2 on 2026-09-24.'),
       updated_at = now()
 WHERE slug = 'openai-video';

UPDATE public.ph_providers
   SET status        = 'active',
       default_model = 'ray-2',
       base_url      = 'https://api.lumalabs.ai/dream-machine/v1',
       capabilities  = ARRAY['text-to-video', 'async', '540p', '720p', '1080p'],
       config        = coalesce(config, '{}'::jsonb)
                       || jsonb_build_object('max_duration_sec', 9,
                                             'models', jsonb_build_array('ray-2', 'ray-flash-2'),
                                             'durations', jsonb_build_array('5s', '9s')),
       updated_at    = now()
 WHERE slug = 'luma-video';
