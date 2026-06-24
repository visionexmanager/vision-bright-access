-- Media catalog cleanup and live stream audit, 2026-06-24.
-- Every URL below was checked by loading its HLS playlist and a child
-- playlist/segment, or by reading bytes from the live audio response.

-- Keep one row for literal duplicate names. Prefer a direct HTTPS stream.
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY lower(btrim(name))
      ORDER BY
        CASE WHEN stream_url LIKE 'https://%' THEN 0 ELSE 1 END,
        updated_at DESC,
        created_at ASC,
        id
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY lower(btrim(name))
      ORDER BY
        CASE WHEN stream_url LIKE 'https://%' THEN 0 ELSE 1 END,
        updated_at DESC,
        created_at ASC,
        id
    ) AS duplicate_number
  FROM public.tv_channels
),
duplicates AS (
  SELECT id, keep_id FROM ranked WHERE duplicate_number > 1
)
UPDATE public.tv_stream_tokens AS token
SET channel_id = duplicates.keep_id
FROM duplicates
WHERE token.channel_id = duplicates.id;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY lower(btrim(name))
      ORDER BY
        CASE WHEN stream_url LIKE 'https://%' THEN 0 ELSE 1 END,
        updated_at DESC,
        created_at ASC,
        id
    ) AS duplicate_number
  FROM public.tv_channels
)
DELETE FROM public.tv_channels AS channel
USING ranked
WHERE channel.id = ranked.id
  AND ranked.duplicate_number > 1;

WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY lower(btrim(name))
      ORDER BY
        CASE WHEN stream_url LIKE 'https://%' THEN 0 ELSE 1 END,
        updated_at DESC,
        created_at ASC,
        id
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY lower(btrim(name))
      ORDER BY
        CASE WHEN stream_url LIKE 'https://%' THEN 0 ELSE 1 END,
        updated_at DESC,
        created_at ASC,
        id
    ) AS duplicate_number
  FROM public.radio_stations
),
duplicates AS (
  SELECT id, keep_id FROM ranked WHERE duplicate_number > 1
)
UPDATE public.radio_stream_tokens AS token
SET station_id = duplicates.keep_id
FROM duplicates
WHERE token.station_id = duplicates.id;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY lower(btrim(name))
      ORDER BY
        CASE WHEN stream_url LIKE 'https://%' THEN 0 ELSE 1 END,
        updated_at DESC,
        created_at ASC,
        id
    ) AS duplicate_number
  FROM public.radio_stations
)
DELETE FROM public.radio_stations AS station
USING ranked
WHERE station.id = ranked.id
  AND ranked.duplicate_number > 1;

-- Merge only clear alternate spellings/names for the same service.
WITH aliases(alias_name, canonical_name) AS (
  VALUES
    ('Al Arabiya Al Hadath', 'Al Hadath'),
    ('Quran TV Saudi', 'Quran Saudi TV'),
    ('MBC3', 'MBC 3'),
    ('Alghad TV', 'Al Ghad TV'),
    ('Rotana Khalijiah', 'Rotana Khalijiyya'),
    ('MBC2 Movies', 'MBC 2'),
    ('Al Jadeed Lebanon', 'Al Jadeed'),
    ('KBS World Korea', 'KBS World'),
    ('CNBC Arabic', 'CNBC Arabia'),
    ('Rotana Music TV', 'Rotana Music')
),
keepers AS (
  SELECT DISTINCT ON (aliases.alias_name)
    aliases.alias_name,
    channel.id AS keep_id
  FROM aliases
  JOIN public.tv_channels AS channel ON channel.name = aliases.canonical_name
  ORDER BY aliases.alias_name, channel.updated_at DESC, channel.id
),
duplicates AS (
  SELECT channel.id, keepers.keep_id
  FROM keepers
  JOIN public.tv_channels AS channel ON channel.name = keepers.alias_name
)
UPDATE public.tv_stream_tokens AS token
SET channel_id = duplicates.keep_id
FROM duplicates
WHERE token.channel_id = duplicates.id;

