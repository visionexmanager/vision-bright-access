-- Sample channels with working public stream sources
-- Run after all migrations

DO $$
DECLARE
  news_id      UUID;
  sports_id    UUID;
  religion_id  UUID;
  kids_id      UUID;
  ch_id        UUID;
BEGIN
  SELECT id INTO news_id     FROM tv_categories WHERE slug = 'news'     LIMIT 1;
  SELECT id INTO sports_id   FROM tv_categories WHERE slug = 'sports'   LIMIT 1;
  SELECT id INTO religion_id FROM tv_categories WHERE slug = 'religion' LIMIT 1;
  SELECT id INTO kids_id     FROM tv_categories WHERE slug = 'kids'     LIMIT 1;

  -- Al Jazeera Arabic
  INSERT INTO tv_channels (slug, name, name_ar, logo_url, country, language, quality, category_id, is_featured)
  VALUES ('al-jazeera-arabic', 'Al Jazeera Arabic', 'قناة الجزيرة', 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Aljazeera_eng.svg/200px-Aljazeera_eng.svg.png', 'QA', 'ar', 'HD', news_id, TRUE)
  RETURNING id INTO ch_id;
  INSERT INTO tv_stream_sources (channel_id, url, type, priority, label, reliability)
  VALUES (ch_id, 'https://live-hls-web-aja.getaj.net/AJA/index.m3u8', 'hls', 0, 'Primary', 95);

  -- Al Jazeera English
  INSERT INTO tv_channels (slug, name, name_ar, logo_url, country, language, quality, category_id, is_featured)
  VALUES ('al-jazeera-english', 'Al Jazeera English', 'الجزيرة الإنجليزية', 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Aljazeera_eng.svg/200px-Aljazeera_eng.svg.png', 'QA', 'en', 'HD', news_id, TRUE)
  RETURNING id INTO ch_id;
  INSERT INTO tv_stream_sources (channel_id, url, type, priority, label, reliability)
  VALUES (ch_id, 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8', 'hls', 0, 'Primary', 95);

  -- BBC World News
  INSERT INTO tv_channels (slug, name, name_ar, logo_url, country, language, quality, category_id, is_featured)
  VALUES ('bbc-world-news', 'BBC World News', 'بي بي سي العالمية', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/BBC_News_2019.svg/200px-BBC_News_2019.svg.png', 'GB', 'en', 'HD', news_id, TRUE)
  RETURNING id INTO ch_id;
  INSERT INTO tv_stream_sources (channel_id, url, type, priority, label, reliability)
  VALUES (ch_id, 'https://vs-cmaf-push-ww-live.akamaized.net/x=4/i=urn:bbc:pips:service:bbc_world_service_news_internet/pc_hd_abr_v2.mpd', 'dash', 0, 'Primary', 90);

  -- MBC 1
  INSERT INTO tv_channels (slug, name, name_ar, logo_url, country, language, quality, category_id, is_featured)
  VALUES ('mbc1', 'MBC 1', 'إم بي سي 1', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/MBC1_logo.svg/200px-MBC1_logo.svg.png', 'SA', 'ar', 'HD', news_id, TRUE)
  RETURNING id INTO ch_id;
  INSERT INTO tv_stream_sources (channel_id, url, type, priority, label, reliability)
  VALUES (ch_id, 'https://a.files.bbci.co.uk/ms6/live/3441A116-B12E-4D2F-ACA8-C1984642FA4B/HLS/auto/master.m3u8', 'hls', 0, 'Primary', 85);

  -- NASA TV
  INSERT INTO tv_channels (slug, name, name_ar, logo_url, country, language, quality, category_id)
  VALUES ('nasa-tv', 'NASA TV', 'ناسا تي في', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/200px-NASA_logo.svg.png', 'US', 'en', 'HD', kids_id)
  RETURNING id INTO ch_id;
  INSERT INTO tv_stream_sources (channel_id, url, type, priority, label, reliability)
  VALUES (ch_id, 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8', 'hls', 0, 'Primary', 98);

END $$;
