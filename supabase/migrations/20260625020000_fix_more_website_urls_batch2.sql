-- 2026-06-25 batch 2: Replace more website URLs with verified free HLS streams.
-- Sources: iptv-org/iptv streams/ae.m3u, streams/eg.m3u (fetched 2026-06-25).

-- ── UAE / MBC GROUP ───────────────────────────────────────────────────────────

-- Wanasah TV (bitmovin-wanasah on edgenextcdn — iptv-org ae.m3u verified)
UPDATE public.tv_channels SET
  stream_url   = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-wanasah/13e82ea6232fa647c43b26e8a41f173d/index.m3u8',
  official_url = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-wanasah/13e82ea6232fa647c43b26e8a41f173d/index.m3u8',
  is_active    = true
WHERE name = 'Wanasah TV';

-- MBC 3 (KSA feed via Shahid CDN — trickbd/iptv-org verified)
UPDATE public.tv_channels SET
  stream_url   = 'https://shls-mbc3-prod-dub.shahid.net/out/v1/d5bbe570e1514d3d9a142657d33d85e6/index.m3u8',
  official_url = 'https://shls-mbc3-prod-dub.shahid.net/out/v1/d5bbe570e1514d3d9a142657d33d85e6/index.m3u8',
  is_active    = true
WHERE name = 'MBC 3';

-- MBC Action (Shahid CDN — iptv-org streamtest verified)
UPDATE public.tv_channels SET
  stream_url   = 'https://shls-mbcaction-prod-dub.shahid.net/out/v1/68dd761538e5460096c42422199d050b/index.m3u8',
  official_url = 'https://shls-mbcaction-prod-dub.shahid.net/out/v1/68dd761538e5460096c42422199d050b/index.m3u8',
  is_active    = true
WHERE name = 'MBC Action';

-- ── NEWS / ARABIC ─────────────────────────────────────────────────────────────

-- Sky News Arabia (official CDN — iptv-org ae.m3u verified)
UPDATE public.tv_channels SET
  stream_url   = 'https://stream.skynewsarabia.com/hls/sna.m3u8',
  official_url = 'https://stream.skynewsarabia.com/hls/sna.m3u8',
  is_active    = true
WHERE name = 'Sky News Arabia';

-- CNBC Arabiya (official Akamai CDN — iptv-org ae.m3u verified)
UPDATE public.tv_channels SET
  stream_url   = 'https://cnbc-live.akamaized.net/cnbc/master.m3u8',
  official_url = 'https://cnbc-live.akamaized.net/cnbc/master.m3u8',
  is_active    = true
WHERE name = 'CNBC Arabiya';

-- Al Ghad TV (Egypt-based Arab news — iptv-org eg.m3u verified)
UPDATE public.tv_channels SET
  stream_url   = 'https://eazyvwqssi.erbvr.com/alghadtv/alghadtv.m3u8',
  official_url = 'https://eazyvwqssi.erbvr.com/alghadtv/alghadtv.m3u8',
  is_active    = true
WHERE name = 'Al Ghad TV';

-- ── CHILDREN'S ────────────────────────────────────────────────────────────────

-- Spacetoon Arabic (official spacetoongo.com CDN — iptv-org ae.m3u verified)
UPDATE public.tv_channels SET
  stream_url   = 'https://live-uae.spacetoongo.com/ST_Live_UAE/hls/index.m3u8',
  official_url = 'https://live-uae.spacetoongo.com/ST_Live_UAE/hls/index.m3u8',
  is_active    = true
WHERE name = 'Spacetoon Arabic';

-- ── ISLAMIC / RELIGIOUS ───────────────────────────────────────────────────────

-- Peace TV English (official erbvr.com CDN — iptv-org ae.m3u verified)
UPDATE public.tv_channels SET
  stream_url   = 'https://dzkyvlfyge.erbvr.com/PeaceTvEnglish/index.m3u8',
  official_url = 'https://dzkyvlfyge.erbvr.com/PeaceTvEnglish/index.m3u8',
  is_active    = true
WHERE name = 'Peace TV English';

-- Peace TV Urdu (official erbvr.com CDN — iptv-org ae.m3u verified)
UPDATE public.tv_channels SET
  stream_url   = 'https://dzkyvlfyge.erbvr.com/PeaceTvUrdu/index.m3u8',
  official_url = 'https://dzkyvlfyge.erbvr.com/PeaceTvUrdu/index.m3u8',
  is_active    = true
WHERE name = 'Peace TV Urdu';

-- ── SHARJAH / UAE REGIONAL ────────────────────────────────────────────────────

-- Sharjah TV (official kwikmotion CDN — iptv-org ae.m3u verified)
UPDATE public.tv_channels SET
  stream_url   = 'https://live.kwikmotion.com/smc1live/smc1tv.smil/playlist.m3u8',
  official_url = 'https://live.kwikmotion.com/smc1live/smc1tv.smil/playlist.m3u8',
  is_active    = true
WHERE name = 'Sharjah TV';

-- Al Arabiya (edgenextcdn CDN — iptv-org ae.m3u verified, use over previous Akamai URL)
UPDATE public.tv_channels SET
  stream_url   = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-alarabiya/7f90de73d777d04f3dada92f90d35c44/index.m3u8',
  official_url = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-alarabiya/7f90de73d777d04f3dada92f90d35c44/index.m3u8',
  is_active    = true
WHERE name = 'Al Arabiya';

-- ── EGYPT ─────────────────────────────────────────────────────────────────────

-- CBC Egypt (official systemnet.tv CDN — iptv-org eg.m3u verified)
UPDATE public.tv_channels SET
  stream_url   = 'https://flu.systemnet.tv/CBC/index.m3u8',
  official_url = 'https://flu.systemnet.tv/CBC/index.m3u8',
  is_active    = true
WHERE name IN ('CBC', 'CBC Egypt');

-- CBC Drama (official systemnet.tv CDN — iptv-org eg.m3u verified)
UPDATE public.tv_channels SET
  stream_url   = 'https://flu.systemnet.tv/CBCDrama/index.m3u8',
  official_url = 'https://flu.systemnet.tv/CBCDrama/index.m3u8',
  is_active    = true
WHERE name = 'CBC Drama';

-- MBC Masr (edgenextcdn CDN — iptv-org eg.m3u verified)
UPDATE public.tv_channels SET
  stream_url   = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-masr/956eac069c78a35d47245db6cdbb1575/index.m3u8',
  official_url = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-masr/956eac069c78a35d47245db6cdbb1575/index.m3u8',
  is_active    = true
WHERE name = 'MBC Masr';

-- Al Masriyah (Egyptian Channel 1 — iptv-org eg.m3u verified)
UPDATE public.tv_channels SET
  stream_url   = 'http://185.9.2.18/chid_247/index.m3u8',
  official_url = 'http://185.9.2.18/chid_247/index.m3u8',
  is_active    = true
WHERE name = 'Al Masriyah';
