-- ================================================================
-- EXPANDED CHANNELS & STATIONS — Multi-cultural, Multi-religion,
-- Multi-language, Multi-field
-- ================================================================

-- ── NEW TV CATEGORIES ─────────────────────────────────────────
INSERT INTO public.tv_categories (name, name_ar, slug, icon, sort_order) VALUES
  ('Music',        'موسيقى وطرب',      'music',       'music',      11),
  ('Education',    'تعليمية وعلمية',   'education',   'book',       12),
  ('Christian',    'مسيحية',           'christian',   'cross',      13),
  ('Culture',      'ثقافة وفنون',      'culture',     'palette',    14),
  ('Business',     'اقتصادية ومالية',  'business',    'trending-up',15),
  ('Turkish',      'تركية',            'turkish',     'globe',      16),
  ('Asian',        'آسيوية',           'asian',       'globe',      17),
  ('African',      'أفريقية',          'african',     'globe',      18),
  ('Levant',       'مشرقية',           'levant',      'map-pin',    19),
  ('North Africa', 'مغاربية',          'north-africa','map-pin',    20),
  ('Nature',       'طبيعة وعلوم',      'nature',      'leaf',       21),
  ('Lifestyle',    'حياة وصحة',        'lifestyle',   'heart',      22),
  ('Indian',       'هندية',            'indian',      'globe',      23),
  ('Latin',        'لاتينية',          'latin',       'globe',      24),
  ('European',     'أوروبية',          'european',    'globe',      25)
ON CONFLICT (slug) DO NOTHING;

-- ── NEW RADIO GENRES ──────────────────────────────────────────
INSERT INTO public.radio_genres (name, name_ar, slug, icon, sort_order) VALUES
  ('Christian Radio',  'دينية مسيحية',   'christian-radio', 'cross',  9),
  ('Jazz & Classical', 'جاز وكلاسيكية',  'jazz-classical',  'music',  10),
  ('Rock & Pop',       'روك وبوب',       'rock-pop',        'music',  11),
  ('Kids Radio',       'إذاعات الأطفال', 'kids-radio',      'smile',  12),
  ('Indian & Asian',   'هندية وآسيوية',  'indian-asian',    'globe',  13),
  ('African',          'أفريقية',        'african',         'globe',  14),
  ('Latin',            'لاتينية',        'latin',           'globe',  15),
  ('Spiritual',        'روحانية وتأمل',  'spiritual',       'sun',    16)
ON CONFLICT (slug) DO NOTHING;

-- ================================================================
-- TV CHANNELS
-- ================================================================
DO $$
DECLARE
  c_news   UUID; c_gulf   UUID; c_ar     UUID; c_ent    UUID;
  c_sport  UUID; c_rel    UUID; c_kids   UUID; c_mov    UUID;
  c_intl   UUID; c_doc    UUID; c_music  UUID; c_edu    UUID;
  c_chr    UUID; c_cult   UUID; c_biz    UUID; c_turk   UUID;
  c_asia   UUID; c_afr    UUID; c_lev    UUID; c_nafr   UUID;
  c_nat    UUID; c_life   UUID; c_ind    UUID; c_lat    UUID;
  c_eur    UUID;
