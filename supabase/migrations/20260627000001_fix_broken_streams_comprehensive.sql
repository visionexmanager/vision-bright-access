-- ============================================================
-- Comprehensive stream fix: June 27 2026
-- Method: HTTP GET test on all 203 TV channels + 139 radio stations
-- TV result:  117 OK / 38 FAIL / 48 WEBSITE
-- Radio result: 32 OK / 104 FAIL / 3 WEBSITE
-- All 55 zeno.fm stream IDs returned 404 (platform IDs expired)
-- All radiojar.com .mp3 slugs returned 404 (slugs expired)
-- ============================================================

BEGIN;

-- ============================================================
-- TV CHANNELS: UPDATE with confirmed working replacement URLs
-- ============================================================

-- Al Kass Sports: old liveeu-gcp URL 404 → new CDN confirmed 200
UPDATE tv_channels SET
  stream_url   = 'https://liveakgr.alkassdigital.net/hls/live/2097037/Alkass3vak/master.m3u8',
  official_url = 'https://liveakgr.alkassdigital.net/hls/live/2097037/Alkass3vak/master.m3u8'
WHERE id = '07178b90-36cb-4baa-bbe4-51b98f596d81';

-- Palestine TV: telewebion CDN dead → PBC official CDN confirmed 200
UPDATE tv_channels SET
  stream_url   = 'https://pbc.furrera.ps/palestinelivehd/index.m3u8',
  official_url = 'https://pbc.furrera.ps/palestinelivehd/index.m3u8'
WHERE id = '44b00f34-2e3e-4d1b-8843-f1a9b2da63a8';

-- CCTV-4 China: dead news.cgtn.com URL → caton.cloud CDN confirmed 200
UPDATE tv_channels SET
  stream_url   = 'https://global.cgtn.cicc.media.caton.cloud/master/cgtn-america.m3u8',
  official_url = 'https://global.cgtn.cicc.media.caton.cloud/master/cgtn-america.m3u8'
WHERE id = '1aef6ea4-fe8d-4e56-8a41-f202a97a0be9';

-- ============================================================
-- TV CHANNELS: DEACTIVATE — dead stream URLs (no free replacement found)
-- ============================================================

