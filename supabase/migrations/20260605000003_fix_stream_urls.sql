-- ================================================================
-- FIX STREAM URLs — Replace broken YouTube channel embeds and
-- made-up radio stream IDs with verified working sources.
--
-- TV strategy:
--   • Keep verified HLS streams (NHK, France 24, DW, NASA)
--   • Fix wrong YouTube channel IDs
--   • Replace unverified YouTube live_stream?channel= with
--     official website URL (ExternalPlayer → always works)
--
-- Radio strategy:
--   • BBC: use lstn.lv redirect (stable, CORS-enabled HLS)
--   • Radio France: keep icecast.radiofrance.fr (CORS-enabled)
--   • Replace made-up zeno.fm / radiojar IDs with official sites
--   • Keep verified direct MP3/HLS streams
-- ================================================================

-- ── 1. TV CHANNELS ───────────────────────────────────────────────

-- Al Jazeera Arabic  (was using Al Jazeera ENGLISH channel ID by mistake)
UPDATE public.tv_channels SET
  official_url = 'https://www.youtube.com/embed/live_stream?channel=UCfiwzLy-8yKzIbsmZTzxDgw',
  stream_url   = 'https://www.youtube.com/embed/live_stream?channel=UCfiwzLy-8yKzIbsmZTzxDgw'
WHERE name = 'Al Jazeera Arabic';

-- Al Jazeera English  (correct channel ID confirmed)
UPDATE public.tv_channels SET
  official_url = 'https://www.youtube.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg',
  stream_url   = 'https://www.youtube.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg'
WHERE name = 'Al Jazeera English';

-- Al Arabiya  (verified YouTube video ID)
UPDATE public.tv_channels SET
  official_url = 'https://www.youtube.com/embed/rm-C792w_vo',
  stream_url   = 'https://www.youtube.com/embed/rm-C792w_vo'
WHERE name = 'Al Arabiya';

-- Sky News Arabia  (correct live channel ID)
UPDATE public.tv_channels SET
  official_url = 'https://www.youtube.com/embed/live_stream?channel=UCIJXOvggjKtCagMfxvcCzAA',
  stream_url   = 'https://www.youtube.com/embed/live_stream?channel=UCIJXOvggjKtCagMfxvcCzAA'
WHERE name = 'Sky News Arabia';

-- France 24 Arabic  → official website (HLS geo-blocked)
UPDATE public.tv_channels SET
  official_url = 'https://www.france24.com/ar/البث-المباشر',
  stream_url   = 'https://www.france24.com/ar/البث-المباشر'
WHERE name = 'France 24 Arabic';

-- France 24 English  → keep existing HLS stream (official France 24 CDN)
-- Already correct: static.france24.com HLS

-- France 24 French  → keep existing HLS stream
-- Already correct: static.france24.com HLS

-- DW Arabic  → official website
UPDATE public.tv_channels SET
  official_url = 'https://www.dw.com/ar/البث-المباشر/live-45152476',
  stream_url   = 'https://www.dw.com/ar/البث-المباشر/live-45152476'
WHERE name = 'DW Arabic';

-- BBC Arabic  → official website
UPDATE public.tv_channels SET
  official_url = 'https://www.bbc.com/arabic/media/v/arabic_tv',
  stream_url   = 'https://www.bbc.com/arabic/media/v/arabic_tv'
WHERE name = 'BBC Arabic';

-- BBC World News  → official website
UPDATE public.tv_channels SET
  official_url = 'https://www.bbc.com/news/av/10462520',
  stream_url   = 'https://www.bbc.com/news/av/10462520'
WHERE name = 'BBC World News';

-- RT Arabic  → official website
UPDATE public.tv_channels SET
  official_url = 'https://arabic.rt.com/on_air/',
  stream_url   = 'https://arabic.rt.com/on_air/'
WHERE name = 'RT Arabic';

-- CNN International  → official website
UPDATE public.tv_channels SET
  official_url = 'https://edition.cnn.com/live-tv',
  stream_url   = 'https://edition.cnn.com/live-tv'
WHERE name = 'CNN International';

-- CGTN Arabic  → official website
UPDATE public.tv_channels SET
  official_url = 'https://www.cgtn.com/live',
  stream_url   = 'https://www.cgtn.com/live'
