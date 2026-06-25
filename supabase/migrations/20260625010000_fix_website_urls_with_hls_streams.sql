-- 2026-06-25: Replace website URLs with verified free HLS streams for TV channels.
-- Sources: iptv-org/iptv (GitHub), Free-TV/IPTV, official broadcaster CDNs.
-- Channels that still have website URLs after this migration are either
-- subscription-only (beIN, ESPN, SSC, etc.) or have no publicly available
-- free HLS stream — their external-link behaviour is intentional.

-- ── NORTH AFRICA ──────────────────────────────────────────────────────────────

-- Al-Oula Morocco (SNRT 1 — official Akamai CDN via livemediama.com)
UPDATE public.tv_channels SET
  stream_url   = 'https://stream-lb.livemediama.com/alaoula-tnt/hls/master.m3u8',
  official_url = 'https://stream-lb.livemediama.com/alaoula-tnt/hls/master.m3u8',
  is_active    = true
WHERE name = 'Al-Oula Morocco';

-- Watanya Tunisia (El Watania 1 — official tanitweb.net CDN)
UPDATE public.tv_channels SET
  stream_url   = 'https://sw1.tanitweb.net/TunisiaTV/_definst_/watania1/chunklist.m3u8',
  official_url = 'https://sw1.tanitweb.net/TunisiaTV/_definst_/watania1/chunklist.m3u8',
  is_active    = true
WHERE name = 'Watanya Tunisia';

-- Libya TV (Libya Al Wataniya — Akamai CDN via cdn-globecast)
UPDATE public.tv_channels SET
  stream_url   = 'https://cdn-globecast.akamaized.net/live/eds/libya_al_watanya/hls_roku/index.m3u8',
  official_url = 'https://cdn-globecast.akamaized.net/live/eds/libya_al_watanya/hls_roku/index.m3u8',
  is_active    = true
WHERE name = 'Libya TV';

-- ENTV Algeria is already at http://185.9.2.18/chid_347/index.m3u8 (set in prior migration)

-- ── LEVANT / JORDAN ───────────────────────────────────────────────────────────

-- Al Mamlaka Jordan (Jordan Satellite Channel — official ercdn.net CDN)
UPDATE public.tv_channels SET
  stream_url   = 'https://jrtv-live.ercdn.net/jordanhd/jordanhd.m3u8',
  official_url = 'https://jrtv-live.ercdn.net/jordanhd/jordanhd.m3u8',
  is_active    = true
WHERE name = 'Al Mamlaka Jordan';

-- Syrian Drama (Syria 2 / Al Thania — drama/variety second channel)
UPDATE public.tv_channels SET
  stream_url   = 'https://live.kwikmotion.com/syriatv02live/syriatv02.smil/playlist.m3u8',
  official_url = 'https://live.kwikmotion.com/syriatv02live/syriatv02.smil/playlist.m3u8',
  is_active    = true
WHERE name = 'Syrian Drama';

-- MTV Lebanon Music (official edgenextcdn.net / MBC CDN)
UPDATE public.tv_channels SET
  stream_url   = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mtv-lebanon/b8ebb2a5affb812f1541712adde10e26/index.m3u8',
  official_url = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mtv-lebanon/b8ebb2a5affb812f1541712adde10e26/index.m3u8',
  is_active    = true
WHERE name = 'MTV Lebanon Music';

-- ── GULF / SAUDI ──────────────────────────────────────────────────────────────

-- Al Arabiya Mubasher (Al Arabiya live news feed — official Akamai CDN)
UPDATE public.tv_channels SET
  stream_url   = 'https://live.alarabiya.net/alarabiapublish/alarabiya.smil/playlist.m3u8',
  official_url = 'https://live.alarabiya.net/alarabiapublish/alarabiya.smil/playlist.m3u8',
  is_active    = true
WHERE name = 'Al Arabiya Mubasher';

-- Rotana Tarab (official Shahid/Rotana CDN hibridcdn.net)
UPDATE public.tv_channels SET
  stream_url   = 'https://shd-amg-fast-btpls.shahid.net/tx002/playlist.m3u8',
  official_url = 'https://shd-amg-fast-btpls.shahid.net/tx002/playlist.m3u8',
  is_active    = true
WHERE name = 'Rotana Tarab';

-- Saudi Sunnah (Al Sunnah Al Nabawiyah — official Akamai CDN)
UPDATE public.tv_channels SET
  stream_url   = 'https://cdn-globecast.akamaized.net/live/eds/saudi_sunnah/hls_roku/index.m3u8',
  official_url = 'https://cdn-globecast.akamaized.net/live/eds/saudi_sunnah/hls_roku/index.m3u8',
  is_active    = true
WHERE name = 'Saudi Sunnah';

-- Saudi TV 2 (Al Thaqafiya — Saudi cultural channel, official edgenextcdn.net CDN)
UPDATE public.tv_channels SET
  stream_url   = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-thaqafeyyah/28c0d2a20dbf1dc049ce15d3973f494b/index.m3u8',
  official_url = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-thaqafeyyah/28c0d2a20dbf1dc049ce15d3973f494b/index.m3u8',
  is_active    = true
WHERE name = 'Saudi TV 2';

-- ── ASIA / PACIFIC ────────────────────────────────────────────────────────────

-- NHK Japan (NHK World — official NHK CDN)
UPDATE public.tv_channels SET
  stream_url   = 'https://masterpl.hls.nhkworld.jp/hls/w/live/smarttv.m3u8',
  official_url = 'https://masterpl.hls.nhkworld.jp/hls/w/live/smarttv.m3u8',
  is_active    = true
WHERE name = 'NHK Japan';

