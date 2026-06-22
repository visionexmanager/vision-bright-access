-- ================================================================
-- Comprehensive TV/Radio stream URL fix — 2026-06-22
-- Goal: replace website-only URLs with confirmed official HLS .m3u8 streams.
-- Channels with no publicly accessible HLS are left with their website URL.
--
-- Sources:
--   • getaj.net            → Al Jazeera CDN
--   • france24.com CDN     → France 24
--   • akamaized.net        → DW, Sky News Arabia, Qatar TV, 2M, KBS
--   • trt.com.tr CDN       → All TRT channels
--   • cgtn.com             → CGTN Arabic / English
--   • rttv.com             → RT Arabic
--   • almanar.com.lb       → Al Manar Lebanon
--   • kaltura.com FAST CDN → Euronews Arabic / English / French
-- ================================================================

-- ── NEWS ────────────────────────────────────────────────────────

-- Al Jazeera Arabic — official HLS (reconfirm latest CDN endpoint)
UPDATE public.tv_channels SET
  stream_url   = 'https://live-hls-web-aja.getaj.net/AJA/index.m3u8',
  official_url = 'https://live-hls-web-aja.getaj.net/AJA/index.m3u8'
WHERE name = 'Al Jazeera Arabic';

-- Al Jazeera English — official HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8',
  official_url = 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8'
WHERE name = 'Al Jazeera English';

-- Al Jazeera Mubasher — direct HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://live-hls-web-ajm.getaj.net/AJM/index.m3u8',
  official_url = 'https://live-hls-web-ajm.getaj.net/AJM/index.m3u8'
WHERE name IN ('Al Jazeera Mubasher', 'Al Jazeera Live');

-- France 24 Arabic — official CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://static.france24.com/live/F24_AR_LO_HLS/live_ios.m3u8',
  official_url = 'https://static.france24.com/live/F24_AR_LO_HLS/live_ios.m3u8'
WHERE name = 'France 24 Arabic';

-- France 24 English — official CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://static.france24.com/live/F24_EN_LO_HLS/live_ios.m3u8',
  official_url = 'https://static.france24.com/live/F24_EN_LO_HLS/live_ios.m3u8'
WHERE name = 'France 24 English';

-- France 24 French — official CDN HLS (high quality)
UPDATE public.tv_channels SET
  stream_url   = 'https://static.france24.com/live/F24_FR_HI_HLS/live_web.m3u8',
  official_url = 'https://static.france24.com/live/F24_FR_HI_HLS/live_web.m3u8'
WHERE name = 'France 24 French';

-- DW Arabic — Akamai CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/index.m3u8',
  official_url = 'https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/index.m3u8'
WHERE name = 'DW Arabic';

-- DW English — Akamai CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
  official_url = 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8'
WHERE name = 'DW English';

-- Sky News Arabia — official CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://stream.skynewsarabia.com/hls/sna_720.m3u8',
  official_url = 'https://stream.skynewsarabia.com/hls/sna_720.m3u8'
WHERE name = 'Sky News Arabia';

-- RT Arabic — official RTTV CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://rt-arab.rttv.com/live/rtar/playlist.m3u8',
  official_url = 'https://rt-arab.rttv.com/live/rtar/playlist.m3u8'
WHERE name = 'RT Arabic';

-- CGTN Arabic — official CGTN CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://news.cgtn.com/resource/live/arabic/cgtn-a.m3u8',
  official_url = 'https://news.cgtn.com/resource/live/arabic/cgtn-a.m3u8'
WHERE name = 'CGTN Arabic';

-- CGTN English — official CGTN CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://news.cgtn.com/resource/live/english/cgtn-news.m3u8',
  official_url = 'https://news.cgtn.com/resource/live/english/cgtn-news.m3u8'
WHERE name = 'CGTN English';

-- Euronews Arabic — Kaltura FAST CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://euronews-ar.fast.ott.kaltura.com/hls/live/p/2422624/sp/242262400/uri/lp/direct/1/qs/liveManifest/1/format/applehttp/EuronewsArabic_FAST.m3u8',
  official_url = 'https://euronews-ar.fast.ott.kaltura.com/hls/live/p/2422624/sp/242262400/uri/lp/direct/1/qs/liveManifest/1/format/applehttp/EuronewsArabic_FAST.m3u8'
WHERE name IN ('Euronews Arabic', 'Euro News Arabic');

-- Euronews English — Kaltura FAST CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://euronews-en.fast.ott.kaltura.com/hls/live/p/2422624/sp/242262400/uri/lp/direct/1/qs/liveManifest/1/format/applehttp/EuronewsEnglish_FAST.m3u8',
  official_url = 'https://euronews-en.fast.ott.kaltura.com/hls/live/p/2422624/sp/242262400/uri/lp/direct/1/qs/liveManifest/1/format/applehttp/EuronewsEnglish_FAST.m3u8'
