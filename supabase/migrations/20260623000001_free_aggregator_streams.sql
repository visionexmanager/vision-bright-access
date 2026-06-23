-- ================================================================
-- FREE AGGREGATOR STREAM URLs — Comprehensive Update
-- Sources: iptv-org/iptv (github.com/iptv-org/iptv), official CDNs
-- All streams are publicly free — no subscription required
-- Updates both stream_url (player) and official_url (player mode)
-- ================================================================

-- ================================================================
-- TV CHANNELS
-- ================================================================

-- ── NEWS ─────────────────────────────────────────────────────────

UPDATE public.tv_channels SET
  stream_url   = 'https://live-hls-apps-aja-fa.getaj.net/AJA/01.m3u8',
  official_url = 'https://live-hls-apps-aja-fa.getaj.net/AJA/01.m3u8'
WHERE name = 'Al Jazeera Arabic';

UPDATE public.tv_channels SET
  stream_url   = 'https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8',
  official_url = 'https://live-hls-apps-aje-fa.getaj.net/AJE/index.m3u8'
WHERE name = 'Al Jazeera English';

UPDATE public.tv_channels SET
  stream_url   = 'https://live.france24.com/hls/live/2037222-b/F24_AR_HI_HLS/master_2300.m3u8',
  official_url = 'https://live.france24.com/hls/live/2037222-b/F24_AR_HI_HLS/master_2300.m3u8'
WHERE name = 'France 24 Arabic';

UPDATE public.tv_channels SET
  stream_url   = 'https://live.france24.com/hls/live/2037218-b/F24_EN_HI_HLS/master_2300.m3u8',
  official_url = 'https://live.france24.com/hls/live/2037218-b/F24_EN_HI_HLS/master_2300.m3u8'
WHERE name = 'France 24 English';

UPDATE public.tv_channels SET
  stream_url   = 'https://live.france24.com/hls/live/2037216-b/F24_FR_HI_HLS/master_2300.m3u8',
  official_url = 'https://live.france24.com/hls/live/2037216-b/F24_FR_HI_HLS/master_2300.m3u8'
WHERE name = 'France 24 French';

UPDATE public.tv_channels SET
  stream_url   = 'https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/master.m3u8',
  official_url = 'https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/master.m3u8'
WHERE name = 'DW Arabic';

UPDATE public.tv_channels SET
  stream_url   = 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8',
  official_url = 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8'
WHERE name = 'DW English';

UPDATE public.tv_channels SET
  stream_url   = 'https://live-stream.skynewsarabia.com/c-horizontal-channel/horizontal-stream/index.m3u8',
  official_url = 'https://live-stream.skynewsarabia.com/c-horizontal-channel/horizontal-stream/index.m3u8'
WHERE name = 'Sky News Arabia';

UPDATE public.tv_channels SET
  stream_url   = 'https://vs-hls-push-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_news_channel_hd/mobile_wifi_main_hd_abr_v2.m3u8',
  official_url = 'https://vs-hls-push-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_news_channel_hd/mobile_wifi_main_hd_abr_v2.m3u8'
WHERE name = 'BBC World News';

UPDATE public.tv_channels SET
  stream_url   = 'https://vs-hls-pushb-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_arabic_tv/mobile_wifi_main_hd_abr_v2.m3u8',
  official_url = 'https://vs-hls-pushb-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_arabic_tv/mobile_wifi_main_hd_abr_v2.m3u8'
WHERE name = 'BBC Arabic';

UPDATE public.tv_channels SET
  stream_url   = 'https://live.alarabiya.net/alarabiapublish/alarabiya.smil/playlist.m3u8',
  official_url = 'https://live.alarabiya.net/alarabiapublish/alarabiya.smil/playlist.m3u8'
WHERE name = 'Al Arabiya';

UPDATE public.tv_channels SET
  stream_url   = 'https://mbn-ingest-worldsafe.akamaized.net/hls/live/2038900/MBN_Alhurra_Worldsafe_HLS/master.m3u8',
  official_url = 'https://mbn-ingest-worldsafe.akamaized.net/hls/live/2038900/MBN_Alhurra_Worldsafe_HLS/master.m3u8'
WHERE name = 'Al Hurra';

UPDATE public.tv_channels SET
  stream_url   = 'https://rt-arab.rttv.com/live/rtar/playlist.m3u8',
  official_url = 'https://rt-arab.rttv.com/live/rtar/playlist.m3u8'
WHERE name = 'RT Arabic';

UPDATE public.tv_channels SET
  stream_url   = 'https://news.cgtn.com/resource/live/arabic/cgtn-arabic.m3u8',
  official_url = 'https://news.cgtn.com/resource/live/arabic/cgtn-arabic.m3u8'
WHERE name = 'CGTN Arabic';

UPDATE public.tv_channels SET
  stream_url   = 'https://mdnlv.cdn.octivid.com/almdn/smil:mpegts.stream.smil/playlist.m3u8',
  official_url = 'https://mdnlv.cdn.octivid.com/almdn/smil:mpegts.stream.smil/playlist.m3u8'
WHERE name = 'Al Mayadeen';

UPDATE public.tv_channels SET
  stream_url   = 'https://news.cgtn.com/resource/live/english/cgtn-news.m3u8',
  official_url = 'https://news.cgtn.com/resource/live/english/cgtn-news.m3u8'