UPDATE tv_channels SET is_active = false WHERE id IN (
  -- Dead CDN streams
  '98056957-f4d2-4c3a-b7da-4c0221b3c608', -- Abu Dhabi TV          (185.9.2.18 404)
  '24dfa005-f031-4654-9904-9951db6015a6', -- Dubai One             (mgmlcdn CDN timeout)
  '21cebca7-2a91-48d6-8fd4-1120ef5bdfb9', -- Dubai Sports          (mgmlcdn CDN timeout)
  '5fdbe41e-8bd4-4f22-9db2-ee9aa630fb23', -- Sama Dubai            (mgmlcdn CDN timeout)
  'c2464533-f05a-4878-b30d-c45dedaff124', -- Iqraa                 (fasttvcdn 404)
  '3aa6f140-fcce-4025-bb84-bfac60288752', -- Iqraa TV              (fasttvcdn 404)
  '26df2a8f-8524-445b-94ad-52b76923e38b', -- Abu Dhabi Sports 1    (ercdn timeout)
  '022ff4dd-f1ff-4d3e-a7c2-d137dfdf3cd6', -- Al Majd               (website, no HLS)
  '69a764fc-6a72-4406-a329-cb18da7050a1', -- ON E Egypt            (on.net website)
  '3df266b2-6206-4904-86ea-a970c5f90227', -- MBC 2                 (magictvbox 403)
  '12a8d09c-78a1-4195-a7b3-1386fcf785c7', -- MBC Action            (shahid 403)
  '677f108f-896e-464d-90e9-e451e908de4b', -- MBC Documentary       (mbc.net website)
  '3f0b903c-2297-4cd6-8eed-23965898a696', -- MBC Lifestyle         (mbc.net website)
  '664f0340-0a09-4534-b637-b0c9b6ad44c5', -- MBC Max               (mbc.net website)
  'b7fd4dfb-fd11-41c2-affc-a9af53022e74', -- TBN Arabic            (simplestreamcdn timeout)
  '9f986aa6-3eb2-40bd-8d9b-e4ad5bcf3abb', -- Africanews English    (mediatailor timeout)
  'b289c500-16df-4b49-a800-d6d8dd2ec96a', -- Euronews Arabic       (kaltura timeout)
  '461a8b41-37df-45b7-ab93-3f3fb666e488', -- Islam Channel UK      (islamchannel timeout)
  '8ae5eb44-6a08-49c1-87a5-e43bb2607852', -- TV5MONDE French       (403 geo-locked EU)
  '22325d19-d324-4e93-a601-456f15818277', -- DW Documentary        (403 geo-locked)
  '258a5863-bade-4e83-a43e-d95cd227bbe8', -- Arte France           (403 geo-locked EU)
  'b652b664-c6e1-45fb-a916-7eef8776e6bb', -- TRT 1 Turkey          (403 geo-locked TR)
  '0883feae-a71e-402a-bd96-2a87f61adc85', -- ARY Digital Pakistan  (5centscdn timeout)
  '0b5fb2f5-f482-4fac-ae4e-1ee37873a90d', -- Geo TV Pakistan       (5centscdn 404)
  'acd39c0f-e682-44b1-8848-0c023386967a', -- Show TV Turkey        (mncdn timeout)
  '886773ff-2ee3-416a-bab5-bb72c95b214b', -- NTA Nigeria           (visionip 404)
  '658a7a15-3926-4dcc-ae42-0fa07365e3e4', -- Al Manar Lebanon      (timeout)
  '6537f931-2e09-4304-ba36-7ce5ba9ead08', -- Channels TV Nigeria   (push2stream 403)
  '5db5b100-0b5c-4e57-ae89-26392a7c957f', -- RAI Uno Italy         (adriatelekom timeout)
  'f0f8da20-4319-4af6-917c-06ca65630585', -- RAI Italy             (adriatelekom timeout)
  '24d742f1-95ac-46cb-b45c-b2f5b2894372', -- ERT Greece            (broadpeak 400)
  '16ff770c-6bc1-4259-8acf-76a8aa736109', -- Zee TV                (zee5 website)
  '2126ebdf-a56c-4b5b-95c5-868be3ae2db2', -- Eurosport             (paid website)
  '4401a09a-c343-4f31-9426-9f2f60e9c3c4', -- CGTN Chinese          (news.cgtn.com 404)
  -- Website-only (no free HLS stream available)
  '7c3a6ab4-98d6-471c-9242-1a23ce741358', -- Abu Dhabi Drama       (adtv.ae website)
  '37b97b07-aead-4c1a-ab6e-647045f615ca', -- Abu Dhabi Sports      (adtv.ae website)
  'f3d77441-0299-4a60-a475-51ced8957284', -- Abu Dhabi Sports 2    (adtv.ae website)
  'bf1a16f2-8c21-43aa-a6f6-48287cff845a', -- Al Hafiz TV           (alhafiz.tv website)
  '60b8f8c9-f251-414a-8a1f-0c1369a2c688', -- Al Hayah Quran        (alhayahtv website)
  '3034ef01-ce3b-432a-b784-07699fcc1011', -- Al Nahar Egypt        (alnaharegypt website)
  'c1dd44c8-95e8-41a9-beef-1507c6e65e0b', -- Al Qahera News        (cairochannel website)
  '8e8601a1-5e78-4117-8f85-269927b32ea4', -- Animal Planet Arabic  (website, paid)
  '08c07175-d750-4d0c-aa08-b6b84747af95', -- Baraem                (baraem.tv website)
  '8abfb430-2421-4e87-8e65-8c72b87ec07c', -- BBC Earth             (paid, no live)
  '83c9bebc-dcd0-49f2-b529-91517020af70', -- BBC One UK            (iplayer geo-locked)
  '3c9c9745-52c2-4cca-bf94-d970b8815b3e', -- beIN Sports 1         (paid)
  'ea7c0187-5fc9-4475-8726-5cf478ca7d25', -- beIN Sports 2         (paid)
  'fab34f87-3e00-46d5-97a4-1d23b4335701', -- Cartoon Network Arabic(paid)
  '5ce646ad-3007-47fe-ae62-a39c3f0f7bb5', -- CNN en Español        (website)
  '57cb918f-dd6d-4c14-a6d6-31db89883fd8', -- CNN International     (website)
  'f91a7ea5-16e6-4973-b05a-ef8e9497a1b3', -- Colors TV India       (paid)
  'f27c20da-c7b9-4de4-8e44-f129037e2853', -- CopticWorld TV        (website)
  'ec8c067b-4a4a-410b-a2f7-33d70aecb710', -- Discovery Arabic      (paid)
  '97d0332e-1c68-4fb6-9cc3-c31ea4fa01fb', -- Dream TV Egypt        (dream.tv website)
  '799577ee-2acd-4ca8-bd2c-9b95265b57ef', -- ENTV Algeria          (entv.dz website)
  '1b4b7ed8-eff2-4d18-b305-e26b0b260ddb', -- ESPN International    (paid)
  '6de28124-fab1-4d72-963c-0201e7f52dad', -- Fatafeat Food         (website)
  'f04acb96-44a3-443b-9d28-a54012ff75c9', -- France 2              (geo-locked FR)
  '997449ca-50d5-456d-9647-e727f28a4388', -- Huda TV               (website)
  '98b35518-cb8c-42d3-b9e9-6a1af830c3ef', -- i24 News Arabic       (website)
  'b5e4ed87-4f27-47e1-876b-3a448a8d6db3', -- IRIB Iran             (geo-locked IR)
  'ba7d98b5-f25f-43a3-bec3-57d091573663', -- Mauritania TV         (tvm.mr website)
  '9afe81c2-e104-4355-b449-2493028931f6', -- Mazika TV             (mazika.tv website)
  'e1800dfe-3299-47e8-af5b-575a750adda7', -- Mazzika               (mazzika.tv website)
  'cd9204cc-20f2-4066-9a91-4bdb12c3827e', -- Melody Arabia         (website)
  'e7588fb1-1dae-40e1-a107-a71b4ae92a6e', -- Melody Hits           (website)
  '9a2606ef-8ba5-4351-adda-f5fff4e9622b', -- Nat Geo Wild          (paid)
  '7f3ad9d2-04fc-4a17-acdd-e3885c337fff', -- National Geographic Arabic (paid)
  '832702e7-1b09-455d-923a-50b6c1761cdc', -- National Geographic Wild   (paid)
  '3af3c6e0-6e01-4260-bae2-f23b582ef275', -- Nickelodeon Arabic    (paid)
  'fc3c8c4e-3ca8-45e8-acaa-32b64a5b142c', -- Nile News             (nile.tv website)
  'fb5090fa-5311-4085-ad1e-03648713c26e', -- NOS Netherlands       (geo-locked NL)
  'f0ec1781-be5f-431a-80c5-cc26615d17ed', -- ON TV Egypt           (ontv.eg website)
  'db02b10a-5e52-4598-b3d8-bcdf4b7f5ba3', -- Qalam Academy         (not a live channel)
  'a08100c7-750a-4afc-9136-cdeb20d1e97c', -- RTE Ireland           (geo-locked IE)
  '9c537e92-688e-48ad-b76a-3596d5831e3d', -- SABC South Africa     (website)
  '1cd8763d-4564-4da4-852a-516ce1dbb782', -- Safa TV               (safatv.net website)
  '7451f7fa-51a5-4a5e-ad3e-b851327c2d7f', -- Saudi Football        (saff.com.sa website)
  '42fdae2b-ea03-4785-ab4a-cfa0e23a8f39', -- Saudi Sports          (ssc.com.sa paid)
  'a8141220-da08-42c9-a945-3a3c9366dbdb', -- Sony Entertainment TV (paid)
  'c38a43c5-c32b-40aa-80d4-b41a726eb28e', -- SSC Saudi             (ssc.com.sa paid)
  'c6274814-9bdb-4c0d-b5c8-21e660ce13aa', -- Star TV Turkey        (startv website)
  '313bbe3e-a59c-42b5-8eb5-15b8a0b52b3a', -- TED Talks             (not a live channel)
  '1bf61902-541f-4133-be63-acce98da75fa', -- Telemundo             (paid US-only)
  'df44be59-605c-443f-aee9-466514633c22', -- Toyor Al Jannah       (website)
  'cb892e33-cb9d-435f-a720-27158d9b43fa', -- TV5Monde Arabic       (paid)
  'b08ac82e-7546-4f85-afed-02bfad646fca', -- Univision             (paid US-only)
  'b2d62229-0999-4dcf-80c6-cc1991c2739d', -- Zee Aflam             (zeesalaam website)
  '2703b0ad-0280-45bc-bc8a-aabbd601901f'  -- Zee TV India          (paid)
);