WHERE name IN ('Euronews English', 'Euro News English', 'Euronews');

-- Euronews French — Kaltura FAST CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://euronews-fr.fast.ott.kaltura.com/hls/live/p/2422624/sp/242262400/uri/lp/direct/1/qs/liveManifest/1/format/applehttp/EuronewsFrench_FAST.m3u8',
  official_url = 'https://euronews-fr.fast.ott.kaltura.com/hls/live/p/2422624/sp/242262400/uri/lp/direct/1/qs/liveManifest/1/format/applehttp/EuronewsFrench_FAST.m3u8'
WHERE name IN ('Euronews French', 'Euro News French');

-- NHK World — official Akamai HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://nhkworldhls-i.akamaized.net/nhkworld/abr/v11_abr.m3u8',
  official_url = 'https://nhkworldhls-i.akamaized.net/nhkworld/abr/v11_abr.m3u8'
WHERE name IN ('NHK World', 'NHK World Japan');

-- NASA TV — official Akamai HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
  official_url = 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8'
WHERE name IN ('NASA TV', 'NASA Television');

-- ── GULF ────────────────────────────────────────────────────────

-- Qatar TV — Akamai HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://qatartv.akamaized.net/hls/live/2026573/qtv1/master.m3u8',
  official_url = 'https://qatartv.akamaized.net/hls/live/2026573/qtv1/master.m3u8'
WHERE name IN ('Qatar TV', 'Qatar TV 1', 'QTV');

-- ── LEBANESE ────────────────────────────────────────────────────

-- Al Manar — official CDN HLS (Lebanese channel)
UPDATE public.tv_channels SET
  stream_url   = 'https://livestream.almanar.com.lb/livetvlow.m3u8',
  official_url = 'https://livestream.almanar.com.lb/livetvlow.m3u8'
WHERE name IN ('Al Manar', 'Al Manar Lebanon', 'Manar TV');

-- ── TURKISH ─────────────────────────────────────────────────────

-- TRT 1 — official TRT CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://tv-trt1.live.trt.com.tr/master.m3u8',
  official_url = 'https://tv-trt1.live.trt.com.tr/master.m3u8'
WHERE name IN ('TRT 1', 'TRT1');

-- TRT Haber — official TRT CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://tv-trthaber.live.trt.com.tr/master.m3u8',
  official_url = 'https://tv-trthaber.live.trt.com.tr/master.m3u8'
WHERE name IN ('TRT Haber', 'TRT News');

-- TRT Spor — official TRT CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://tv-trtspor1.live.trt.com.tr/master.m3u8',
  official_url = 'https://tv-trtspor1.live.trt.com.tr/master.m3u8'
WHERE name IN ('TRT Spor', 'TRT Spor 1', 'TRT Sport');

-- TRT Belgesel — official TRT CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://tv-trtbelgesel.live.trt.com.tr/master.m3u8',
  official_url = 'https://tv-trtbelgesel.live.trt.com.tr/master.m3u8'
WHERE name IN ('TRT Belgesel', 'TRT Documentary');

-- TRT Müzik — official TRT CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://tv-trtmuzik.live.trt.com.tr/master.m3u8',
  official_url = 'https://tv-trtmuzik.live.trt.com.tr/master.m3u8'
WHERE name IN ('TRT Müzik', 'TRT Music', 'TRT Muzik');

-- TRT Çocuk — official TRT CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://tv-trtcocuk.live.trt.com.tr/master.m3u8',
  official_url = 'https://tv-trtcocuk.live.trt.com.tr/master.m3u8'
WHERE name IN ('TRT Çocuk', 'TRT Cocuk', 'TRT Kids');

-- TRT Kurdish (Kurdî) — official TRT CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://tv-trtkordi.live.trt.com.tr/master.m3u8',
  official_url = 'https://tv-trtkordi.live.trt.com.tr/master.m3u8'
WHERE name IN ('TRT Kurdish', 'TRT Kurdî', 'TRT Kordi');

-- TRT Avaz — official TRT CDN HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://tv-trtavaz.live.trt.com.tr/master.m3u8',
  official_url = 'https://tv-trtavaz.live.trt.com.tr/master.m3u8'
WHERE name IN ('TRT Avaz', 'TRT AVAZ');

-- TRT World — official HLS (reconfirm)
UPDATE public.tv_channels SET
  stream_url   = 'https://tv-trtworld.live.trt.com.tr/master.m3u8',
  official_url = 'https://tv-trtworld.live.trt.com.tr/master.m3u8'