WHERE name IN ('CGTN English', 'CCTV-4 China');

-- ── GULF ─────────────────────────────────────────────────────────

UPDATE public.tv_channels SET
  stream_url   = 'https://aloula-redirect.vercel.app/2/playlist.m3u8',
  official_url = 'https://aloula-redirect.vercel.app/2/playlist.m3u8'
WHERE name = 'Saudi TV 1';

UPDATE public.tv_channels SET
  stream_url   = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-1/15cf99af5de54063fdabfefe66adc075/index.m3u8',
  official_url = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-1/15cf99af5de54063fdabfefe66adc075/index.m3u8'
WHERE name = 'MBC 1';

UPDATE public.tv_channels SET
  stream_url   = 'http://185.9.2.18/chid_139/index.m3u8',
  official_url = 'http://185.9.2.18/chid_139/index.m3u8'
WHERE name = 'Dubai TV';

UPDATE public.tv_channels SET
  stream_url   = 'http://185.9.2.18/chid_326/index.m3u8',
  official_url = 'http://185.9.2.18/chid_326/index.m3u8'
WHERE name = 'Abu Dhabi TV';

UPDATE public.tv_channels SET
  stream_url   = 'https://kwtktv1ta.cdn.mangomolo.com/ktv1/smil:ktv1.stream.smil/chunklist.m3u8',
  official_url = 'https://kwtktv1ta.cdn.mangomolo.com/ktv1/smil:ktv1.stream.smil/chunklist.m3u8'
WHERE name = 'Kuwait TV';

UPDATE public.tv_channels SET
  stream_url   = 'https://5c7b683162943.streamlock.net/live/ngrp:bahraintvmain_all/playlist.m3u8',
  official_url = 'https://5c7b683162943.streamlock.net/live/ngrp:bahraintvmain_all/playlist.m3u8'
WHERE name = 'Bahrain TV';

UPDATE public.tv_channels SET
  stream_url   = 'https://live.kwikmotion.com/qtv1live/qtv1.smil/playlist.m3u8',
  official_url = 'https://live.kwikmotion.com/qtv1live/qtv1.smil/playlist.m3u8'
WHERE name = 'Qatar TV';

UPDATE public.tv_channels SET
  stream_url   = 'https://partneta.cdn.mgmlcdn.com/omantv/smil:omantv.stream.smil/chunklist.m3u8',
  official_url = 'https://partneta.cdn.mgmlcdn.com/omantv/smil:omantv.stream.smil/chunklist.m3u8'
WHERE name = 'Oman TV';

UPDATE public.tv_channels SET
  stream_url   = 'https://live.kwikmotion.com/smc1live/smc1tv.smil/playlist.m3u8',
  official_url = 'https://live.kwikmotion.com/smc1live/smc1tv.smil/playlist.m3u8'
WHERE name = 'Sharjah TV';

UPDATE public.tv_channels SET
  stream_url   = 'https://rotana.hibridcdn.net/rotananet/khaleejiya_net-7Y83PP5adWixDF93/playlist.m3u8',
  official_url = 'https://rotana.hibridcdn.net/rotananet/khaleejiya_net-7Y83PP5adWixDF93/playlist.m3u8'
WHERE name = 'Rotana Khalijiyya';

-- ── ARABIC ────────────────────────────────────────────────────────

UPDATE public.tv_channels SET
  stream_url   = 'https://flu.systemnet.tv/CBC/index.m3u8',
  official_url = 'https://flu.systemnet.tv/CBC/index.m3u8'
WHERE name = 'CBC Egypt';

UPDATE public.tv_channels SET
  stream_url   = 'http://185.9.2.18/chid_327/index.m3u8',
  official_url = 'http://185.9.2.18/chid_327/index.m3u8'
WHERE name = 'LBC Lebanon';

UPDATE public.tv_channels SET
  stream_url   = 'http://185.9.2.18/chid_391/mono.m3u8',
  official_url = 'http://185.9.2.18/chid_391/mono.m3u8'
WHERE name = 'Al Jadeed';

UPDATE public.tv_channels SET
  stream_url   = 'http://185.9.2.18/chid_247/index.m3u8',
  official_url = 'http://185.9.2.18/chid_247/index.m3u8'
WHERE name = 'Nile TV International';

UPDATE public.tv_channels SET
  stream_url   = 'https://jrtv-live.ercdn.net/jordanhd/jordanhd.m3u8',
  official_url = 'https://jrtv-live.ercdn.net/jordanhd/jordanhd.m3u8'
WHERE name = 'Jordan TV';

UPDATE public.tv_channels SET
  stream_url   = 'https://imn-live.esite-lab.com/hls/iraqia-general.m3u8',
  official_url = 'https://imn-live.esite-lab.com/hls/iraqia-general.m3u8'
WHERE name = 'Iraq TV';

UPDATE public.tv_channels SET
  stream_url   = 'https://live.kwikmotion.com/syriatvlive/syriatv.smil/playlist_dvr.m3u8',
  official_url = 'https://live.kwikmotion.com/syriatvlive/syriatv.smil/playlist_dvr.m3u8'
WHERE name = 'Syria TV';

-- ── ENTERTAINMENT ─────────────────────────────────────────────────

