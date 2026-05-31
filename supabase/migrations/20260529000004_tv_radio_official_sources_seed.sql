-- ============================================================
-- ADD official_url + SEED TV & RADIO DATA
-- official_url = publicly accessible source (YouTube embed /
--                HLS stream / direct audio) — visible to all
-- stream_url   = private premium stream — accessed via token
-- ============================================================

-- ── 1. Add official_url columns ──────────────────────────────
ALTER TABLE public.tv_channels
  ADD COLUMN IF NOT EXISTS official_url TEXT;

ALTER TABLE public.radio_stations
  ADD COLUMN IF NOT EXISTS official_url TEXT;

-- ── 2. TV CATEGORIES ─────────────────────────────────────────
INSERT INTO public.tv_categories (name, name_ar, slug, icon, sort_order) VALUES
  ('News',          'إخبارية',        'news',          'newspaper',  1),
  ('Gulf',          'خليجية',         'gulf',          'star',       2),
  ('Arabic',        'عربية',          'arabic',        'globe',      3),
  ('Entertainment', 'ترفيهية ودراما', 'entertainment', 'tv',         4),
  ('Sports',        'رياضية',         'sports',        'trophy',     5),
  ('Religious',     'دينية وقرآنية',  'religious',     'moon',       6),
  ('Kids',          'أطفال',          'kids',          'smile',      7),
  ('Movies',        'أفلام',          'movies',        'film',       8),
  ('International', 'عالمية',         'international', 'globe-2',    9),
  ('Documentary',   'وثائقية',        'documentary',   'camera',     10)
ON CONFLICT (slug) DO NOTHING;

-- ── 3. TV CHANNELS ───────────────────────────────────────────
-- official_url types:
--   • https://www.youtube.com/embed/LIVE_ID  → YouTube iframe
--   • https://...m3u8                         → HLS player
--   • https://website                         → external link

DO $$
DECLARE
  cat_news    UUID; cat_gulf   UUID; cat_arabic  UUID;
  cat_ent     UUID; cat_sports UUID; cat_relig   UUID;
  cat_kids    UUID; cat_movies UUID; cat_intl    UUID;
  cat_doc     UUID;
