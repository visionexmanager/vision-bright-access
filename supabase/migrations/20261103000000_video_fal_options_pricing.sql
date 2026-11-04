-- The video options on fal.ai, priced in VX.
--
-- One registry row per option, priced per second of video: vx_reserve charges
-- units x vx_price and the unit is a second, so a 10-second clip is ten units.
-- A VX is a thousandth of a dollar, and the markup is 100%, so vx_price is
-- fal's price per second in thousandths of a dollar (see
-- _shared/providers/falVideoOptions.ts, which a test compares with this file).
--
-- Prices read on each model's fal.ai page on 2026-11-02:
--   wan         $0.15 a video, offered at 5 s                  30 VX / s
--   pixverse    720p, no sound      $0.045 / s                 45 VX / s
--   grok        480p, sound inc.    $0.05  / s                 50 VX / s
--   kling       Pro, no sound       $0.07  / s                 70 VX / s
--   kling_audio Pro, with sound     $0.14  / s                140 VX / s
--
-- max_daily_usage is in seconds: 120 is twenty-four clips of five seconds, and
-- the balance is the real limit. free_limit is 0: nothing here is free.
--
-- Enabled from the start. They cannot be used before the video function has a
-- funded FAL_KEY, and a funded key is exactly when a price must already exist.

INSERT INTO public.central_pricing_registry
  (service_id, display_name, provider, base_cost, vx_price, free_limit, plan_limits, max_daily_usage, enabled, admin_only, notes, pricing_mode)
VALUES
  ('video_wan',        'Video: Wan 2.2 (basic, 720p)',            'fal', 0.030000,  30, 0, '{}', 120, true, false, 'fal-ai/wan/v2.2-5b/text-to-video. $0.15 a video, 5 s only.', 'fixed'),
  ('video_pixverse',   'Video: PixVerse V6 (720p)',               'fal', 0.045000,  45, 0, '{}', 120, true, false, 'pixverse/v6/text-to-video, 720p, no audio.', 'fixed'),
  ('video_grok',       'Video: Grok Imagine (480p, with sound)',  'fal', 0.050000,  50, 0, '{}', 120, true, false, 'xai/grok-imagine-video/text-to-video, 480p; sound is included in the price.', 'fixed'),
  ('video_kling',      'Video: Kling 2.6 Pro',                    'fal', 0.070000,  70, 0, '{}', 120, true, false, 'fal-ai/kling-video/v2.6/pro/text-to-video, audio off.', 'fixed'),
  ('video_kling_audio','Video: Kling 2.6 Pro with sound',         'fal', 0.140000, 140, 0, '{}', 120, true, false, 'Same endpoint, generate_audio on.', 'fixed')
ON CONFLICT (service_id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      provider = EXCLUDED.provider,
      base_cost = EXCLUDED.base_cost,
      vx_price = EXCLUDED.vx_price,
      max_daily_usage = EXCLUDED.max_daily_usage,
      notes = EXCLUDED.notes,
      updated_at = now();