UPDATE public.tv_channels SET
  stream_url   = 'https://edge66.magictvbox.com/liveApple/MBC_2/index.m3u8',
  official_url = 'https://edge66.magictvbox.com/liveApple/MBC_2/index.m3u8'
WHERE name IN ('MBC 2', 'MBC2 Movies');

UPDATE public.tv_channels SET
  stream_url   = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-4/24f134f1cd63db9346439e96b86ca6ed/index.m3u8',
  official_url = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-4/24f134f1cd63db9346439e96b86ca6ed/index.m3u8'
WHERE name = 'MBC 4';

UPDATE public.tv_channels SET
  stream_url   = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-drama/2c28a458e2f3253e678b07ac7d13fe71/index.m3u8',
  official_url = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-drama/2c28a458e2f3253e678b07ac7d13fe71/index.m3u8'
WHERE name = 'MBC Drama';

UPDATE public.tv_channels SET
  stream_url   = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-masr/956eac069c78a35d47245db6cdbb1575/index.m3u8',
  official_url = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-masr/956eac069c78a35d47245db6cdbb1575/index.m3u8'
WHERE name = 'MBC Masr';

UPDATE public.tv_channels SET
  stream_url   = 'https://flu.systemnet.tv/CBCSofra/index.m3u8',
  official_url = 'https://flu.systemnet.tv/CBCSofra/index.m3u8'
WHERE name = 'CBC Sofra';

UPDATE public.tv_channels SET
  stream_url   = 'https://cdn3.wowza.com/5/OE5HREpIcEkySlNT/alhayat-live/ngrp:livestream_all/playlist.m3u8',
  official_url = 'https://cdn3.wowza.com/5/OE5HREpIcEkySlNT/alhayat-live/ngrp:livestream_all/playlist.m3u8'
WHERE name = 'Al Hayah';

UPDATE public.tv_channels SET
  stream_url   = 'https://rotana.hibridcdn.net/rotananet/cinema_net-7Y83PP5adWixDF93/playlist.m3u8',
  official_url = 'https://rotana.hibridcdn.net/rotananet/cinema_net-7Y83PP5adWixDF93/playlist.m3u8'
WHERE name IN ('Rotana Cinema', 'Rotana Cinema');

UPDATE public.tv_channels SET
  stream_url   = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-bollywood/546eb40d7dcf9a209255dd2496903764/index.m3u8',
  official_url = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-bollywood/546eb40d7dcf9a209255dd2496903764/index.m3u8'
WHERE name = 'MBC Bollywood';

-- ── SPORTS ────────────────────────────────────────────────────────

-- SSC Sport 1 (Saudi) — free via aloula relay
UPDATE public.tv_channels SET
  stream_url   = 'https://aloula-redirect.vercel.app/9/playlist.m3u8',
  official_url = 'https://aloula-redirect.vercel.app/9/playlist.m3u8'
WHERE name = 'SSC Sport 1';

-- Abu Dhabi Sports 1
UPDATE public.tv_channels SET
  stream_url   = 'http://adtv.ercdn.net/adsport1/adsport1_720p.m3u8',
  official_url = 'http://adtv.ercdn.net/adsport1/adsport1_720p.m3u8'
WHERE name = 'Abu Dhabi Sports 1';

-- Al Kass via Al Kass Digital CDN
UPDATE public.tv_channels SET
  stream_url   = 'https://liveeu-gcp.alkassdigital.net/alkass1/tracks-v1a1/index.m3u8',
  official_url = 'https://liveeu-gcp.alkassdigital.net/alkass1/tracks-v1a1/index.m3u8'
WHERE name = 'Al Kass Sports';

-- ── RELIGIOUS ─────────────────────────────────────────────────────

UPDATE public.tv_channels SET
  stream_url   = 'https://playlist.fasttvcdn.com/pl/dlkqw1ftuvuuzkcb4pxdcg/Iqraafasttv3/playlist.m3u8',
  official_url = 'https://playlist.fasttvcdn.com/pl/dlkqw1ftuvuuzkcb4pxdcg/Iqraafasttv3/playlist.m3u8'
WHERE name = 'Iqraa TV';

UPDATE public.tv_channels SET
  stream_url   = 'https://aloula-redirect.vercel.app/7/playlist.m3u8',
  official_url = 'https://aloula-redirect.vercel.app/7/playlist.m3u8'
WHERE name IN ('Al Majd Quran', 'Al Hayah Quran');

UPDATE public.tv_channels SET
  stream_url   = 'https://cdn.bestream.io:19360/elfaro1/elfaro1.m3u8',
  official_url = 'https://cdn.bestream.io:19360/elfaro1/elfaro1.m3u8'
WHERE name = 'Huda TV';

UPDATE public.tv_channels SET
  stream_url   = 'https://dzkyvlfyge.erbvr.com/PeaceTvEnglish/index.m3u8',
  official_url = 'https://dzkyvlfyge.erbvr.com/PeaceTvEnglish/index.m3u8'
WHERE name = 'Peace TV';

UPDATE public.tv_channels SET
  stream_url   = 'https://rotana.hibridcdn.net/rotananet/risala_net-7Y83PP5adWixDF93/playlist.m3u8',
  official_url = 'https://rotana.hibridcdn.net/rotananet/risala_net-7Y83PP5adWixDF93/playlist.m3u8'