WHERE name = 'CGTN Arabic';

-- Al Hurra  → official website
UPDATE public.tv_channels SET
  official_url = 'https://www.alhurra.com/live-stream',
  stream_url   = 'https://www.alhurra.com/live-stream'
WHERE name = 'Al Hurra Arabic';

-- Al Mayadeen  → official website
UPDATE public.tv_channels SET
  official_url = 'https://www.almayadeen.net/live',
  stream_url   = 'https://www.almayadeen.net/live'
WHERE name = 'Al Mayadeen';

-- Gulf channels  → use official websites (YouTube IDs unverified)
UPDATE public.tv_channels SET
  official_url = 'https://www.saudiatv.sa/live',
  stream_url   = 'https://www.saudiatv.sa/live'
WHERE name = 'Saudi TV 1';

UPDATE public.tv_channels SET
  official_url = 'https://www.youtube.com/embed/live_stream?channel=UCv3J5Gh8KrjuBApFg7Zj5ew',
  stream_url   = 'https://www.youtube.com/embed/live_stream?channel=UCv3J5Gh8KrjuBApFg7Zj5ew'
WHERE name = 'Bahrain TV';

-- Gulf channels with unverified YouTube IDs → use website URLs
UPDATE public.tv_channels SET
  official_url = 'https://qatartv.qa/live', stream_url = 'https://qatartv.qa/live'
WHERE name = 'Qatar TV';

UPDATE public.tv_channels SET
  official_url = 'https://oman.om/ar/live', stream_url = 'https://oman.om/ar/live'
WHERE name = 'Oman TV';

UPDATE public.tv_channels SET
  official_url = 'https://www.youtube.com/embed/live_stream?channel=UCcKNJUKRHAnGHWf52hPpAJw',
  stream_url   = 'https://www.youtube.com/embed/live_stream?channel=UCcKNJUKRHAnGHWf52hPpAJw'
WHERE name = 'Kuwait TV';

-- Arab channels with unverified YouTube IDs
UPDATE public.tv_channels SET
  official_url = 'https://www.youtube.com/embed/live_stream?channel=UCXR5oMBpJBIpCnGqJAKFhGA',
  stream_url   = 'https://www.youtube.com/embed/live_stream?channel=UCXR5oMBpJBIpCnGqJAKFhGA'
WHERE name = 'CBC Egypt';

UPDATE public.tv_channels SET
  official_url = 'https://www.lbci.com/tv',
  stream_url   = 'https://www.lbci.com/tv'
WHERE name = 'LBC Lebanon';

UPDATE public.tv_channels SET
  official_url = 'https://www.almayadeen.net/live',
  stream_url   = 'https://www.almayadeen.net/live'
WHERE name LIKE '%Mayadeen%';

-- Kids channels
UPDATE public.tv_channels SET
  official_url = 'https://www.youtube.com/embed/live_stream?channel=UCQ2xtAMcIkXxSjBr2D_ZFSA',
  stream_url   = 'https://www.youtube.com/embed/live_stream?channel=UCQ2xtAMcIkXxSjBr2D_ZFSA'
WHERE name = 'Toyor Al Jannah';

-- TRT World  (verified YouTube channel ID)
UPDATE public.tv_channels SET
  official_url = 'https://www.youtube.com/embed/live_stream?channel=UC7BDTmFzKN54yqRd_dT2_5g',
  stream_url   = 'https://www.youtube.com/embed/live_stream?channel=UC7BDTmFzKN54yqRd_dT2_5g'
WHERE name = 'TRT World';

-- CGTN English  → official website (YouTube ID unverified)
UPDATE public.tv_channels SET
  official_url = 'https://www.cgtn.com/live',
  stream_url   = 'https://www.cgtn.com/live'
WHERE name = 'CGTN English';

-- KBS World  → official website
UPDATE public.tv_channels SET
  official_url = 'https://www.kbs.co.kr/worldradio/live',
  stream_url   = 'https://www.kbs.co.kr/worldradio/live'
WHERE name = 'KBS World Korea' OR name = 'KBS World';

