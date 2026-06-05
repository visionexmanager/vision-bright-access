-- ================================================================
-- GLOBAL TV CHANNELS & RADIO STATIONS — Comprehensive Seed
-- official_url types handled by OfficialStreamPlayer:
--   youtube.com/embed → YouTube iframe
--   *.m3u8 / *hls*    → HLS video player
--   *.mp3 / icecast / infomaniak / bbcmedia / zeno.fm → Audio player
--   anything else     → External link button
-- ================================================================

DO $$
DECLARE
  -- TV category IDs
  c_news    UUID; c_gulf      UUID; c_arabic   UUID;
  c_ent     UUID; c_sports    UUID; c_relig    UUID;
  c_kids    UUID; c_movies    UUID; c_intl     UUID;
  c_doc     UUID; c_music     UUID; c_edu      UUID;
  c_biz     UUID; c_turkish   UUID; c_asian    UUID;
  c_african UUID; c_levant    UUID; c_nafr     UUID;
  c_nature  UUID; c_lifestyle UUID; c_indian   UUID;
  c_latin   UUID; c_european  UUID; c_culture  UUID;

  -- Radio genre IDs
  g_arabic  UUID; g_quran    UUID; g_news    UUID;
  g_music   UUID; g_intl     UUID; g_sports  UUID;
  g_kids    UUID; g_jazz     UUID; g_rock    UUID;
  g_indian  UUID; g_african  UUID; g_latin   UUID;
  g_spirit  UUID; g_christo  UUID;