WITH aliases(alias_name, canonical_name) AS (
  VALUES
    ('Al Arabiya Al Hadath', 'Al Hadath'),
    ('Quran TV Saudi', 'Quran Saudi TV'),
    ('MBC3', 'MBC 3'),
    ('Alghad TV', 'Al Ghad TV'),
    ('Rotana Khalijiah', 'Rotana Khalijiyya'),
    ('MBC2 Movies', 'MBC 2'),
    ('Al Jadeed Lebanon', 'Al Jadeed'),
    ('KBS World Korea', 'KBS World'),
    ('CNBC Arabic', 'CNBC Arabia'),
    ('Rotana Music TV', 'Rotana Music')
)
DELETE FROM public.tv_channels AS channel
USING aliases
WHERE channel.name = aliases.alias_name
  AND EXISTS (
    SELECT 1
    FROM public.tv_channels AS canonical
    WHERE canonical.name = aliases.canonical_name
  );

WITH aliases(alias_name, canonical_name) AS (
  VALUES
    ('Monte Carlo Arabic (RFI)', 'Monte Carlo Doualiya'),
    ('MBC FM Arabia', 'MBC FM Saudi'),
    ('Rotana FM Saudi', 'Rotana FM'),
    ('Sawa Radio Arabic', 'Radio Sawa'),
    ('RFI French Radio', 'RFI French'),
    ('Vatican Radio Arabic', 'Radio Vatican Arabic'),
    ('Noor FM Dubai', 'Noor Dubai FM')
),
keepers AS (
  SELECT DISTINCT ON (aliases.alias_name)
    aliases.alias_name,
    station.id AS keep_id
  FROM aliases
  JOIN public.radio_stations AS station ON station.name = aliases.canonical_name
  ORDER BY aliases.alias_name, station.updated_at DESC, station.id
),
duplicates AS (
  SELECT station.id, keepers.keep_id
  FROM keepers
  JOIN public.radio_stations AS station ON station.name = keepers.alias_name
)
UPDATE public.radio_stream_tokens AS token
SET station_id = duplicates.keep_id
FROM duplicates
WHERE token.station_id = duplicates.id;

WITH aliases(alias_name, canonical_name) AS (
  VALUES
    ('Monte Carlo Arabic (RFI)', 'Monte Carlo Doualiya'),
    ('MBC FM Arabia', 'MBC FM Saudi'),
    ('Rotana FM Saudi', 'Rotana FM'),
    ('Sawa Radio Arabic', 'Radio Sawa'),
    ('RFI French Radio', 'RFI French'),
    ('Vatican Radio Arabic', 'Radio Vatican Arabic'),
    ('Noor FM Dubai', 'Noor Dubai FM')
)
DELETE FROM public.radio_stations AS station
USING aliases
WHERE station.name = aliases.alias_name
  AND EXISTS (
    SELECT 1
    FROM public.radio_stations AS canonical
    WHERE canonical.name = aliases.canonical_name
  );

-- Verified HTTPS television streams.
UPDATE public.tv_channels AS channel
SET
  stream_url = verified.url,
  official_url = verified.url,
  is_active = true