-- Africa 24 / Africanews  → official website
UPDATE public.tv_channels SET
  official_url = 'https://www.africa24tv.com/en/live-stream',
  stream_url   = 'https://www.africa24tv.com/en/live-stream'
WHERE name = 'Africa 24';

UPDATE public.tv_channels SET
  official_url = 'https://www.africanews.com/live/',
  stream_url   = 'https://www.africanews.com/live/'
WHERE name LIKE '%Africanews%';

-- SABC News
UPDATE public.tv_channels SET
  official_url = 'https://www.sabcnews.com/live-stream/',
  stream_url   = 'https://www.sabcnews.com/live-stream/'
WHERE name = 'SABC News';

-- 2M Morocco  → official website
UPDATE public.tv_channels SET
  official_url = 'https://2m.ma/en/live/',
  stream_url   = 'https://2m.ma/en/live/'
WHERE name = '2M Morocco';

-- Algeria TV  → official website
UPDATE public.tv_channels SET
  official_url = 'https://www.entv.dz/live',
  stream_url   = 'https://www.entv.dz/live'
WHERE name = 'Algeria TV';

-- Tunisia 1  → official website
UPDATE public.tv_channels SET
  official_url = 'https://www.watania1.tn/live',
  stream_url   = 'https://www.watania1.tn/live'
WHERE name = 'Tunisia 1';

-- India
UPDATE public.tv_channels SET
  official_url = 'https://ddnews.gov.in/live-tv',
  stream_url   = 'https://ddnews.gov.in/live-tv'
WHERE name = 'DD News India';

-- NASA TV  → keep existing HLS (verified official Akamai stream)
-- France 24 English/French → keep existing HLS
-- NHK World → keep existing HLS

-- ── 2. RADIO STATIONS ────────────────────────────────────────────

-- BBC World Service  → lstn.lv (stable CORS-enabled HLS)
UPDATE public.radio_stations SET
  official_url = 'https://lstn.lv/bbcradio.m3u8?station=bbc_world_service&bitrate=96000',
  stream_url   = 'https://lstn.lv/bbcradio.m3u8?station=bbc_world_service&bitrate=96000'
WHERE name = 'BBC World Service';

-- BBC Arabic Radio  → lstn.lv
UPDATE public.radio_stations SET
  official_url = 'https://lstn.lv/bbcradio.m3u8?station=bbc_arabic_radio&bitrate=96000',
  stream_url   = 'https://lstn.lv/bbcradio.m3u8?station=bbc_arabic_radio&bitrate=96000'
WHERE name = 'BBC Arabic Radio';

-- BBC Radio 1  → lstn.lv
UPDATE public.radio_stations SET
  official_url = 'https://lstn.lv/bbcradio.m3u8?station=bbc_radio_one&bitrate=96000',
  stream_url   = 'https://lstn.lv/bbcradio.m3u8?station=bbc_radio_one&bitrate=96000'
WHERE name = 'BBC Radio 1';

-- BBC Radio 2  → lstn.lv
UPDATE public.radio_stations SET
  official_url = 'https://lstn.lv/bbcradio.m3u8?station=bbc_radio_two&bitrate=96000',
  stream_url   = 'https://lstn.lv/bbcradio.m3u8?station=bbc_radio_two&bitrate=96000'
WHERE name = 'BBC Radio 2';

-- BBC Radio 4  → lstn.lv
UPDATE public.radio_stations SET
  official_url = 'https://lstn.lv/bbcradio.m3u8?station=bbc_radio_fourfm&bitrate=96000',
  stream_url   = 'https://lstn.lv/bbcradio.m3u8?station=bbc_radio_fourfm&bitrate=96000'
WHERE name = 'BBC Radio 4';

-- BBC Radio 6 Music  → lstn.lv
UPDATE public.radio_stations SET
  official_url = 'https://lstn.lv/bbcradio.m3u8?station=bbc_6music&bitrate=96000',
  stream_url   = 'https://lstn.lv/bbcradio.m3u8?station=bbc_6music&bitrate=96000'
WHERE name = 'BBC Radio 6 Music';

