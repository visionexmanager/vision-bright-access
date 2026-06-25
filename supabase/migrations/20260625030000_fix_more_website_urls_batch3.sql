-- 2026-06-25 batch 3: Arte France + Dubai Media Inc channels.
-- Sources: iptv-org/iptv streams/fr.m3u (Arte), mgmlcdn.com CDN (Dubai Media Inc).

-- ── EUROPE / FRANCE ──────────────────────────────────────────────────────────

-- Arte France (Franco-German public broadcaster, Akamai CDN — iptv-org fr.m3u verified)
UPDATE public.tv_channels SET
  stream_url   = 'https://artesimulcast.akamaized.net/hls/live/2031003/artelive_fr/index.m3u8',
  official_url = 'https://artesimulcast.akamaized.net/hls/live/2031003/artelive_fr/index.m3u8',
  is_active    = true
WHERE name = 'Arte France';

-- ── DUBAI MEDIA INC (DMC) ─────────────────────────────────────────────────────

-- Dubai One (English entertainment — Dubai Media Inc mgmlcdn.com CDN)
UPDATE public.tv_channels SET
  stream_url   = 'https://dminnvllta.cdn.mgmlcdn.com/dubaione/smil:dubaione.stream.smil/chunklist.m3u8',
  official_url = 'https://dminnvllta.cdn.mgmlcdn.com/dubaione/smil:dubaione.stream.smil/chunklist.m3u8',
  is_active    = true
WHERE name = 'Dubai One';

-- Dubai Sports (sports channel — Dubai Media Inc mgmlcdn.com CDN)
UPDATE public.tv_channels SET
  stream_url   = 'https://dmitnthfr.cdn.mgmlcdn.com/dubaisports/smil:dubaisports.stream.smil/chunklist.m3u8',
  official_url = 'https://dmitnthfr.cdn.mgmlcdn.com/dubaisports/smil:dubaisports.stream.smil/chunklist.m3u8',
  is_active    = true
WHERE name = 'Dubai Sports';

-- Sama Dubai (Arabic music channel — Dubai Media Inc mgmlcdn.com CDN)
UPDATE public.tv_channels SET
  stream_url   = 'https://dmieigthvll.cdn.mgmlcdn.com/samadubaiht/smil:samadubai.stream.smil/playlist.m3u8',
  official_url = 'https://dmieigthvll.cdn.mgmlcdn.com/samadubaiht/smil:samadubai.stream.smil/playlist.m3u8',
  is_active    = true
WHERE name = 'Sama Dubai';
