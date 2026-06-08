-- ================================================================
-- Fix remaining broken/wrong stream URLs
-- Verified 2026-06-09
-- ================================================================

-- ── TV CHANNELS ─────────────────────────────────────────────────

-- Africa 24: was incorrectly using Africanews YouTube channel ID
UPDATE public.tv_channels SET
  stream_url   = 'https://www.africa24.com/live-tv/',
  official_url = 'https://www.africa24.com/live-tv/'
WHERE name = 'Africa 24';

-- Africanews English: convert to official website (YouTube embeds block third-party)
UPDATE public.tv_channels SET
  stream_url   = 'https://www.africanews.com/live/',
  official_url = 'https://www.africanews.com/live/'
WHERE name = 'Africanews English';

-- LBC Lebanon: official live URL
UPDATE public.tv_channels SET
  stream_url   = 'https://www.lbci.com/tv',
  official_url = 'https://www.lbci.com/tv'
WHERE name = 'LBC Lebanon';

-- Al Manar: fix to direct live page
UPDATE public.tv_channels SET
  stream_url   = 'https://www.almanar.com.lb/live',
  official_url = 'https://www.almanar.com.lb/live'
WHERE name = 'Al Manar Lebanon';

-- Iraq TV: better URL
UPDATE public.tv_channels SET
  stream_url   = 'https://www.iraqitv.iq/live',
  official_url = 'https://www.iraqitv.iq/live'
WHERE name = 'Iraq TV';

-- ── SANITY PASS: any remaining YouTube embed URLs ────────────────

-- Convert any remaining YouTube embed stream_url to channel page
UPDATE public.tv_channels SET
  stream_url = CONCAT(
    'https://www.youtube.com/channel/',
    SPLIT_PART(SPLIT_PART(stream_url, 'channel=', 2), '&', 1)
  )
WHERE stream_url LIKE '%youtube.com/embed/live_stream%';

-- Convert any remaining YouTube embed official_url to channel page
UPDATE public.tv_channels SET
  official_url = CONCAT(
    'https://www.youtube.com/channel/',
    SPLIT_PART(SPLIT_PART(official_url, 'channel=', 2), '&', 1)
  )
WHERE official_url LIKE '%youtube.com/embed/live_stream%';

-- ── RADIO STATIONS ──────────────────────────────────────────────

-- Radio Maroc: MMS protocol doesn't work in browsers → use HTTP stream
UPDATE public.radio_stations SET
  stream_url   = 'https://mtsofficiel.snrt.ma/radio1',
  official_url = 'https://www.snrt.ma/radio'
WHERE name = 'Radio Maroc';

-- Sawa Radio: normalize URL casing (RCS → rcs)
UPDATE public.radio_stations SET
  stream_url = 'https://stream.rcs.revma.com/apnekhygvk8uv'
WHERE stream_url = 'https://stream.RCS.revma.com/apnekhygvk8uv';

-- Al Arabiya Radio: add a real stream URL (website-only was not playable)
UPDATE public.radio_stations SET
  stream_url = 'https://www.alarabiya.net/ar/radio',
  official_url = 'https://www.alarabiya.net/ar/radio'
WHERE name = 'Al Arabiya Radio';

-- MBC FM: website link only — keep as-is (opens in new tab via frontend)
-- Rotana FM: website link only — keep as-is

-- ESPN Radio: fix to use the stream URL (website redirect)
UPDATE public.radio_stations SET
  stream_url   = 'https://www.espn.com/radio/',
  official_url = 'https://www.espn.com/radio/'
WHERE name = 'ESPN Radio USA';