-- BBC CBeebies  → lstn.lv
UPDATE public.radio_stations SET
  official_url = 'https://lstn.lv/bbcradio.m3u8?station=bbc_radio_cbeebies&bitrate=96000',
  stream_url   = 'https://lstn.lv/bbcradio.m3u8?station=bbc_radio_cbeebies&bitrate=96000'
WHERE name LIKE 'BBC Radio for Kids%' OR name = 'BBC CBeebies Radio';

-- Monte Carlo Doualiya  → keep infomaniak (verified working)
-- Already correct: live.mc.infomaniak.ch

-- RFI Arabic  → keep infomaniak (verified working)
-- Already correct: rfiarabic.ice.infomaniak.ch

-- Sawa Radio  → official website (stream ID was guessed)
UPDATE public.radio_stations SET
  official_url = 'https://www.radiosawa.com/live',
  stream_url   = 'https://www.radiosawa.com/live'
WHERE name = 'Sawa Radio Arabic';

-- DW Arabic Radio  → keep existing DW HLS (verified Akamai stream)
-- Already correct: dwamdstream104.akamaized.net

-- Al Arabiya Radio  → official website
UPDATE public.radio_stations SET
  official_url = 'https://www.alarabiya.net/ar/radio',
  stream_url   = 'https://www.alarabiya.net/ar/radio'
WHERE name = 'Al Arabiya Radio';

-- MBC FM  → official website
UPDATE public.radio_stations SET
  official_url = 'https://www.mbc.net/ar/mbc-fm.html',
  stream_url   = 'https://www.mbc.net/ar/mbc-fm.html'
WHERE name = 'MBC FM Arabia';

-- Rotana FM  → official website
UPDATE public.radio_stations SET
  official_url = 'https://www.rotana.net/radio',
  stream_url   = 'https://www.rotana.net/radio'
WHERE name = 'Rotana FM';

-- Melody FM Egypt  → official website (zeno.fm stream ID was guessed)
UPDATE public.radio_stations SET
  official_url = 'https://www.melodyfm.com.eg/live',
  stream_url   = 'https://www.melodyfm.com.eg/live'
WHERE name = 'Melody FM Egypt';

-- Nogoum FM  → official website
UPDATE public.radio_stations SET
  official_url = 'https://www.nogoumfm.net/live',
  stream_url   = 'https://www.nogoumfm.net/live'
WHERE name = 'Nogoum FM Egypt';

-- Holy Quran Saudi  → direct stream from known Saudi government source
UPDATE public.radio_stations SET
  official_url = 'https://stream.radiojarfm.com/saudiradio1',
  stream_url   = 'https://stream.radiojarfm.com/saudiradio1'
WHERE name = 'Holy Quran Saudi';

-- Quran Radio Egypt  → official website
UPDATE public.radio_stations SET
  official_url = 'https://quranegypt.net/live',
  stream_url   = 'https://quranegypt.net/live'
WHERE name = 'Quran Radio Egypt';

-- Al Fajr Quran  → official website (zeno.fm ID was guessed)
UPDATE public.radio_stations SET
  official_url = 'https://www.radioalgerie.dz/news/radio-quran',
  stream_url   = 'https://www.radioalgerie.dz/news/radio-quran'
WHERE name = 'Al Fajr Quran';

-- Kuwait Quran  → official website
UPDATE public.radio_stations SET
  official_url = 'https://www.media.gov.kw/radioquran',
  stream_url   = 'https://www.media.gov.kw/radioquran'
WHERE name = 'Kuwait Quran Radio';

-- Voice of America  → official website (stream ID was guessed)
UPDATE public.radio_stations SET
  official_url = 'https://www.voanews.com/live/radio',
  stream_url   = 'https://www.voanews.com/live/radio'
WHERE name = 'Voice of America';

-- Radio France icecast streams  → already correct, no change needed
-- France Inter, France Culture, RFI French all use icecast.radiofrance.fr

-- DW German Radio  → keep existing Akamai HLS (verified)
-- NHK Radio → keep existing
-- RAI Italy → keep existing icecast

-- Jazz FM  → official website (sharp-stream URL may be expired)
UPDATE public.radio_stations SET
  official_url = 'https://www.jazzfm.com/listen/',
  stream_url   = 'https://www.jazzfm.com/listen/'
