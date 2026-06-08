-- ================================================================
-- Replace ALL YouTube embed URLs with official HLS streams or
-- official channel website URLs.
--
-- Priority order:
--   1. Official HLS/m3u8 from channel's own CDN (best)
--   2. Official channel website live page (external link button)
--
-- Sources verified 2026-06-07:
--   • getaj.net      → Al Jazeera official CDN
--   • france24.com   → France 24 official CDN
--   • akamaized.net  → DW, Sky News, KBS, Qatar, 2M
--   • trt.com.tr     → TRT official CDN
--   • cgtn.com       → CGTN official
--   • kbsworld-ott   → KBS official Akamai
-- ================================================================

-- ── NEWS ────────────────────────────────────────────────────────

-- Al Jazeera Arabic — official HLS via getaj.net (1080p)
UPDATE public.tv_channels SET
  stream_url   = 'https://live-hls-v3-aja.getaj.net/AJA/v3/index.m3u8',
  official_url = 'https://live-hls-v3-aja.getaj.net/AJA/v3/index.m3u8'
WHERE name = 'Al Jazeera Arabic';

-- Al Jazeera English — restore official HLS (was broken by previous fix)
UPDATE public.tv_channels SET
  stream_url   = 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8',
  official_url = 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8'
WHERE name = 'Al Jazeera English';

-- France 24 Arabic — official HLS from France 24 CDN
UPDATE public.tv_channels SET
  stream_url   = 'https://static.france24.com/live/F24_AR_LO_HLS/live_ios.m3u8',
  official_url = 'https://static.france24.com/live/F24_AR_LO_HLS/live_ios.m3u8'
WHERE name = 'France 24 Arabic';

-- DW Arabic — official HLS from Akamai CDN
UPDATE public.tv_channels SET
  stream_url   = 'https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/index.m3u8',
  official_url = 'https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/index.m3u8'
WHERE name = 'DW Arabic';

-- Sky News Arabia — official HLS from skynewsarabia.com CDN
UPDATE public.tv_channels SET
  stream_url   = 'https://stream.skynewsarabia.com/hls/sna_720.m3u8',
  official_url = 'https://stream.skynewsarabia.com/hls/sna_720.m3u8'
WHERE name = 'Sky News Arabia';

-- Al Arabiya — revert to official website (previous fix used a video embed, not live)
UPDATE public.tv_channels SET
  stream_url   = 'https://www.alarabiya.net/ar/tv',
  official_url = 'https://www.alarabiya.net/ar/tv'
WHERE name = 'Al Arabiya';

-- Al Hurra — official website live page
UPDATE public.tv_channels SET
  stream_url   = 'https://www.alhurra.com/live',
  official_url = 'https://www.alhurra.com/live'
WHERE name = 'Al Hurra';

-- CGTN Arabic — official HLS from cgtn.com
UPDATE public.tv_channels SET
  stream_url   = 'https://news.cgtn.com/resource/live/arabic/cgtn-a.m3u8',
  official_url = 'https://news.cgtn.com/resource/live/arabic/cgtn-a.m3u8'
WHERE name = 'CGTN Arabic';

-- CGTN English — official HLS from cgtn.com
UPDATE public.tv_channels SET
  stream_url   = 'https://news.cgtn.com/resource/live/english/cgtn-news.m3u8',
  official_url = 'https://news.cgtn.com/resource/live/english/cgtn-news.m3u8'
WHERE name = 'CGTN English';

-- Al Mayadeen — official live player page
UPDATE public.tv_channels SET
  stream_url   = 'https://www.almayadeen.net/liveplayer.html',
  official_url = 'https://www.almayadeen.net/liveplayer.html'
WHERE name = 'Al Mayadeen';

-- ── GULF ────────────────────────────────────────────────────────

-- Kuwait TV — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.kwtv.gov.kw/live',
  official_url = 'https://www.kwtv.gov.kw/live'
WHERE name = 'Kuwait TV';

-- Bahrain TV — official website (also fixes wrong stream_url that pointed to BBC)
UPDATE public.tv_channels SET
  stream_url   = 'https://www.brtc.com.bh/live',
  official_url = 'https://www.brtc.com.bh/live'
WHERE name = 'Bahrain TV';

-- Qatar TV — official HLS from Akamai CDN
UPDATE public.tv_channels SET
  stream_url   = 'https://qatartv.akamaized.net/hls/live/2026573/qtv1/master.m3u8',
  official_url = 'https://qatartv.akamaized.net/hls/live/2026573/qtv1/master.m3u8'
WHERE name = 'Qatar TV';