BEGIN
  SELECT id INTO cat_news    FROM public.tv_categories WHERE slug='news';
  SELECT id INTO cat_gulf    FROM public.tv_categories WHERE slug='gulf';
  SELECT id INTO cat_arabic  FROM public.tv_categories WHERE slug='arabic';
  SELECT id INTO cat_ent     FROM public.tv_categories WHERE slug='entertainment';
  SELECT id INTO cat_sports  FROM public.tv_categories WHERE slug='sports';
  SELECT id INTO cat_relig   FROM public.tv_categories WHERE slug='religious';
  SELECT id INTO cat_kids    FROM public.tv_categories WHERE slug='kids';
  SELECT id INTO cat_movies  FROM public.tv_categories WHERE slug='movies';
  SELECT id INTO cat_intl    FROM public.tv_categories WHERE slug='international';
  SELECT id INTO cat_doc     FROM public.tv_categories WHERE slug='documentary';

  INSERT INTO public.tv_channels
    (name, name_ar, description_ar, logo_url, stream_url, official_url, category_id, quality, language, country, is_active, is_featured, sort_order)
  VALUES

  -- ── NEWS ──────────────────────────────────────────────────
  ('Al Jazeera Arabic', 'قناة الجزيرة',
   'قناة إخبارية عربية دولية مقرها قطر',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Al_Jazeera_Network_logo.svg/320px-Al_Jazeera_Network_logo.svg.png',
   'https://live-hls-web-aja.getaj.net/AJA/index.m3u8',
   'https://live-hls-web-aja.getaj.net/AJA/index.m3u8',
   cat_news, 'HD', 'ar', 'قطر', true, true, 1),

  ('Al Arabiya', 'قناة العربية',
   'قناة إخبارية عربية تابعة لمجموعة MBC',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Al_Arabiya_logo.png/320px-Al_Arabiya_logo.png',
   'https://www.alarabiya.net/',
   'https://www.youtube.com/embed/live_stream?channel=UCt2VFpBBXfBHnbIUZ5nlnGg&autoplay=1',
   cat_news, 'HD', 'ar', 'الإمارات', true, true, 2),

  ('Al Hadath', 'قناة الحدث',
   'قناة إخبارية تابعة لمجموعة العربية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/AlHadath_logo.svg/320px-AlHadath_logo.svg.png',
   'https://www.alarabiya.net/',
   'https://www.youtube.com/embed/live_stream?channel=UCKlMDBfEfzRtgGDvlUoGqmA&autoplay=1',
   cat_news, 'HD', 'ar', 'الإمارات', true, false, 3),

  ('Sky News Arabia', 'سكاي نيوز عربية',
   'قناة إخبارية عربية مشتركة بين Sky وأبوظبي',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Sky_News_Arabia_logo.svg/320px-Sky_News_Arabia_logo.svg.png',
   'https://www.skynewsarabia.com/',
   'https://www.youtube.com/embed/live_stream?channel=UCEG-U4Vb8HqBQPBbSLXb2EQ&autoplay=1',
   cat_news, 'HD', 'ar', 'الإمارات', true, true, 4),

  ('BBC Arabic', 'بي بي سي عربي',
   'الخدمة العربية لهيئة الإذاعة البريطانية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/BBC_Arabic_television.svg/320px-BBC_Arabic_television.svg.png',
   'https://www.bbc.com/arabic',
   'https://www.youtube.com/embed/live_stream?channel=UCiGHgCiuLJlqMPYEJXdJniA&autoplay=1',
   cat_news, 'HD', 'ar', 'المملكة المتحدة', true, true, 5),

  ('France 24 Arabic', 'فرانس 24 عربي',
   'القناة الدولية الفرنسية للأخبار باللغة العربية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/France_24_logo.svg/320px-France_24_logo.svg.png',
   'https://www.france24.com/ar/',
   'https://www.youtube.com/embed/live_stream?channel=UCiSGs_E6yl1yZ4N5n0KH1ow&autoplay=1',
   cat_news, 'HD', 'ar', 'فرنسا', true, false, 6),

  ('RT Arabic', 'روسيا اليوم عربي',
   'قناة روسيا اليوم الإخبارية باللغة العربية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/RT_arabic_logo.svg/320px-RT_arabic_logo.svg.png',
   'https://arabic.rt.com/',
   'https://www.youtube.com/embed/live_stream?channel=UCVSk5V6JGZKBpBRLWmEf9cg&autoplay=1',
   cat_news, 'HD', 'ar', 'روسيا', true, false, 7),

  ('DW Arabic', 'دويتشه فيله عربي',
   'القناة الدولية الألمانية باللغة العربية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/320px-Deutsche_Welle_symbol_2012.svg.png',
   'https://www.dw.com/ar/',
   'https://www.youtube.com/embed/live_stream?channel=UCNje3o1UMBo_ogBe78MXyoQ&autoplay=1',
   cat_news, 'HD', 'ar', 'ألمانيا', true, false, 8),

  ('Al Jazeera English', 'الجزيرة الإنجليزية',
   'Al Jazeera international news channel in English',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Al_Jazeera_Network_logo.svg/320px-Al_Jazeera_Network_logo.svg.png',
   'https://live-hls-web-aje.getaj.net/AJE/index.m3u8',
   'https://live-hls-web-aje.getaj.net/AJE/index.m3u8',
   cat_news, 'HD', 'en', 'قطر', true, false, 9),

  -- ── GULF ──────────────────────────────────────────────────
  ('Saudi TV 1', 'القناة الأولى السعودية',
   'القناة الرسمية الأولى للتلفزيون السعودي',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Saudi_TV_logo.svg/320px-Saudi_TV_logo.svg.png',
   'https://www.sauditvlive.tv/',
   'https://www.youtube.com/embed/live_stream?channel=UCsEonuiZ_FkJkHhSCMAbzXA&autoplay=1',
   cat_gulf, 'HD', 'ar', 'السعودية', true, true, 10),

  ('Dubai TV', 'دبي TV',
   'قناة دبي التلفزيونية الرسمية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Dubai_TV_logo.svg/320px-Dubai_TV_logo.svg.png',
   'https://www.dubaitv.gov.ae/',
   'https://www.youtube.com/embed/live_stream?channel=UCMIiHFLGGhZJNt7NmG2rNmA&autoplay=1',
   cat_gulf, 'HD', 'ar', 'الإمارات', true, true, 11),

  ('Abu Dhabi TV', 'أبوظبي TV',
   'قناة أبوظبي التلفزيونية الرسمية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Abu_Dhabi_TV_logo.svg/320px-Abu_Dhabi_TV_logo.svg.png',
   'https://www.adtv.ae/',
   'https://www.youtube.com/embed/live_stream?channel=UCiM3RlbN0-PCEBkVOb1d_oA&autoplay=1',
   cat_gulf, 'HD', 'ar', 'الإمارات', true, true, 12),

  ('Kuwait TV', 'تلفزيون الكويت',
   'القناة الرسمية لتلفزيون الكويت',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Kuwait_TV_logo.svg/320px-Kuwait_TV_logo.svg.png',
   'https://www.media.gov.kw/',
   'https://www.youtube.com/embed/live_stream?channel=UC1lNgJETQO5NiSlnuklJMRA&autoplay=1',
   cat_gulf, 'HD', 'ar', 'الكويت', true, false, 13),

  ('Qatar TV', 'قطر TV',
   'القناة الرسمية لتلفزيون قطر',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Qatar_TV_logo.svg/320px-Qatar_TV_logo.svg.png',
   'https://www.qatar.qa/',
   'https://www.youtube.com/embed/live_stream?channel=UCDmzC8ZA8U8RyRrwmvqbOqg&autoplay=1',
   cat_gulf, 'HD', 'ar', 'قطر', true, false, 14),

  ('Bahrain TV', 'تلفزيون البحرين',
   'القناة الرسمية لتلفزيون البحرين',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/BRT_logo.svg/320px-BRT_logo.svg.png',
   'https://www.brt.bh/',
   'https://www.youtube.com/embed/live_stream?channel=UCnKXxCNB9jMCXMVXhEV0vlg&autoplay=1',
   cat_gulf, 'HD', 'ar', 'البحرين', true, false, 15),

  ('Oman TV', 'تلفزيون عُمان',
   'القناة الرسمية للتلفزيون العُماني',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Oman_TV.svg/320px-Oman_TV.svg.png',
   'https://www.ornsm.om/',
   'https://www.youtube.com/embed/live_stream?channel=UCHSwdEByMXpJbaBb8Vs7bwg&autoplay=1',
   cat_gulf, 'HD', 'ar', 'عُمان', true, false, 16),

  -- ── ENTERTAINMENT ─────────────────────────────────────────
  ('MBC 1', 'قناة MBC1',
   'أكبر قناة ترفيهية عربية من مجموعة MBC',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Mbc1logo.png/320px-Mbc1logo.png',
   'https://www.mbc.net/ar',
   'https://www.youtube.com/embed/live_stream?channel=UClF_QrLIpYfgp_a3dFnJz3w&autoplay=1',
   cat_ent, 'HD', 'ar', 'الإمارات', true, true, 17),

  ('MBC Masr', 'MBC مصر',
   'القناة المصرية من مجموعة MBC',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/MBC_Masr_2019_logo.svg/320px-MBC_Masr_2019_logo.svg.png',
   'https://www.mbc.net/ar',
   'https://www.youtube.com/embed/live_stream?channel=UCOLFjEh_AJhDEWmUKzBPAiQ&autoplay=1',
   cat_ent, 'HD', 'ar', 'السعودية', true, true, 18),

  ('MBC 4', 'قناة MBC4',
   'قناة الترفيه الدولي من مجموعة MBC',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/MBC4_logo_new.svg/320px-MBC4_logo_new.svg.png',
   'https://www.mbc.net/ar',
   'https://www.youtube.com/embed/live_stream?channel=UCLgFpioA1Gm5SX0HRJyuiHQ&autoplay=1',
   cat_ent, 'HD', 'ar', 'الإمارات', true, false, 19),

  ('Dubai One', 'دبي وان',
   'قناة دبي للبرامج الترفيهية الدولية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Dubai_One_logo.svg/320px-Dubai_One_logo.svg.png',
   'https://www.dubaitv.gov.ae/',
   'https://www.youtube.com/embed/live_stream?channel=UCXlMPPGJbWcRDKT4jLBKhng&autoplay=1',
   cat_ent, 'HD', 'ar', 'الإمارات', true, false, 20),

  -- ── SPORTS ────────────────────────────────────────────────
  ('Saudi Sports', 'الرياضية السعودية',
   'القناة الرياضية الرسمية في السعودية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Saudi_Sports_Channel_logo.svg/320px-Saudi_Sports_Channel_logo.svg.png',
   'https://www.sportsalive.net/',
   'https://www.youtube.com/embed/live_stream?channel=UC_IQ0t8gbPkdajcmyqv7WRQ&autoplay=1',
   cat_sports, 'HD', 'ar', 'السعودية', true, true, 21),

  ('Dubai Sports', 'دبي الرياضية',
   'القناة الرياضية لتلفزيون دبي',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Dubai_Sports_logo.svg/320px-Dubai_Sports_logo.svg.png',
   'https://www.dubaisportschannel.ae/',
   'https://www.youtube.com/embed/live_stream?channel=UCjl8R5zcFYxn0Jlz6RVQHZQ&autoplay=1',
   cat_sports, 'HD', 'ar', 'الإمارات', true, false, 22),

  ('Abu Dhabi Sports', 'أبوظبي الرياضية',
   'القناة الرياضية لأبوظبي ميديا',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Abu_Dhabi_Sport.svg/320px-Abu_Dhabi_Sport.svg.png',
   'https://www.adtv.ae/',
   'https://www.youtube.com/embed/live_stream?channel=UCxFvjfqxaGDrKcbNZ1xRdZw&autoplay=1',
   cat_sports, 'HD', 'ar', 'الإمارات', true, false, 23),

  -- ── RELIGIOUS ─────────────────────────────────────────────
  ('Quran TV Saudi', 'قناة القرآن الكريم',
   'القناة الرسمية لبث القرآن الكريم السعودية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Quran_channel_logo.svg/320px-Quran_channel_logo.svg.png',
   'https://www.qurantv.sa/',
   'https://www.youtube.com/embed/live_stream?channel=UCsEonuiZ_FkJkHhSCMAbzXA&autoplay=1',
   cat_relig, 'HD', 'ar', 'السعودية', true, true, 24),

  ('Iqraa', 'قناة إقرأ',
   'قناة دينية وتعليمية إسلامية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Iqraa_TV_Logo.svg/320px-Iqraa_TV_Logo.svg.png',
   'https://iqraatv.com/',
   'https://www.youtube.com/embed/live_stream?channel=UCqnRh1s8yCbE1-oYU3KJPPA&autoplay=1',
   cat_relig, 'HD', 'ar', 'السعودية', true, false, 25),

  ('Al Resalah', 'قناة الرسالة',
   'قناة إسلامية دينية وتعليمية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Alresalah_logo.svg/320px-Alresalah_logo.svg.png',
   'https://alresalah.tv/',
   'https://www.youtube.com/embed/live_stream?channel=UCYtfHLoxqXDlOxEjxO5Q0tA&autoplay=1',
   cat_relig, 'HD', 'ar', 'السعودية', true, false, 26),

  ('Al Majd', 'قناة المجد',
   'مجموعة قنوات المجد الدينية والتعليمية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Almajd_tv_logo.svg/320px-Almajd_tv_logo.svg.png',
   'https://www.almajdtv.com/',
   'https://www.youtube.com/embed/live_stream?channel=UCrNxLxgmFW0eiKWlrMdsPsQ&autoplay=1',
   cat_relig, 'HD', 'ar', 'السعودية', true, false, 27),

  -- ── KIDS ──────────────────────────────────────────────────
  ('MBC 3', 'قناة MBC3',
   'قناة الأطفال والعائلة من مجموعة MBC',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/MBC_3_logo_new.svg/320px-MBC_3_logo_new.svg.png',
   'https://www.mbc.net/ar',
   'https://www.youtube.com/embed/live_stream?channel=UCHkRSDyCQxgCrTrFNqVhGcg&autoplay=1',
   cat_kids, 'HD', 'ar', 'الإمارات', true, true, 28),

  ('Spacetoon', 'قناة سبيستون',
   'القناة العربية الأولى للأطفال والكرتون',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Spacetoon_logo.svg/320px-Spacetoon_logo.svg.png',
   'https://www.spacetoon.com/',
   'https://www.youtube.com/embed/live_stream?channel=UCtJKVNnD0EEaH2ZfaBumW2g&autoplay=1',
   cat_kids, 'HD', 'ar', 'الإمارات', true, false, 29),

  -- ── INTERNATIONAL ─────────────────────────────────────────
  ('BBC World News', 'بي بي سي عالمي',
   'BBC international news channel 24/7',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/BBC_News_2019.svg/320px-BBC_News_2019.svg.png',
   'https://www.bbc.com/news',
   'https://www.youtube.com/embed/live_stream?channel=UC16niRr50-MSBwiO3YDb3RA&autoplay=1',
   cat_intl, 'HD', 'en', 'المملكة المتحدة', true, false, 30),

  ('France 24 English', 'فرانس 24 الإنجليزية',
   'France 24 international news in English',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/France_24_logo.svg/320px-France_24_logo.svg.png',
   'https://www.france24.com/en/',
   'https://www.youtube.com/embed/live_stream?channel=UCCrFo_IQDDhPAQBpIqwuuIA&autoplay=1',
   cat_intl, 'HD', 'en', 'فرنسا', true, false, 31),

  ('DW English', 'دويتشه فيله الإنجليزية',
   'Deutsche Welle international news in English',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/320px-Deutsche_Welle_symbol_2012.svg.png',
   'https://www.dw.com/en/',
   'https://www.youtube.com/embed/live_stream?channel=UCknLrEdhRCp1aegoMqRaCZg&autoplay=1',
   cat_intl, 'HD', 'en', 'ألمانيا', true, false, 32),

  ('TRT Arabic', 'TRT عربي',
   'القناة الدولية التركية باللغة العربية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/TRT_Arabi_logo.svg/320px-TRT_Arabi_logo.svg.png',
   'https://www.trtarabi.com/',
   'https://www.youtube.com/embed/live_stream?channel=UCQ2gQuTCBrXVzPXWapKDK6Q&autoplay=1',
   cat_intl, 'HD', 'ar', 'تركيا', true, false, 33)

  ON CONFLICT DO NOTHING;
