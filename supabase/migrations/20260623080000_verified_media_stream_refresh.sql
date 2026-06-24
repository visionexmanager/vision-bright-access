-- Verified TV/radio stream refresh generated from a live reachability audit on 2026-06-23.
-- This migration keeps all TV channels and radio stations visible.
-- It only updates streams that were verified as playable and matched to the channel/station name.

UPDATE public.tv_channels AS ch
SET stream_url = v.url, official_url = v.url, is_active = true
FROM (VALUES
  ('Al Hadath', 'https://av.alarabiya.net/alarabiapublish/alhadath.smil/playlist.m3u8'),
  ('Sky News Arabia', 'https://stream.skynewsarabia.com/hls/sna_720.m3u8'),
  ('BBC World News', 'https://vs-hls-push-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_news_channel_hd/mobile_wifi_main_hd_abr_v2.m3u8'),
  ('BBC Arabic', 'https://vs-hls-pushb-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_arabic_tv/mobile_wifi_main_hd_abr_v2.m3u8'),
  ('RT Arabic', 'https://rt-arb.rttv.com/dvr/rtarab/playlist.m3u8'),
  ('CGTN Arabic', 'https://arabic-livews.cgtn.com/hls/LSveq57bErWLinBnxosqjisZ220802LSTefTAS9zc9mpU08y3np9TH220802cd/playlist.m3u8'),
  ('Iqraa', 'https://playlist.fasttvcdn.com/pl/dlkqw1ftuvuuzkcb4pxdcg/Iqraafasttv1/playlist.m3u8'),
  ('Al Alam', 'https://live2.alalam.ir/alalam.m3u8'),
  ('Africanews English', 'https://cdn-euronews.akamaized.net/live/eds/africanews-en/25049/index.m3u8'),
  ('Aghapy TV', 'https://5b622f07944df.streamlock.net/aghapy.tv/aghapy.smil/playlist.m3u8'),
  ('Logos TV', 'https://streamer1.streamhost.org/salive/logosH/master.m3u8'),
  ('Bloomberg TV', 'https://bloomberg.com/media-manifest/streams/asia.m3u8'),
  ('TRT Haber', 'https://tv-trthaber.medya.trt.com.tr/master.m3u8'),
  ('NDTV India', 'https://ndtvindiaelemarchana.akamaized.net/hls/live/2003679/ndtvindia/master.m3u8'),
  ('SABC News', 'https://sabconetanw.cdn.mangomolo.com/news/smil:news.stream.smil/master.m3u8'),
  ('Al Iraqia News', 'https://imn-live.esite-lab.com/hls/iraqia-news.m3u8'),
  ('Al Jazeera Arabic', 'https://www.youtube.com/embed/live_stream?channel=UCfiwzLy-8yKzIbsmZTzxDgw'),
  ('Al Jazeera English', 'https://www.youtube.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg'),
  ('France 24 French', 'https://www.youtube.com/embed/live_stream?channel=UC5aeU5hk31cLzq_sAExLVWg'),
  ('Al Hurra', 'https://www.youtube.com/embed/live_stream?channel=UCPVWMCUz9GGE8v7dkSwrpJA')
) AS v(name, url)
WHERE ch.name = v.name;

UPDATE public.radio_stations AS st
SET stream_url = v.url, official_url = v.url, is_active = true
FROM (VALUES
  ('Sky News Arabia Radio', 'https://stream.skynewsarabia.com/hls/sna.m3u8'),
  ('Moody Radio', 'https://playerservices.streamtheworld.com/api/livestream-redirect/KMBIFM.mp3'),
  ('Radio Algérie', 'https://radiochaine1.ice.infomaniak.ch/chaine1.mp3'),
  ('Radio Nacional Argentina', 'https://sa.mp3.icecast.magma.edge-access.net/sc_rad1'),
  ('Radio Vatican', 'https://radio.vaticannews.va/stream-en'),
  ('Radio Mozart', 'https://0nlineradio.radioho.st/0r-mozart?ref=visionex'),
  ('Tunisia Radio', 'https://azuracast.conceptradio.fr:8000/radio.mp3')
) AS v(name, url)
WHERE st.name = v.name;

-- Keep the full catalog visible. Some existing entries may still need better stream URLs,
-- but they should not be hidden while those replacements are being sourced.
UPDATE public.tv_channels
SET is_active = true;

UPDATE public.radio_stations
SET is_active = true;