BEGIN

  -- ── Resolve TV category IDs ──────────────────────────────────
  SELECT id INTO c_news     FROM public.tv_categories WHERE slug='news';
  SELECT id INTO c_gulf     FROM public.tv_categories WHERE slug='gulf';
  SELECT id INTO c_arabic   FROM public.tv_categories WHERE slug='arabic';
  SELECT id INTO c_ent      FROM public.tv_categories WHERE slug='entertainment';
  SELECT id INTO c_sports   FROM public.tv_categories WHERE slug='sports';
  SELECT id INTO c_relig    FROM public.tv_categories WHERE slug='religious';
  SELECT id INTO c_kids     FROM public.tv_categories WHERE slug='kids';
  SELECT id INTO c_movies   FROM public.tv_categories WHERE slug='movies';
  SELECT id INTO c_intl     FROM public.tv_categories WHERE slug='international';
  SELECT id INTO c_doc      FROM public.tv_categories WHERE slug='documentary';
  SELECT id INTO c_music    FROM public.tv_categories WHERE slug='music';
  SELECT id INTO c_edu      FROM public.tv_categories WHERE slug='education';
  SELECT id INTO c_biz      FROM public.tv_categories WHERE slug='business';
  SELECT id INTO c_turkish  FROM public.tv_categories WHERE slug='turkish';
  SELECT id INTO c_asian    FROM public.tv_categories WHERE slug='asian';
  SELECT id INTO c_african  FROM public.tv_categories WHERE slug='african';
  SELECT id INTO c_levant   FROM public.tv_categories WHERE slug='levant';
  SELECT id INTO c_nafr     FROM public.tv_categories WHERE slug='north-africa';
  SELECT id INTO c_nature   FROM public.tv_categories WHERE slug='nature';
  SELECT id INTO c_lifestyle FROM public.tv_categories WHERE slug='lifestyle';
  SELECT id INTO c_indian   FROM public.tv_categories WHERE slug='indian';
  SELECT id INTO c_latin    FROM public.tv_categories WHERE slug='latin';
  SELECT id INTO c_european FROM public.tv_categories WHERE slug='european';
  SELECT id INTO c_culture  FROM public.tv_categories WHERE slug='culture';

  -- ── Resolve Radio genre IDs ──────────────────────────────────
  SELECT id INTO g_arabic  FROM public.radio_genres WHERE slug='arabic';
  SELECT id INTO g_quran   FROM public.radio_genres WHERE slug='quran';
  SELECT id INTO g_news    FROM public.radio_genres WHERE slug='news';
  SELECT id INTO g_music   FROM public.radio_genres WHERE slug='music';
  SELECT id INTO g_intl    FROM public.radio_genres WHERE slug='international';
  SELECT id INTO g_sports  FROM public.radio_genres WHERE slug='sports';
  SELECT id INTO g_kids    FROM public.radio_genres WHERE slug='kids-radio';
  SELECT id INTO g_jazz    FROM public.radio_genres WHERE slug='jazz-classical';
  SELECT id INTO g_rock    FROM public.radio_genres WHERE slug='rock-pop';
  SELECT id INTO g_indian  FROM public.radio_genres WHERE slug='indian-asian';
  SELECT id INTO g_african FROM public.radio_genres WHERE slug='african';
  SELECT id INTO g_latin   FROM public.radio_genres WHERE slug='latin';
  SELECT id INTO g_spirit  FROM public.radio_genres WHERE slug='spiritual';
  SELECT id INTO g_christo FROM public.radio_genres WHERE slug='christian-radio';

  -- ================================================================
  -- TV CHANNELS
  -- ================================================================
  INSERT INTO public.tv_channels
    (name, name_ar, description, description_ar, logo_url,
     stream_url, official_url, category_id,
     quality, language, country, is_active, is_featured, sort_order)
  VALUES

  -- ── NEWS ─────────────────────────────────────────────────────
  ('Al Jazeera Arabic','قناة الجزيرة',
   'International Arabic news channel based in Qatar',
   'قناة إخبارية عربية دولية مقرها قطر — تغطية على مدار الساعة',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Al_Jazeera_Network_logo.svg/320px-Al_Jazeera_Network_logo.svg.png',
   'https://www.youtube.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg',
   'https://www.youtube.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg',
   c_news,'HD','ar','QA',true,true,1),

  ('Al Jazeera English','الجزيرة الإنجليزية',
   'International English news channel',
   'قناة الجزيرة الإخبارية باللغة الإنجليزية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Al_Jazeera_Network_logo.svg/320px-Al_Jazeera_Network_logo.svg.png',
   'https://live-hls-web-aje.getaj.net/AJE/index.m3u8',
   'https://live-hls-web-aje.getaj.net/AJE/index.m3u8',
   c_news,'HD','en','QA',true,true,2),

  ('France 24 Arabic','فرانس 24 عربي',
   'French international Arabic-language news channel',
   'القناة الدولية الفرنسية للأخبار باللغة العربية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/France24_logo.svg/320px-France24_logo.svg.png',
   'https://www.youtube.com/embed/live_stream?channel=UCZkPkBrQ5G7AAm_AHrFGiwg',
   'https://www.youtube.com/embed/live_stream?channel=UCZkPkBrQ5G7AAm_AHrFGiwg',
   c_news,'HD','ar','FR',true,true,3),

  ('France 24 English','فرانس 24 إنجليزي',
   'French international English-language news',
   'قناة فرانس 24 الإخبارية باللغة الإنجليزية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/France24_logo.svg/320px-France24_logo.svg.png',
   'https://static.france24.com/live/F24_EN_LO_HLS/live_ios.m3u8',
   'https://static.france24.com/live/F24_EN_LO_HLS/live_ios.m3u8',
   c_news,'HD','en','FR',true,false,4),

  ('France 24 French','فرانس 24 فرنسي',
   'French international French-language news',
   'قناة فرانس 24 الإخبارية باللغة الفرنسية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/France24_logo.svg/320px-France24_logo.svg.png',
   'https://static.france24.com/live/F24_FR_LO_HLS/live_ios.m3u8',
   'https://static.france24.com/live/F24_FR_LO_HLS/live_ios.m3u8',
   c_news,'HD','fr','FR',true,false,5),

  ('DW Arabic','دويتشه فيله عربي',
   'German international broadcaster — Arabic service',
   'القناة الدولية الألمانية — الخدمة العربية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/320px-Deutsche_Welle_symbol_2012.svg.png',
   'https://www.youtube.com/embed/live_stream?channel=UCNje3G7rnALMBRJtRj5pV9g',
   'https://www.youtube.com/embed/live_stream?channel=UCNje3G7rnALMBRJtRj5pV9g',
   c_news,'HD','ar','DE',true,false,6),

  ('DW English','دويتشه فيله إنجليزي',
   'German international broadcaster — English service',
   'القناة الدولية الألمانية — الخدمة الإنجليزية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/320px-Deutsche_Welle_symbol_2012.svg.png',
   'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
   'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
   c_news,'HD','en','DE',true,false,7),

  ('Sky News Arabia','سكاي نيوز عربية',
   'Arabic-language satellite news channel',
   'قناة إخبارية عربية فضائية — أبوظبي',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCBoTovJOmQtME-cO2LDMhsg',
   'https://www.youtube.com/embed/live_stream?channel=UCBoTovJOmQtME-cO2LDMhsg',
   c_news,'HD','ar','AE',true,true,8),

  ('BBC World News','بي بي سي وورلد نيوز',
   'BBC international English news channel',
   'قناة بي بي سي الدولية الإخبارية باللغة الإنجليزية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/BBC_Logo_2021.svg/320px-BBC_Logo_2021.svg.png',
   'https://www.bbc.com/news/av/10462520',
   'https://www.bbc.com/news/av/10462520',
   c_news,'HD','en','GB',true,true,9),

  ('BBC Arabic','بي بي سي عربي',
   'BBC Arabic television news',
   'قناة بي بي سي العربية الإخبارية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/BBC_Logo_2021.svg/320px-BBC_Logo_2021.svg.png',
   'https://www.bbc.com/arabic/media/v/arabic_tv',
   'https://www.bbc.com/arabic/media/v/arabic_tv',
   c_news,'HD','ar','GB',true,true,10),

  ('Al Arabiya','العربية',
   'Saudi 24-hour Arabic-language news channel',
   'قناة العربية الإخبارية السعودية — على مدار الساعة',
   null,
   'https://www.alarabiya.net/ar/tv',
   'https://www.alarabiya.net/ar/tv',
   c_news,'HD','ar','SA',true,true,11),

  ('Al Hurra','الحرة',
   'US-funded Arabic-language news channel',
   'قناة الحرة — بث مدعوم أمريكياً',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCPVWMCUz9GGE8v7dkSwrpJA',
   'https://www.youtube.com/embed/live_stream?channel=UCPVWMCUz9GGE8v7dkSwrpJA',
   c_news,'HD','ar','US',true,false,12),

  ('RT Arabic','آر تي عربي',
   'Russian Today Arabic news channel',
   'قناة روسيا اليوم العربية',
   null,
   'https://arabic.rt.com/on_air/',
   'https://arabic.rt.com/on_air/',
   c_news,'HD','ar','RU',true,false,13),

  ('CNN International','سي إن إن الدولية',
   'CNN international English news',
   'قناة سي إن إن الدولية الإخبارية',
   null,
   'https://edition.cnn.com/live-tv',
   'https://edition.cnn.com/live-tv',
   c_news,'HD','en','US',true,false,14),

  ('CGTN Arabic','CGTN عربي',
   'China Global Television Network — Arabic',
   'شبكة التلفزيون الصيني العالمي — العربية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UC7cs8q-gJRlGwj4A8OmCmXg',
   'https://www.youtube.com/embed/live_stream?channel=UC7cs8q-gJRlGwj4A8OmCmXg',
   c_news,'HD','ar','CN',true,false,15),

  ('Al Mayadeen','الميادين',
   'Lebanese pan-Arab news satellite channel',
   'قناة الميادين الإخبارية الفضائية اللبنانية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCt9E7WyD8xdPuCnb-wsMBFg',
   'https://www.youtube.com/embed/live_stream?channel=UCt9E7WyD8xdPuCnb-wsMBFg',
   c_news,'HD','ar','LB',true,false,16),

  -- ── GULF ─────────────────────────────────────────────────────
  ('Saudi TV 1','قناة السعودية',
   'Saudi Arabia national television',
   'القناة التلفزيونية الوطنية السعودية',
   null,
   'https://www.saudiatv.sa/live',
   'https://www.saudiatv.sa/live',
   c_gulf,'HD','ar','SA',true,true,20),

  ('MBC 1','إم بي سي 1',
   'Saudi general entertainment and news channel',
   'قناة إم بي سي الأولى — ترفيه وأخبار',
   null,
   'https://www.mbc.net/ar/mbc1/live.html',
   'https://www.mbc.net/ar/mbc1/live.html',
   c_gulf,'HD','ar','SA',true,true,21),

  ('Dubai TV','دبي',
   'Dubai Media Incorporated television',
   'قناة دبي التلفزيونية — مؤسسة دبي للإعلام',
   null,
   'https://www.dmc.ae/ar/live',
   'https://www.dmc.ae/ar/live',
   c_gulf,'HD','ar','AE',true,true,22),

  ('Abu Dhabi TV','أبوظبي',
   'Abu Dhabi Media general channel',
   'قناة أبوظبي — قناة عامة من شركة أبوظبي للإعلام',
   null,
   'https://adtv.ae/ar/live',
   'https://adtv.ae/ar/live',
   c_gulf,'HD','ar','AE',true,true,23),

  ('Kuwait TV','تلفزيون الكويت',
   'Kuwait state television',
   'التلفزيون الرسمي لدولة الكويت',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCcKNJUKRHAnGHWf52hPpAJw',
   'https://www.youtube.com/embed/live_stream?channel=UCcKNJUKRHAnGHWf52hPpAJw',
   c_gulf,'HD','ar','KW',true,false,24),

  ('Bahrain TV','تلفزيون البحرين',
   'Bahrain national television',
   'تلفزيون البحرين الوطني',
   null,
   'https://www.bbc.com/arabic',
   'https://www.youtube.com/embed/live_stream?channel=UCv3J5Gh8KrjuBApFg7Zj5ew',
   c_gulf,'HD','ar','BH',true,false,25),

  ('Qatar TV','تلفزيون قطر',
   'Qatar state television',
   'التلفزيون الرسمي لدولة قطر',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCZjjE52s4GIeIBhCrqp_P_w',
   'https://www.youtube.com/embed/live_stream?channel=UCZjjE52s4GIeIBhCrqp_P_w',
   c_gulf,'HD','ar','QA',true,false,26),

  ('Oman TV','تلفزيون عُمان',
   'Oman national television',
   'التلفزيون الوطني لسلطنة عُمان',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCf2kXqJMX8m7sFtCHLBRUsQ',
   'https://www.youtube.com/embed/live_stream?channel=UCf2kXqJMX8m7sFtCHLBRUsQ',
   c_gulf,'SD','ar','OM',true,false,27),

  ('Sharjah TV','تلفزيون الشارقة',
   'Sharjah media channel',
   'قناة تلفزيون الشارقة',
   null,
   'https://www.sharjahtv.ae/live',
   'https://www.sharjahtv.ae/live',
   c_gulf,'HD','ar','AE',true,false,28),

  ('Rotana Khalijiyya','روتانا خليجية',
   'Gulf drama and entertainment channel',
   'قناة روتانا خليجية للدراما والترفيه الخليجي',
   null,
   'https://www.rotana.net/rotanakhaleejiatv',
   'https://www.rotana.net/rotanakhaleejiatv',
   c_gulf,'HD','ar','SA',true,false,29),

  -- ── ARABIC ────────────────────────────────────────────────────
  ('CBC Egypt','سي بي سي مصر',
   'Egyptian private satellite channel',
   'قناة سي بي سي الفضائية المصرية الخاصة',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCXR5oMBpJBIpCnGqJAKFhGA',
   'https://www.youtube.com/embed/live_stream?channel=UCXR5oMBpJBIpCnGqJAKFhGA',
   c_arabic,'HD','ar','EG',true,true,30),

  ('ON E Egypt','قناة أون',
   'Egyptian satellite channel',
   'قناة أون المصرية الفضائية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCMGCnSYBpyH4QkDaocWFUlg',
   'https://www.youtube.com/embed/live_stream?channel=UCMGCnSYBpyH4QkDaocWFUlg',
   c_arabic,'HD','ar','EG',true,false,31),

  ('LBC Lebanon','إل بي سي',
   'Lebanese Broadcasting Corporation',
   'شركة اللبنانية للإرسال',
   null,
   'https://www.lbci.com/tv',
   'https://www.lbci.com/tv',
   c_arabic,'HD','ar','LB',true,true,32),

  ('Al Jadeed','الجديد',
   'Lebanese independent satellite channel',
   'قناة الجديد اللبنانية المستقلة',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCPDt4EJoqaXQvdFOshWv-IQ',
   'https://www.youtube.com/embed/live_stream?channel=UCPDt4EJoqaXQvdFOshWv-IQ',
   c_arabic,'HD','ar','LB',true,false,33),

  ('Nile TV International','نايل TV الدولية',
   'Egypt international satellite channel',
   'قناة نايل الدولية الفضائية المصرية',
   null,
   'https://www.ertu.org/live',
   'https://www.ertu.org/live',
   c_arabic,'SD','ar','EG',true,false,34),

  ('Jordan TV','التلفزيون الأردني',
   'Jordan national television',
   'التلفزيون الأردني الرسمي',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCMf0PMuHjgz2jZoGPTf9H7A',
   'https://www.youtube.com/embed/live_stream?channel=UCMf0PMuHjgz2jZoGPTf9H7A',
   c_arabic,'HD','ar','JO',true,false,35),

  ('Iraq TV','قناة العراقية',
   'Iraq state television',
   'القناة العراقية الرسمية',
   null,
   'https://www.iraqitv.iq/live',
   'https://www.iraqitv.iq/live',
   c_arabic,'SD','ar','IQ',true,false,36),

  ('Syria TV','التلفزيون السوري',
   'Syrian Arab television',
   'التلفزيون العربي السوري',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UClHECdULhTTYCq0WFYk3bCg',
   'https://www.youtube.com/embed/live_stream?channel=UClHECdULhTTYCq0WFYk3bCg',
   c_arabic,'SD','ar','SY',true,false,37),

  -- ── ENTERTAINMENT ─────────────────────────────────────────────
  ('MBC 2','إم بي سي 2',
   'MBC movies and series channel',
   'قناة إم بي سي 2 للأفلام والمسلسلات',
   null,
   'https://www.mbc.net/ar/mbc2/live.html',
   'https://www.mbc.net/ar/mbc2/live.html',
   c_ent,'HD','ar','SA',true,true,40),

  ('MBC 4','إم بي سي 4',
   'MBC lifestyle and entertainment',
   'قناة إم بي سي 4 للترفيه والحياة',
   null,
   'https://www.mbc.net/ar/mbc4/live.html',
   'https://www.mbc.net/ar/mbc4/live.html',
   c_ent,'HD','ar','SA',true,false,41),

  ('MBC Drama','إم بي سي دراما',
   'MBC drama channel',
   'قناة إم بي سي دراما للمسلسلات',
   null,
   'https://www.mbc.net/ar/mbcdrama/live.html',
   'https://www.mbc.net/ar/mbcdrama/live.html',
   c_ent,'HD','ar','SA',true,true,42),

  ('MBC Masr','إم بي سي مصر',
   'MBC Egyptian channel',
   'قناة إم بي سي مصر',
   null,
   'https://www.mbc.net/ar/mbcmasr/live.html',
   'https://www.mbc.net/ar/mbcmasr/live.html',
   c_ent,'HD','ar','EG',true,false,43),

  ('CBC Sofra','سي بي سي سفرة',
   'Egyptian cooking and lifestyle',
   'قناة سي بي سي سفرة المصرية للطبخ والحياة',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UC0yDi4bNAJiXJtJhxiNjHhQ',
   'https://www.youtube.com/embed/live_stream?channel=UC0yDi4bNAJiXJtJhxiNjHhQ',
   c_ent,'HD','ar','EG',true,false,44),

  ('Al Hayah','الحياة',
   'Egyptian entertainment channel',
   'قناة الحياة المصرية للترفيه',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCh3wUQ_7GKnwEVzKTUkbBmg',
   'https://www.youtube.com/embed/live_stream?channel=UCh3wUQ_7GKnwEVzKTUkbBmg',
   c_ent,'HD','ar','EG',true,false,45),

  ('Rotana Cinema','روتانا سينما',
   'Arabic movies channel',
   'قناة روتانا سينما للأفلام العربية',
   null,
   'https://www.rotana.net/rotanatv',
   'https://www.rotana.net/rotanatv',
   c_ent,'HD','ar','SA',true,false,46),

  ('MBC Bollywood','إم بي سي بوليوود',
   'MBC Bollywood Indian channel',
   'قناة إم بي سي بوليوود للأفلام الهندية',
   null,
   'https://www.mbc.net/ar/mbcbollywood/live.html',
   'https://www.mbc.net/ar/mbcbollywood/live.html',
   c_ent,'HD','hi','SA',true,false,47),

  -- ── SPORTS ────────────────────────────────────────────────────
  ('beIN Sports 1','بي إن سبورتس 1',
   'beIN Sports flagship sports channel',
   'قناة بي إن سبورتس 1 الرئيسية',
   null,
   'https://www.bein.com/ar/live-tv/',
   'https://www.bein.com/ar/live-tv/',
   c_sports,'FHD','ar','QA',true,true,50),

  ('SSC Sport 1','SSC الرياضية 1',
   'Saudi Sports Company channel 1',
   'قناة SSC الرياضية السعودية 1',
   null,
   'https://ssc.com.sa/ar/channels/',
   'https://ssc.com.sa/ar/channels/',
   c_sports,'FHD','ar','SA',true,true,51),

  ('Abu Dhabi Sports 1','أبوظبي الرياضية 1',
   'Abu Dhabi Sports flagship channel',
   'قناة أبوظبي الرياضية الأولى',
   null,
   'https://adtv.ae/ar/sport-live',
   'https://adtv.ae/ar/sport-live',
   c_sports,'FHD','ar','AE',true,true,52),

  ('Al Kass Sports','الكأس',
   'Al Kass Qatari sports channel',
   'قناة الكأس القطرية الرياضية',
   null,
   'https://www.alkass.net/live',
   'https://www.alkass.net/live',
   c_sports,'FHD','ar','QA',true,false,53),

  ('ESPN International','ESPN الدولية',
   'ESPN international sports coverage',
   'قناة ESPN الرياضية الدولية',
   null,
   'https://www.espn.com/watch/',
   'https://www.espn.com/watch/',
   c_sports,'HD','en','US',true,false,54),

  ('Eurosport','يوروسبورت',
   'European and international sports',
   'القناة الرياضية الأوروبية والدولية',
   null,
   'https://www.eurosport.com/live/',
   'https://www.eurosport.com/live/',
   c_sports,'HD','en','EU',true,false,55),

  -- ── RELIGIOUS ─────────────────────────────────────────────────
  ('Iqraa TV','قناة اقرأ',
   'Islamic educational and religious channel',
   'قناة اقرأ الإسلامية التعليمية والدينية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCVkEnr9qWDVr37iHVGVY-Vg',
   'https://www.youtube.com/embed/live_stream?channel=UCVkEnr9qWDVr37iHVGVY-Vg',
   c_relig,'HD','ar','SA',true,true,60),

  ('Al Majd Quran','المجد للقرآن',
   'Holy Quran recitation channel',
   'قناة المجد للقرآن الكريم — تلاوة على مدار الساعة',
   null,
   'https://www.almajdtv.com/live',
   'https://www.almajdtv.com/live',
   c_relig,'HD','ar','SA',true,true,61),

  ('Huda TV','هدى',
   'Islamic educational channel in English',
   'قناة هدى الإسلامية التعليمية باللغة الإنجليزية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCYGgKnFxTtSPDmgmSp66LAQ',
   'https://www.youtube.com/embed/live_stream?channel=UCYGgKnFxTtSPDmgmSp66LAQ',
   c_relig,'HD','en','QA',true,true,62),

  ('Peace TV','بيس تي في',
   'International Islamic channel',
   'قناة بيس TV الإسلامية الدولية',
   null,
   'https://www.peacetv.tv/live/',
   'https://www.peacetv.tv/live/',
   c_relig,'HD','en','IN',true,false,63),

  ('Safa TV','صفا',
   'Iranian Islamic satellite channel',
   'قناة صفا الإيرانية الفضائية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCnfmOKrjzFMdIcXlL-L5gOg',
   'https://www.youtube.com/embed/live_stream?channel=UCnfmOKrjzFMdIcXlL-L5gOg',
   c_relig,'HD','ar','IR',true,false,64),

  ('Al Hayah Quran','الحياة قرآن',
   'Egyptian Quran channel',
   'قناة الحياة للقرآن الكريم المصرية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCXk5ENFsQyMIKX3aESpQtfQ',
   'https://www.youtube.com/embed/live_stream?channel=UCXk5ENFsQyMIKX3aESpQtfQ',
   c_relig,'HD','ar','EG',true,false,65),

  -- ── KIDS ──────────────────────────────────────────────────────
  ('Spacetoon','سبيستون',
   'Pan-Arab children''s entertainment channel',
   'قناة سبيستون العربية لبرامج الأطفال',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCgcNJG8h7FKnNz0UQAP7I7w',
   'https://www.youtube.com/embed/live_stream?channel=UCgcNJG8h7FKnNz0UQAP7I7w',
   c_kids,'HD','ar','AE',true,true,70),

  ('Toyor Al Jannah','طيور الجنة',
   'Islamic children''s channel',
   'قناة طيور الجنة للأطفال الإسلامية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCQ2xtAMcIkXxSjBr2D_ZFSA',
   'https://www.youtube.com/embed/live_stream?channel=UCQ2xtAMcIkXxSjBr2D_ZFSA',
   c_kids,'HD','ar','SA',true,true,71),

  ('MBC3','إم بي سي 3',
   'MBC children''s channel',
   'قناة إم بي سي 3 للأطفال',
   null,
   'https://www.mbc.net/ar/mbc3/live.html',
   'https://www.mbc.net/ar/mbc3/live.html',
   c_kids,'HD','ar','SA',true,false,72),

  ('Jeem TV','جيم',
   'Qatar children''s channel',
   'قناة جيم القطرية للأطفال',
   null,
   'https://www.jeem.tv/live',
   'https://www.jeem.tv/live',
   c_kids,'HD','ar','QA',true,false,73),

  ('Cartoon Network Arabic','كرتون نتورك عربي',
   'Cartoon Network Arabic service',
   'قناة كرتون نتورك بالعربية',
   null,
   'https://www.cartoonnetworkarabia.com/',
   'https://www.cartoonnetworkarabia.com/',
   c_kids,'HD','ar','AE',true,false,74),

  -- ── MOVIES ────────────────────────────────────────────────────
  ('Rotana Cinema','روتانا سينما',
   'Arabic cinema channel',
   'قناة روتانا سينما للأفلام العربية',
   null,
   'https://www.rotana.net/rotanatv/channels/rotana-cinema',
   'https://www.rotana.net/rotanatv/channels/rotana-cinema',
   c_movies,'HD','ar','SA',true,true,80),

  ('Aflam TV','أفلام TV',
   'Arabic and international films',
   'قناة أفلام للسينما العربية والعالمية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCawq35M8etdmXLDGFdMqmOg',
   'https://www.youtube.com/embed/live_stream?channel=UCawq35M8etdmXLDGFdMqmOg',
   c_movies,'HD','ar','SA',true,false,81),

  ('MBC2 Movies','إم بي سي 2',
   'MBC English and Arabic movies',
   'قناة إم بي سي 2 للأفلام العربية والإنجليزية',
   null,
   'https://www.mbc.net/ar/mbc2/live.html',
   'https://www.mbc.net/ar/mbc2/live.html',
   c_movies,'HD','ar','SA',true,false,82),

  -- ── INTERNATIONAL ─────────────────────────────────────────────
  ('NHK World Japan','NHK وورلد يابان',
   'Japan''s international public broadcaster',
   'هيئة الإذاعة اليابانية العالمية',
   null,
   'https://nhkworldhls-i.akamaized.net/nhkworld/abr/v11_abr.m3u8',
   'https://nhkworldhls-i.akamaized.net/nhkworld/abr/v11_abr.m3u8',
   c_intl,'HD','en','JP',true,true,90),

  ('KBS World Korea','KBS وورلد كوريا',
   'Korean Broadcasting System international channel',
   'قناة KBS الكورية العالمية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCj4fNHdZJQs6jJiByxRJsqw',
   'https://www.youtube.com/embed/live_stream?channel=UCj4fNHdZJQs6jJiByxRJsqw',
   c_intl,'HD','ko','KR',true,true,91),

  ('CGTN English','CGTN الإنجليزية',
   'China Global Television Network English',
   'شبكة التلفزيون الصيني العالمي باللغة الإنجليزية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCtenTAAbbas514MCvKPz1QZA',
   'https://www.youtube.com/embed/live_stream?channel=UCtenTAAbbas514MCvKPz1QZA',
   c_intl,'HD','en','CN',true,true,92),

  ('TRT World','TRT وورلد',
   'Turkish international English broadcaster',
   'القناة التركية الدولية باللغة الإنجليزية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UC7BDTmFzKN54yqRd_dT2_5g',
   'https://www.youtube.com/embed/live_stream?channel=UC7BDTmFzKN54yqRd_dT2_5g',
   c_intl,'HD','en','TR',true,true,93),

  ('Africanews English','أفريكانيوز',
   'Pan-African multilingual news channel',
   'قناة أفريكانيوز متعددة اللغات',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCCKnMFCVFxHhF3lHKDMp8kQ',
   'https://www.youtube.com/embed/live_stream?channel=UCCKnMFCVFxHhF3lHKDMp8kQ',
   c_intl,'HD','en','FR',true,false,94),

  ('TV5MONDE French','TV5 موند',
   'French-language international channel',
   'القناة الدولية الناطقة بالفرنسية',
   null,
   'https://www.tv5monde.com/emissions/direct',
   'https://www.tv5monde.com/emissions/direct',
   c_intl,'HD','fr','FR',true,false,95),

  ('NASA TV','ناسا TV',
   'NASA public television — space and science',
   'قناة ناسا العامة — الفضاء والعلوم',
   null,
   'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
   'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
   c_intl,'HD','en','US',true,true,96),

  -- ── DOCUMENTARY ───────────────────────────────────────────────
  ('National Geographic Arabic','ناشيونال جيوغرافيك عربي',
   'NatGeo Arabic documentaries',
   'قناة ناشيونال جيوغرافيك العربية للوثائقيات',
   null,
   'https://www.nationalgeographic.com/tv/watch-national-geographic/',
   'https://www.nationalgeographic.com/tv/watch-national-geographic/',
   c_doc,'HD','ar','AE',true,true,100),

  ('BBC Earth','بي بي سي إيرث',
   'BBC Earth nature documentaries',
   'قناة بي بي سي إيرث للوثائقيات الطبيعية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCwmZiChSryoWQCZMIQezgTg',
   'https://www.youtube.com/embed/live_stream?channel=UCwmZiChSryoWQCZMIQezgTg',
   c_doc,'HD','en','GB',true,true,101),

  ('DW Documentary','دويتشه فيله وثائقي',
   'DW documentary channel',
   'قناة دويتشه فيله للوثائقيات',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UC9t_5CzPyxNBr8zBp-QhOBg',
   'https://www.youtube.com/embed/live_stream?channel=UC9t_5CzPyxNBr8zBp-QhOBg',
   c_doc,'HD','en','DE',true,false,102),

  -- ── MUSIC ─────────────────────────────────────────────────────
  ('Rotana Music','روتانا موسيقى',
   'Arabic music channel',
   'قناة روتانا الموسيقية العربية',
   null,
   'https://www.rotana.net/rotanatv/channels/rotana-music',
   'https://www.rotana.net/rotanatv/channels/rotana-music',
   c_music,'HD','ar','SA',true,true,110),

  ('Mazzika','مزيكا',
   'Egyptian music channel',
   'قناة مزيكا المصرية للموسيقى',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCdRWi6UBqFvnEAIq6ZjNfAA',
   'https://www.youtube.com/embed/live_stream?channel=UCdRWi6UBqFvnEAIq6ZjNfAA',
   c_music,'HD','ar','EG',true,true,111),

  ('Melody Arabia','ميلودي العربية',
   'Pan-Arab music channel',
   'قناة ميلودي العربية للموسيقى',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCII7qmT09jUkXE-AvE_t5mw',
   'https://www.youtube.com/embed/live_stream?channel=UCII7qmT09jUkXE-AvE_t5mw',
   c_music,'HD','ar','SA',true,false,112),

  ('MTV Lebanon','MTV لبنان',
   'Lebanese music and entertainment',
   'قناة MTV اللبنانية للموسيقى والترفيه',
   null,
   'https://www.mtv.com.lb/tv/live',
   'https://www.mtv.com.lb/tv/live',
   c_music,'HD','ar','LB',true,false,113),

  -- ── BUSINESS ──────────────────────────────────────────────────
  ('CNBC Arabia','CNBC عربية',
   'Arabic business and financial news',
   'قناة CNBC العربية للأعمال والاقتصاد',
   null,
   'https://www.cnbcarabia.com/liveTV',
   'https://www.cnbcarabia.com/liveTV',
   c_biz,'HD','ar','AE',true,true,120),

  ('Bloomberg TV','بلومبرغ TV',
   'International business and finance',
   'قناة بلومبرغ للأعمال والاقتصاد الدولي',
   null,
   'https://www.bloomberg.com/live/us',
   'https://www.bloomberg.com/live/us',
   c_biz,'HD','en','US',true,false,121),

  ('Al Jazeera Finance','الجزيرة مباشر اقتصاد',
   'Al Jazeera economic coverage',
   'التغطية الاقتصادية لشبكة الجزيرة',
   null,
   'https://mubasher.aljazeera.net/live',
   'https://mubasher.aljazeera.net/live',
   c_biz,'HD','ar','QA',true,false,122),

  -- ── TURKISH ───────────────────────────────────────────────────
  ('TRT Arabic','TRT عربي',
   'Turkish Radio and Television Arabic channel',
   'قناة TRT العربية التركية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCsgkWFR2e4FORfG-3WZjXTg',
   'https://www.youtube.com/embed/live_stream?channel=UCsgkWFR2e4FORfG-3WZjXTg',
   c_turkish,'HD','ar','TR',true,true,130),

  ('TRT World','TRT وورلد',
   'Turkish international English channel',
   'القناة التركية الدولية الإنجليزية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UC7BDTmFzKN54yqRd_dT2_5g',
   'https://www.youtube.com/embed/live_stream?channel=UC7BDTmFzKN54yqRd_dT2_5g',
   c_turkish,'HD','en','TR',true,true,131),

  ('ATV Turkey','ATV تركيا',
   'Turkish entertainment channel',
   'قناة ATV التركية الترفيهية',
   null,
   'https://www.atv.com.tr/webtv/canli-yayin',
   'https://www.atv.com.tr/webtv/canli-yayin',
   c_turkish,'HD','tr','TR',true,false,132),

  ('Show TV Turkey','شو TV تركيا',
   'Turkish drama and entertainment',
   'قناة شو TV التركية للدراما والترفيه',
   null,
   'https://www.showtv.com.tr/canli-yayin/',
   'https://www.showtv.com.tr/canli-yayin/',
   c_turkish,'HD','tr','TR',true,false,133),

  -- ── ASIAN ─────────────────────────────────────────────────────
  ('NHK World Japan','NHK العالمية',
   'NHK World Japan 24-hour English',
   'قناة NHK اليابانية العالمية باللغة الإنجليزية',
   null,
   'https://nhkworldhls-i.akamaized.net/nhkworld/abr/v11_abr.m3u8',
   'https://nhkworldhls-i.akamaized.net/nhkworld/abr/v11_abr.m3u8',
   c_asian,'HD','en','JP',true,true,140),

  ('KBS World','KBS وورلد',
   'Korean Broadcasting System international',
   'القناة الكورية العالمية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCj4fNHdZJQs6jJiByxRJsqw',
   'https://www.youtube.com/embed/live_stream?channel=UCj4fNHdZJQs6jJiByxRJsqw',
   c_asian,'HD','ko','KR',true,true,141),

  ('CCTV-4 China','CCTV-4 الصينية',
   'China Central Television international Chinese',
   'قناة CCTV-4 الصينية المركزية الدولية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCtenTAAbbas514MCvKPz1QZA',
   'https://www.youtube.com/embed/live_stream?channel=UCtenTAAbbas514MCvKPz1QZA',
   c_asian,'HD','zh','CN',true,false,142),

  -- ── AFRICAN ───────────────────────────────────────────────────
  ('Africa 24','أفريكا 24',
   'Pan-African multilingual news',
   'قناة أفريكا 24 الإخبارية متعددة اللغات',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCCKnMFCVFxHhF3lHKDMp8kQ',
   'https://www.youtube.com/embed/live_stream?channel=UCCKnMFCVFxHhF3lHKDMp8kQ',
   c_african,'HD','fr','FR',true,true,150),

  ('Channels TV Nigeria','قنوات نيجيريا',
   'Nigeria leading news channel',
   'قناة تشانلز النيجيرية الإخبارية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCCKnMFCVFxHhF3lHKDMp8kQ',
   'https://www.youtube.com/embed/live_stream?channel=UCCKnMFCVFxHhF3lHKDMp8kQ',
   c_african,'HD','en','NG',true,false,151),

  ('SABC News','SABC الأخبار',
   'South Africa Broadcasting Corporation news',
   'قناة أخبار هيئة الإذاعة جنوب أفريقيا',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCfOAnfFSwNcqOasFPuKX3gg',
   'https://www.youtube.com/embed/live_stream?channel=UCfOAnfFSwNcqOasFPuKX3gg',
   c_african,'HD','en','ZA',true,false,152),

  -- ── LEVANT ────────────────────────────────────────────────────
  ('OTV Lebanon','OTV لبنان',
   'Lebanese Orange TV channel',
   'قناة OTV اللبنانية',
   null,
   'https://www.otv.com.lb/live',
   'https://www.otv.com.lb/live',
   c_levant,'HD','ar','LB',true,true,160),

  ('Al Manar Lebanon','المنار',
   'Lebanese Hezbollah satellite channel',
   'قناة المنار الفضائية اللبنانية',
   null,
   'https://www.almanar.com.lb/live',
   'https://www.almanar.com.lb/live',
   c_levant,'HD','ar','LB',true,false,161),

  -- ── NORTH AFRICA ──────────────────────────────────────────────
  ('2M Morocco','2M المغرب',
   'Moroccan second channel',
   'القناة المغربية الثانية 2M',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UC6LXGWzJ_M7UzBMXl3pMVvQ',
   'https://www.youtube.com/embed/live_stream?channel=UC6LXGWzJ_M7UzBMXl3pMVvQ',
   c_nafr,'HD','ar','MA',true,true,170),

  ('Al Aoula Morocco','الأولى المغرب',
   'Morocco national first channel',
   'القناة الأولى المغربية الوطنية',
   null,
   'https://www.snrt.ma/live-tv',
   'https://www.snrt.ma/live-tv',
   c_nafr,'SD','ar','MA',true,false,171),

  ('Algeria TV','التلفزيون الجزائري',
   'Algeria national television',
   'التلفزيون الجزائري الرسمي',
   null,
   'https://www.entebbe.dz/live',
   'https://www.youtube.com/embed/live_stream?channel=UCJDz2-s0g_FRnVHAr_9FMPA',
   c_nafr,'SD','ar','DZ',true,false,172),

  ('Tunisia 1','تونس 1',
   'Tunisian national television',
   'القناة التونسية الوطنية الأولى',
   null,
   'https://www.watania1.tn/live',
   'https://www.watania1.tn/live',
   c_nafr,'SD','ar','TN',true,false,173),

  -- ── EDUCATION ─────────────────────────────────────────────────
  ('NASA TV Science','ناسا العلوم',
   'NASA TV public channel — science and exploration',
   'قناة ناسا للعلوم واستكشاف الفضاء',
   null,
   'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
   'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
   c_edu,'HD','en','US',true,true,180),

  ('TED Talks','تيد توكس',
   'TED talks and ideas worth spreading',
   'محاضرات TED وأفكار تستحق الانتشار',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCAuUUnT6oDeKwE6v1NGQxug',
   'https://www.youtube.com/embed/live_stream?channel=UCAuUUnT6oDeKwE6v1NGQxug',
   c_edu,'HD','en','US',true,true,181),

  -- ── NATURE ────────────────────────────────────────────────────
  ('Nat Geo Wild','ناشيونال جيوغرافيك وايلد',
   'National Geographic wildlife channel',
   'قناة ناشيونال جيوغرافيك وايلد للحياة البرية',
   null,
   'https://www.nationalgeographic.com/tv/',
   'https://www.nationalgeographic.com/tv/',
   c_nature,'HD','en','US',true,true,190),

  ('BBC Earth','بي بي سي إيرث',
   'BBC natural world documentaries',
   'قناة بي بي سي إيرث للوثائقيات الطبيعية',
   null,
   'https://www.youtube.com/embed/live_stream?channel=UCwmZiChSryoWQCZMIQezgTg',
   'https://www.youtube.com/embed/live_stream?channel=UCwmZiChSryoWQCZMIQezgTg',
   c_nature,'HD','en','GB',true,false,191),

  -- ── INDIAN ────────────────────────────────────────────────────
  ('Zee TV','زي TV',
   'Indian Hindi general entertainment',
   'قناة زي TV الهندية الترفيهية',
   null,
   'https://www.zee5.com/live-tv/details/zee-tv/0-6-1777',
   'https://www.zee5.com/live-tv/details/zee-tv/0-6-1777',
   c_indian,'HD','hi','IN',true,true,200),

  ('Star Plus','ستار بلس',
   'Indian entertainment channel',
   'قناة ستار بلس الهندية الترفيهية',
   null,
   'https://www.hotstar.com/in/live/star-plus/1',
   'https://www.hotstar.com/in/live/star-plus/1',
   c_indian,'HD','hi','IN',true,false,201),

  ('DD News India','DD نيوز الهند',
   'Doordarshan national news channel',
   'قناة دوردارشان الهندية الإخبارية',
   null,
   'https://ddnews.gov.in/live-tv',
   'https://ddnews.gov.in/live-tv',
   c_indian,'HD','en','IN',true,false,202),

  -- ── LATIN ─────────────────────────────────────────────────────
  ('Univision','يونيفيجن',
   'Spanish-language US television',
   'القناة الأمريكية الناطقة بالإسبانية',
   null,
   'https://www.univision.com/shows/noticiero-univision/livestream',
   'https://www.univision.com/shows/noticiero-univision/livestream',
   c_latin,'HD','es','US',true,true,210),

  ('Telemundo','تيليموندو',
   'Spanish-language US television',
   'تيليموندو — قناة أمريكية إسبانية',
   null,
   'https://www.telemundo.com/en/shows/noticias-telemundo/live',
   'https://www.telemundo.com/en/shows/noticias-telemundo/live',
   c_latin,'HD','es','US',true,false,211),

  -- ── EUROPEAN ──────────────────────────────────────────────────
  ('RAI Italy','RAI إيطاليا',
   'Italy national broadcaster',
   'قناة RAI الإيطالية الوطنية',
   null,
   'https://www.raiplay.it/dirette/rai1',
   'https://www.raiplay.it/dirette/rai1',
   c_european,'HD','it','IT',true,true,220),

  ('ARD Germany','ARD ألمانيا',
   'Germany first public television',
   'القناة الأولى الألمانية العامة',
   null,
   'https://www.ardmediathek.de/live/Y3JpZDovL2Rhc2Vyc3RlLmRlL2xpdmUvY2xpcC9hcGlkZWZhdWx0',
   'https://www.ardmediathek.de/live/Y3JpZDovL2Rhc2Vyc3RlLmRlL2xpdmUvY2xpcC9hcGlkZWZhdWx0',
   c_european,'HD','de','DE',true,true,221),

  ('Euronews English','يورونيوز إنجليزي',
   'European multilingual news channel',
   'قناة يورونيوز الأوروبية متعددة اللغات',
   null,
   'https://www.euronews.com/live',
   'https://www.euronews.com/live',
   c_european,'HD','en','EU',true,true,222),

  ('RTE Ireland','RTE أيرلندا',
   'Irish national broadcaster',
   'القناة الأيرلندية الوطنية',
   null,
   'https://www.rte.ie/player/live/rte-one',
   'https://www.rte.ie/player/live/rte-one',
   c_european,'HD','en','IE',true,false,223),

  ('NOS Netherlands','NOS هولندا',
   'Netherlands public broadcaster',
   'القناة العامة الهولندية',
   null,
   'https://nos.nl/live',
   'https://nos.nl/live',
   c_european,'HD','nl','NL',true,false,224);

  -- ================================================================
  -- RADIO STATIONS
  -- ================================================================
  INSERT INTO public.radio_stations
    (name, name_ar, description, description_ar, logo_url,
     stream_url, official_url, genre_id,
     bitrate, language, country, is_active, is_featured, sort_order)
  VALUES

  -- ── BBC STREAMS (verified working HLS via bbcmedia/akamaized) ─
  ('BBC World Service','بي بي سي وورلد سيرفيس',
   'BBC international English radio',
   'إذاعة بي بي سي العالمية باللغة الإنجليزية',
   null,
   'https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_world_service/bbc_world_service.isml/bbc_world_service-audio=128000.m3u8',
   'https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_world_service/bbc_world_service.isml/bbc_world_service-audio=128000.m3u8',
   g_news,'128','en','GB',true,true,1),

  ('BBC Arabic Radio','إذاعة بي بي سي عربي',
   'BBC Arabic language radio service',
   'الخدمة الإذاعية العربية لبي بي سي',
   null,
   'https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_arabic_radio/bbc_arabic_radio.isml/bbc_arabic_radio-audio=128000.m3u8',
   'https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_arabic_radio/bbc_arabic_radio.isml/bbc_arabic_radio-audio=128000.m3u8',
   g_arabic,'128','ar','GB',true,true,2),

  ('BBC Radio 1','بي بي سي راديو 1',
   'BBC Radio 1 — pop, dance, new music',
   'بي بي سي راديو 1 — موسيقى البوب والرقص والجديد',
   null,
   'https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_radio_one/bbc_radio_one.isml/bbc_radio_one-audio=128000.m3u8',
   'https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_radio_one/bbc_radio_one.isml/bbc_radio_one-audio=128000.m3u8',
   g_rock,'128','en','GB',true,true,3),

  ('BBC Radio 2','بي بي سي راديو 2',
   'BBC Radio 2 — classic hits and talk',
   'بي بي سي راديو 2 — كلاسيكيات وحديث',
   null,
   'https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_radio_two/bbc_radio_two.isml/bbc_radio_two-audio=128000.m3u8',
   'https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_radio_two/bbc_radio_two.isml/bbc_radio_two-audio=128000.m3u8',
   g_music,'128','en','GB',true,false,4),

  ('BBC Radio 4','بي بي سي راديو 4',
   'BBC Radio 4 — news, drama, documentaries',
   'بي بي سي راديو 4 — أخبار ودراما ووثائقيات',
   null,
   'https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_radio_fourfm/bbc_radio_fourfm.isml/bbc_radio_fourfm-audio=128000.m3u8',
   'https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_radio_fourfm/bbc_radio_fourfm.isml/bbc_radio_fourfm-audio=128000.m3u8',
   g_news,'128','en','GB',true,false,5),

  ('BBC Radio 6 Music','بي بي سي راديو 6',
   'BBC Radio 6 Music — alternative and indie',
   'بي بي سي راديو 6 — موسيقى إندي وبديلة',
   null,
   'https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_6music/bbc_6music.isml/bbc_6music-audio=128000.m3u8',
   'https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_6music/bbc_6music.isml/bbc_6music-audio=128000.m3u8',
   g_rock,'128','en','GB',true,false,6),

  -- ── ARABIC RADIO ───────────────────────────────────────────────
  ('Monte Carlo Doualiya','مونت كارلو الدولية',
   'French Arabic-language international radio',
   'إذاعة مونت كارلو الدولية باللغة العربية',
   null,
   'https://live.mc.infomaniak.ch/mc/mcm.mp3',
   'https://live.mc.infomaniak.ch/mc/mcm.mp3',
   g_arabic,'128','ar','FR',true,true,10),

  ('RFI Arabic','RFI عربي',
   'Radio France Internationale Arabic service',
   'راديو فرانس إنترناسيونال الخدمة العربية',
   null,
   'https://rfiarabic.ice.infomaniak.ch/rfi-arabe-56.mp3',
   'https://rfiarabic.ice.infomaniak.ch/rfi-arabe-56.mp3',
   g_arabic,'128','ar','FR',true,true,11),

  ('Sawa Radio Arabic','إذاعة سوا',
   'US-funded Arabic radio — news and music',
   'إذاعة سوا العربية — أخبار وموسيقى',
   null,
   'https://stream.RCS.revma.com/apnekhygvk8uv',
   'https://www.radiosawa.com/live',
   g_arabic,'128','ar','US',true,false,12),

  ('DW Arabic Radio','دويتشه فيله عربي',
   'Deutsche Welle Arabic radio',
   'إذاعة دويتشه فيله العربية',
   null,
   'https://dwamdstream104.akamaized.net/hls/live/2015531/dwstream104/index.m3u8',
   'https://dwamdstream104.akamaized.net/hls/live/2015531/dwstream104/index.m3u8',
   g_arabic,'128','ar','DE',true,false,13),

  ('Al Arabiya Radio','إذاعة العربية',
   'Al Arabiya network radio',
   'إذاعة شبكة العربية الإخبارية',
   null,
   'https://www.alarabiya.net/ar/radio',
   'https://www.alarabiya.net/ar/radio',
   g_arabic,'128','ar','AE',true,false,14),

  ('MBC FM Arabia','MBC FM',
   'MBC FM Arabic music radio',
   'MBC FM راديو الموسيقى العربية',
   null,
   'https://www.mbc.net/ar/mbc-fm.html',
   'https://www.mbc.net/ar/mbc-fm.html',
   g_arabic,'128','ar','SA',true,true,15),

  ('Rotana FM','روتانا FM',
   'Rotana music radio',
   'راديو روتانا للموسيقى العربية',
   null,
   'https://www.rotana.net/radio',
   'https://www.rotana.net/radio',
   g_music,'128','ar','SA',true,false,16),

  ('Melody FM Egypt','ميلودي FM مصر',
   'Egyptian music radio',
   'راديو ميلودي FM المصري للموسيقى',
   null,
   'https://stream.zeno.fm/melodyfm',
   'https://stream.zeno.fm/melodyfm',
   g_music,'128','ar','EG',true,false,17),

  ('Nogoum FM Egypt','نجوم FM مصر',
   'Egyptian pop music radio',
   'راديو نجوم FM المصري للبوب',
   null,
   'https://stream.zeno.fm/nogoumfm',
   'https://stream.zeno.fm/nogoumfm',
   g_music,'128','ar','EG',true,false,18),

  -- ── QURAN / ISLAMIC ────────────────────────────────────────────
  ('Holy Quran Saudi','إذاعة القرآن الكريم',
   'Saudi official Holy Quran radio',
   'إذاعة القرآن الكريم السعودية الرسمية',
   null,
   'https://n01.radiojar.com/8s5u5tpdtwzuv',
   'https://n01.radiojar.com/8s5u5tpdtwzuv',
   g_quran,'128','ar','SA',true,true,20),

  ('Quran Radio Egypt','إذاعة القرآن الكريم مصر',
   'Egyptian Holy Quran radio',
   'إذاعة القرآن الكريم المصرية الرسمية',
   null,
   'https://stream.radiojarfm.com/quraneg',
   'https://quran.ertu.org/live',
   g_quran,'128','ar','EG',true,true,21),

  ('Al Fajr Quran','إذاعة الفجر',
   'Algerian Quran and Islamic radio',
   'إذاعة الفجر الجزائرية للقرآن والتراتيل',
   null,
   'https://stream.zeno.fm/fajralquran',
   'https://stream.zeno.fm/fajralquran',
   g_quran,'64','ar','DZ',true,false,22),

  ('Kuwait Quran Radio','إذاعة القرآن الكويتية',
   'Kuwait Holy Quran radio',
   'إذاعة دولة الكويت للقرآن الكريم',
   null,
   'https://stream.radiojarfm.com/kuwaitquran',
   'https://www.media.gov.kw/radioquran',
   g_quran,'64','ar','KW',true,false,23),

  -- ── INTERNATIONAL NEWS RADIO ───────────────────────────────────
  ('Voice of America','صوت أمريكا',
   'VOA English international radio',
   'صوت أمريكا الإذاعة الدولية الإنجليزية',
   null,
   'https://stream.voa.gov/voaeng/hlsp/voa-eng.m3u8',
   'https://www.voanews.com/live/radio',
   g_news,'128','en','US',true,true,30),

  ('RFI French','RFI فرنسي',
   'Radio France Internationale French service',
   'راديو فرانس الدولي الخدمة الفرنسية',
   null,
   'https://icecast.radiofrance.fr/rfimonde-midfi.mp3',
   'https://icecast.radiofrance.fr/rfimonde-midfi.mp3',
   g_intl,'128','fr','FR',true,true,31),

  ('France Inter','فرانس إنتر',
   'France Inter public radio',
   'إذاعة فرانس إنتر العامة الفرنسية',
   null,
   'https://icecast.radiofrance.fr/franceinter-midfi.mp3',
   'https://icecast.radiofrance.fr/franceinter-midfi.mp3',
   g_intl,'128','fr','FR',true,false,32),

  ('France Culture','فرانس كولتور',
   'France Culture ideas and documentaries',
   'فرانس كولتور — أفكار ووثائقيات',
   null,
   'https://icecast.radiofrance.fr/franceculture-midfi.mp3',
   'https://icecast.radiofrance.fr/franceculture-midfi.mp3',
   g_intl,'128','fr','FR',true,false,33),

  ('DW German Radio','دويتشه فيله ألماني',
   'Deutsche Welle German radio',
   'إذاعة دويتشه فيله الألمانية',
   null,
   'https://dwamdstream105.akamaized.net/hls/live/2015532/dwstream105/index.m3u8',
   'https://dwamdstream105.akamaized.net/hls/live/2015532/dwstream105/index.m3u8',
   g_intl,'128','de','DE',true,false,34),

  ('NHK World Radio Japan','NHK وورلد راديو',
   'NHK World Radio Japan English',
   'إذاعة NHK العالمية اليابانية باللغة الإنجليزية',
   null,
   'https://nhkradioakr1-i.akamaihd.net/hls/live/571858/nhkradioakr1/index.m3u8',
   'https://www3.nhk.or.jp/nhkworld/en/radio/',
   g_intl,'128','en','JP',true,false,35),

  ('Radio Vatican Arabic','راديو الفاتيكان عربي',
   'Vatican Radio Arabic service',
   'إذاعة الفاتيكان باللغة العربية',
   null,
   'https://icecast.vaticanradio.org/vaticanradio-ar-low.mp3',
   'https://icecast.vaticanradio.org/vaticanradio-ar-low.mp3',
   g_intl,'64','ar','VA',true,false,36),

  -- ── MUSIC RADIO ────────────────────────────────────────────────
  ('Jazz FM UK','جاز FM بريطانيا',
   'Jazz and soul music 24/7',
   'موسيقى الجاز والسول على مدار الساعة',
   null,
   'https://edge-bauerall-01-gos2.sharp-stream.com/jazzfm.mp3',
   'https://edge-bauerall-01-gos2.sharp-stream.com/jazzfm.mp3',
   g_jazz,'128','en','GB',true,true,40),

  ('Radio Swiss Jazz','راديو سويس جاز',
   'Switzerland jazz radio',
   'راديو سويسرا للجاز',
   null,
   'https://stream.srg-ssr.ch/m/rsp/mp3_128',
   'https://stream.srg-ssr.ch/m/rsp/mp3_128',
   g_jazz,'128','en','CH',true,false,41),

  ('Classical KING FM','كلاسيكال كينج FM',
   'Classical music from Seattle USA',
   'موسيقى كلاسيكية من سياتل الأمريكية',
   null,
   'https://live.wostreaming.net/manifest/ppm-kingfmaac-ibc1.m3u8',
   'https://www.king.org/listen-live/',
   g_jazz,'128','en','US',true,false,42),

  ('NRJ France','NRJ فرنسا',
   'French pop and hit music radio',
   'إذاعة NRJ الفرنسية لموسيقى البوب والهيتس',
   null,
   'https://scdn.nrjaudio.fm/audio1/fr/40001/mp3_128.mp3',
   'https://scdn.nrjaudio.fm/audio1/fr/40001/mp3_128.mp3',
   g_rock,'128','fr','FR',true,true,43),

  ('Virgin Radio UK','فيرجن راديو بريطانيا',
   'UK pop and rock music radio',
   'إذاعة فيرجن البريطانية لموسيقى البوب والروك',
   null,
   'https://stream.radiojar.com/0tpy1h0kxtzuv',
   'https://stream.radiojar.com/0tpy1h0kxtzuv',
   g_rock,'128','en','GB',true,false,44),

  ('Smooth Radio UK','سموذ راديو بريطانيا',
   'Smooth Jazz and contemporary hits',
   'موسيقى ناعمة وسموذ جاز',
   null,
   'https://media-ssl.musicradio.com/SmoothUK',
   'https://media-ssl.musicradio.com/SmoothUK',
   g_music,'128','en','GB',true,false,45),

  -- ── SPORTS RADIO ───────────────────────────────────────────────
  ('talkSPORT UK','تاك سبورت',
   'UK sports radio — football, cricket, tennis',
   'راديو الرياضة البريطاني — كرة قدم وكريكيت وتنس',
   null,
   'https://radio.talksport.com/stream',
   'https://radio.talksport.com/stream',
   g_sports,'128','en','GB',true,true,50),

  ('ESPN Radio USA','ESPN راديو',
   'ESPN sports radio — North America',
   'ESPN راديو الرياضة — أمريكا الشمالية',
   null,
   'https://www.espn.com/radio/play/_/id/101',
   'https://www.espn.com/radio/play/_/id/101',
   g_sports,'128','en','US',true,false,51),

  -- ── KIDS RADIO ────────────────────────────────────────────────
  ('BBC Radio for Kids','بي بي سي راديو للأطفال',
   'BBC CBeebies Radio for children',
   'إذاعة بي بي سي CBeebies للأطفال',
   null,
   'https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_radio_cbeebies/bbc_radio_cbeebies.isml/bbc_radio_cbeebies-audio=128000.m3u8',
   'https://as-hls-ww-live.akamaized.net/pool_904/live/ww/bbc_radio_cbeebies/bbc_radio_cbeebies.isml/bbc_radio_cbeebies-audio=128000.m3u8',
   g_kids,'128','en','GB',true,true,60),

  ('Radio Disney Arabia','راديو ديزني العربي',
   'Disney Arabic children radio',
   'راديو ديزني العربي للأطفال',
   null,
   'https://stream.zeno.fm/disneykids',
   'https://stream.zeno.fm/disneykids',
   g_kids,'64','ar','US',true,false,61),

  -- ── INDIAN / ASIAN RADIO ───────────────────────────────────────
  ('All India Radio World','راديو الهند العالمي',
   'All India Radio World Service',
   'الخدمة العالمية لإذاعة الهند',
   null,
   'https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8',
   'https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8',
   g_indian,'128','en','IN',true,true,70),

  ('Vividh Bharati India','فيفيد بهاراتي',
   'Vividh Bharati Hindi music and entertainment',
   'إذاعة فيفيد بهاراتي الهندية للموسيقى',
   null,
   'https://air.pc.cdn.bitgravity.com/air/live/pbaudio012/playlist.m3u8',
   'https://air.pc.cdn.bitgravity.com/air/live/pbaudio012/playlist.m3u8',
   g_indian,'128','hi','IN',true,false,71),

  ('Radio Singapore CNA','راديو سنغافورة',
   'CNA938 Singapore news radio',
   'راديو CNA938 الإخباري السنغافوري',
   null,
   'https://livefm.mediacorp.sg/audio/cna938',
   'https://www.channelnewsasia.com/listen',
   g_intl,'128','en','SG',true,false,72),

  -- ── AFRICAN RADIO ──────────────────────────────────────────────
  ('Radio Nigeria','راديو نيجيريا',
   'Nigerian national radio',
   'راديو نيجيريا الوطني',
   null,
   'https://stream.zeno.fm/radionigeria',
   'https://stream.zeno.fm/radionigeria',
   g_african,'64','en','NG',true,true,80),

  ('Radio Kenya Citizen','راديو كينيا',
   'Kenya Citizen Radio',
   'راديو المواطن في كينيا',
   null,
   'https://stream.zeno.fm/citizenradiokenya',
   'https://stream.zeno.fm/citizenradiokenya',
   g_african,'64','en','KE',true,false,81),

  ('Radio Maroc','راديو المغرب',
   'Morocco national radio',
   'الإذاعة المغربية الوطنية',
   null,
   'https://mms.snrt.ma/radio1',
   'https://www.snrt.ma/radio',
   g_arabic,'128','ar','MA',true,true,82),

  ('Radio Algérie','راديو الجزائر',
   'Algeria national radio Chaîne 1',
   'الإذاعة الجزائرية الوطنية — السلسلة الأولى',
   null,
   'https://stream.radiojarfm.com/radiodz',
   'https://www.radioalgerie.dz/news/live',
   g_arabic,'64','ar','DZ',true,false,83),

  -- ── LATIN RADIO ────────────────────────────────────────────────
  ('Radio Formula Mexico','راديو فورمولا المكسيك',
   'Mexico news and talk radio',
   'راديو فورمولا المكسيكي للأخبار والحديث',
   null,
   'https://stream.zeno.fm/radioformula',
   'https://www.radioformula.com.mx/live/',
   g_latin,'128','es','MX',true,true,90),

  ('Cadena SER Spain','كادينا سير إسبانيا',
   'Spanish leading radio network',
   'شبكة كادينا سير الإذاعية الإسبانية',
   null,
   'https://playerservices.streamtheworld.com/api/livestream-redirect/CADENASER.mp3',
   'https://playerservices.streamtheworld.com/api/livestream-redirect/CADENASER.mp3',
   g_latin,'128','es','ES',true,false,91),

  -- ── CHRISTIAN RADIO ────────────────────────────────────────────
  ('Radio Mariam Lebanon','راديو مريم لبنان',
   'Lebanese Christian religious radio',
   'راديو مريم المسيحي اللبناني',
   null,
   'https://stream.zeno.fm/radiomariam',
   'https://stream.zeno.fm/radiomariam',
   g_christo,'64','ar','LB',true,true,100),

  ('Sawt el Rab Lebanon','صوت الرب',
   'Voice of God Christian Arabic radio',
   'إذاعة صوت الرب المسيحية العربية',
   null,
   'https://stream.zeno.fm/sawtelrab',
   'https://stream.zeno.fm/sawtelrab',
   g_christo,'64','ar','LB',true,false,101),

  -- ── SPIRITUAL / MEDITATION ─────────────────────────────────────
  ('Calm Radio Meditation','راديو كالم — تأمل',
   'Meditation, yoga and relaxation music',
   'موسيقى التأمل واليوغا والاسترخاء',
   null,
   'https://streams.calmradio.com/api/37/128/stream',
   'https://streams.calmradio.com/api/37/128/stream',
   g_spirit,'128','en','CA',true,true,110),

  ('Radio Swiss Classic','راديو سويس كلاسيك',
   'Switzerland classical music radio',
   'راديو سويسرا للموسيقى الكلاسيكية',
   null,
   'https://stream.srg-ssr.ch/m/rsc_de/mp3_128',
   'https://stream.srg-ssr.ch/m/rsc_de/mp3_128',
   g_spirit,'128','de','CH',true,false,111),

  -- ── EUROPEAN RADIO ─────────────────────────────────────────────
  ('Deutschlandfunk Germany','دويتشلاندفونك',
   'German national public radio',
   'الإذاعة الألمانية الوطنية العامة',
   null,
   'https://st01.sslstream.dlf.de/dlf/01/128/mp3/stream.mp3',
   'https://st01.sslstream.dlf.de/dlf/01/128/mp3/stream.mp3',
   g_intl,'128','de','DE',true,true,120),

  ('RAI Radio 1 Italy','RAI راديو 1 إيطاليا',
   'Italy RAI Radio 1 national',
   'إذاعة RAI Radio 1 الإيطالية الوطنية',
   null,
   'https://icecast.rai.it/rai-radio1-96.mp3',
   'https://icecast.rai.it/rai-radio1-96.mp3',
   g_intl,'128','it','IT',true,false,121),

  ('RNE Spain Radio Nacional','RNE راديو إسبانيا',
   'Spain national public radio',
   'الإذاعة الإسبانية الوطنية العامة',
   null,
   'https://rtveliveaudio.akamaized.net/hls/live/2026793/radio1/master.m3u8',
   'https://rtveliveaudio.akamaized.net/hls/live/2026793/radio1/master.m3u8',
   g_intl,'128','es','ES',true,false,122);

END $$;