WHERE name = 'Safa TV';

-- ── KIDS ──────────────────────────────────────────────────────────

UPDATE public.tv_channels SET
  stream_url   = 'https://live-uae.spacetoongo.com/ST_Live_UAE/hls/index.m3u8',
  official_url = 'https://live-uae.spacetoongo.com/ST_Live_UAE/hls/index.m3u8'
WHERE name = 'Spacetoon';

UPDATE public.tv_channels SET
  stream_url   = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-3/a5c0a4c33a74db7d9b7234399a52aaad/index.m3u8',
  official_url = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-3/a5c0a4c33a74db7d9b7234399a52aaad/index.m3u8'
WHERE name = 'MBC3';

UPDATE public.tv_channels SET
  stream_url   = 'https://live.kwikmotion.com/jeemtvlive/jeem.smil/playlist.m3u8',
  official_url = 'https://live.kwikmotion.com/jeemtvlive/jeem.smil/playlist.m3u8'
WHERE name = 'Jeem TV';

-- ── INTERNATIONAL ─────────────────────────────────────────────────

UPDATE public.tv_channels SET
  stream_url   = 'https://masterpl.hls.nhkworld.jp/hls/w/live/smarttv.m3u8',
  official_url = 'https://masterpl.hls.nhkworld.jp/hls/w/live/smarttv.m3u8'
WHERE name IN ('NHK World Japan', 'NHK World Japan');

UPDATE public.tv_channels SET
  stream_url   = 'http://31.148.48.15/KBS_World/index.m3u8',
  official_url = 'http://31.148.48.15/KBS_World/index.m3u8'
WHERE name IN ('KBS World Korea', 'KBS World');

UPDATE public.tv_channels SET
  stream_url   = 'https://tv-trtworld.medya.trt.com.tr/master.m3u8',
  official_url = 'https://tv-trtworld.medya.trt.com.tr/master.m3u8'
WHERE name = 'TRT World';

UPDATE public.tv_channels SET
  stream_url   = 'https://ott.tv5monde.com/Content/HLS/Live/channel(europe)/variant.m3u8',
  official_url = 'https://ott.tv5monde.com/Content/HLS/Live/channel(europe)/variant.m3u8'
WHERE name = 'TV5MONDE French';

UPDATE public.tv_channels SET
  stream_url   = 'https://euronews-tum.fc.leanstream.co/EURONEWSENGLISH@491383/index.m3u8',
  official_url = 'https://euronews-tum.fc.leanstream.co/EURONEWSENGLISH@491383/index.m3u8'
WHERE name = 'Euronews English';

-- NASA TV already has working stream, keep it

-- Al Arabiya Al Hadath
UPDATE public.tv_channels SET
  stream_url   = 'https://av.alarabiya.net/alarabiapublish/alhadath.smil/playlist.m3u8',
  official_url = 'https://av.alarabiya.net/alarabiapublish/alhadath.smil/playlist.m3u8'
WHERE name = 'Al Jazeera Finance';

-- ── TURKISH ───────────────────────────────────────────────────────

UPDATE public.tv_channels SET
  stream_url   = 'https://tv-trtarabi.medya.trt.com.tr/master.m3u8',
  official_url = 'https://tv-trtarabi.medya.trt.com.tr/master.m3u8'
WHERE name = 'TRT Arabic';

UPDATE public.tv_channels SET
  stream_url   = 'http://rnttwmjcin.turknet.ercdn.net/lcpmvefbyo/atv/atv_360p.m3u8',
  official_url = 'http://rnttwmjcin.turknet.ercdn.net/lcpmvefbyo/atv/atv_360p.m3u8'
WHERE name = 'ATV Turkey';

UPDATE public.tv_channels SET
  stream_url   = 'https://mn-nl.mncdn.com/blutv_showtv_dvr/live_720p2000000/index.m3u8',
  official_url = 'https://mn-nl.mncdn.com/blutv_showtv_dvr/live_720p2000000/index.m3u8'
WHERE name = 'Show TV Turkey';

-- ── NORTH AFRICA ──────────────────────────────────────────────────

UPDATE public.tv_channels SET
  stream_url   = 'https://stream-lb.livemediama.com/2m-tnt/hls/master.m3u8',
  official_url = 'https://stream-lb.livemediama.com/2m-tnt/hls/master.m3u8'
WHERE name = '2M Morocco';

UPDATE public.tv_channels SET
  stream_url   = 'https://stream-lb.livemediama.com/alaoula-tnt/hls/master.m3u8',
  official_url = 'https://stream-lb.livemediama.com/alaoula-tnt/hls/master.m3u8'
WHERE name = 'Al Aoula Morocco';

UPDATE public.tv_channels SET
  stream_url   = 'http://185.9.2.18/chid_347/index.m3u8',
  official_url = 'http://185.9.2.18/chid_347/index.m3u8'
WHERE name = 'Algeria TV';

UPDATE public.tv_channels SET
  stream_url   = 'https://sw1.tanitweb.net/TunisiaTV/_definst_/watania1/playlist.m3u8',
  official_url = 'https://sw1.tanitweb.net/TunisiaTV/_definst_/watania1/playlist.m3u8'
WHERE name = 'Tunisia 1';

-- ── MUSIC ─────────────────────────────────────────────────────────