-- ============================================================
-- RADIO STATIONS: UPDATE with confirmed working replacement URLs
-- ============================================================

-- Quran Radio Saudi: radiojar slug expired → Akamai globecast CDN (confirmed 200)
UPDATE radio_stations SET
  stream_url   = 'https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8',
  official_url = 'https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8'
WHERE id = '665145c6-213e-4754-a0cc-ea34fe112913';

-- Holy Quran Saudi: icestream2.sba.sa unreliable → same Akamai globecast CDN
UPDATE radio_stations SET
  stream_url   = 'https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8',
  official_url = 'https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8'
WHERE id = '35bb30e2-c0fe-46d9-ad50-e2e964e0229e';

-- DW German Radio: zeno.fm 404 → DW Akamai CDN (confirmed 200)
UPDATE radio_stations SET
  stream_url   = 'https://dwamdstream106.akamaized.net/hls/live/2017965/dwstream106/index.m3u8',
  official_url = 'https://dwamdstream106.akamaized.net/hls/live/2017965/dwstream106/index.m3u8'
WHERE id = '97001f3c-84e4-440d-8174-3db401d3c4c1';

-- BBC World Service: bbcmedia icecast HEAD-incompatible → BBC ms6 HLS (confirmed 200)
UPDATE radio_stations SET
  stream_url   = 'https://a.files.bbci.co.uk/ms6/live/3441A116-B12E-4D2F-ACA8-C1984642FA4B/audio/simulcast/hls/nonuk/pc_hd_abr_v2/ak/bbc_world_service.m3u8',
  official_url = 'https://a.files.bbci.co.uk/ms6/live/3441A116-B12E-4D2F-ACA8-C1984642FA4B/audio/simulcast/hls/nonuk/pc_hd_abr_v2/ak/bbc_world_service.m3u8'