-- Oman TV — official Oman national TV website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.omantv.om/live',
  official_url = 'https://www.omantv.om/live'
WHERE name = 'Oman TV';

-- ── ARABIC ──────────────────────────────────────────────────────

-- CBC Egypt — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://cbcegypt.com/live/',
  official_url = 'https://cbcegypt.com/live/'
WHERE name = 'CBC Egypt';

-- ON E Egypt — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.ontv.com/live/',
  official_url = 'https://www.ontv.com/live/'
WHERE name = 'ON E Egypt';

-- Al Jadeed Lebanon — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.jadeed.tv/live',
  official_url = 'https://www.jadeed.tv/live'
WHERE name = 'Al Jadeed';

-- Jordan TV — official JRTV website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.jrtv.gov.jo/live-tv',
  official_url = 'https://www.jrtv.gov.jo/live-tv'
WHERE name = 'Jordan TV';

-- Syria TV — official Syrian TV website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.rtv.gov.sy',
  official_url = 'https://www.rtv.gov.sy'
WHERE name = 'Syria TV';

-- ── ENTERTAINMENT ────────────────────────────────────────────────

-- CBC Sofra — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://cbcegypt.com/live/cbcsofra',
  official_url = 'https://cbcegypt.com/live/cbcsofra'
WHERE name = 'CBC Sofra';

-- Al Hayah — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://hayah.tv',
  official_url = 'https://hayah.tv'
WHERE name = 'Al Hayah';

-- ── RELIGIOUS ────────────────────────────────────────────────────

-- Iqraa TV — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://iqraa.tv/iqra-tv-live/',
  official_url = 'https://iqraa.tv/iqra-tv-live/'
WHERE name = 'Iqraa TV';

-- Huda TV — official website live page
UPDATE public.tv_channels SET
  stream_url   = 'https://huda.tv/live-streaming/',
  official_url = 'https://huda.tv/live-streaming/'
WHERE name = 'Huda TV';

-- Safa TV — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.safasat.com/live',
  official_url = 'https://www.safasat.com/live'
WHERE name = 'Safa TV';

-- Al Hayah Quran — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://hayah.tv',
  official_url = 'https://hayah.tv'
WHERE name = 'Al Hayah Quran';

-- ── KIDS ─────────────────────────────────────────────────────────

-- Spacetoon — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.spacetoon.com',
  official_url = 'https://www.spacetoon.com'
WHERE name = 'Spacetoon';

-- Toyor Al Jannah — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.toyoraljanah.com',
  official_url = 'https://www.toyoraljanah.com'
WHERE name = 'Toyor Al Jannah';

-- ── MOVIES ───────────────────────────────────────────────────────

-- Aflam TV — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.aflam.tv',
  official_url = 'https://www.aflam.tv'
WHERE name = 'Aflam TV';

-- ── INTERNATIONAL ────────────────────────────────────────────────

-- KBS World Korea / KBS World — official HLS from Akamai CDN
UPDATE public.tv_channels SET
  stream_url   = 'https://kbsworld-ott.akamaized.net/hls/live/2002341/kbsworld/master.m3u8',
  official_url = 'https://kbsworld-ott.akamaized.net/hls/live/2002341/kbsworld/master.m3u8'
WHERE name IN ('KBS World Korea', 'KBS World');

-- TRT World — official HLS from trt.com.tr CDN (all categories)
UPDATE public.tv_channels SET
  stream_url   = 'https://tv-trtworld.live.trt.com.tr/master.m3u8',
  official_url = 'https://tv-trtworld.live.trt.com.tr/master.m3u8'
WHERE name = 'TRT World';

-- CCTV-4 China — official website (separate from CGTN)
UPDATE public.tv_channels SET
  stream_url   = 'https://tv.cctv.com/live/cctv4/',
  official_url = 'https://tv.cctv.com/live/cctv4/'
WHERE name = 'CCTV-4 China';

-- ── DOCUMENTARY ──────────────────────────────────────────────────

-- BBC Earth — official website (content/VOD channel, no 24/7 live HLS)
UPDATE public.tv_channels SET
  stream_url   = 'https://www.bbcearth.com/',
  official_url = 'https://www.bbcearth.com/'
WHERE name = 'BBC Earth';

-- DW Documentary — official DW live TV page
UPDATE public.tv_channels SET
  stream_url   = 'https://www.dw.com/en/media-center/live-tv/',
  official_url = 'https://www.dw.com/en/media-center/live-tv/'
WHERE name = 'DW Documentary';

-- ── MUSIC ────────────────────────────────────────────────────────

