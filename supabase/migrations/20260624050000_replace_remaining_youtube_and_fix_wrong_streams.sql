-- 2026-06-24: Replace all remaining YouTube embed URLs with free HLS/external URLs.
-- Also corrects channels that were assigned wrong stream content by previous migrations.
--
-- YouTube channels still in DB after all prior migrations:
--   Al Hurra  (overwritten back to YouTube by 20260623080000)
--   Aflam TV, ON E Egypt, Toyor Al Jannah, DW Documentary, TED Talks, BBC Earth
--
-- Wrong-stream channels (non-YouTube but pointing to wrong content):
--   Safa TV → Rotana Al Resalah  (completely different channel)
--   Mazzika  → Nogoum TV         (completely different channel)
--   Melody Arabia → Nogoum TV    (completely different channel)
--   Huda TV  → El Faro (Latin-American Christian channel)
--   Al Hayah Quran → Saudi Quran aloula relay (different country/channel)

-- ── 1. REMAINING YOUTUBE EMBED CHANNELS ──────────────────────────────

-- Al Hurra: official MBC Networks free HLS (iptv-org verified)
UPDATE public.tv_channels SET
  stream_url   = 'https://mbn-ingest-worldsafe.akamaized.net/hls/live/2038900/MBN_Alhurra_Worldsafe_HLS/master.m3u8',
  official_url = 'https://mbn-ingest-worldsafe.akamaized.net/hls/live/2038900/MBN_Alhurra_Worldsafe_HLS/master.m3u8',
  is_active    = true
WHERE name = 'Al Hurra';

-- Aflam TV: Saudi films channel HLS via edgenextcdn
UPDATE public.tv_channels SET
  stream_url   = 'https://shd-amg-fast.edgenextcdn.net/tx001/playlist.m3u8',
  official_url = 'https://shd-amg-fast.edgenextcdn.net/tx001/playlist.m3u8',
  is_active    = true
WHERE name = 'Aflam TV';

-- DW Documentary: Deutsche Welle documentary channel via Akamai CDN
UPDATE public.tv_channels SET
  stream_url   = 'https://dwamdstream107.akamaized.net/hls/live/2015534/dwstream107/index.m3u8',
  official_url = 'https://dwamdstream107.akamaized.net/hls/live/2015534/dwstream107/index.m3u8',
  is_active    = true
WHERE name = 'DW Documentary';

-- ON E Egypt: official website (no free public HLS found)
UPDATE public.tv_channels SET
  stream_url   = 'https://on.net/live',
  official_url = 'https://on.net/live',
  is_active    = true
WHERE name = 'ON E Egypt';

-- Toyor Al Jannah: official website (no free public HLS found)
UPDATE public.tv_channels SET
  stream_url   = 'https://www.toyoraljanah.com/',
  official_url = 'https://www.toyoraljanah.com/',
  is_active    = true
WHERE name = 'Toyor Al Jannah';

-- TED Talks: not a live TV channel — open talks library instead
UPDATE public.tv_channels SET
  stream_url   = 'https://www.ted.com/talks',
  official_url = 'https://www.ted.com/talks',
  is_active    = true
WHERE name = 'TED Talks';

-- BBC Earth: on-demand channel only, no free live HLS — official site
UPDATE public.tv_channels SET
  stream_url   = 'https://www.bbcearth.com/',
  official_url = 'https://www.bbcearth.com/',
  is_active    = true
WHERE name = 'BBC Earth';

-- Channels TV Nigeria: deactivated but still had YouTube URL
UPDATE public.tv_channels SET
  stream_url   = 'https://www.channelstv.com/live/',
  official_url = 'https://www.channelstv.com/live/',
  is_active    = true
WHERE name = 'Channels TV Nigeria';

-- ── 2. CHANNELS WITH WRONG STREAM CONTENT ────────────────────────────

-- Safa TV: was set to Rotana Al Resalah (Islamic Saudi channel, not Iranian Safa)
UPDATE public.tv_channels SET
  stream_url   = 'https://safatv.net/live/',
  official_url = 'https://safatv.net/live/',
  is_active    = true
WHERE name = 'Safa TV';

-- Mazzika: was set to Nogoum TV stream
UPDATE public.tv_channels SET
  stream_url   = 'https://www.mazzika.tv/',
  official_url = 'https://www.mazzika.tv/',
  is_active    = true
WHERE name = 'Mazzika';

-- Melody Arabia: was set to Nogoum TV stream
UPDATE public.tv_channels SET
  stream_url   = 'https://www.melodyarabia.tv/',
  official_url = 'https://www.melodyarabia.tv/',
  is_active    = true
WHERE name = 'Melody Arabia';

-- Huda TV: was set to El Faro (Latin-American Christian channel)
UPDATE public.tv_channels SET
  stream_url   = 'https://huda.tv/live-streaming/',
  official_url = 'https://huda.tv/live-streaming/',
  is_active    = true
WHERE name = 'Huda TV';

-- Al Hayah Quran: was set to Saudi Quran via aloula relay (different country/broadcaster)
UPDATE public.tv_channels SET
  stream_url   = 'https://www.alhayahtv.com/',
  official_url = 'https://www.alhayahtv.com/',
  is_active    = true
WHERE name = 'Al Hayah Quran';

-- ── 3. CATCH-ALL: Deactivate any remaining YouTube-linked channels ────
-- Safety net for anything not caught above.

UPDATE public.tv_channels SET
  is_active = false
WHERE official_url LIKE '%youtube.com%'
   OR official_url LIKE '%youtu.be%';

UPDATE public.radio_stations SET
  is_active = false
WHERE official_url LIKE '%youtube.com%'
   OR official_url LIKE '%youtu.be%';