BEGIN
  SELECT id INTO c_news  FROM public.tv_categories WHERE slug='news';
  SELECT id INTO c_gulf  FROM public.tv_categories WHERE slug='gulf';
  SELECT id INTO c_ar    FROM public.tv_categories WHERE slug='arabic';
  SELECT id INTO c_ent   FROM public.tv_categories WHERE slug='entertainment';
  SELECT id INTO c_sport FROM public.tv_categories WHERE slug='sports';
  SELECT id INTO c_rel   FROM public.tv_categories WHERE slug='religious';
  SELECT id INTO c_kids  FROM public.tv_categories WHERE slug='kids';
  SELECT id INTO c_mov   FROM public.tv_categories WHERE slug='movies';
  SELECT id INTO c_intl  FROM public.tv_categories WHERE slug='international';
  SELECT id INTO c_doc   FROM public.tv_categories WHERE slug='documentary';
  SELECT id INTO c_music FROM public.tv_categories WHERE slug='music';
  SELECT id INTO c_edu   FROM public.tv_categories WHERE slug='education';
  SELECT id INTO c_chr   FROM public.tv_categories WHERE slug='christian';
  SELECT id INTO c_cult  FROM public.tv_categories WHERE slug='culture';
  SELECT id INTO c_biz   FROM public.tv_categories WHERE slug='business';
  SELECT id INTO c_turk  FROM public.tv_categories WHERE slug='turkish';
  SELECT id INTO c_asia  FROM public.tv_categories WHERE slug='asian';
  SELECT id INTO c_afr   FROM public.tv_categories WHERE slug='african';
  SELECT id INTO c_lev   FROM public.tv_categories WHERE slug='levant';
  SELECT id INTO c_nafr  FROM public.tv_categories WHERE slug='north-africa';
  SELECT id INTO c_nat   FROM public.tv_categories WHERE slug='nature';
  SELECT id INTO c_life  FROM public.tv_categories WHERE slug='lifestyle';
  SELECT id INTO c_ind   FROM public.tv_categories WHERE slug='indian';
  SELECT id INTO c_lat   FROM public.tv_categories WHERE slug='latin';
  SELECT id INTO c_eur   FROM public.tv_categories WHERE slug='european';

  INSERT INTO public.tv_channels
    (name, name_ar, description_ar, logo_url, stream_url, official_url,
     category_id, quality, language, country, is_active, is_featured, sort_order)
  VALUES

  -- ═══ NEWS — إضافية ═══════════════════════════════════════
  ('Alghad TV','قناة الغد',
   'قناة إخبارية عربية تبث من الأردن ومصر',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/AlGhad_TV_Logo.svg/240px-AlGhad_TV_Logo.svg.png',
   'https://www.alghad.tv/','https://www.youtube.com/embed/live_stream?channel=UCW9mDwBFnQBj3Iqyh8bH4iw&autoplay=1',
   c_news,'HD','ar','الأردن',true,false,50),

  ('Al Mayadeen','الميادين',
   'قناة إخبارية لبنانية مستقلة',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Mayadeen_tv_logo.svg/240px-Mayadeen_tv_logo.svg.png',
   'https://www.mayadeen.net/','https://www.youtube.com/embed/live_stream?channel=UCCcYW0FxJ_yPm1MO9AlTkAQ&autoplay=1',
   c_news,'HD','ar','لبنان',true,false,51),

  ('Al Alam','العالم الإيرانية',
   'قناة إخبارية إيرانية ناطقة بالعربية',
   null,'https://www.alalam.ir/','https://www.youtube.com/embed/live_stream?channel=UCr4SNmPZ2hBJO3bxZKVN_vg&autoplay=1',
   c_news,'HD','ar','إيران',true,false,52),

  ('Al Qahera News','القاهرة الإخبارية',
   'القناة الإخبارية المصرية الرسمية',
   null,'https://www.cairochannel.com/','https://www.youtube.com/embed/live_stream?channel=UCnp4GDVEFJxiRFCE2xIpLCA&autoplay=1',
   c_news,'HD','ar','مصر',true,false,53),

  ('Nile News','نايل نيوز',
   'قناة نايل نيوز الإخبارية المصرية',
   null,'https://nile.tv/','https://www.youtube.com/embed/live_stream?channel=UCW9qyGMSYPBgWH7k4bCXfkA&autoplay=1',
   c_news,'HD','ar','مصر',true,false,54),

  ('Al Iraqiya','العراقية',
   'القناة الإخبارية والرسمية العراقية',
   null,'https://www.iraqitv.iq/','https://www.youtube.com/embed/live_stream?channel=UCWk1DlW0TKQFMUJqDJ4X6VA&autoplay=1',
   c_news,'HD','ar','العراق',true,false,55),

  ('Al Arabiya Mubasher','العربية مباشر',
   'قناة البث المباشر من قناة العربية',
   null,'https://www.alarabiya.net/','https://www.youtube.com/embed/live_stream?channel=UC5kDR2vZkZlVt_BF5nqAKag&autoplay=1',
   c_news,'HD','ar','الإمارات',true,false,56),

  ('i24 News Arabic','i24 نيوز عربي',
   'قناة إخبارية دولية إسرائيلية باللغة العربية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/I24news_logo.svg/240px-I24news_logo.svg.png',
   'https://www.i24news.tv/ar','https://www.youtube.com/embed/live_stream?channel=UCicFcm52OiS9y0bS1PWhFXg&autoplay=1',
   c_news,'HD','ar','إسرائيل',true,false,57),

  ('Euronews Arabic','يورونيوز عربي',
   'القناة الأوروبية للأخبار باللغة العربية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Euronews_logo.svg/240px-Euronews_logo.svg.png',
   'https://arabic.euronews.com/','https://www.youtube.com/embed/live_stream?channel=UCzxBTCBCgBjhiHtBjbzBaRg&autoplay=1',
   c_news,'HD','ar','فرنسا',true,false,58),

  ('TRT World','TRT العالمية',
   'قناة تركية إخبارية دولية باللغة الإنجليزية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/TRT_World_Logo.svg/240px-TRT_World_Logo.svg.png',
   'https://www.trtworld.com/','https://www.youtube.com/embed/live_stream?channel=UC7fWeaHhqgM4Ry-RMpM2YYw&autoplay=1',
   c_news,'HD','en','تركيا',true,false,59),

  ('CGTN Arabic','CGTN عربي',
   'القناة الصينية الدولية للأخبار بالعربية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/CGTN_logo.svg/240px-CGTN_logo.svg.png',
   'https://arabic.cgtn.com/','https://www.youtube.com/embed/live_stream?channel=UCFBaBaM0-CZSr9Z0cxTEOEA&autoplay=1',
   c_news,'HD','ar','الصين',true,false,60),

  ('Russia 24','روسيا 24',
   'القناة الإخبارية الروسية الرسمية',
   null,'https://russia.tv/brand/show/brand_id/5169','https://www.youtube.com/embed/live_stream?channel=UCkzjFGlQnOtDHHKAWnqSaRA&autoplay=1',
   c_news,'HD','ru','روسيا',true,false,61),

  ('CNN International','سي إن إن الدولية',
   'CNN international news channel',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/CNN.svg/240px-CNN.svg.png',
   'https://edition.cnn.com/live-tv','https://www.youtube.com/embed/live_stream?channel=UCupvZG-5ko_eiXAupbDfxWw&autoplay=1',
   c_news,'HD','en','الولايات المتحدة',true,false,62),

  ('Fox News','فوكس نيوز',
   'Fox News Channel American cable news',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Fox_News_Channel_logo.svg/240px-Fox_News_Channel_logo.svg.png',
   'https://www.foxnews.com/live','https://www.foxnews.com/live',
   c_news,'HD','en','الولايات المتحدة',true,false,63),

  ('NHK World Japan','NHK العالمية',
   'قناة NHK اليابانية الدولية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/NHK_World-Japan_logo.svg/240px-NHK_World-Japan_logo.svg.png',
   'https://www3.nhk.or.jp/nhkworld/','https://www.youtube.com/embed/live_stream?channel=UC5R_rZHuOXQy7dCHUBLqNeg&autoplay=1',
   c_news,'HD','en','اليابان',true,false,64),

  -- ═══ GULF — إضافية ═══════════════════════════════════════
  ('Saudi TV 2','القناة الثانية السعودية',
   'القناة الثانية للتلفزيون السعودي',
   null,'https://www.sauditvlive.tv/','https://www.youtube.com/embed/live_stream?channel=UCZTnk6LBHMuRF5-5KTfrqDA&autoplay=1',
   c_gulf,'HD','ar','السعودية',true,false,65),

  ('Saudi Sunnah','قناة السنة النبوية',
   'قناة السنة النبوية التلفزيونية السعودية',
   null,'https://www.sauditvlive.tv/','https://www.youtube.com/embed/live_stream?channel=UC-ZLpUnvCQ8LjNMKLr21Leg&autoplay=1',
   c_gulf,'HD','ar','السعودية',true,false,66),

  ('Sharjah TV','الشارقة',
   'قناة تلفزيون الشارقة الرسمية',
   null,'https://www.sharjah.gov.ae/','https://www.youtube.com/embed/live_stream?channel=UCvFi8qhOGvRSPsEp6cGGCug&autoplay=1',
   c_gulf,'HD','ar','الإمارات',true,false,67),

  ('Al Mamlaka Jordan','المملكة الأردنية',
   'قناة المملكة الأردنية الإخبارية والترفيهية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/AlMamlaka_TV.svg/240px-AlMamlaka_TV.svg.png',
   'https://www.mamlaka.tv/','https://www.youtube.com/embed/live_stream?channel=UCFe4XyoKEFG7Cf5IWjqsNXg&autoplay=1',
   c_gulf,'HD','ar','الأردن',true,false,68),

  ('Rotana Khalijiah','روتانا خليجية',
   'قناة روتانا للبرامج الخليجية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Rotana_Khalijiah.svg/240px-Rotana_Khalijiah.svg.png',
   'https://www.rotana.net/','https://www.rotana.net/live',
   c_gulf,'HD','ar','السعودية',true,false,69),

  -- ═══ ENTERTAINMENT — إضافية ═══════════════════════════════
  ('MBC Action','MBC أكشن',
   'قناة الأفلام والمسلسلات الأكشن من MBC',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/MBC_Action_logo.svg/240px-MBC_Action_logo.svg.png',
   'https://www.mbc.net/ar','https://www.youtube.com/embed/live_stream?channel=UCR-e-1x5A9qe0IGRxhIUC5Q&autoplay=1',
   c_ent,'HD','ar','الإمارات',true,true,70),

  ('MBC Drama','MBC دراما',
   'قناة المسلسلات والدراما العربية من MBC',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/MBC_Drama_logo.svg/240px-MBC_Drama_logo.svg.png',
   'https://www.mbc.net/ar','https://www.youtube.com/embed/live_stream?channel=UCBFq3B2iOfzRZ97kFj6L6Og&autoplay=1',
   c_ent,'HD','ar','الإمارات',true,true,71),

  ('LBC Lebanon','LBC لبنان',
   'قناة LBC الترفيهية والإخبارية اللبنانية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/LBC_SAT.svg/240px-LBC_SAT.svg.png',
   'https://lbci.com/','https://www.youtube.com/embed/live_stream?channel=UCz1p5YU3l4c4lH5cHBW10wg&autoplay=1',
   c_ent,'HD','ar','لبنان',true,false,72),

  ('Al Jadeed Lebanon','الجديد',
   'قناة الجديد الإخبارية والترفيهية اللبنانية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Al-Jadeed_TV_logo.svg/240px-Al-Jadeed_TV_logo.svg.png',
   'https://www.jadeed.tv/','https://www.youtube.com/embed/live_stream?channel=UCpXGpAQ8L4Fs_3M6jH2HQKQ&autoplay=1',
   c_ent,'HD','ar','لبنان',true,false,73),

  ('MTV Lebanon','MTV لبنان',
   'قناة MTV اللبنانية الترفيهية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/MTV_Lebanon_logo.svg/240px-MTV_Lebanon_logo.svg.png',
   'https://www.mtv.com.lb/','https://www.youtube.com/embed/live_stream?channel=UCxlhMGKEH6gI4qT1Kia5Mng&autoplay=1',
   c_ent,'HD','ar','لبنان',true,false,74),

  ('Dream TV Egypt','دريم',
   'قناة دريم الترفيهية والإخبارية المصرية',
   null,'https://dream.tv/','https://www.youtube.com/embed/live_stream?channel=UCsWBjgYuCJFiHIB1RuEj0CQ&autoplay=1',
   c_ent,'HD','ar','مصر',true,false,75),

  ('ON TV Egypt','ON التلفزيون',
   'قناة ON المصرية الترفيهية',
   null,'https://ontv.eg/','https://www.youtube.com/embed/live_stream?channel=UCDm5UPtWn9Xyqz_M0Y-N9CA&autoplay=1',
   c_ent,'HD','ar','مصر',true,false,76),

  ('CBC Egypt','CBC مصر',
   'قناة CBC الترفيهية المصرية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/CBC_TV_Egypt.svg/240px-CBC_TV_Egypt.svg.png',
   'https://cbcegypt.com/','https://www.youtube.com/embed/live_stream?channel=UCPPzS7qlpL7OLRXrpVvvtaA&autoplay=1',
   c_ent,'HD','ar','مصر',true,false,77),

  ('Al Nahar Egypt','النهار',
   'قناة النهار الترفيهية المصرية',
   null,'https://alnaharegypt.tv/','https://www.youtube.com/embed/live_stream?channel=UCZlMPaOCY-iCZ2i-7S2BUMA&autoplay=1',
   c_ent,'HD','ar','مصر',true,false,78),

  ('Sama Dubai','سما دبي',
   'قناة سما الترفيهية التابعة لتلفزيون دبي',
   null,'https://www.sama.ae/','https://www.youtube.com/embed/live_stream?channel=UCMIiHFLGGhZJNt7NmG2rNmA&autoplay=1',
   c_ent,'HD','ar','الإمارات',true,false,79),

  ('Abu Dhabi Drama','أبوظبي دراما',
   'قناة أبوظبي للمسلسلات والدراما العربية',
   null,'https://www.adtv.ae/','https://www.youtube.com/embed/live_stream?channel=UCbI9eMeBxUl8Jgz3Gl_3Vgg&autoplay=1',
   c_ent,'HD','ar','الإمارات',true,false,80),

  ('Syrian Drama','الدراما السورية',
   'قناة الدراما والمسلسلات السورية',
   null,'https://www.rtv.gov.sy/','https://www.youtube.com/embed/live_stream?channel=UCe-I9u-mw_abVV-qLdGwLog&autoplay=1',
   c_ent,'HD','ar','سوريا',true,false,81),

  -- ═══ MOVIES — إضافية ═══════════════════════════════════
  ('MBC Max','MBC ماكس',
   'قناة MBC للأفلام العالمية الحديثة',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/MBC_Max_new_logo.svg/240px-MBC_Max_new_logo.svg.png',
   'https://www.mbc.net/ar','https://www.mbc.net/ar/live/mbc-max',
   c_mov,'HD','ar','الإمارات',true,true,82),

  ('Rotana Cinema','روتانا سينما',
   'قناة روتانا للأفلام العربية والعالمية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Rotana_Cinema_logo.png/240px-Rotana_Cinema_logo.png',
   'https://www.rotana.net/','https://www.rotana.net/live',
   c_mov,'HD','ar','السعودية',true,true,83),

  ('Rotana Classic','روتانا كلاسيك',
   'قناة روتانا للأفلام والمسلسلات الكلاسيكية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Rotana_Classic.svg/240px-Rotana_Classic.svg.png',
   'https://www.rotana.net/','https://www.rotana.net/live',
   c_mov,'HD','ar','السعودية',true,false,84),

  ('Zee Aflam','زي أفلام',
   'قناة أفلام بوليوود الهندية المدبلجة للعربية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Zee_Aflam.svg/240px-Zee_Aflam.svg.png',
   'https://www.zeesalaam.tv/','https://www.zeesalaam.tv/',
   c_mov,'HD','ar','الإمارات',true,false,85),

  ('MBC Bollywood','MBC بوليوود',
   'قناة MBC للأفلام الهندية المدبلجة للعربية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/MBC_Bollywood_logo.svg/240px-MBC_Bollywood_logo.svg.png',
   'https://www.mbc.net/ar','https://www.mbc.net/ar/live/mbc-bollywood',
   c_mov,'HD','ar','الإمارات',true,false,86),

  -- ═══ SPORTS — إضافية ═══════════════════════════════════
  ('beIN Sports 1','beIN سبورتس 1',
   'القناة الرياضية الأولى من beIN',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/BeIN_Sports_logo.svg/240px-BeIN_Sports_logo.svg.png',
   'https://www.beinsports.com/ar/','https://www.beinsports.com/ar/',
   c_sport,'FHD','ar','قطر',true,true,87),

  ('beIN Sports 2','beIN سبورتس 2',
   'القناة الرياضية الثانية من beIN',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/BeIN_Sports_logo.svg/240px-BeIN_Sports_logo.svg.png',
   'https://www.beinsports.com/ar/','https://www.beinsports.com/ar/',
   c_sport,'FHD','ar','قطر',true,false,88),

  ('SSC Saudi','SSC الرياضية',
   'قناة SSC الرياضية السعودية',
   null,'https://ssc.com.sa/','https://ssc.com.sa/',
   c_sport,'FHD','ar','السعودية',true,true,89),

  ('Abu Dhabi Sports 2','أبوظبي الرياضية 2',
   'القناة الرياضية الثانية لأبوظبي',
   null,'https://www.adtv.ae/','https://www.youtube.com/embed/live_stream?channel=UCxFvjfqxaGDrKcbNZ1xRdZw&autoplay=1',
   c_sport,'HD','ar','الإمارات',true,false,90),

  ('Saudi Football','كرة القدم السعودية',
   'قناة الاتحاد السعودي لكرة القدم',
   null,'https://www.saff.com.sa/','https://www.youtube.com/embed/live_stream?channel=UCgT_9C8EPlDG5Rknlnfz1Pg&autoplay=1',
   c_sport,'HD','ar','السعودية',true,false,91),

  -- ═══ RELIGIOUS — إضافية ═══════════════════════════════
  ('Huda TV','قناة هدى',
   'قناة إسلامية إنجليزية للمسلمين الجدد',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Huda_TV_logo.svg/240px-Huda_TV_logo.svg.png',
   'https://www.huda.tv/','https://www.youtube.com/embed/live_stream?channel=UCYmKhXisP2-3OxHD4R0UXLA&autoplay=1',
   c_rel,'HD','en','الإمارات',true,true,92),

  ('Islam Channel','قناة الإسلام',
   'قناة إسلامية بريطانية باللغة الإنجليزية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Islam_Channel_logo.svg/240px-Islam_Channel_logo.svg.png',
   'https://www.islamchannel.tv/','https://www.youtube.com/embed/live_stream?channel=UCmRpLgCJKSJGOgrpOhKj-GA&autoplay=1',
   c_rel,'HD','en','المملكة المتحدة',true,false,93),

  ('Peace TV','قناة بيس TV',
   'قناة إسلامية دولية ناطقة بالإنجليزية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Peace_TV_Logo.svg/240px-Peace_TV_Logo.svg.png',
   'https://www.peacetv.tv/','https://www.youtube.com/embed/live_stream?channel=UCq_lRhuvhKTuC-xHhilnqzg&autoplay=1',
   c_rel,'HD','en','المملكة المتحدة',true,false,94),

  ('Al Hafiz TV','قناة الحافظ',
   'قناة دينية إسلامية سعودية',
   null,'https://alhafiz.tv/','https://www.youtube.com/embed/live_stream?channel=UCHYPWxC6YtmcrVuZWifnfqg&autoplay=1',
   c_rel,'HD','ar','السعودية',true,false,95),

  -- ═══ CHRISTIAN ════════════════════════════════════════
  ('SAT-7 Arabic','ساتSeven عربي',
   'قناة مسيحية عربية دولية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/SAT-7_logo.svg/240px-SAT-7_logo.svg.png',
   'https://sat7.org/ar/','https://www.youtube.com/embed/live_stream?channel=UCvzKkLsf1Mv8KGAfbhcgLgw&autoplay=1',
   c_chr,'HD','ar','المملكة المتحدة',true,true,96),

  ('TBN Arabic','TBN عربي',
   'قناة TBN الأمريكية المسيحية باللغة العربية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/TBN_logo.svg/240px-TBN_logo.svg.png',
   'https://www.tbn.org/','https://www.youtube.com/embed/live_stream?channel=UCTiL1q9iFNYpi9NLkzAPNsA&autoplay=1',
   c_chr,'HD','ar','الولايات المتحدة',true,false,97),

  ('Aghapy TV','أغابي',
   'قناة قبطية أرثوذكسية مصرية',
   null,'https://www.aghapy.com/','https://www.youtube.com/embed/live_stream?channel=UCWy0h64MiYeJb_gCDDj3MmQ&autoplay=1',
   c_chr,'HD','ar','مصر',true,false,98),

  ('CopticWorld TV','قناة العالم القبطي',
   'قناة مسيحية قبطية مصرية',
   null,'https://www.copticworld.tv/','https://www.youtube.com/embed/live_stream?channel=UCa7ue3Gtp34ik-H3f5Ub9fA&autoplay=1',
   c_chr,'HD','ar','مصر',true,false,99),

  ('Logos TV','لوغوس',
   'قناة مسيحية عربية تعليمية',
   null,'https://logostvonline.com/','https://www.youtube.com/embed/live_stream?channel=UCi9FJSl97v3R-D_NJeKiMvA&autoplay=1',
   c_chr,'HD','ar','لبنان',true,false,100),

  -- ═══ KIDS — إضافية ═══════════════════════════════════
  ('Cartoon Network Arabic','كرتون نتورك',
   'قناة كرتون نتورك بالعربية للأطفال',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Cartoon_Network_2010_logo.svg/240px-Cartoon_Network_2010_logo.svg.png',
   'https://www.cartoonnetworkarabia.com/','https://www.cartoonnetworkarabia.com/',
   c_kids,'HD','ar','الإمارات',true,true,101),

  ('Nickelodeon Arabic','نيكلوديون',
   'قناة نيكلوديون العربية للأطفال',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Nick_logo.svg/240px-Nick_logo.svg.png',
   'https://www.nickelodeon.tv.ar/','https://www.nickelodeon.tv.ar/',
   c_kids,'HD','ar','الإمارات',true,false,102),

  ('Baraem','براعم',
   'قناة براعم للأطفال الصغار من الجزيرة',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Baraem_logo.svg/240px-Baraem_logo.svg.png',
   'https://www.baraem.tv/','https://www.youtube.com/embed/live_stream?channel=UCKKnMqGnRanQ-MZl2FaLvZQ&autoplay=1',
   c_kids,'HD','ar','قطر',true,true,103),

  ('Jeem TV','جيم',
   'قناة جيم للأطفال الكبار من الجزيرة',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Jeem_logo.svg/240px-Jeem_logo.svg.png',
   'https://www.jeem.tv/','https://www.youtube.com/embed/live_stream?channel=UCBJnZlrMlOjQxMXU5MN5vXg&autoplay=1',
   c_kids,'HD','ar','قطر',true,false,104),

  -- ═══ DOCUMENTARY ═════════════════════════════════════
  ('Al Jazeera Documentary','الجزيرة الوثائقية',
   'قناة الوثائقيات من الجزيرة',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Al_Jazeera_Network_logo.svg/240px-Al_Jazeera_Network_logo.svg.png',
   'https://doc.aljazeera.net/','https://www.youtube.com/embed/live_stream?channel=UC0d4MlRsYPj0CUXkSx3yB_w&autoplay=1',
   c_doc,'HD','ar','قطر',true,true,105),

  ('National Geographic Arabic','ناشيونال جيوغرافيك',
   'قناة ناشيونال جيوغرافيك العربية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/National_Geographic_logo.svg/240px-National_Geographic_logo.svg.png',
   'https://www.natgeotv.com/ae','https://www.natgeotv.com/ae',
   c_doc,'HD','ar','الإمارات',true,true,106),

  ('Discovery Arabic','ديسكفري عربي',
   'قناة ديسكفري العربية للوثائقيات',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Discovery_Channel_Logo.svg/240px-Discovery_Channel_Logo.svg.png',
   'https://www.discoveryarabia.com/','https://www.discoveryarabia.com/',
   c_doc,'HD','ar','الإمارات',true,false,107),

  ('MBC Documentary','MBC وثائقية',
   'قناة MBC للبرامج والوثائقيات',
   null,'https://www.mbc.net/ar','https://www.mbc.net/ar/live',
   c_doc,'HD','ar','الإمارات',true,false,108),

  -- ═══ MUSIC ═══════════════════════════════════════════
  ('Rotana Music TV','روتانا موسيقى',
   'قناة روتانا للموسيقى العربية والكليبات',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Rotana_FM_Logo.png/240px-Rotana_FM_Logo.png',
   'https://www.rotana.net/','https://www.youtube.com/embed/live_stream?channel=UCo-eXD2VZoE6WFdvsMeZ3lA&autoplay=1',
   c_music,'HD','ar','السعودية',true,true,109),

  ('Rotana Tarab','روتانا طرب',
   'قناة روتانا للطرب الأصيل والكلاسيك العربي',
   null,'https://www.rotana.net/','https://www.youtube.com/embed/live_stream?channel=UCyO2VGzFjCh8GbimPsJ-sAw&autoplay=1',
   c_music,'HD','ar','السعودية',true,false,110),

  ('Melody Hits','ميلودي هيتس',
   'قناة ميلودي للكليبات الحديثة',
   null,'https://www.melodyarabia.com/','https://www.melodyarabia.com/',
   c_music,'HD','ar','الإمارات',true,false,111),

  ('Wanasah TV','وناسة',
   'قناة وناسة الخليجية للموسيقى والطرب',
   null,'https://www.wanasah.tv/','https://www.youtube.com/embed/live_stream?channel=UCE1bNh5G-dSvk0d4N8IINPA&autoplay=1',
   c_music,'HD','ar','الكويت',true,false,112),

  ('Mazika TV','مزيكا',
   'قناة مزيكا المصرية للكليبات',
   null,'https://mazika.tv/','https://www.youtube.com/embed/live_stream?channel=UCJ2uIJDXDqpXP3fEBCMDx3A&autoplay=1',
   c_music,'HD','ar','مصر',true,false,113),

  ('MTV Lebanon Music','MTV موسيقى',
   'قناة MTV اللبنانية للكليبات والترفيه',
   null,'https://www.mtv.com.lb/','https://www.youtube.com/embed/live_stream?channel=UCxlhMGKEH6gI4qT1Kia5Mng&autoplay=1',
   c_music,'HD','ar','لبنان',true,false,114),

  -- ═══ EDUCATION ═══════════════════════════════════════
  ('Al Jazeera English','الجزيرة مباشر إنجليزي',
   'Al Jazeera documentary and educational content',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Al_Jazeera_Network_logo.svg/240px-Al_Jazeera_Network_logo.svg.png',
   'https://live-hls-web-aje.getaj.net/AJE/index.m3u8',
   'https://live-hls-web-aje.getaj.net/AJE/index.m3u8',
   c_edu,'HD','en','قطر',true,false,115),

  ('Qalam Academy','قلم أكاديمي',
   'قناة تعليمية عربية للعلوم والمعرفة',
   null,'https://qalamonline.org/','https://www.youtube.com/embed/live_stream?channel=UCbVBqBRHCN6QP0LAfVkbpNg&autoplay=1',
   c_edu,'HD','ar','السعودية',true,false,116),

  ('NASA TV','ناسا TV',
   'قناة وكالة ناسا الفضائية الأمريكية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/240px-NASA_logo.svg.png',
   'https://www.nasa.gov/nasatv','https://www.youtube.com/embed/live_stream?channel=UCLA_DiR1FfKNvjuUpBHmylQ&autoplay=1',
   c_edu,'HD','en','الولايات المتحدة',true,true,117),

  -- ═══ CULTURE ═════════════════════════════════════════
  ('TV5Monde Arabic','TV5 مونده',
   'القناة الفرنسية الدولية الثقافية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/TV5MONDE_logo.svg/240px-TV5MONDE_logo.svg.png',
   'https://www.tv5monde.com/','https://www.youtube.com/embed/live_stream?channel=UCefNKlbIkq1PnVfzMORHvLA&autoplay=1',
   c_cult,'HD','fr','فرنسا',true,false,118),

  ('Arte France','آرتي',
   'القناة الثقافية الفرنسية الألمانية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/ARTE_logo.svg/240px-ARTE_logo.svg.png',
   'https://www.arte.tv/','https://www.youtube.com/embed/live_stream?channel=UCVoxz3HY-EHONLzogGMdHQg&autoplay=1',
   c_cult,'HD','fr','فرنسا',true,false,119),

  -- ═══ BUSINESS ═══════════════════════════════════════
  ('CNBC Arabic','CNBC عربي',
   'قناة CNBC للأخبار الاقتصادية والمالية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/CNBC_logo.svg/240px-CNBC_logo.svg.png',
   'https://www.cnbcarabia.com/','https://www.youtube.com/embed/live_stream?channel=UCPFnM2xh0HkQSWYMQgXKNSg&autoplay=1',
   c_biz,'HD','ar','الإمارات',true,true,120),

  ('Bloomberg TV','بلومبرغ',
   'Bloomberg international business and finance channel',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Bloomberg_logo_2019.svg/240px-Bloomberg_logo_2019.svg.png',
   'https://www.bloomberg.com/live','https://www.youtube.com/embed/live_stream?channel=UCIALMKvObZNtJ6AmdCLP7Lg&autoplay=1',
   c_biz,'HD','en','الولايات المتحدة',true,false,121),

  -- ═══ TURKISH ═════════════════════════════════════════
  ('TRT 1','TRT 1 التركية',
   'القناة الأولى للتلفزيون التركي الرسمي',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/TRT_1_logo.svg/240px-TRT_1_logo.svg.png',
   'https://www.trt1.com.tr/','https://www.youtube.com/embed/live_stream?channel=UCrB9zNNF48gU6YqIR6R5QZQ&autoplay=1',
   c_turk,'HD','tr','تركيا',true,true,122),

  ('TRT Haber','TRT هابر',
   'قناة الأخبار التركية الرسمية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/TRT_Haber_logo.svg/240px-TRT_Haber_logo.svg.png',
   'https://www.trthaber.com/','https://www.youtube.com/embed/live_stream?channel=UCqcDsM5E9p9e4S9sMoIKEpw&autoplay=1',
   c_turk,'HD','tr','تركيا',true,false,123),

  ('Star TV Turkey','ستار TV تركيا',
   'قناة Star TV الترفيهية التركية',
   null,'https://www.startv.com.tr/','https://www.youtube.com/embed/live_stream?channel=UCNZF_rVJ_ixXiPMtK-6Nssw&autoplay=1',
   c_turk,'HD','tr','تركيا',true,false,124),

  ('Kanal D Turkey','قناة D تركيا',
   'قناة Kanal D الترفيهية التركية',
   null,'https://www.kanald.com.tr/','https://www.youtube.com/embed/live_stream?channel=UCqNm9S4_4DJZSPuJXYFvdTw&autoplay=1',
   c_turk,'HD','tr','تركيا',true,false,125),

  -- ═══ INDIAN ══════════════════════════════════════════
  ('Zee TV India','Zee TV',
   'قناة Zee الترفيهية الهندية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Zee_TV_logo.svg/240px-Zee_TV_logo.svg.png',
   'https://www.zeetv.com/','https://www.youtube.com/embed/live_stream?channel=UCppHT7SZKKvar4Oc9J4oljQ&autoplay=1',
   c_ind,'HD','hi','الهند',true,true,126),

  ('Sony Entertainment TV','Sony TV الهند',
   'قناة Sony الترفيهية الهندية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Sony_Entertainment_Television.svg/240px-Sony_Entertainment_Television.svg.png',
   'https://www.sonyliv.com/','https://www.youtube.com/embed/live_stream?channel=UCs7A2bq5MV8ySTkGALBm24g&autoplay=1',
   c_ind,'HD','hi','الهند',true,false,127),

  ('Colors TV India','Colors',
   'قناة Colors الترفيهية الهندية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/ColorsTV.svg/240px-ColorsTV.svg.png',
   'https://www.colorstv.com/','https://www.youtube.com/embed/live_stream?channel=UCFpOV78t0M_5T2lEb2Z-9pA&autoplay=1',
   c_ind,'HD','hi','الهند',true,false,128),

  ('NDTV India','NDTV',
   'قناة الأخبار الهندية NDTV',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/NDTV_logo.svg/240px-NDTV_logo.svg.png',
   'https://www.ndtv.com/','https://www.youtube.com/embed/live_stream?channel=UCZFMm1mMw0F81Z37aaEzTUA&autoplay=1',
   c_ind,'HD','hi','الهند',true,false,129),

  ('ARY Digital Pakistan','ARY Digital',
   'قناة ARY الترفيهية الباكستانية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/ARY_Digital_logo.png/240px-ARY_Digital_logo.png',
   'https://www.ary.tv/','https://www.youtube.com/embed/live_stream?channel=UCZeZPoZbV3IrpPb5RFPMLUA&autoplay=1',
   c_ind,'HD','ur','باكستان',true,false,130),

  ('Geo TV Pakistan','جيو TV',
   'قناة جيو التلفزيونية الباكستانية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Geo_Entertainment_Logo.svg/240px-Geo_Entertainment_Logo.svg.png',
   'https://www.geo.tv/','https://www.youtube.com/embed/live_stream?channel=UCt7fwAhXDy3oNFTAzF2o8Lg&autoplay=1',
   c_ind,'HD','ur','باكستان',true,false,131),

  -- ═══ ASIAN ════════════════════════════════════════════
  ('KBS World Korea','KBS كوريا',
   'القناة الكورية الدولية KBS World',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/KBS_World.svg/240px-KBS_World.svg.png',
   'https://world.kbs.co.kr/','https://www.youtube.com/embed/live_stream?channel=UC6BnOxAUMmHFdJM0EAD7OEw&autoplay=1',
   c_asia,'HD','ko','كوريا الجنوبية',true,true,132),

  ('Arirang TV Korea','أريرانغ',
   'القناة الكورية الدولية للأخبار والثقافة',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Arirang_TV.svg/240px-Arirang_TV.svg.png',
   'https://www.arirang.com/','https://www.youtube.com/embed/live_stream?channel=UC7QKuNTKNUZNv4dh9iRCBzg&autoplay=1',
   c_asia,'HD','en','كوريا الجنوبية',true,false,133),

  ('CGTN Chinese','CGTN الصينية',
   'القناة الصينية الدولية للأخبار CGTN',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/CGTN_logo.svg/240px-CGTN_logo.svg.png',
   'https://www.cgtn.com/','https://www.youtube.com/embed/live_stream?channel=UCnwzQCnfQFUJgHlFh4KCi1g&autoplay=1',
   c_asia,'HD','en','الصين',true,false,134),

  ('NHK Japan','NHK اليابان',
   'القناة اليابانية العامة NHK',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/NHK_World-Japan_logo.svg/240px-NHK_World-Japan_logo.svg.png',
   'https://www3.nhk.or.jp/nhkworld/','https://www.youtube.com/embed/live_stream?channel=UC5R_rZHuOXQy7dCHUBLqNeg&autoplay=1',
   c_asia,'HD','en','اليابان',true,false,135),

  ('IRIB Iran','IRIB الإيرانية',
   'الإذاعة والتلفزيون الإيراني الرسمي',
   null,'https://www.irib.ir/','https://www.irib.ir/',
   c_asia,'HD','fa','إيران',true,false,136),

  -- ═══ AFRICAN ══════════════════════════════════════════
  ('Al-Oula Morocco','الأولى المغربية',
   'القناة المغربية الأولى الرسمية',
   null,'https://www.2m.ma/','https://www.youtube.com/embed/live_stream?channel=UCgjA4HVlCJp-P2rePKLcSJg&autoplay=1',
   c_afr,'HD','ar','المغرب',true,true,137),

  ('2M Morocco','2M المغرب',
   'قناة 2M المغربية الترفيهية',
   null,'https://www.2m.ma/','https://www.youtube.com/embed/live_stream?channel=UCW59Z01PaGl5X0mFe-W2a2g&autoplay=1',
   c_afr,'HD','ar','المغرب',true,false,138),

  ('ENTV Algeria','التلفزيون الجزائري',
   'القناة الجزائرية الرسمية ENTV',
   null,'https://www.entv.dz/','https://www.youtube.com/embed/live_stream?channel=UC7f3ZJ1qEHjFqSdGkoBN6kQ&autoplay=1',
   c_afr,'HD','ar','الجزائر',true,false,139),

  ('Watanya Tunisia','الوطنية التونسية',
   'القناة التونسية الوطنية الأولى',
   null,'https://www.watanya.com.tn/','https://www.youtube.com/embed/live_stream?channel=UCaxr3p3T0EwEi7yvhCGIb4A&autoplay=1',
   c_afr,'HD','ar','تونس',true,false,140),

  ('NTA Nigeria','NTA نيجيريا',
   'القناة الرسمية لتلفزيون نيجيريا',
   null,'https://www.nta.ng/','https://www.youtube.com/embed/live_stream?channel=UCLM2pv97Pn3s5fjOT6y8qmA&autoplay=1',
   c_afr,'HD','en','نيجيريا',true,false,141),

  ('SABC South Africa','SABC جنوب أفريقيا',
   'قناة البث العام جنوب أفريقيا',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Sabc_new_logo.svg/240px-Sabc_new_logo.svg.png',
   'https://www.sabcnews.com/','https://www.youtube.com/embed/live_stream?channel=UCCFoYbqMiDqrEYHQW4f7ZFg&autoplay=1',
   c_afr,'HD','en','جنوب أفريقيا',true,false,142),

  -- ═══ LEVANT — مشرقية ══════════════════════════════════
  ('Jordan TV','الأردن TV',
   'قناة التلفزيون الأردني الرسمية',
   null,'https://www.jrtv.jo/','https://www.youtube.com/embed/live_stream?channel=UCFAl5O4QlGPmMWjXzYWuWhA&autoplay=1',
   c_lev,'HD','ar','الأردن',true,false,143),

  ('Syria TV','التلفزيون العربي السوري',
   'القناة الرسمية للتلفزيون العربي السوري',
   null,'https://www.rtv.gov.sy/','https://www.youtube.com/embed/live_stream?channel=UCe-I9u-mw_abVV-qLdGwLog&autoplay=1',
   c_lev,'HD','ar','سوريا',true,false,144),

  ('Palestine TV','فلسطين TV',
   'تلفزيون فلسطين الرسمي',
   null,'https://www.ptv.ps/','https://www.youtube.com/embed/live_stream?channel=UCzPyJcm8Pf6TrQBHnfOEizA&autoplay=1',
   c_lev,'HD','ar','فلسطين',true,true,145),

  ('Al Manar Lebanon','المنار',
   'قناة المنار اللبنانية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Al-Manar_logo.svg/240px-Al-Manar_logo.svg.png',
   'https://www.almanar.com.lb/','https://www.youtube.com/embed/live_stream?channel=UCvY8bAZDCNSHmFlYxPP4OAg&autoplay=1',
   c_lev,'HD','ar','لبنان',true,false,146),

  -- ═══ NORTH AFRICA — مغاربية ═══════════════════════════
  ('Libya TV','ليبيا TV',
   'قناة ليبيا التلفزيونية الرسمية',
   null,'https://libyatv.ly/','https://www.youtube.com/embed/live_stream?channel=UCyFbAzVOHbfWa4gMp3ULRXQ&autoplay=1',
   c_nafr,'HD','ar','ليبيا',true,false,147),

  ('Mauritania TV','موريتانيا TV',
   'التلفزيون الموريتاني الرسمي',
   null,'https://www.tvm.mr/','https://www.youtube.com/embed/live_stream?channel=UCFbQ3aEQCkKJvYvH2OxkP1w&autoplay=1',
   c_nafr,'HD','ar','موريتانيا',true,false,148),

  -- ═══ NATURE ══════════════════════════════════════════
  ('Animal Planet Arabic','أنيمال بلانيت',
   'قناة أنيمال بلانيت للعربية - عالم الحيوان',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Animal_Planet_logo_2018.svg/240px-Animal_Planet_logo_2018.svg.png',
   'https://www.animalplanetarabia.com/','https://www.animalplanetarabia.com/',
   c_nat,'HD','ar','الولايات المتحدة',true,false,149),

  ('National Geographic Wild','ناشيونال جيو وايلد',
   'قناة ناشيونال جيوغرافيك للحياة البرية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/National_Geographic_logo.svg/240px-National_Geographic_logo.svg.png',
   'https://www.natgeotv.com/ae','https://www.natgeotv.com/ae',
   c_nat,'HD','ar','الإمارات',true,false,150),

  -- ═══ LIFESTYLE ════════════════════════════════════════
  ('Fatafeat Food','فتافيت',
   'قناة فتافيت للطبخ والطعام العربي',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Fatafeat_logo.svg/240px-Fatafeat_logo.svg.png',
   'https://www.fatafeat.com/','https://www.youtube.com/embed/live_stream?channel=UCk3cqAeUGVBm0DnWm_pZJSg&autoplay=1',
   c_life,'HD','ar','الإمارات',true,true,151),

  ('MBC Lifestyle','MBC لايفستايل',
   'قناة MBC للبرامج الحياتية والمنزلية',
   null,'https://www.mbc.net/ar','https://www.mbc.net/ar/live',
   c_life,'HD','ar','الإمارات',true,false,152),

  -- ═══ LATIN ════════════════════════════════════════════
  ('Telemundo','تيليموندو',
   'القناة الإسبانية الأمريكية الكبرى',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Telemundo_logo_2018.svg/240px-Telemundo_logo_2018.svg.png',
   'https://www.telemundo.com/','https://www.youtube.com/embed/live_stream?channel=UCFt8VrUWg7A3XBFMoEeDoFw&autoplay=1',
   c_lat,'HD','es','الولايات المتحدة',true,false,153),

  ('Univision','يونيفيسيون',
   'القناة الإسبانية الأمريكية الأولى',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Univision_2019.svg/240px-Univision_2019.svg.png',
   'https://www.univision.com/','https://www.youtube.com/embed/live_stream?channel=UCDlB-BkVvBFm-UXvKCaBGbA&autoplay=1',
   c_lat,'HD','es','الولايات المتحدة',true,false,154),

  ('CNN en Español','CNN بالإسبانية',
   'CNN International en Español',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/CNN.svg/240px-CNN.svg.png',
   'https://cnnespanol.cnn.com/','https://www.youtube.com/embed/live_stream?channel=UCOCsNpDIYa52tRQxCxANq3g&autoplay=1',
   c_lat,'HD','es','الولايات المتحدة',true,false,155),

  -- ═══ EUROPEAN ═════════════════════════════════════════
  ('RAI Uno Italy','RAI إيطاليا',
   'القناة الإيطالية الأولى RAI',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Rai1-logo-2010.svg/240px-Rai1-logo-2010.svg.png',
   'https://www.rai.it/','https://www.youtube.com/embed/live_stream?channel=UCmqRBkfSW3HotMt82w2X9OQ&autoplay=1',
   c_eur,'HD','it','إيطاليا',true,false,156),

  ('ARD Germany','ARD ألمانيا',
   'القناة الألمانية العامة الأولى ARD',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/ARD_logo.svg/240px-ARD_logo.svg.png',
   'https://www.ardmediathek.de/','https://www.youtube.com/embed/live_stream?channel=UCt-IIy8mMuvkd36TxDFi1Kw&autoplay=1',
   c_eur,'HD','de','ألمانيا',true,false,157),

  ('France 2','فرانس 2',
   'القناة الفرنسية العامة الثانية',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/France_2_2008.svg/240px-France_2_2008.svg.png',
   'https://www.france.tv/france-2/direct/','https://www.youtube.com/embed/live_stream?channel=UCH-avB-Zq72KeSdaEW-Z-XQ&autoplay=1',
   c_eur,'HD','fr','فرنسا',true,false,158),

  ('BBC One UK','BBC وان',
   'القناة البريطانية الأولى BBC One',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/BBC_One_logo_2021.svg/240px-BBC_One_logo_2021.svg.png',
   'https://www.bbc.co.uk/bbcone','https://www.bbc.co.uk/iplayer/live/bbcone',
   c_eur,'HD','en','المملكة المتحدة',true,false,159),

  ('ERT Greece','ERT اليونان',
   'القناة اليونانية العامة ERT',
   null,'https://www.ert.gr/','https://www.youtube.com/embed/live_stream?channel=UCsq3bMaJWCKmYjvKrZNNvgA&autoplay=1',
   c_eur,'HD','el','اليونان',true,false,160)

  ON CONFLICT DO NOTHING;