-- Mazzika — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.mazzika.com',
  official_url = 'https://www.mazzika.com'
WHERE name = 'Mazzika';

-- Melody Arabia — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.melodyarabia.tv',
  official_url = 'https://www.melodyarabia.tv'
WHERE name = 'Melody Arabia';

-- ── TURKISH ──────────────────────────────────────────────────────

-- TRT Arabic — official HLS from trt.com.tr CDN
UPDATE public.tv_channels SET
  stream_url   = 'https://tv-trtarabi.live.trt.com.tr/master.m3u8',
  official_url = 'https://tv-trtarabi.live.trt.com.tr/master.m3u8'
WHERE name = 'TRT Arabic';

-- ── AFRICAN ──────────────────────────────────────────────────────

-- Channels TV Nigeria — official website (was using wrong Africanews YouTube channel)
UPDATE public.tv_channels SET
  stream_url   = 'https://www.channelstv.com/live',
  official_url = 'https://www.channelstv.com/live'
WHERE name = 'Channels TV Nigeria';

-- SABC News — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.sabcnews.com/sabcnews/live/',
  official_url = 'https://www.sabcnews.com/sabcnews/live/'
WHERE name = 'SABC News';

-- ── NORTH AFRICA ─────────────────────────────────────────────────

-- 2M Morocco — official HLS from Akamai/Globecast CDN
UPDATE public.tv_channels SET
  stream_url   = 'https://cdnamd-hls-globecast.akamaized.net/live/ramdisk/2m_monde/hls_video_ts_hy217612tge1f21j83/2m_monde.m3u8',
  official_url = 'https://2m.ma/en/live/'
WHERE name = '2M Morocco';

-- Algeria TV — fix wrong stream_url domain (was entebbe.dz, should be entv.dz)
UPDATE public.tv_channels SET
  stream_url   = 'https://www.entv.dz/live',
  official_url = 'https://www.entv.dz/live'
WHERE name = 'Algeria TV';

-- ── EDUCATION ────────────────────────────────────────────────────

-- TED Talks — official website (not a 24/7 live channel)
UPDATE public.tv_channels SET
  stream_url   = 'https://www.ted.com/',
  official_url = 'https://www.ted.com/'
WHERE name = 'TED Talks';

-- ── NATURE ───────────────────────────────────────────────────────
-- BBC Earth (nature category) handled above by name = 'BBC Earth'

-- ── OLDER SEED CHANNELS (20260529000004) ────────────────────────
-- These channels exist in the earlier seed with YouTube official_urls

-- Al Hadath (Al Arabiya business news)
UPDATE public.tv_channels SET
  stream_url   = 'https://www.alarabiya.net/alhadath',
  official_url = 'https://www.alarabiya.net/alhadath'
WHERE name = 'Al Hadath';

-- Al Resalah — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://alresalah.tv/',
  official_url = 'https://alresalah.tv/'
WHERE name = 'Al Resalah';

-- Al Majd — official website live page
UPDATE public.tv_channels SET
  stream_url   = 'https://www.almajdtv.com/live',
  official_url = 'https://www.almajdtv.com/live'
WHERE name = 'Al Majd';

-- Quran TV Saudi — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.qurantv.sa/',
  official_url = 'https://www.qurantv.sa/'
WHERE name = 'Quran TV Saudi';

-- Iqraa (old seed name without "TV") — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://iqraa.tv/iqra-tv-live/',
  official_url = 'https://iqraa.tv/iqra-tv-live/'
WHERE name = 'Iqraa';

-- Saudi Sports — official SSC website
UPDATE public.tv_channels SET
  stream_url   = 'https://ssc.com.sa/ar/channels/',
  official_url = 'https://ssc.com.sa/ar/channels/'
WHERE name = 'Saudi Sports';

-- Dubai Sports — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.dubaisportschannel.ae/',
  official_url = 'https://www.dubaisportschannel.ae/'
WHERE name = 'Dubai Sports';

-- Abu Dhabi Sports (old name without "1") — official website
UPDATE public.tv_channels SET
  stream_url   = 'https://adtv.ae/ar/sport-live',
  official_url = 'https://adtv.ae/ar/sport-live'
WHERE name = 'Abu Dhabi Sports';

-- Dubai One — official DMC website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.dmc.ae/ar/live',
  official_url = 'https://www.dmc.ae/ar/live'
WHERE name = 'Dubai One';

-- MBC channels from old seed — official MBC website
UPDATE public.tv_channels SET
  stream_url   = 'https://www.mbc.net/ar/mbc1/live.html',
  official_url = 'https://www.mbc.net/ar/mbc1/live.html'