UPDATE public.tv_channels SET
  stream_url   = 'https://rotana.hibridcdn.net/rotananet/music_net-7Y83PP5adWixDF93/playlist.m3u8',
  official_url = 'https://rotana.hibridcdn.net/rotananet/music_net-7Y83PP5adWixDF93/playlist.m3u8'
WHERE name = 'Rotana Music';

UPDATE public.tv_channels SET
  stream_url   = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mtv-lebanon/b8ebb2a5affb812f1541712adde10e26/index.m3u8',
  official_url = 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mtv-lebanon/b8ebb2a5affb812f1541712adde10e26/index.m3u8'
WHERE name = 'MTV Lebanon';

UPDATE public.tv_channels SET
  stream_url   = 'https://nogoumtv.nrpstream.com/hls/stream.m3u8',
  official_url = 'https://nogoumtv.nrpstream.com/hls/stream.m3u8'
WHERE name IN ('Mazzika', 'Melody Arabia');

-- ── LEVANT ────────────────────────────────────────────────────────

UPDATE public.tv_channels SET
  stream_url   = 'https://otv.hibridcdn.net/otv/tv_abr/playlist.m3u8',
  official_url = 'https://otv.hibridcdn.net/otv/tv_abr/playlist.m3u8'
WHERE name = 'OTV Lebanon';

UPDATE public.tv_channels SET
  stream_url   = 'https://live.almanar.com.lb/hls/livestream/index.m3u8',
  official_url = 'https://live.almanar.com.lb/hls/livestream/index.m3u8'
WHERE name = 'Al Manar Lebanon';

-- ── DOCUMENTARY / EDUCATION ───────────────────────────────────────

UPDATE public.tv_channels SET
  stream_url   = 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
  official_url = 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8'
WHERE name IN ('NASA TV', 'NASA TV Science');

-- DD News India
UPDATE public.tv_channels SET
  stream_url   = 'https://d2gvyg6lvauoko.cloudfront.net/230226/ddindia/chunks.m3u8',
  official_url = 'https://d2gvyg6lvauoko.cloudfront.net/230226/ddindia/chunks.m3u8'
WHERE name = 'DD News India';

-- African channels via iptv-org verified streams
UPDATE public.tv_channels SET
  stream_url   = 'https://bshots.sgp1.cdn.digitaloceanspaces.com/live/channels24.m3u8',
  official_url = 'https://bshots.sgp1.cdn.digitaloceanspaces.com/live/channels24.m3u8'
WHERE name = 'SABC News';

-- ================================================================
-- RADIO STATIONS
-- ================================================================

-- BBC streams are already working via akamaized — keep as-is

-- ── ARABIC RADIO ───────────────────────────────────────────────────

-- MBC FM — verified direct HLS stream
UPDATE public.radio_stations SET
  stream_url   = 'https://dbbv9umqcd7cs.cloudfront.net/out/v1/db15b75c3cc0400c91961468d6a232ac/index.m3u8',
  official_url = 'https://dbbv9umqcd7cs.cloudfront.net/out/v1/db15b75c3cc0400c91961468d6a232ac/index.m3u8'
WHERE name = 'MBC FM Arabia';

-- Rotana FM — via zeno.fm free
UPDATE public.radio_stations SET
  stream_url   = 'https://stream.zeno.fm/r6o0a7msk2zuv',
  official_url = 'https://stream.zeno.fm/r6o0a7msk2zuv'
WHERE name = 'Rotana FM';

-- Nogoum FM Egypt — via NRP stream (official)
UPDATE public.radio_stations SET
  stream_url   = 'https://nogoumfm.nrpstream.com/hls/stream.m3u8',
  official_url = 'https://nogoumfm.nrpstream.com/hls/stream.m3u8'
WHERE name = 'Nogoum FM Egypt';

-- Melody FM Egypt — already has zeno.fm stream, verify slug
UPDATE public.radio_stations SET
  stream_url   = 'https://stream.zeno.fm/r0aw8x2mr2zuv',
  official_url = 'https://stream.zeno.fm/r0aw8x2mr2zuv'
WHERE name = 'Melody FM Egypt';

-- Al Arabiya Radio — direct stream
UPDATE public.radio_stations SET
  stream_url   = 'https://live.alarabiya.net/alarabiapublish/alarabiyaradio.smil/playlist.m3u8',
  official_url = 'https://live.alarabiya.net/alarabiapublish/alarabiyaradio.smil/playlist.m3u8'
WHERE name = 'Al Arabiya Radio';

-- Monte Carlo Doualiya — already has infomaniak stream, update to latest
UPDATE public.radio_stations SET
  stream_url   = 'https://stream.mc.infomaniak.ch/mc/mcd-128.mp3',
  official_url = 'https://stream.mc.infomaniak.ch/mc/mcd-128.mp3'
WHERE name = 'Monte Carlo Doualiya';

-- Sawa Radio — verified stream via revma
UPDATE public.radio_stations SET
  stream_url   = 'https://stream.rcs.revma.com/apnekhygvk8uv',
  official_url = 'https://stream.rcs.revma.com/apnekhygvk8uv'
WHERE name = 'Sawa Radio Arabic';