END $$;


-- ================================================================
-- RADIO STATIONS — EXPANDED
-- ================================================================
DO $$
DECLARE
  g_saudi UUID; g_gulf UUID; g_ar   UUID; g_quran UUID;
  g_music UUID; g_news UUID; g_intl UUID; g_talk  UUID;
  g_chr   UUID; g_jazz UUID; g_rock UUID; g_kids  UUID;
  g_ind   UUID; g_afr  UUID; g_lat  UUID; g_spir  UUID;
BEGIN
  SELECT id INTO g_saudi FROM public.radio_genres WHERE slug='saudi';
  SELECT id INTO g_gulf  FROM public.radio_genres WHERE slug='gulf';
  SELECT id INTO g_ar    FROM public.radio_genres WHERE slug='arabic';
  SELECT id INTO g_quran FROM public.radio_genres WHERE slug='quran';
  SELECT id INTO g_music FROM public.radio_genres WHERE slug='music';
  SELECT id INTO g_news  FROM public.radio_genres WHERE slug='news';
  SELECT id INTO g_intl  FROM public.radio_genres WHERE slug='international';
  SELECT id INTO g_talk  FROM public.radio_genres WHERE slug='talk';
  SELECT id INTO g_chr   FROM public.radio_genres WHERE slug='christian-radio';
  SELECT id INTO g_jazz  FROM public.radio_genres WHERE slug='jazz-classical';
  SELECT id INTO g_rock  FROM public.radio_genres WHERE slug='rock-pop';
  SELECT id INTO g_kids  FROM public.radio_genres WHERE slug='kids-radio';
  SELECT id INTO g_ind   FROM public.radio_genres WHERE slug='indian-asian';
  SELECT id INTO g_afr   FROM public.radio_genres WHERE slug='african';
  SELECT id INTO g_lat   FROM public.radio_genres WHERE slug='latin';
  SELECT id INTO g_spir  FROM public.radio_genres WHERE slug='spiritual';

  INSERT INTO public.radio_stations
    (name, name_ar, description_ar, logo_url, stream_url, official_url,
     genre_id, bitrate, language, country, is_active, is_featured, sort_order)
  VALUES

  -- ═══ QURAN — إضافية ══════════════════════════════════
  ('Quran Radio Kuwait','إذاعة القرآن الكويتية',
   'إذاعة القرآن الكريم من الكويت',
   null,'https://stream.zeno.fm/kw-quran.mp3','https://stream.zeno.fm/kw-quran.mp3',
   g_quran,'128','ar','الكويت',true,false,30),

  ('Mishary Rashid Radio','إذاعة مشاري راشد',
   'إذاعة تلاوات الشيخ مشاري راشد العفاسي',
   null,'https://stream.zeno.fm/mishari-rashid.mp3','https://stream.zeno.fm/mishari-rashid.mp3',
   g_quran,'128','ar','الكويت',true,true,31),

  ('Quran Madinah','إذاعة القرآن المدينة',
   'إذاعة القرآن الكريم من المدينة المنورة',
   null,'https://stream.radiojar.com/madinah-quran.mp3','https://stream.radiojar.com/madinah-quran.mp3',
   g_quran,'128','ar','السعودية',true,true,32),

  ('Al-Quran Al-Karim Sudan','إذاعة القرآن السودانية',
   'إذاعة القرآن الكريم من السودان',
   null,'https://stream.zeno.fm/sd-quran.mp3','https://stream.zeno.fm/sd-quran.mp3',
   g_quran,'128','ar','السودان',true,false,33),

  ('Holy Quran Pakistan','إذاعة القرآن الباكستانية',
   'إذاعة القرآن الكريم من باكستان بالأردية',
   null,'https://stream.zeno.fm/pk-quran.mp3','https://stream.zeno.fm/pk-quran.mp3',
   g_quran,'128','ur','باكستان',true,false,34),

  ('Quran Radio Turkey','إذاعة القرآن التركية',
   'إذاعة القرآن الكريم من تركيا',
   null,'https://stream.zeno.fm/tr-quran.mp3','https://stream.zeno.fm/tr-quran.mp3',
   g_quran,'128','tr','تركيا',true,false,35),

  ('Tilawat Quran','تلاوات قرآنية',
   'إذاعة التلاوات القرآنية من مختلف القراء',
   null,'https://stream.radiojar.com/tilawat.mp3','https://stream.radiojar.com/tilawat.mp3',
   g_quran,'128','ar','السعودية',true,false,36),

  -- ═══ SAUDI — إضافية ══════════════════════════════════
  ('Noor Dubai FM','نور دبي إف إم',
   'إذاعة نور دبي الإسلامية باللغة العربية',
   null,'https://stream.zeno.fm/noor-dubai.mp3','https://stream.zeno.fm/noor-dubai.mp3',
   g_saudi,'128','ar','الإمارات',true,false,37),

  ('Saudi Radio Jeddah','إذاعة جدة',
   'إذاعة مدينة جدة السعودية',
   null,'https://stream.zeno.fm/jeddah-radio.mp3','https://stream.zeno.fm/jeddah-radio.mp3',
   g_saudi,'128','ar','السعودية',true,false,38),

  ('Hala FM Saudi','هلا FM',
   'إذاعة هلا FM الترفيهية السعودية',
   null,'https://stream.zeno.fm/hala-fm.mp3','https://stream.zeno.fm/hala-fm.mp3',
   g_saudi,'128','ar','السعودية',true,false,39),

  ('Mix FM Saudi','ميكس FM',
   'إذاعة ميكس FM من السعودية',
   null,'https://stream.zeno.fm/mix-fm-sa.mp3','https://stream.zeno.fm/mix-fm-sa.mp3',
   g_saudi,'128','ar','السعودية',true,false,40),

  -- ═══ GULF — إضافية ═══════════════════════════════════
  ('Sawt Al Khaleej','صوت الخليج',
   'إذاعة صوت الخليج العربي',
   null,'https://stream.zeno.fm/sawt-alkhaleej.mp3','https://stream.zeno.fm/sawt-alkhaleej.mp3',
   g_gulf,'128','ar','الإمارات',true,false,41),

  ('Sharjah Radio','إذاعة الشارقة',
   'إذاعة إمارة الشارقة الرسمية',
   null,'https://stream.zeno.fm/sharjah-radio.mp3','https://stream.zeno.fm/sharjah-radio.mp3',
   g_gulf,'128','ar','الإمارات',true,false,42),

  ('Qatar Radio','إذاعة قطر',
   'إذاعة قطر الرسمية',
   null,'https://stream.zeno.fm/qatar-radio.mp3','https://stream.zeno.fm/qatar-radio.mp3',
   g_gulf,'128','ar','قطر',true,false,43),

  ('Bahrain Radio','إذاعة البحرين',
   'إذاعة البحرين الرسمية',
   null,'https://stream.zeno.fm/bh-radio.mp3','https://stream.zeno.fm/bh-radio.mp3',
   g_gulf,'128','ar','البحرين',true,false,44),

  ('Oman Radio','إذاعة سلطنة عُمان',
   'إذاعة سلطنة عُمان الرسمية',
   null,'https://stream.zeno.fm/om-radio.mp3','https://stream.zeno.fm/om-radio.mp3',
   g_gulf,'128','ar','عُمان',true,false,45),

  -- ═══ ARABIC — إضافية ═════════════════════════════════
  ('Palestine Radio','إذاعة فلسطين',
   'إذاعة فلسطين الرسمية صوت فلسطين',
   null,'https://stream.zeno.fm/ps-radio.mp3','https://stream.zeno.fm/ps-radio.mp3',
   g_ar,'128','ar','فلسطين',true,true,46),

  ('Jordan Radio','إذاعة المملكة الأردنية',
   'البرنامج العام لإذاعة المملكة الأردنية',
   null,'https://stream.zeno.fm/jo-radio.mp3','https://stream.zeno.fm/jo-radio.mp3',
   g_ar,'128','ar','الأردن',true,false,47),

  ('Lebanon Radio','إذاعة لبنان',
   'إذاعة لبنان الرسمية',
   null,'https://stream.zeno.fm/lb-radio.mp3','https://stream.zeno.fm/lb-radio.mp3',
   g_ar,'128','ar','لبنان',true,false,48),

  ('Sudan Radio','إذاعة السودان',
   'إذاعة جمهورية السودان',
   null,'https://stream.zeno.fm/sd-radio.mp3','https://stream.zeno.fm/sd-radio.mp3',
   g_ar,'128','ar','السودان',true,false,49),

  ('Libya Radio','إذاعة ليبيا',
   'إذاعة الجماهيرية الليبية',
   null,'https://stream.zeno.fm/ly-radio.mp3','https://stream.zeno.fm/ly-radio.mp3',
   g_ar,'128','ar','ليبيا',true,false,50),

  ('Somalia Radio','إذاعة الصومال',
   'إذاعة جمهورية الصومال',
   null,'https://stream.zeno.fm/so-radio.mp3','https://stream.zeno.fm/so-radio.mp3',
   g_ar,'128','ar','الصومال',true,false,51),

  ('Algeria Radio','إذاعة الجزائر',
   'الإذاعة الجزائرية القناة الأولى',
   null,'https://stream.zeno.fm/dz-radio1.mp3','https://stream.zeno.fm/dz-radio1.mp3',
   g_ar,'128','ar','الجزائر',true,false,52),

  ('Tunisia Radio','إذاعة تونس',
   'الإذاعة الوطنية التونسية',
   null,'https://stream.zeno.fm/tn-radio.mp3','https://stream.zeno.fm/tn-radio.mp3',
   g_ar,'128','ar','تونس',true,false,53),

  -- ═══ NEWS / TALK — إضافية ════════════════════════════
  ('Voice of America Arabic','صوت أمريكا',
   'إذاعة صوت أمريكا باللغة العربية',
   null,'https://stream.zeno.fm/voa-arabic.mp3','https://stream.zeno.fm/voa-arabic.mp3',
   g_news,'128','ar','الولايات المتحدة',true,false,54),

  ('Al Arabiya Radio','إذاعة العربية',
   'إذاعة قناة العربية الإخبارية',
   null,'https://stream.zeno.fm/alarabiya-radio.mp3','https://stream.zeno.fm/alarabiya-radio.mp3',
   g_news,'128','ar','الإمارات',true,false,55),

  ('Sky News Arabia Radio','إذاعة سكاي نيوز',
   'إذاعة سكاي نيوز عربية',
   null,'https://stream.zeno.fm/skynews-ar.mp3','https://stream.zeno.fm/skynews-ar.mp3',
   g_news,'128','ar','الإمارات',true,false,56),

  ('NPR News USA','NPR نيوز',
   'National Public Radio news from the USA',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/NPR_logo.svg/240px-NPR_logo.svg.png',
   'https://npr-ice.streamguys1.com/live.mp3','https://npr-ice.streamguys1.com/live.mp3',
   g_news,'128','en','الولايات المتحدة',true,true,57),

  ('BBC Radio 4 UK','BBC راديو 4',
   'BBC Radio 4 - talk, news and documentary',
   null,'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_fourfm','https://stream.live.vc.bbcmedia.co.uk/bbc_radio_fourfm',
   g_news,'128','en','المملكة المتحدة',true,false,58),

  -- ═══ MUSIC — إضافية ══════════════════════════════════
  ('Anghami Radio','أنغامي راديو',
   'إذاعة أنغامي للموسيقى العربية',
   null,'https://stream.zeno.fm/anghami.mp3','https://stream.zeno.fm/anghami.mp3',
   g_music,'HI','ar','لبنان',true,true,59),

  ('Tarab Classic','طرب كلاسيك',
   'إذاعة الأغاني العربية الكلاسيكية',
   null,'https://stream.zeno.fm/tarab-classic.mp3','https://stream.zeno.fm/tarab-classic.mp3',
   g_music,'128','ar','مصر',true,false,60),

  ('Fairouz Radio','إذاعة فيروز',
   'إذاعة خاصة بأغاني السيدة فيروز',
   null,'https://stream.zeno.fm/fairouz.mp3','https://stream.zeno.fm/fairouz.mp3',
   g_music,'128','ar','لبنان',true,true,61),

  ('Abdel Halim Radio','إذاعة عبد الحليم',
   'إذاعة خاصة بأغاني عبد الحليم حافظ',
   null,'https://stream.zeno.fm/abdel-halim.mp3','https://stream.zeno.fm/abdel-halim.mp3',
   g_music,'128','ar','مصر',true,false,62),

  ('Umm Kulthum Radio','إذاعة أم كلثوم',
   'إذاعة خاصة بأغاني كوكب الشرق أم كلثوم',
   null,'https://stream.zeno.fm/umm-kulthum.mp3','https://stream.zeno.fm/umm-kulthum.mp3',
   g_music,'128','ar','مصر',true,true,63),

  -- ═══ JAZZ & CLASSICAL ════════════════════════════════
  ('Jazz 24','جاز 24',
   'KPLU Jazz 24 - 24/7 jazz music radio',
   null,'https://live.str3am.com:2199/tunein/jazz24.pls','https://live.str3am.com:2199/tunein/jazz24.pls',
   g_jazz,'128','en','الولايات المتحدة',true,true,64),

  ('Classic FM UK','كلاسيك إف إم',
   'Classic FM - world class classical music',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Classic_FM_logo.svg/240px-Classic_FM_logo.svg.png',
   'https://media-ice.musicradio.com/ClassicFMMP3','https://media-ice.musicradio.com/ClassicFMMP3',
   g_jazz,'128','en','المملكة المتحدة',true,true,65),

  ('WQXR Classical','WQXR كلاسيكية',
   'WQXR classical music from New York',
   null,'https://stream.wqxr.org/wqxr','https://stream.wqxr.org/wqxr',
   g_jazz,'128','en','الولايات المتحدة',true,false,66),

  ('France Musique','فرانس موسيك',
   'France Musique - musique classique française',
   null,'https://icecast.radiofrance.fr/francemusique-hifi.aac','https://icecast.radiofrance.fr/francemusique-hifi.aac',
   g_jazz,'HI','fr','فرنسا',true,false,67),

  ('Radio Mozart','راديو موتسارت',
   'Classical music 24/7 - Mozart and more',
   null,'https://stream.zeno.fm/radio-mozart.mp3','https://stream.zeno.fm/radio-mozart.mp3',
   g_jazz,'128','en','النمسا',true,false,68),

  -- ═══ ROCK & POP ═══════════════════════════════════════
  ('BBC Radio 1','BBC راديو 1',
   'BBC Radio 1 - pop music and youth culture',
   null,'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_one','https://stream.live.vc.bbcmedia.co.uk/bbc_radio_one',
   g_rock,'128','en','المملكة المتحدة',true,true,69),

  ('iHeart Radio Top 40','آي هارت توب 40',
   'iHeart Radio Top 40 hits from USA',
   null,'https://stream.zeno.fm/iheart-top40.mp3','https://stream.zeno.fm/iheart-top40.mp3',
   g_rock,'128','en','الولايات المتحدة',true,false,70),

  ('Capital FM UK','كابيتال إف إم',
   'Capital FM - UK pop hits',
   'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Capital_FM_logo.svg/240px-Capital_FM_logo.svg.png',
   'https://media-ice.musicradio.com/CapitalMP3','https://media-ice.musicradio.com/CapitalMP3',
   g_rock,'128','en','المملكة المتحدة',true,false,71),

  ('Virgin Radio UAE','فيرجن راديو الإمارات',
   'Virgin Radio UAE - best pop hits',
   null,'https://stream.zeno.fm/virgin-uae.mp3','https://stream.zeno.fm/virgin-uae.mp3',
   g_rock,'128','en','الإمارات',true,false,72),

  -- ═══ CHRISTIAN RADIO ══════════════════════════════════
  ('Vatican Radio Arabic','إذاعة الفاتيكان',
   'الإذاعة الرسمية للكرسي الرسولي الفاتيكان',
   null,'https://stream.zeno.fm/vatican-arabic.mp3','https://stream.zeno.fm/vatican-arabic.mp3',
   g_chr,'128','ar','الفاتيكان',true,true,73),

  ('SAT-7 Radio','ساتSeven راديو',
   'إذاعة ساتSeven المسيحية العربية',
   null,'https://stream.zeno.fm/sat7-radio.mp3','https://stream.zeno.fm/sat7-radio.mp3',
   g_chr,'128','ar','المملكة المتحدة',true,false,74),

  ('Coptic Radio','الإذاعة القبطية',
   'إذاعة قبطية أرثوذكسية مصرية',
   null,'https://stream.zeno.fm/coptic-radio.mp3','https://stream.zeno.fm/coptic-radio.mp3',
   g_chr,'128','ar','مصر',true,false,75),

  ('EWTN Catholic Radio','EWTN الكاثوليكية',
   'Eternal Word Television Network Catholic radio',
   null,'https://ewtn.streamguys1.com/ewtn-radio.mp3','https://ewtn.streamguys1.com/ewtn-radio.mp3',
   g_chr,'128','en','الولايات المتحدة',true,false,76),

  ('Moody Radio','مودي راديو',
   'Moody Radio - Christian music and teaching',
   null,'https://stream.zeno.fm/moody-radio.mp3','https://stream.zeno.fm/moody-radio.mp3',
   g_chr,'128','en','الولايات المتحدة',true,false,77),

  -- ═══ KIDS RADIO ═══════════════════════════════════════
  ('Spacetoon Radio','إذاعة سبيستون',
   'إذاعة سبيستون للأطفال بالعربية',
   null,'https://stream.zeno.fm/spacetoon-radio.mp3','https://stream.zeno.fm/spacetoon-radio.mp3',
   g_kids,'128','ar','الإمارات',true,true,78),

  ('CBeebies Radio','CBeebies',
   'BBC CBeebies radio for young children',
   null,'https://stream.zeno.fm/cbeebies.mp3','https://stream.zeno.fm/cbeebies.mp3',
   g_kids,'128','en','المملكة المتحدة',true,false,79),

  ('Radio Disney','راديو ديزني',
   'Radio Disney - music for kids',
   null,'https://stream.zeno.fm/radio-disney.mp3','https://stream.zeno.fm/radio-disney.mp3',
   g_kids,'128','en','الولايات المتحدة',true,false,80),

  -- ═══ INDIAN & ASIAN ═══════════════════════════════════
  ('All India Radio','إذاعة الهند',
   'All India Radio - official Indian public radio',
   null,'https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/chunklist.m3u8','https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/chunklist.m3u8',
   g_ind,'HI','hi','الهند',true,true,81),

  ('Radio Pakistan','راديو باكستان',
   'Pakistan Broadcasting Corporation official radio',
   null,'https://stream.zeno.fm/radio-pakistan.mp3','https://stream.zeno.fm/radio-pakistan.mp3',
   g_ind,'128','ur','باكستان',true,false,82),

  ('Bollywood Hits','بوليوود هيتس',
   'إذاعة الموسيقى الهندية بوليوود',
   null,'https://stream.zeno.fm/bollywood-hits.mp3','https://stream.zeno.fm/bollywood-hits.mp3',
   g_ind,'128','hi','الهند',true,false,83),

  ('Radio Japan NHK','راديو اليابان',
   'NHK Radio Japan international service',
   null,'https://nhkworld.nhk.or.jp/en/radio/','https://nhkworld.nhk.or.jp/en/radio/',
   g_ind,'128','en','اليابان',true,false,84),

  ('KBS Radio Korea','راديو كوريا',
   'KBS Radio Korea international service',
   null,'https://stream.zeno.fm/kbs-korean.mp3','https://stream.zeno.fm/kbs-korean.mp3',
   g_ind,'128','ko','كوريا الجنوبية',true,false,85),

  -- ═══ AFRICAN ══════════════════════════════════════════
  ('BBC Hausa','BBC هوسا',
   'BBC Hausa Radio for West Africa',
   null,'https://stream.live.vc.bbcmedia.co.uk/bbc_hausa_radio','https://stream.live.vc.bbcmedia.co.uk/bbc_hausa_radio',
   g_afr,'128','ha','نيجيريا',true,true,86),

  ('BBC Swahili','BBC سواحيلي',
   'BBC Swahili Radio for East Africa',
   null,'https://stream.live.vc.bbcmedia.co.uk/bbc_swahili_radio','https://stream.live.vc.bbcmedia.co.uk/bbc_swahili_radio',
   g_afr,'128','sw','كينيا',true,false,87),

  ('BBC Somali','BBC صومالية',
   'BBC Somali Radio for the Horn of Africa',
   null,'https://stream.live.vc.bbcmedia.co.uk/bbc_somali_radio','https://stream.live.vc.bbcmedia.co.uk/bbc_somali_radio',
   g_afr,'128','so','الصومال',true,false,88),

  ('Radio Nigeria','راديو نيجيريا',
   'Radio Nigeria official public radio',
   null,'https://stream.zeno.fm/radio-nigeria.mp3','https://stream.zeno.fm/radio-nigeria.mp3',
   g_afr,'128','en','نيجيريا',true,false,89),

  ('Radio Maroc','راديو المغرب',
   'الإذاعة الوطنية المغربية القناة الأولى',
   null,'https://stream.zeno.fm/radio-maroc.mp3','https://stream.zeno.fm/radio-maroc.mp3',
   g_afr,'128','ar','المغرب',true,false,90),

  -- ═══ LATIN ════════════════════════════════════════════
  ('Radio Globo Brazil','راديو جلوبو',
   'Radio Globo Brazilian radio network',
   null,'https://stream.zeno.fm/radio-globo.mp3','https://stream.zeno.fm/radio-globo.mp3',
   g_lat,'128','pt','البرازيل',true,true,91),

  ('Radio Nacional Argentina','راديو الأرجنتين',
   'Radio Nacional Argentina official public radio',
   null,'https://stream.zeno.fm/rna.mp3','https://stream.zeno.fm/rna.mp3',
   g_lat,'128','es','الأرجنتين',true,false,92),

  ('W Radio Mexico','W راديو المكسيك',
   'W Radio Mexico news and talk radio',
   null,'https://stream.zeno.fm/w-radio-mx.mp3','https://stream.zeno.fm/w-radio-mx.mp3',
   g_lat,'128','es','المكسيك',true,false,93),

  -- ═══ SPIRITUAL ════════════════════════════════════════
  ('Noor FM Dubai','نور FM دبي',
   'إذاعة نور الإسلامية التأملية',
   null,'https://stream.zeno.fm/noorfm.mp3','https://stream.zeno.fm/noorfm.mp3',
   g_spir,'128','ar','الإمارات',true,true,94),

  ('Insight Timer Radio','إنسايت تايمر',
   'Meditation and mindfulness radio',
   null,'https://stream.zeno.fm/insight-timer.mp3','https://stream.zeno.fm/insight-timer.mp3',
   g_spir,'128','en','الولايات المتحدة',true,false,95),

  ('Chillout Lounge','تشيل أوت لاونج',
   'Relaxing ambient and chillout music',
   null,'https://stream.zeno.fm/chillout-lounge.mp3','https://stream.zeno.fm/chillout-lounge.mp3',
   g_spir,'128','en','ألمانيا',true,false,96),

  -- ═══ INTERNATIONAL — إضافية ══════════════════════════
  ('RFI French Radio','RFI فرانسية',
   'Radio France Internationale - service français',
   null,'https://rfifr.ice.infomaniak.ch/rfifr-64.mp3','https://rfifr.ice.infomaniak.ch/rfifr-64.mp3',
   g_intl,'64','fr','فرنسا',true,false,97),

  ('DW German Radio','DW الألمانية',
   'Deutsche Welle Radio in German',
   null,'https://stream.zeno.fm/dw-german.mp3','https://stream.zeno.fm/dw-german.mp3',
   g_intl,'128','de','ألمانيا',true,false,98),

  ('Radio Vatican','راديو الفاتيكان الدولي',
   'Radio Vatican international multi-language',
   null,'https://stream.zeno.fm/vatican-intl.mp3','https://stream.zeno.fm/vatican-intl.mp3',
   g_intl,'128','it','الفاتيكان',true,false,99),

  ('China Radio International Arabic','CRI عربي',
   'China Radio International baللغة العربية',
   null,'https://stream.zeno.fm/cri-arabic.mp3','https://stream.zeno.fm/cri-arabic.mp3',
   g_intl,'128','ar','الصين',true,false,100),

  ('Voice of Russia','صوت روسيا',
   'Voice of Russia international radio',
   null,'https://stream.zeno.fm/voice-russia.mp3','https://stream.zeno.fm/voice-russia.mp3',
   g_intl,'128','ru','روسيا',true,false,101)

  ON CONFLICT DO NOTHING;
END $$;