WHERE name = 'MBC 1';

UPDATE public.tv_channels SET
  stream_url   = 'https://www.mbc.net/ar/mbcmasr/live.html',
  official_url = 'https://www.mbc.net/ar/mbcmasr/live.html'
WHERE name = 'MBC Masr';

UPDATE public.tv_channels SET
  stream_url   = 'https://www.mbc.net/ar/mbc4/live.html',
  official_url = 'https://www.mbc.net/ar/mbc4/live.html'
WHERE name = 'MBC 4';

UPDATE public.tv_channels SET
  stream_url   = 'https://www.mbc.net/ar/mbc3/live.html',
  official_url = 'https://www.mbc.net/ar/mbc3/live.html'
WHERE name = 'MBC 3';

-- France 24 English — official HLS (old seed had YouTube, new seed has HLS)
UPDATE public.tv_channels SET
  stream_url   = 'https://static.france24.com/live/F24_EN_LO_HLS/live_ios.m3u8',
  official_url = 'https://static.france24.com/live/F24_EN_LO_HLS/live_ios.m3u8'
WHERE name = 'France 24 English';

-- France 24 French — official HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://static.france24.com/live/F24_FR_LO_HLS/live_ios.m3u8',
  official_url = 'https://static.france24.com/live/F24_FR_LO_HLS/live_ios.m3u8'
WHERE name = 'France 24 French';

-- DW English — official Akamai HLS
UPDATE public.tv_channels SET
  stream_url   = 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
  official_url = 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8'
WHERE name = 'DW English';

-- Saudi TV 1 — official website (covers both seed versions)
UPDATE public.tv_channels SET
  stream_url   = 'https://www.saudiatv.sa/live',
  official_url = 'https://www.saudiatv.sa/live'
WHERE name = 'Saudi TV 1';

-- Dubai TV — official DMC website (covers both seed versions)
UPDATE public.tv_channels SET
  stream_url   = 'https://www.dmc.ae/ar/live',
  official_url = 'https://www.dmc.ae/ar/live'
WHERE name = 'Dubai TV';

-- Abu Dhabi TV — official ADTV website (covers both seed versions)
UPDATE public.tv_channels SET
  stream_url   = 'https://adtv.ae/ar/live',
  official_url = 'https://adtv.ae/ar/live'
WHERE name = 'Abu Dhabi TV';

-- BBC Arabic (old seed had YouTube; fix 000003 already set to BBC website)
UPDATE public.tv_channels SET
  stream_url   = 'https://www.bbc.com/arabic/media/v/arabic_tv',
  official_url = 'https://www.bbc.com/arabic/media/v/arabic_tv'
WHERE name = 'BBC Arabic';

-- BBC World News (old seed had YouTube; fix 000003 already set to BBC website)
UPDATE public.tv_channels SET
  stream_url   = 'https://www.bbc.com/news/av/10462520',
  official_url = 'https://www.bbc.com/news/av/10462520'
WHERE name = 'BBC World News';

-- RT Arabic (old seed had YouTube; fix 000003 already set to RT website)
UPDATE public.tv_channels SET
  stream_url   = 'https://arabic.rt.com/on_air/',
  official_url = 'https://arabic.rt.com/on_air/'
WHERE name = 'RT Arabic';

-- ── SANITY PASS 1: channels where official_url = YouTube embed
-- but stream_url is already an official website — use stream_url as official_url
-- (handles the 89 channels in 20260529000005 with this exact pattern)
UPDATE public.tv_channels SET
  official_url = stream_url
WHERE official_url LIKE '%youtube.com/embed%'
  AND stream_url NOT LIKE '%youtube.com%'
  AND stream_url IS NOT NULL
  AND stream_url <> '';

-- ── SANITY PASS 2: any remaining YouTube embed stream_url
-- extract channel ID and convert to a plain channel page URL
-- (shows as external link button — always accessible, no embed issues)
UPDATE public.tv_channels SET
  stream_url = CONCAT(
    'https://www.youtube.com/channel/',
    SPLIT_PART(SPLIT_PART(stream_url, 'channel=', 2), '&', 1)
  )
WHERE stream_url LIKE '%youtube.com/embed/live_stream%';

-- ── SANITY PASS 3: any remaining YouTube embed official_url
UPDATE public.tv_channels SET
  official_url = CONCAT(
    'https://www.youtube.com/channel/',
    SPLIT_PART(SPLIT_PART(official_url, 'channel=', 2), '&', 1)
  )
WHERE official_url LIKE '%youtube.com/embed/live_stream%';