WHERE id = 'a01144a9-d210-4b21-8237-ec7ba85be4c2';

-- BBC Radio 4 UK: bbcmedia HEAD-incompatible → BBC ms6 HLS (confirmed 200)
UPDATE radio_stations SET
  stream_url   = 'https://a.files.bbci.co.uk/ms6/live/3441A116-B12E-4D2F-ACA8-C1984642FA4B/audio/simulcast/hls/nonuk/pc_hd_abr_v2/cf/bbc_radio_fourfm.m3u8',
  official_url = 'https://a.files.bbci.co.uk/ms6/live/3441A116-B12E-4D2F-ACA8-C1984642FA4B/audio/simulcast/hls/nonuk/pc_hd_abr_v2/cf/bbc_radio_fourfm.m3u8'
WHERE id = '8b48026c-a063-4663-922e-693fbc11800b';

-- BBC Arabic Radio: pool_904 returned 410 Gone → bbcmedia icecast (correct format)
UPDATE radio_stations SET
  stream_url   = 'https://stream.live.vc.bbcmedia.co.uk/bbc_arabic_radio',
  official_url = 'https://stream.live.vc.bbcmedia.co.uk/bbc_arabic_radio'
WHERE id = '1a396871-3042-4f23-b57e-f02ec9bd9dcf';