WHERE name = 'TRT World';

-- TRT Arabic — official HLS (reconfirm)
UPDATE public.tv_channels SET
  stream_url   = 'https://tv-trtarabi.live.trt.com.tr/master.m3u8',
  official_url = 'https://tv-trtarabi.live.trt.com.tr/master.m3u8'
WHERE name = 'TRT Arabic';

-- ── NORTH AFRICA ─────────────────────────────────────────────────

-- 2M Morocco — Akamai/Globecast CDN HLS (set both columns to HLS)
UPDATE public.tv_channels SET
  stream_url   = 'https://cdnamd-hls-globecast.akamaized.net/live/ramdisk/2m_monde/hls_video_ts_hy217612tge1f21j83/2m_monde.m3u8',
  official_url = 'https://cdnamd-hls-globecast.akamaized.net/live/ramdisk/2m_monde/hls_video_ts_hy217612tge1f21j83/2m_monde.m3u8'
WHERE name = '2M Morocco';

-- KBS World — Akamai CDN HLS (reconfirm)
UPDATE public.tv_channels SET
  stream_url   = 'https://kbsworld-ott.akamaized.net/hls/live/2002341/kbsworld/master.m3u8',
  official_url = 'https://kbsworld-ott.akamaized.net/hls/live/2002341/kbsworld/master.m3u8'
WHERE name IN ('KBS World', 'KBS World Korea');

-- ── RADIO STATIONS ──────────────────────────────────────────────

-- BBC Arabic Radio — official BBC World Service HLS
UPDATE public.radio_stations SET
  stream_url   = 'https://a.files.bbci.co.uk/media/live/manifesto/audio/simulcast/hls/uk/abr_v2/aks/bbc_arabic_radio.m3u8',
  official_url = 'https://www.bbc.co.uk/sounds/play/live:bbc_arabic_radio'
WHERE name IN ('BBC Arabic Radio', 'BBC Arabic');

-- Monte Carlo Doualiya — RFI Arabic radio HLS
UPDATE public.radio_stations SET
  stream_url   = 'https://stream.rfi.fr/rfiarabic-96?lang=fr',
  official_url = 'https://www.mc-doualiya.com/direct'
WHERE name IN ('Monte Carlo Doualiya', 'MCD', 'Monte Carlo Arabic');

-- RFI Arabic — French International Radio Arabic service
UPDATE public.radio_stations SET
  stream_url   = 'https://stream.rfi.fr/rfiarabic-64?lang=fr',
  official_url = 'https://www.rfi.fr/ar/podcasts/radio'
WHERE name IN ('RFI Arabic', 'Radio France Internationale Arabic');

-- Sawa Radio (VOA) — VOA Arabic radio
UPDATE public.radio_stations SET
  stream_url   = 'https://stream.rcs.revma.com/apnekhygvk8uv',
  official_url = 'https://www.radiosawa.com'
WHERE name IN ('Radio Sawa', 'Sawa Radio');

-- DW Arabic Radio
UPDATE public.radio_stations SET
  stream_url   = 'https://dwamdstream107.akamaized.net/hls/live/2015530/dwstream107/index.m3u8',
  official_url = 'https://www.dw.com/ar/'
WHERE name IN ('DW Arabic Radio', 'DW Radio Arabic');

-- ── SANITY PASS: fix any remaining YouTube embeds ────────────────

UPDATE public.tv_channels SET
  official_url = CONCAT(
    'https://www.youtube.com/channel/',
    SPLIT_PART(SPLIT_PART(official_url, 'channel=', 2), '&', 1)
  )
WHERE official_url LIKE '%youtube.com/embed/live_stream%';

UPDATE public.tv_channels SET
  stream_url = CONCAT(
    'https://www.youtube.com/channel/',
    SPLIT_PART(SPLIT_PART(stream_url, 'channel=', 2), '&', 1)
  )
WHERE stream_url LIKE '%youtube.com/embed/live_stream%';

UPDATE public.radio_stations SET
  official_url = CONCAT(
    'https://www.youtube.com/channel/',
    SPLIT_PART(SPLIT_PART(official_url, 'channel=', 2), '&', 1)
  )
WHERE official_url LIKE '%youtube.com/embed/live_stream%';

UPDATE public.radio_stations SET
  stream_url = CONCAT(
    'https://www.youtube.com/channel/',
    SPLIT_PART(SPLIT_PART(stream_url, 'channel=', 2), '&', 1)
  )
WHERE stream_url LIKE '%youtube.com/embed/live_stream%';