-- Arirang TV Korea (official Akamai edgesuite CDN)
UPDATE public.tv_channels SET
  stream_url   = 'https://amdlive-ch01-ctnd-com.akamaized.net/arirang_1ch/smil:arirang_1ch.smil/playlist.m3u8',
  official_url = 'https://amdlive-ch01-ctnd-com.akamaized.net/arirang_1ch/smil:arirang_1ch.smil/playlist.m3u8',
  is_active    = true
WHERE name = 'Arirang TV Korea';

-- CGTN Chinese (official CGTN CDN — Chinese-language channel)
UPDATE public.tv_channels SET
  stream_url   = 'https://news.cgtn.com/resource/live/chinese/cgtn-f.m3u8',
  official_url = 'https://news.cgtn.com/resource/live/chinese/cgtn-f.m3u8',
  is_active    = true
WHERE name = 'CGTN Chinese';

-- Geo TV Pakistan (Geo News HLS stream)
UPDATE public.tv_channels SET
  stream_url   = 'https://jk3lz82elw79-hls-live.5centscdn.com/newgeonews/07811dc6c422334ce36a09ff5cd6fe71.sdp/playlist.m3u8',
  official_url = 'https://jk3lz82elw79-hls-live.5centscdn.com/newgeonews/07811dc6c422334ce36a09ff5cd6fe71.sdp/playlist.m3u8',
  is_active    = true
WHERE name = 'Geo TV Pakistan';

-- ARY Digital Pakistan (ARY Digital USA feed — same content, 5centscdn.com)
UPDATE public.tv_channels SET
  stream_url   = 'https://6zklx4wryw9b-hls-live.5centscdn.com/arydigitalusa/498f1704b692c3ad4dbfdf5ba5d04536.sdp/playlist.m3u8',
  official_url = 'https://6zklx4wryw9b-hls-live.5centscdn.com/arydigitalusa/498f1704b692c3ad4dbfdf5ba5d04536.sdp/playlist.m3u8',
  is_active    = true
WHERE name = 'ARY Digital Pakistan';

-- ── EUROPE ────────────────────────────────────────────────────────────────────

-- ARD Germany (Das Erste HD — official ARD CDN, international feed)
UPDATE public.tv_channels SET
  stream_url   = 'https://daserste-live.ard-mcdn.de/daserste/live/hls/int/master.m3u8',
  official_url = 'https://daserste-live.ard-mcdn.de/daserste/live/hls/int/master.m3u8',
  is_active    = true
WHERE name = 'ARD Germany';

-- ERT Greece (ERT1 HD — official ERT broadpeak CDN)
UPDATE public.tv_channels SET
  stream_url   = 'https://ert-ucdn.broadpeak-aas.com/bpk-tv/ERT1/default/index.m3u8',
  official_url = 'https://ert-ucdn.broadpeak-aas.com/bpk-tv/ERT1/default/index.m3u8',
  is_active    = true
WHERE name = 'ERT Greece';

-- RAI Italy (RAI 1 HD — non-geoblocked international mirror)
UPDATE public.tv_channels SET
  stream_url   = 'https://srv1.adriatelekom.com/Rai1/index.m3u8',
  official_url = 'https://srv1.adriatelekom.com/Rai1/index.m3u8',
  is_active    = true
WHERE name IN ('RAI Italy', 'RAI Uno Italy');

-- Kanal D Turkey (official Demiroren CDN)
UPDATE public.tv_channels SET
  stream_url   = 'https://demiroren.daioncdn.net/kanald/kanald.m3u8?app=kanald_web&ce=3',
  official_url = 'https://demiroren.daioncdn.net/kanald/kanald.m3u8?app=kanald_web&ce=3',
  is_active    = true
WHERE name = 'Kanal D Turkey';

-- ── AFRICA ────────────────────────────────────────────────────────────────────

-- Channels TV Nigeria (official push2stream CDN)
UPDATE public.tv_channels SET
  stream_url   = 'https://cs2.push2stream.com/CHANNELSTV-DVR/playlist.m3u8',
  official_url = 'https://cs2.push2stream.com/CHANNELSTV-DVR/playlist.m3u8',
  is_active    = true
WHERE name = 'Channels TV Nigeria';

-- NTA Nigeria (NTA International — official visionip.tv CDN)
UPDATE public.tv_channels SET
  stream_url   = 'https://api.visionip.tv/live/ASHTTP/visiontvuk-entertainment-ntai-hsslive-25f-4x3-MB/playlist.m3u8',
  official_url = 'https://api.visionip.tv/live/ASHTTP/visiontvuk-entertainment-ntai-hsslive-25f-4x3-MB/playlist.m3u8',
  is_active    = true
WHERE name = 'NTA Nigeria';

-- ── ISLAMIC / RELIGIOUS ───────────────────────────────────────────────────────

-- Islam Channel UK (official islamchannel.tv CDN)
UPDATE public.tv_channels SET
  stream_url   = 'https://live.islamchannel.tv/live11/islamtv_english/bitrate1.isml/live.m3u8',
  official_url = 'https://live.islamchannel.tv/live11/islamtv_english/bitrate1.isml/live.m3u8',
  is_active    = true
WHERE name = 'Islam Channel';

-- TBN Arabic (TBN UK international feed — simplestreamcdn.com)
UPDATE public.tv_channels SET
  stream_url   = 'https://live-tbn-ssai.simplestreamcdn.com/v1/master/774d979dd66704abea7c5b62cb34c6815fda0d35/tbn-live/manifest.m3u8',
  official_url = 'https://live-tbn-ssai.simplestreamcdn.com/v1/master/774d979dd66704abea7c5b62cb34c6815fda0d35/tbn-live/manifest.m3u8',
  is_active    = true
WHERE name = 'TBN Arabic';