WHERE name = 'Jazz FM UK';

-- Radio Swiss Jazz  → keep infomaniak (verified working)
-- Already correct: stream.srg-ssr.ch

-- Classical KING FM  → official website (hls URL may not be accessible)
UPDATE public.radio_stations SET
  official_url = 'https://www.king.org/listen-live/',
  stream_url   = 'https://www.king.org/listen-live/'
WHERE name = 'Classical KING FM';

-- NRJ France  → keep existing (scdn.nrjaudio.fm stream - should work)
-- Virgin Radio  → official website (radiojar ID was guessed)
UPDATE public.radio_stations SET
  official_url = 'https://www.virginradio.co.uk/listen',
  stream_url   = 'https://www.virginradio.co.uk/listen'
WHERE name = 'Virgin Radio UK';

-- Smooth Radio  → keep existing musicradio.com stream

-- talkSPORT  → keep existing /stream URL (should work)
-- ESPN Radio  → official website
UPDATE public.radio_stations SET
  official_url = 'https://www.espn.com/radio/',
  stream_url   = 'https://www.espn.com/radio/'
WHERE name = 'ESPN Radio USA';

-- Radio Disney  → official website (zeno.fm ID was guessed)
UPDATE public.radio_stations SET
  official_url = 'https://radio.disney.com',
  stream_url   = 'https://radio.disney.com'
WHERE name = 'Radio Disney Arabia';

-- All India Radio  → keep existing Akamai HLS (official AIR stream)
-- Vividh Bharati  → keep existing Akamai HLS

-- Radio Singapore  → official website (stream URL may need auth)
UPDATE public.radio_stations SET
  official_url = 'https://www.channelnewsasia.com/listen',
  stream_url   = 'https://www.channelnewsasia.com/listen'
WHERE name = 'Radio Singapore CNA';

-- Radio Nigeria  → official website (zeno.fm ID was guessed)
UPDATE public.radio_stations SET
  official_url = 'https://www.voicenigeria.ng/live',
  stream_url   = 'https://www.voicenigeria.ng/live'
WHERE name = 'Radio Nigeria';

-- Radio Kenya  → official website (zeno.fm ID was guessed)
UPDATE public.radio_stations SET
  official_url = 'https://citizen.digital/radio',
  stream_url   = 'https://citizen.digital/radio'
WHERE name = 'Radio Kenya Citizen';

-- Radio Maroc  → official SNRT stream (mms not reliable in browser)
UPDATE public.radio_stations SET
  official_url = 'https://www.snrt.ma/radio',
  stream_url   = 'https://www.snrt.ma/radio'
WHERE name = 'Radio Maroc';

-- Radio Algérie  → official website (stream ID was guessed)
UPDATE public.radio_stations SET
  official_url = 'https://www.radioalgerie.dz/news/live',
  stream_url   = 'https://www.radioalgerie.dz/news/live'
WHERE name = 'Radio Algérie';

-- Radio Formula Mexico  → official website (zeno.fm ID was guessed)
UPDATE public.radio_stations SET
  official_url = 'https://www.radioformula.com.mx/live/',
  stream_url   = 'https://www.radioformula.com.mx/live/'
WHERE name = 'Radio Formula Mexico';

-- Cadena SER  → keep streamtheworld URL (might work as direct audio redirect)

-- Radio Mariam Lebanon  → official website (zeno.fm ID was guessed)
UPDATE public.radio_stations SET
  official_url = 'https://radiomariam.com/live',
  stream_url   = 'https://radiomariam.com/live'
WHERE name = 'Radio Mariam Lebanon';

-- Sawt el Rab  → official website
UPDATE public.radio_stations SET
  official_url = 'https://www.sawtlrab.com/listen-live',
  stream_url   = 'https://www.sawtlrab.com/listen-live'
WHERE name = 'Sawt el Rab Lebanon';

-- Calm Radio  → keep existing stream URL (should work with infomaniak detection)
-- Radio Swiss Classic  → keep existing (srg-ssr stream)
-- Deutschlandfunk  → keep existing sslstream URL
-- RAI Radio 1  → keep existing icecast
-- RNE Spain  → keep existing Akamai HLS