-- MBC FM Saudi: radiojar slug 404 → CloudFront HLS (confirmed 200)
UPDATE radio_stations SET
  stream_url   = 'https://dbbv9umqcd7cs.cloudfront.net/out/v1/db15b75c3cc0400c91961468d6a232ac/index.m3u8',
  official_url = 'https://dbbv9umqcd7cs.cloudfront.net/out/v1/db15b75c3cc0400c91961468d6a232ac/index.m3u8'
WHERE id = '45573595-c579-4a6b-865d-e818a87411ed';

-- Panorama FM Saudi: zeno.fm 404 → CloudFront HLS (confirmed 200)
UPDATE radio_stations SET
  stream_url   = 'https://d6izdil55uftn.cloudfront.net/out/v1/0a06d1d6377c47edbd48721ed724bd08/index.m3u8',
  official_url = 'https://d6izdil55uftn.cloudfront.net/out/v1/0a06d1d6377c47edbd48721ed724bd08/index.m3u8'
WHERE id = '9bf27880-d57d-457e-9b25-248a80cdaa46';

-- Sharjah Radio: zeno.fm 404 → itworkscdn HLS (confirmed 200)
UPDATE radio_stations SET
  stream_url   = 'https://svs.itworkscdn.net/smcradiolive/smcradiolive/playlist.m3u8',
  official_url = 'https://svs.itworkscdn.net/smcradiolive/smcradiolive/playlist.m3u8'
WHERE id = 'e8d90969-cb64-4638-81b8-3201fb9db1cf';

-- Quran Radio Egypt: ertu.org timeout → kwikmotion CDN (confirmed 200)
UPDATE radio_stations SET
  stream_url   = 'https://live.kwikmotion.com/quranegyptlive/quranegypt/playlist.m3u8',
  official_url = 'https://live.kwikmotion.com/quranegyptlive/quranegypt/playlist.m3u8'
WHERE id = '4d6ff4df-9852-42a6-8b9b-27ad76a04258';

-- DW Arabic Radio: dwamdstream104 404 → dwamdstream103 (DW Arabic, confirmed 200)
UPDATE radio_stations SET
  stream_url   = 'https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/index.m3u8',
  official_url = 'https://dwamdstream103.akamaized.net/hls/live/2015526/dwstream103/index.m3u8'
WHERE id = 'e654573d-7d1e-4ea0-8a75-611e3cdca230';

-- ============================================================
-- RADIO STATIONS: DEACTIVATE — all dead streams
-- ============================================================