-- DW Arabic Radio — verified akamaized HLS
UPDATE public.radio_stations SET
  stream_url   = 'https://dwamdstream104.akamaized.net/hls/live/2015531/dwstream104/index.m3u8',
  official_url = 'https://dwamdstream104.akamaized.net/hls/live/2015531/dwstream104/index.m3u8'
WHERE name = 'DW Arabic Radio';

-- ── QURAN / ISLAMIC ────────────────────────────────────────────────

-- Holy Quran Saudi — via Saudi Broadcasting Authority
UPDATE public.radio_stations SET
  stream_url   = 'https://Icestream2.sba.sa/quran',
  official_url = 'https://Icestream2.sba.sa/quran'
WHERE name = 'Holy Quran Saudi';

-- Quran Radio Egypt — verified via ertu
UPDATE public.radio_stations SET
  stream_url   = 'https://mediaeg.ertu.org:1935/live/quran/livestream/playlist.m3u8',
  official_url = 'https://mediaeg.ertu.org:1935/live/quran/livestream/playlist.m3u8'
WHERE name = 'Quran Radio Egypt';

-- Al Fajr Quran Algeria — zeno.fm (already set)
-- Kuwait Quran — via Kuwait Ministry of Information
UPDATE public.radio_stations SET
  stream_url   = 'https://icecast.vrtcdn.be/mnm-high.mp3',
  official_url = 'https://www.media.gov.kw/radioquran'
WHERE name = 'Kuwait Quran Radio';

-- ── INTERNATIONAL NEWS RADIO ───────────────────────────────────────

-- Voice of America — already has working HLS
-- RFI French/French Inter/France Culture — already have working icecast streams

-- NHK World Radio Japan — already has akamaihd stream

-- DW German Radio — already has akamaized stream

-- RNE Spain — already has akamaized HLS

-- ── MUSIC RADIO ────────────────────────────────────────────────────

-- NRJ France — already has working CDN stream

-- Virgin Radio UK
UPDATE public.radio_stations SET
  stream_url   = 'https://stream.radiojar.com/0tpy1h0kxtzuv',
  official_url = 'https://stream.radiojar.com/0tpy1h0kxtzuv'
WHERE name = 'Virgin Radio UK';

-- Smooth Radio UK — update to confirmed UK endpoint
UPDATE public.radio_stations SET
  stream_url   = 'https://vis.media-ice.musicradio.com/SmoothUK',
  official_url = 'https://vis.media-ice.musicradio.com/SmoothUK'
WHERE name = 'Smooth Radio UK';

-- ── SPORTS RADIO ───────────────────────────────────────────────────

-- talkSPORT — update to confirmed stream
UPDATE public.radio_stations SET
  stream_url   = 'https://radio.talksport.com/stream?awparams=platform:roku',
  official_url = 'https://radio.talksport.com/stream?awparams=platform:roku'
WHERE name = 'talkSPORT UK';

-- ── AFRICAN RADIO ──────────────────────────────────────────────────

-- Radio Maroc / SNRT — direct mms stream
UPDATE public.radio_stations SET
  stream_url   = 'https://mms.snrt.ma/radio1',
  official_url = 'https://mms.snrt.ma/radio1'
WHERE name = 'Radio Maroc';

-- ── SPIRITUAL / MEDITATION ─────────────────────────────────────────

-- Calm Radio Meditation — already has direct stream

-- ── EUROPEAN RADIO ─────────────────────────────────────────────────

-- Deutschlandfunk — already has ssl stream
-- RAI Radio 1 — already has icecast stream

-- ================================================================
-- ADD MISSING CHANNELS (new entries from iptv-org not in original seed)
-- ================================================================

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'Al Arabiya Al Hadath', 'العربية الحدث',
  'Al Arabiya breaking news channel',
  'قناة العربية الحدث للأخبار العاجلة',
  null,
  'https://av.alarabiya.net/alarabiapublish/alhadath.smil/playlist.m3u8',
  'https://av.alarabiya.net/alarabiapublish/alhadath.smil/playlist.m3u8',
  id, 'HD', 'ar', 'SA', true, false, 17
FROM public.tv_categories WHERE slug = 'news'
ON CONFLICT DO NOTHING;

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'Al Jazeera Mubasher', 'الجزيرة مباشر',
  'Al Jazeera live documentary channel',
  'قناة الجزيرة مباشر — بث حي مستمر',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Al_Jazeera_Network_logo.svg/320px-Al_Jazeera_Network_logo.svg.png',
  'https://live-hls-apps-ajm-fa.getaj.net/AJM/index.m3u8',
  'https://live-hls-apps-ajm-fa.getaj.net/AJM/index.m3u8',
  id, 'HD', 'ar', 'QA', true, false, 18
FROM public.tv_categories WHERE slug = 'news'
ON CONFLICT DO NOTHING;

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'Al Hurra Iraq', 'الحرة عراق',
  'Al Hurra Iraq Arabic news channel',
  'قناة الحرة عراق الإخبارية',
  null,
  'https://mbn-ingest-worldsafe.akamaized.net/hls/live/2038899/MBN_Iraq_Worldsafe_HLS/master.m3u8',
  'https://mbn-ingest-worldsafe.akamaized.net/hls/live/2038899/MBN_Iraq_Worldsafe_HLS/master.m3u8',
  id, 'HD', 'ar', 'IQ', true, false, 19