FROM (VALUES
  ('Al Jazeera Arabic', 'https://live-hls-web-aja-fa.thehlive.com/AJA/index.m3u8'),
  ('Al Jazeera English', 'https://live-hls-web-aje-fa.thehlive.com/AJE/index.m3u8'),
  ('France 24 Arabic', 'https://live.france24.com/hls/live/2037222-b/F24_AR_HI_HLS/master_2300.m3u8'),
  ('France 24 English', 'https://live.france24.com/hls/live/2037218-b/F24_EN_HI_HLS/master_2300.m3u8'),
  ('France 24 French', 'https://live.france24.com/hls/live/2037179-b/F24_FR_HI_HLS/master_2300.m3u8'),
  ('DW Arabic', 'https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/index.m3u8'),
  ('DW English', 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8'),
  ('BBC World News', 'https://vs-hls-push-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_news_channel_hd/mobile_wifi_main_hd_abr_v2.m3u8'),
  ('Al Arabiya', 'https://live.alarabiya.net/alarabiapublish/alarabiya.smil/playlist.m3u8'),
  ('Al Hadath', 'https://av.alarabiya.net/alarabiapublish/alhadath.smil/playlist.m3u8'),
  ('Sky News Arabia', 'https://live-stream.skynewsarabia.com/c-horizontal-channel/horizontal-stream/index.m3u8'),
  ('BBC Arabic', 'https://vs-hls-pushb-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_arabic_tv/mobile_wifi_main_hd_abr_v2.m3u8'),
  ('RT Arabic', 'https://rt-arb.rttv.com/dvr/rtarab/playlist.m3u8'),
  ('Saudi TV 1', 'https://aloula-redirect.vercel.app/2/playlist.m3u8'),
  ('Qatar TV', 'https://live.kwikmotion.com/qtv1live/qtv1.smil/playlist.m3u8'),
  ('CGTN Arabic', 'https://arabic-livews.cgtn.com/hls/LSveq57bErWLinBnxosqjisZ220802LSTefTAS9zc9mpU08y3np9TH220802cd/playlist.m3u8'),
  ('Bahrain TV', 'https://5c7b683162943.streamlock.net/live/ngrp:bahraintvmain_all/playlist.m3u8'),
  ('Al Mayadeen', 'https://mdnlv.cdn.octivid.com/almdn/smil:mpegts.stream.smil/playlist.m3u8'),
  ('Oman TV', 'https://partneta.cdn.mgmlcdn.com/omantv/smil:omantv.stream.smil/chunklist.m3u8'),
  ('MBC 1', 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-1/15cf99af5de54063fdabfefe66adc075/index.m3u8'),
  ('Al Jazeera Mubasher', 'https://live-hls-web-ajm-fa.thehlive.com/AJM/index.m3u8'),
  ('MBC Masr', 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-masr/956eac069c78a35d47245db6cdbb1575/index.m3u8'),
  ('MBC 4', 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-4/24f134f1cd63db9346439e96b86ca6ed/index.m3u8'),
  ('Al Resalah', 'https://rotana.hibridcdn.net/rotananet/risala_net-7Y83PP5adWixDF93/playlist.m3u8'),
  ('Sharjah TV', 'https://live.kwikmotion.com/smc1live/smc1tv.smil/playlist.m3u8'),
  ('Rotana Khalijiyya', 'https://rotana.hibridcdn.net/rotananet/khaleejiya_net-7Y83PP5adWixDF93/playlist.m3u8'),
  ('Qatar TV 2', 'https://live.kwikmotion.com/qtv2live/qtv2.smil/playlist.m3u8'),
  ('TRT Arabic', 'https://tv-trtarabi.medya.trt.com.tr/master.m3u8'),
  ('Jordan TV', 'https://jrtv-live.ercdn.net/jordanhd/jordanhd.m3u8'),
  ('Syria TV', 'https://live.kwikmotion.com/syriatvlive/syriatv.smil/playlist_dvr.m3u8'),
  ('Al Iraqia News', 'https://imn-live.esite-lab.com/hls/iraqia-news.m3u8'),
  ('Al Ghad TV', 'https://eazyvwqssi.erbvr.com/alghadtv/alghadtv.m3u8'),
  ('Al Sharqiya Iraq', 'https://5d94523502c2d.streamlock.net/home/mystream/playlist.m3u8'),
  ('Al Souriya TV', 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-al-souriya-tv/e3150760fa5fd62776225433b8c3d406/index.m3u8'),
  ('MBC Drama', 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-drama/2c28a458e2f3253e678b07ac7d13fe71/index.m3u8'),
  ('CBC Sofra', 'https://flu.systemnet.tv/CBCSofra/index.m3u8'),
  ('Rotana Cinema', 'https://rotana.hibridcdn.net/rotananet/cinema_net-7Y83PP5adWixDF93/playlist.m3u8'),
  ('MBC Bollywood', 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-bollywood/546eb40d7dcf9a209255dd2496903764/index.m3u8'),
  ('MBC 5', 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-5/ee6b000cee0629411b666ab26cb13e9b/index.m3u8'),
  ('Al Iraqiya', 'https://imn-live.esite-lab.com/hls/iraqia-general.m3u8'),
  ('Jordan Sport', 'https://jrtv-live.ercdn.net/jordansporthd/jordansporthd.m3u8'),
  ('TRT World', 'https://dash2.antik.sk/live/test_trt_world_atktv/playlist.m3u8'),
  ('Russia 24', 'https://stream8.cinerama.uz/1021/tracks-v1a1/mono.m3u8'),
  ('Huda TV', 'https://cdn.bestream.io:19360/elfaro1/elfaro1.m3u8'),
  ('Fox News', 'https://247preview.foxnews.com/hls/live/2020027/fncv3preview/primary.m3u8'),
  ('NHK World Japan', 'https://nhk.lls.pbs.org/index.m3u8'),
  ('MTV Lebanon', 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mtv-lebanon/b8ebb2a5affb812f1541712adde10e26/index.m3u8'),
  ('Rotana Classic', 'https://rotana.hibridcdn.net/rotananet/classical_net-7Y83PP5adWixDF93/playlist.m3u8'),
  ('Africanews English', 'https://c3c275b999764df8a2dd55ffe2996818.mediatailor.eu-west-1.amazonaws.com/v1/master/0547f18649bd788bec7b67b746e47670f558b6b2/production-LiveChannel-6576/bitok/eyJzdGlkIjoiOTU0NDAyODQtOTU0My00Yzc2LThmZjQtNDRhY2YwYmQxYTYwIiwibWt0IjoicGwiLCJjaCI6NjYwNiwicHRmIjo1fQ==/26036/africanews-en.m3u8'),
  ('NASA TV', 'https://stream.nasatv.com.mk/hls/nasatv_live.m3u8'),
  ('SAT-7 Arabic', 'https://svs.itworkscdn.net/sat7arabiclive/sat7arabic.smil/playlist_dvr.m3u8'),
  ('Aghapy TV', 'https://5b622f07944df.streamlock.net/aghapy.tv/aghapy.smil/playlist.m3u8'),
  ('Logos TV', 'https://streamer1.streamhost.org/salive/logosH/master.m3u8'),
  ('Al Jazeera Documentary', 'https://live-hls-web-ajd-fa.thehlive.com/AJD/index.m3u8'),
  ('Rotana Music', 'https://rotana.hibridcdn.net/rotananet/music_net-7Y83PP5adWixDF93/playlist.m3u8'),
  ('CNBC Arabia', 'https://cnbc-live.akamaized.net/cnbc/master.m3u8'),
  ('Bloomberg TV', 'https://bloomberg.com/media-manifest/streams/asia.m3u8'),
  ('TRT 1', 'https://tv-trt1.medya.trt.com.tr/master.m3u8'),
  ('TRT Haber', 'https://tv-trthaber.medya.trt.com.tr/master.m3u8'),
  ('NDTV India', 'https://raw.githubusercontent.com/amazeyourself/adaptive-streams/refs/heads/main/streams/in/YuppTV/NDTVIndia.m3u8'),
  ('Palestine TV', 'https://ncdn.telewebion.ir/palestine/live/playlist.m3u8'),
  ('Africa 24', 'https://africa24.vedge.infomaniak.com/livecast/ik:africa24/manifest.m3u8'),
  ('SABC News', 'https://sabconetanw.cdn.mangomolo.com/news/smil:news.stream.smil/master.m3u8'),
  ('Tele Liban', 'https://cdn.catiacast.video/abr/ed8f807e2548db4507d2a6f4ba0c4a06/playlist.m3u8'),
  ('Star Plus', 'https://trs1.aynaott.com/starplushd/index.m3u8'),
  ('Euronews English', 'https://dash4.antik.sk/live/test_euronews/playlist.m3u8')
) AS verified(name, url)
WHERE channel.name = verified.name;

-- Verified HTTPS radio streams.
UPDATE public.radio_stations AS station
SET
  stream_url = verified.url,
  official_url = verified.url,
  is_active = true
FROM (VALUES
  ('BBC World Service', 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service'),
  ('BBC Radio 1', 'https://a.files.bbci.co.uk/ms6/live/3441A116-B12E-4D2F-ACA8-C1984642FA4B/audio/simulcast/hls/nonuk/pc_hd_abr_v2/ak/bbc_radio_one.m3u8'),
  ('BBC Radio 2', 'https://a.files.bbci.co.uk/ms6/live/3441A116-B12E-4D2F-ACA8-C1984642FA4B/audio/simulcast/hls/nonuk/pc_hd_abr_v2/cf/bbc_radio_two.m3u8'),
  ('BBC Radio 4', 'https://as-hls-ww-live.akamaized.net/pool_55057080/live/ww/bbc_radio_fourfm/bbc_radio_fourfm.isml/bbc_radio_fourfm-audio=320000.norewind.m3u8'),
  ('BBC Radio 6 Music', 'https://as-hls-ww-live.akamaized.net/pool_81827798/live/ww/bbc_6music/bbc_6music.isml/bbc_6music-audio%3d320000.norewind.m3u8'),
  ('Monte Carlo Doualiya', 'https://montecarlodoualiya128k.ice.infomaniak.ch/mc-doualiya.mp3'),
  ('Abu Dhabi FM', 'https://admn-radio-cdn-lb.starzplayarabia.com/out/v1/admn_radio_enc/abudhabi_fm/abudhabi_fm_hls_nd/index.m3u8'),
  ('Deutsche Welle Radio', 'https://dw.audiostream.io/dw/1027/mp3/64/dw08'),
  ('France Inter', 'https://stream.radiofrance.fr/franceinter/franceinter_hifi.m3u8?id=radiofrance'),
  ('France Culture', 'https://icecast.radiofrance.fr/franceculture-hifi.aac'),
  ('Radio Swiss Jazz', 'https://stream.srg-ssr.ch/m/rsj/mp3_128'),
  ('Classical KING FM', 'https://classicalking.streamguys1.com/king-fm-aac-128k'),
  ('Virgin Radio UK', 'https://radio.virginradio.co.uk/stream'),
  ('Smooth Radio UK', 'https://media-ice.musicradio.com/SmoothUKMP3'),
  ('Sky News Arabia Radio', 'https://stream.skynewsarabia.com/hls/sna.m3u8'),
  ('Jazz 24', 'https://knkx-live-a.edge.audiocdn.com/6285_256k'),
  ('Classic FM UK', 'https://ice-the.musicradio.com/ClassicFMMP3'),
  ('France Musique', 'https://direct.francemusique.fr/live/francemusique-midfi.mp3'),
  ('Capital FM UK', 'https://capitalfm.cloudrad.io/stream'),
  ('Radio Pakistan', 'https://whmsonic.radio.gov.pk:7005/stream?type=http&nocache=12'),
  ('Radio Nacional Argentina', 'https://sa.mp3.icecast.magma.edge-access.net/sc_rad1'),
  ('Radio Swiss Classic', 'https://stream.srg-ssr.ch/m/rsc_it/mp3_128')
) AS verified(name, url)
WHERE station.name = verified.name;

-- Remove category/genre rows that have no remaining media.
DELETE FROM public.tv_categories AS category
WHERE NOT EXISTS (
  SELECT 1 FROM public.tv_channels AS channel
  WHERE channel.category_id = category.id
);

DELETE FROM public.radio_genres AS genre
WHERE NOT EXISTS (
  SELECT 1 FROM public.radio_stations AS station
  WHERE station.genre_id = genre.id
);