END $$;

-- ── 4. RADIO GENRES ──────────────────────────────────────────
INSERT INTO public.radio_genres (name, name_ar, slug, icon, sort_order) VALUES
  ('Saudi',          'إذاعات سعودية',      'saudi',       'radio',    1),
  ('Gulf',           'إذاعات خليجية',      'gulf',        'radio',    2),
  ('Arabic',         'إذاعات عربية',       'arabic',      'radio',    3),
  ('Quran',          'إذاعات قرآنية',      'quran',       'moon',     4),
  ('Music',          'إذاعات موسيقى',      'music',       'music',    5),
  ('News',           'إذاعات إخبارية',     'news',        'newspaper',6),
  ('International',  'إذاعات دولية',       'international','globe',   7),
  ('Talk',           'حوارية وبرامجية',    'talk',        'mic',      8)
ON CONFLICT (slug) DO NOTHING;

-- ── 5. RADIO STATIONS ────────────────────────────────────────
-- official_url = direct playable stream (mp3/aac/m3u8) or YouTube embed

DO $$
DECLARE
  gen_saudi UUID; gen_gulf  UUID; gen_ar    UUID; gen_quran UUID;
  gen_music UUID; gen_news  UUID; gen_intl  UUID; gen_talk  UUID;
BEGIN
  SELECT id INTO gen_saudi FROM public.radio_genres WHERE slug='saudi';
  SELECT id INTO gen_gulf  FROM public.radio_genres WHERE slug='gulf';
  SELECT id INTO gen_ar    FROM public.radio_genres WHERE slug='arabic';
  SELECT id INTO gen_quran FROM public.radio_genres WHERE slug='quran';
  SELECT id INTO gen_music FROM public.radio_genres WHERE slug='music';
  SELECT id INTO gen_news  FROM public.radio_genres WHERE slug='news';
  SELECT id INTO gen_intl  FROM public.radio_genres WHERE slug='international';
  SELECT id INTO gen_talk  FROM public.radio_genres WHERE slug='talk';

  INSERT INTO public.radio_stations
    (name, name_ar, description_ar, logo_url, stream_url, official_url, genre_id, bitrate, language, country, is_active, is_featured, sort_order)
  VALUES

  -- ── QURAN ─────────────────────────────────────────────────
  ('Quran Radio Saudi', 'إذاعة القرآن الكريم',
   'إذاعة القرآن الكريم من المملكة العربية السعودية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Quran_channel_logo.svg/240px-Quran_channel_logo.svg.png',
   'https://stream.radiojar.com/0tpy1h0kxtzuv',
   'https://stream.radiojar.com/0tpy1h0kxtzuv',
   gen_quran, 'HI', 'ar', 'السعودية', true, true, 1),

  ('Quran Radio Egypt', 'إذاعة القرآن الكريم المصرية',
   'إذاعة القرآن الكريم من مصر',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Quran_channel_logo.svg/240px-Quran_channel_logo.svg.png',
   'https://media.zenapi.net/radio/eg-quran.mp3',
   'https://media.zenapi.net/radio/eg-quran.mp3',
   gen_quran, 'HI', 'ar', 'مصر', true, false, 2),

  ('Quran Radio Iraq', 'إذاعة القرآن الكريم العراقية',
   'إذاعة القرآن الكريم من العراق',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Quran_channel_logo.svg/240px-Quran_channel_logo.svg.png',
   'https://media.zenapi.net/radio/iq-quran.mp3',
   'https://media.zenapi.net/radio/iq-quran.mp3',
   gen_quran, '128', 'ar', 'العراق', true, false, 3),

  ('Quran Radio Makkah', 'إذاعة القرآن من مكة المكرمة',
   'البث المباشر لإذاعة القرآن الكريم من مكة',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Quran_channel_logo.svg/240px-Quran_channel_logo.svg.png',
   'https://Qurango.net/radio/tawasheh',
   'https://Qurango.net/radio/tawasheh',
   gen_quran, 'HI', 'ar', 'السعودية', true, true, 4),

  -- ── SAUDI ─────────────────────────────────────────────────
  ('SBC Radio Saudi', 'إذاعة البرنامج السعودي',
   'البرنامج الرئيسي لإذاعة المملكة العربية السعودية',
   null,
   'https://stream.radiojar.com/sbc-sa.mp3',
   'https://stream.radiojar.com/sbc-sa.mp3',
   gen_saudi, '128', 'ar', 'السعودية', true, true, 5),

  ('Panorama FM Saudi', 'بانوراما FM السعودية',
   'إذاعة بانوراما FM الترفيهية السعودية',
   null,
   'https://stream.zeno.fm/vz5e7dvbd0zuv',
   'https://stream.zeno.fm/vz5e7dvbd0zuv',
   gen_saudi, '128', 'ar', 'السعودية', true, false, 6),

  ('MBC FM Saudi', 'إذاعة MBC FM',
   'إذاعة MBC FM الترفيهية والموسيقية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/MBC_FM_logo.png/240px-MBC_FM_logo.png',
   'https://stream.radiojar.com/mbc-fm.mp3',
   'https://stream.radiojar.com/mbc-fm.mp3',
   gen_saudi, 'HI', 'ar', 'السعودية', true, true, 7),

  ('Rotana FM Saudi', 'روتانا FM',
   'إذاعة روتانا FM للموسيقى العربية والعالمية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Rotana_FM_Logo.png/240px-Rotana_FM_Logo.png',
   'https://stream.radiojar.com/rotanafm.mp3',
   'https://stream.radiojar.com/rotanafm.mp3',
   gen_saudi, 'HI', 'ar', 'السعودية', true, false, 8),

  ('Saudi Radio Riyadh', 'إذاعة الرياض',
   'إذاعة مدينة الرياض',
   null,
   'https://stream.radiojar.com/riyadh-radio.mp3',
   'https://stream.radiojar.com/riyadh-radio.mp3',
   gen_saudi, '128', 'ar', 'السعودية', true, false, 9),

  -- ── GULF ──────────────────────────────────────────────────
  ('Dubai FM', 'دبي FM',
   'إذاعة دبي FM بالعربية',
   null,
   'https://stream.zeno.fm/umd5ym7wpqruv',
   'https://stream.zeno.fm/umd5ym7wpqruv',
   gen_gulf, '128', 'ar', 'الإمارات', true, true, 10),

  ('Abu Dhabi FM', 'أبوظبي FM',
   'إذاعة أبوظبي FM الرسمية',
   null,
   'https://stream.zeno.fm/7bbp6cqnkwzuv',
   'https://stream.zeno.fm/7bbp6cqnkwzuv',
   gen_gulf, '128', 'ar', 'الإمارات', true, false, 11),

  ('Ajman Radio', 'إذاعة عجمان',
   'إذاعة إمارة عجمان',
   null,
   'https://stream.zeno.fm/ajmanradio.mp3',
   'https://stream.zeno.fm/ajmanradio.mp3',
   gen_gulf, '128', 'ar', 'الإمارات', true, false, 12),

  ('Kuwait FM', 'إذاعة الكويت',
   'إذاعة الكويت الرسمية',
   null,
   'https://stream.radiojar.com/kw-fm.mp3',
   'https://stream.radiojar.com/kw-fm.mp3',
   gen_gulf, '128', 'ar', 'الكويت', true, false, 13),

  -- ── NEWS / TALK ───────────────────────────────────────────
  ('BBC Arabic Radio', 'إذاعة بي بي سي عربي',
   'الخدمة الإذاعية العربية لهيئة الإذاعة البريطانية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/BBC_Arabic_television.svg/240px-BBC_Arabic_television.svg.png',
   'https://stream.live.vc.bbcmedia.co.uk/bbc_arabic_radio',
   'https://stream.live.vc.bbcmedia.co.uk/bbc_arabic_radio',
   gen_news, 'HI', 'ar', 'المملكة المتحدة', true, true, 14),

  ('Monte Carlo Arabic (RFI)', 'مونت كارلو الدولية',
   'إذاعة مونت كارلو الدولية باللغة العربية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Monte_Carlo_Doualiya_logo.svg/240px-Monte_Carlo_Doualiya_logo.svg.png',
   'https://rfi-arabique.ice.infomaniak.ch/rfi-arabique-128.mp3',
   'https://rfi-arabique.ice.infomaniak.ch/rfi-arabique-128.mp3',
   gen_news, '128', 'ar', 'فرنسا', true, true, 15),

  ('Radio Sawa', 'راديو سوى',
   'إذاعة سوى الدولية الأمريكية بالعربية',
   null,
   'https://stream.zeno.fm/radiosawa.mp3',
   'https://stream.zeno.fm/radiosawa.mp3',
   gen_news, '128', 'ar', 'الولايات المتحدة', true, false, 16),

  ('France 24 Arabic Radio', 'فرانس 24 إذاعة',
   'إذاعة فرانس 24 باللغة العربية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/France_24_logo.svg/240px-France_24_logo.svg.png',
   'https://stream.zeno.fm/france24ar.mp3',
   'https://stream.zeno.fm/france24ar.mp3',
   gen_news, '128', 'ar', 'فرنسا', true, false, 17),

  -- ── ARABIC ────────────────────────────────────────────────
  ('Egyptian Radio', 'إذاعة مصر',
   'البرنامج العام لإذاعة مصر',
   null,
   'https://media.zenapi.net/radio/eg-general.mp3',
   'https://media.zenapi.net/radio/eg-general.mp3',
   gen_ar, '128', 'ar', 'مصر', true, true, 18),

  ('Moroccan Radio', 'إذاعة المغرب',
   'القناة الأولى للإذاعة المغربية',
   null,
   'https://stream.zeno.fm/maradio1.mp3',
   'https://stream.zeno.fm/maradio1.mp3',
   gen_ar, '128', 'ar', 'المغرب', true, false, 19),

  ('Syrian Radio', 'إذاعة سوريا',
   'الإذاعة السورية الرسمية',
   null,
   'https://stream.zeno.fm/syrianradio.mp3',
   'https://stream.zeno.fm/syrianradio.mp3',
   gen_ar, '128', 'ar', 'سوريا', true, false, 20),

  ('Iraqi Radio', 'إذاعة العراق',
   'إذاعة جمهورية العراق',
   null,
   'https://stream.zeno.fm/iraqradio.mp3',
   'https://stream.zeno.fm/iraqradio.mp3',
   gen_ar, '128', 'ar', 'العراق', true, false, 21),

  -- ── MUSIC ─────────────────────────────────────────────────
  ('Rotana Music', 'روتانا موسيقى',
   'إذاعة روتانا للموسيقى العربية',
   null,
   'https://stream.radiojar.com/rotana-music.mp3',
   'https://stream.radiojar.com/rotana-music.mp3',
   gen_music, 'HI', 'ar', 'السعودية', true, true, 22),

  ('Melody FM', 'ميلودي FM',
   'إذاعة ميلودي للموسيقى',
   null,
   'https://stream.zeno.fm/melodyfm.mp3',
   'https://stream.zeno.fm/melodyfm.mp3',
   gen_music, '128', 'ar', 'الإمارات', true, false, 23),

  ('Nile FM Egypt', 'Nile FM مصر',
   'إذاعة نايل FM الإنجليزية من مصر',
   null,
   'https://stream.zeno.fm/nilefm.mp3',
   'https://stream.zeno.fm/nilefm.mp3',
   gen_music, '128', 'en', 'مصر', true, false, 24),

  -- ── INTERNATIONAL ─────────────────────────────────────────
  ('BBC World Service', 'بي بي سي العالمية',
   'BBC World Service radio in English',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/BBC_News_2019.svg/240px-BBC_News_2019.svg.png',
   'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
   'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
   gen_intl, 'HI', 'en', 'المملكة المتحدة', true, true, 25),

  ('RFI French', 'راديو فرنسا الدولي',
   'Radio France Internationale - French language',
   null,
   'https://rfifr.ice.infomaniak.ch/rfifr-64.mp3',
   'https://rfifr.ice.infomaniak.ch/rfifr-64.mp3',
   gen_intl, '64', 'fr', 'فرنسا', true, false, 26),

  ('Deutsche Welle Radio', 'دويتشه فيله إذاعة',
   'Deutsche Welle Radio in Arabic and English',
   null,
   'https://stream.zeno.fm/dw-arabic.mp3',
   'https://stream.zeno.fm/dw-arabic.mp3',
   gen_intl, '128', 'ar', 'ألمانيا', true, false, 27)

  ON CONFLICT DO NOTHING;
END $$;