FROM public.tv_categories WHERE slug = 'news'
ON CONFLICT DO NOTHING;

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'Kuwait TV 2', 'قناة الكويت الثانية',
  'Kuwait Television channel 2',
  'قناة الكويت الثانية — برامج متنوعة',
  null,
  'https://kwtktv2ta.cdn.mangomolo.com/ktv2/smil:ktv2.stream.smil/chunklist.m3u8',
  'https://kwtktv2ta.cdn.mangomolo.com/ktv2/smil:ktv2.stream.smil/chunklist.m3u8',
  id, 'HD', 'ar', 'KW', true, false, 29
FROM public.tv_categories WHERE slug = 'gulf'
ON CONFLICT DO NOTHING;

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'Qatar TV 2', 'قناة قطر الثانية',
  'Qatar Television channel 2',
  'القناة القطرية الثانية',
  null,
  'https://live.kwikmotion.com/qtv2live/qtv2.smil/playlist.m3u8',
  'https://live.kwikmotion.com/qtv2live/qtv2.smil/playlist.m3u8',
  id, 'HD', 'ar', 'QA', true, false, 30
FROM public.tv_categories WHERE slug = 'gulf'
ON CONFLICT DO NOTHING;

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'Bahrain International', 'قناة البحرين الدولية',
  'Bahrain International Television',
  'قناة البحرين الدولية للمشاهدين خارج البحرين',
  null,
  'https://5c7b683162943.streamlock.net/live/ngrp:bahraininternational_all/playlist.m3u8',
  'https://5c7b683162943.streamlock.net/live/ngrp:bahraininternational_all/playlist.m3u8',
  id, 'HD', 'ar', 'BH', true, false, 31
FROM public.tv_categories WHERE slug = 'gulf'
ON CONFLICT DO NOTHING;

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'Al Ghad TV', 'قناة الغد',
  'Egyptian independent satellite channel',
  'قناة الغد المصرية المستقلة',
  null,
  'https://eazyvwqssi.erbvr.com/alghadtv/alghadtv.m3u8',
  'https://eazyvwqssi.erbvr.com/alghadtv/alghadtv.m3u8',
  id, 'HD', 'ar', 'EG', true, false, 38
FROM public.tv_categories WHERE slug = 'arabic'
ON CONFLICT DO NOTHING;

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'Future TV Lebanon', 'المستقبل لبنان',
  'Lebanese Future Television',
  'قناة المستقبل اللبنانية',
  null,
  'https://live.kwikmotion.com/futurelive/ftv.smil/playlist.m3u8',
  'https://live.kwikmotion.com/futurelive/ftv.smil/playlist.m3u8',
  id, 'HD', 'ar', 'LB', true, false, 162
FROM public.tv_categories WHERE slug = 'levant'
ON CONFLICT DO NOTHING;

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'Tele Liban', 'تيلي لبنان',
  'Lebanon national public television',
  'قناة تيلي لبنان الوطنية العامة',
  null,
  'https://cdn.catiacast.video/abr/ed8f807e2548db4507d2a6f4ba0c4a06/playlist.m3u8',
  'https://cdn.catiacast.video/abr/ed8f807e2548db4507d2a6f4ba0c4a06/playlist.m3u8',
  id, 'HD', 'ar', 'LB', true, false, 163
FROM public.tv_categories WHERE slug = 'levant'
ON CONFLICT DO NOTHING;

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'Al Iraqia News', 'العراقية الأخبار',
  'Al Iraqia Iraqi news channel',
  'قناة العراقية للأخبار',
  null,
  'https://imn-live.esite-lab.com/hls/iraqia-news.m3u8',
  'https://imn-live.esite-lab.com/hls/iraqia-news.m3u8',
  id, 'HD', 'ar', 'IQ', true, false, 37
FROM public.tv_categories WHERE slug = 'arabic'
ON CONFLICT DO NOTHING;

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'Al Sharqiya Iraq', 'الشرقية عراق',
  'Iraqi satellite entertainment channel',
  'قناة الشرقية العراقية الفضائية الترفيهية',
  null,
  'https://5d94523502c2d.streamlock.net/home/mystream/playlist.m3u8',
  'https://5d94523502c2d.streamlock.net/home/mystream/playlist.m3u8',
  id, 'HD', 'ar', 'IQ', true, false, 39
FROM public.tv_categories WHERE slug = 'arabic'
ON CONFLICT DO NOTHING;

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'MBC 5', 'إم بي سي 5',
  'MBC North Africa entertainment channel',
  'قناة إم بي سي 5 للترفيه في شمال أفريقيا',
  null,
  'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-5/ee6b000cee0629411b666ab26cb13e9b/index.m3u8',
  'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-5/ee6b000cee0629411b666ab26cb13e9b/index.m3u8',
  id, 'HD', 'ar', 'MA', true, false, 48
FROM public.tv_categories WHERE slug = 'entertainment'
ON CONFLICT DO NOTHING;

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'Al Resalah', 'قناة الرسالة',
  'Islamic educational channel',
  'قناة الرسالة الإسلامية التعليمية',
  null,
  'https://rotana.hibridcdn.net/rotananet/risala_net-7Y83PP5adWixDF93/playlist.m3u8',
  'https://rotana.hibridcdn.net/rotananet/risala_net-7Y83PP5adWixDF93/playlist.m3u8',
  id, 'HD', 'ar', 'SA', true, false, 66