UPDATE radio_stations SET is_active = false WHERE id IN (
  -- All zeno.fm streams (every single ID returned 404 — platform IDs expired)
  'a4f7ffc0-447d-4ee9-8d23-f36399d3de90', -- Abdel Halim Radio
  '1ab46481-a07e-4936-ab7e-fbcf56d4c214', -- Ajman Radio
  'f5553af5-e521-4305-81ce-c11a05551118', -- Algeria Radio
  '76b92ca9-8ee8-470f-9121-1cd73636470d', -- Anghami Radio (paid service)
  'b06bf03a-7b09-430b-831f-3277a2ab1ed6', -- Bahrain Radio
  'cf66aebe-981c-46ad-8787-0387a98f0e02', -- Bollywood Hits
  '4d33bb29-b9b1-4436-a634-356876f7f59a', -- CBeebies Radio (shut down 2019)
  'c74b686b-62b5-4c7b-a0b9-8545a0cb2b48', -- Chillout Lounge
  'cdd35b64-66ab-4444-83b7-f0b1bba11903', -- China Radio International Arabic
  '00bfc9f5-5597-48b5-9ac6-2866dd4b026a', -- Coptic Radio
  'f557bc2f-e83a-48b9-9493-e2c4ed9b6113', -- Dubai FM
  '9f3a3431-dd23-4df7-9a26-76516990fd50', -- Fairouz Radio
  '3f2bcbbf-57e8-4df6-8bbc-6b03ffd5eb65', -- France 24 Arabic Radio
  '7935db5b-f017-4e34-9c04-c5318dce75a7', -- Hala FM Saudi
  '924ed4a9-0a53-4e31-b21b-d0c2ec0d1780', -- Holy Quran Pakistan
  'dda47bd0-9a26-447e-97e3-e2298adc9b97', -- iHeart Radio Top 40 (US geo-locked)
  'af96eee7-7562-4f77-a8fb-f0a1bc909f74', -- Insight Timer Radio (paid)
  '83d5dbf2-24c4-4097-bb40-9525a9c0133c', -- Iraqi Radio
  '5e6c4895-1d1b-4a95-9dc5-e1b9d8120fc0', -- Jordan Radio
  '58276c6f-620d-4f62-903b-39a9f94d2ddb', -- KBS Radio Korea
  'd5f8f74a-bb81-478b-b4b2-34dcdb649a42', -- Lebanon Radio
  'fd2d8b72-e8bb-41e3-a37f-ce63037f215b', -- Libya Radio
  'b4c2aead-a072-45b5-954f-fe65b5a725da', -- Melody FM
  '1931e061-d99b-4163-9cdf-27e6091a8cc8', -- Melody FM Egypt
  '9dacd284-70f0-4dd9-89b1-1c419ea6be6d', -- Mishary Rashid Radio
  '9cf92384-ba8f-4043-b536-7c77f2076465', -- Mix FM Saudi
  '6e17c30d-6ff5-401c-9c9c-7742d93ce665', -- Moroccan Radio
  '12828199-22c8-4600-8854-890542923409', -- Nile FM Egypt
  'cbc4823c-900f-4981-adc4-35d5584a3f66', -- Noor Dubai FM
  '0f2453f6-a335-41a6-9c4a-604641ee5782', -- Oman Radio
  '4aa00e8d-cf8c-42a3-b0d9-427451aadbef', -- Palestine Radio
  '0f689542-cae2-4278-8a43-0a20ef66c736', -- Qatar Radio
  '0b23005a-f9ca-4534-b15b-81cc8f3abb65', -- Al-Quran Al-Karim Sudan
  '9264f73f-7645-45db-98d6-0030fba92da7', -- Sudan Radio
  '75a58495-7c50-4820-829a-d8ae038f0c98', -- Quran Radio Kuwait
  'd0451b4d-dde1-4c2f-a89d-992b85f07291', -- Quran Radio Turkey
  'ff7a3f06-3476-4ecf-ab5f-560602a3d8ab', -- Radio Disney (shut down 2021)
  '3ea1fe94-40b8-406d-9957-5130c1f914fa', -- Radio Globo Brazil
  '3bd72148-5c90-4b85-93fc-d07d53c2730b', -- Rotana FM
  '676aa50c-87b6-4166-9632-1326a4100256', -- SAT-7 Radio
  '700c6ef9-b7e8-449c-93aa-c532c4fe7340', -- Sawt Al Khaleej
  '9e3d3e4a-4866-43bb-ac10-6accb01eaeed', -- Somalia Radio
  '648faf1d-4097-49fa-b309-be87d771d84d', -- Spacetoon Radio (defunct)
  '6ac5f48e-3941-460a-a71a-a6bca039341d', -- Syrian Radio
  'e18e3cb1-e101-461f-93c5-8a72528c53d6', -- Tarab Classic
  '7903ae25-683a-4f79-9bbc-de74dd644cf8', -- Umm Kulthum Radio
  'f6a70f23-9ef8-47ee-9401-899123514a7a', -- Virgin Radio UAE
  'b85f062f-a11f-45b5-91a9-8c0660c8cd92', -- VOA Arabic
  'fa25f5a6-66a5-4476-80c0-a37f3d1dc3b6', -- Voice of Russia (shut down 2014)
  '30c195c4-9939-4365-a56a-0f07cf9977ec', -- W Radio Mexico
  -- radiojar.com slugs (MBC FM confirmed 404; all .mp3 slugs on same platform)
  '209d77cf-37ff-4ad6-9803-4a8cb8c3e6c4', -- Quran Madinah
  '5785d8aa-3e84-4459-8a19-bd5fa4342058', -- Kuwait FM
  '2280adb3-b112-4105-ba19-9c934da3c29c', -- Saudi Radio Riyadh
  'e0f8ff79-f247-4b28-8c44-dc57c8310ad3', -- SBC Radio Saudi
  'b975e7c0-816f-47fd-811f-ace3da1d3e97', -- Tilawat Quran
  'e65ed06d-d724-48a5-b9c7-d68aabf40172', -- Rotana Music
  -- Other dead/unreachable streams
  '541bbe7a-42c7-4df5-b87b-0015077f43ad', -- Al Arabiya Radio      (alarabiya 404)
  '5a04d594-e9ec-4125-8e8f-95da62e57a47', -- Nogoum FM Egypt       (nrpstream timeout)
  'b4246900-db6b-4769-a69b-d1d7555626ff', -- Monte Carlo Doualiya  (infomaniak timeout)
  '2a2325a1-90be-4aaa-8ca1-701aa1f0dfea', -- RFI Arabic            (infomaniak 404)
  'eebdcc29-aefb-4a40-9a95-b10208c7ac1e', -- RFI French            (infomaniak 404)
  -- Website URLs (cannot be played as audio streams)
  'cbf38f6c-bfdb-4da1-bf24-d0890e633bc8', -- Al Fajr Quran         (radioalgerie website)
  '3226474d-2e2a-4dfd-9193-b8d8eeebc081', -- Kuwait Quran Radio    (media.gov.kw website)
  'ee0a4e27-4153-4cd9-a528-4515657d6f4b', -- Oman FM               (oman.om website)
  '9bb9598c-35f4-4885-a6d0-d4f97210a740', -- Radio Disney Arabia   (disney website, defunct)
  '52bd6690-0841-423c-a139-503cd411e9d5', -- Radio Formula Mexico  (radioformula website)
  'f9f7d13c-6b15-4f30-8ee9-6f0ddf9b3dc1', -- Radio Kenya Citizen   (citizen.digital website)
  'ce63acf4-6779-43b1-8cc5-1134e8a63ac4', -- Radio Nigeria         (voicenigeria website)
  'ab782231-102f-42d2-94ea-8bea6908d6e7', -- Radio Mariam Lebanon  (radiomariam website)
  '95e05991-cdb1-4e0c-bb73-9d792139eea1', -- ESPN Radio USA        (espn website)
  '7c340aab-747e-4229-b172-fa6074327ca9', -- Radio Singapore CNA   (channelnewsasia website)
  'bc09662e-dd73-4e05-a67a-2474f4eab636', -- Sawt el Rab Lebanon   (sawtlrab website)
  'a50e7cc6-b4fb-4c89-994b-96fb7cfea6bd', -- Voice of America      (voanews website)
  'cbec23ba-b23d-4bed-8025-e5172338a5b1', -- NHK World Radio Japan (nhkworld website)
  'bb138e4c-e440-45ac-807e-c44ce710265f', -- Radio Japan NHK       (nhkworld website)
  '09d083d4-b988-4aa2-b005-d80bc59ed91a', -- Calm Radio Meditation (paid subscription)
  '050cb6d0-8527-4312-a69f-fec744c70b21', -- BBC Radio for Kids    (CBeebies shut down 2019)
  '85390f09-762d-4a23-a46c-e8a7d8376d6e'  -- Jazz FM UK            (jazzfm website)
);

COMMIT;
