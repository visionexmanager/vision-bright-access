-- ================================================================
-- Fix broken TV/Radio stream URLs — 2026-06-24
--
-- Issues fixed:
-- 1. Migration 20260622 "sanity pass" converted YouTube embed URLs
--    (youtube.com/embed/live_stream?channel=XXX) to channel page URLs
--    (youtube.com/channel/XXX).  The player only recognises embed
--    format, so all YouTube-based channels appeared as external links.
-- 2. Bahrain TV had stream_url pointing to BBC Arabic (copy-paste error
--    in the original seed).
-- 3. Algeria TV had stream_url pointing to entebbe.dz (wrong country).
-- 4. CCTV-4 China shared the same YouTube ID as CGTN English (wrong).
-- 5. Africa 24 and Channels TV Nigeria shared the same YouTube ID as
--    Africanews English (wrong).
-- 6. Four radio stations had official_url set to their website by the
--    20260622 migration instead of the audio stream, breaking playback.
-- ================================================================

-- ── 1. Restore YouTube embed format in tv_channels ───────────────
-- Convert youtube.com/channel/ID → youtube.com/embed/live_stream?channel=ID
UPDATE public.tv_channels SET
  official_url = CONCAT(
    'https://www.youtube.com/embed/live_stream?channel=',
    SPLIT_PART(official_url, 'youtube.com/channel/', 2)
  )
WHERE official_url LIKE '%youtube.com/channel/%';

UPDATE public.tv_channels SET
  stream_url = CONCAT(
    'https://www.youtube.com/embed/live_stream?channel=',
    SPLIT_PART(stream_url, 'youtube.com/channel/', 2)
  )
WHERE stream_url LIKE '%youtube.com/channel/%';

-- ── 2. Restore YouTube embed format in radio_stations ───────────
UPDATE public.radio_stations SET
  official_url = CONCAT(
    'https://www.youtube.com/embed/live_stream?channel=',
    SPLIT_PART(official_url, 'youtube.com/channel/', 2)
  )
WHERE official_url LIKE '%youtube.com/channel/%';

UPDATE public.radio_stations SET
  stream_url = CONCAT(
    'https://www.youtube.com/embed/live_stream?channel=',
    SPLIT_PART(stream_url, 'youtube.com/channel/', 2)
  )
WHERE stream_url LIKE '%youtube.com/channel/%';

-- ── 3. Fix Bahrain TV (stream_url was pointing to BBC Arabic) ───
UPDATE public.tv_channels SET
  stream_url   = 'https://www.youtube.com/embed/live_stream?channel=UCv3J5Gh8KrjuBApFg7Zj5ew',
  official_url = 'https://www.youtube.com/embed/live_stream?channel=UCv3J5Gh8KrjuBApFg7Zj5ew'
WHERE name = 'Bahrain TV';

-- ── 4. Fix Algeria TV (stream_url was pointing to entebbe.dz) ───
UPDATE public.tv_channels SET
  stream_url   = 'https://www.youtube.com/embed/live_stream?channel=UCJDz2-s0g_FRnVHAr_9FMPA',
  official_url = 'https://www.youtube.com/embed/live_stream?channel=UCJDz2-s0g_FRnVHAr_9FMPA'
WHERE name = 'Algeria TV';

-- ── 5. Fix CCTV-4 China (was using CGTN English's YouTube ID) ───
-- Use CGTN's Chinese-language HLS stream for the Chinese state TV entry.
UPDATE public.tv_channels SET
  stream_url   = 'https://news.cgtn.com/resource/live/chinese/cgtn-f.m3u8',
  official_url = 'https://news.cgtn.com/resource/live/chinese/cgtn-f.m3u8'
WHERE name = 'CCTV-4 China';

-- ── 6. Deactivate channels with wrong YouTube IDs ────────────────
-- "Africa 24" was pointing to Africanews's YouTube channel (wrong).
-- "Channels TV Nigeria" was also pointing to Africanews (wrong).
-- Deactivating so they don't confuse users; admin can re-add correct streams.
UPDATE public.tv_channels SET is_active = false
WHERE name IN ('Africa 24', 'Channels TV Nigeria')
  AND official_url LIKE '%UCCKnMFCVFxHhF3lHKDMp8kQ%';

-- ── 7. Fix radio stations where 20260622 set official_url to websites ──
-- These stations had their official_url changed to the broadcaster's
-- website instead of the audio stream, which broke in-app playback.

-- BBC Arabic Radio: use worldwide Akamai CDN (not UK-restricted bbci.co.uk)
UPDATE public.radio_stations SET
  stream_url   = 'https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_arabic_radio/bbc_arabic_radio.isml/bbc_arabic_radio-audio=128000.m3u8',
  official_url = 'https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_arabic_radio/bbc_arabic_radio.isml/bbc_arabic_radio-audio=128000.m3u8'
WHERE name IN ('BBC Arabic Radio', 'BBC Arabic');

-- Monte Carlo Doualiya: restore original infomaniak MP3 stream
-- (20260622 changed stream_url to RFI Arabic stream which is wrong,
--  and official_url to website which breaks in-app playback)
UPDATE public.radio_stations SET
  stream_url   = 'https://live.mc.infomaniak.ch/mc/mcm.mp3',
  official_url = 'https://live.mc.infomaniak.ch/mc/mcm.mp3'
WHERE name IN ('Monte Carlo Doualiya', 'MCD', 'Monte Carlo Arabic');

-- RFI Arabic: use infomaniak MP3 stream for both columns
UPDATE public.radio_stations SET
  stream_url   = 'https://rfiarabic.ice.infomaniak.ch/rfi-arabe-56.mp3',
  official_url = 'https://rfiarabic.ice.infomaniak.ch/rfi-arabe-56.mp3'
WHERE name IN ('RFI Arabic', 'Radio France Internationale Arabic');

-- Radio Sawa (VOA Arabic): use Revma stream for both columns
UPDATE public.radio_stations SET
  stream_url   = 'https://stream.rcs.revma.com/apnekhygvk8uv',
  official_url = 'https://stream.rcs.revma.com/apnekhygvk8uv'
WHERE name IN ('Radio Sawa', 'Sawa Radio', 'Sawa Radio Arabic');

-- DW Arabic Radio: use Akamai HLS for both columns
UPDATE public.radio_stations SET
  stream_url   = 'https://dwamdstream104.akamaized.net/hls/live/2015531/dwstream104/index.m3u8',
  official_url = 'https://dwamdstream104.akamaized.net/hls/live/2015531/dwstream104/index.m3u8'
WHERE name IN ('DW Arabic Radio', 'DW Radio Arabic');