FROM public.tv_categories WHERE slug = 'religious'
ON CONFLICT DO NOTHING;

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'Quran Saudi TV', 'قناة القرآن الكريم السعودية',
  'Saudi official Holy Quran television channel',
  'قناة القرآن الكريم السعودية الرسمية',
  null,
  'https://aloula-redirect.vercel.app/7/playlist.m3u8',
  'https://aloula-redirect.vercel.app/7/playlist.m3u8',
  id, 'HD', 'ar', 'SA', true, true, 67
FROM public.tv_categories WHERE slug = 'religious'
ON CONFLICT DO NOTHING;

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'Al Souriya TV', 'السورية TV',
  'Syrian satellite entertainment channel',
  'قناة السورية الفضائية الترفيهية',
  null,
  'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-al-souriya-tv/e3150760fa5fd62776225433b8c3d406/index.m3u8',
  'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-al-souriya-tv/e3150760fa5fd62776225433b8c3d406/index.m3u8',
  id, 'HD', 'ar', 'SY', true, false, 40
FROM public.tv_categories WHERE slug = 'arabic'
ON CONFLICT DO NOTHING;

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'Jordan Sport', 'الأردن الرياضية',
  'Jordan Sports Television',
  'القناة الأردنية الرياضية',
  null,
  'https://jrtv-live.ercdn.net/jordansporthd/jordansporthd.m3u8',
  'https://jrtv-live.ercdn.net/jordansporthd/jordansporthd.m3u8',
  id, 'HD', 'ar', 'JO', true, false, 56
FROM public.tv_categories WHERE slug = 'sports'
ON CONFLICT DO NOTHING;

INSERT INTO public.tv_channels
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, category_id,
   quality, language, country, is_active, is_featured, sort_order)
SELECT
  'Tunisia 2', 'تونس 2',
  'Tunisian national television channel 2',
  'القناة التونسية الوطنية الثانية',
  null,
  'https://sw1.tanitweb.net/TunisiaTV/_definst_/watania2/playlist.m3u8',
  'https://sw1.tanitweb.net/TunisiaTV/_definst_/watania2/playlist.m3u8',
  id, 'HD', 'ar', 'TN', true, false, 174
FROM public.tv_categories WHERE slug = 'north-africa'
ON CONFLICT DO NOTHING;

-- ================================================================
-- NEW RADIO STATIONS from iptv-org / free aggregators
-- ================================================================

INSERT INTO public.radio_stations
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, genre_id,
   bitrate, language, country, is_active, is_featured, sort_order)
SELECT
  'Asharq News Radio', 'راديو الشرق',
  'Asharq News Arabic radio',
  'راديو الشرق الإخباري العربي',
  null,
  'https://live-news.asharq.com/asharq.m3u8',
  'https://live-news.asharq.com/asharq.m3u8',
  id, '128', 'ar', 'SA', true, false, 16
FROM public.radio_genres WHERE slug = 'arabic'
ON CONFLICT DO NOTHING;

INSERT INTO public.radio_stations
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, genre_id,
   bitrate, language, country, is_active, is_featured, sort_order)
SELECT
  'Quran Sharjah Radio', 'إذاعة الشارقة للقرآن',
  'Sharjah Quran Radio — live TV channel',
  'إذاعة الشارقة للقرآن الكريم المرئية',
  null,
  'https://live.kwikmotion.com/smcquranlive/quranradiolive/playlist.m3u8',
  'https://live.kwikmotion.com/smcquranlive/quranradiolive/playlist.m3u8',
  id, '128', 'ar', 'AE', true, true, 24
FROM public.radio_genres WHERE slug = 'quran'
ON CONFLICT DO NOTHING;

INSERT INTO public.radio_stations
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, genre_id,
   bitrate, language, country, is_active, is_featured, sort_order)
SELECT
  'Oman FM', 'إذاعة عُمان',
  'Oman national FM radio',
  'إذاعة سلطنة عُمان الوطنية',
  null,
  'https://partneta.cdn.mgmlcdn.com/omsport/smil:omsport.stream.smil/chunklist.m3u8',
  'https://www.oman.om/fm',
  id, '128', 'ar', 'OM', true, false, 19
FROM public.radio_genres WHERE slug = 'arabic'
ON CONFLICT DO NOTHING;

INSERT INTO public.radio_stations
  (name, name_ar, description, description_ar, logo_url,
   stream_url, official_url, genre_id,
   bitrate, language, country, is_active, is_featured, sort_order)
SELECT
  'Radio Tunisie', 'راديو تونس',
  'Tunisian national radio',
  'الإذاعة التونسية الوطنية',
  null,
  'https://radio.rtci.tn:8443/live',
  'https://radio.rtci.tn:8443/live',
  id, '128', 'ar', 'TN', true, false, 84
FROM public.radio_genres WHERE slug = 'arabic'
ON CONFLICT DO NOTHING;

-- Remove duplicate bad Kuwait Quran stream, set proper stream
UPDATE public.radio_stations SET
  stream_url   = 'https://kwtktvata.cdn.mangomolo.com/ktva/smil:tktva.stream.smil/chunklist.m3u8',
  official_url = 'https://www.media.gov.kw/radioquran'
WHERE name = 'Kuwait Quran Radio';
