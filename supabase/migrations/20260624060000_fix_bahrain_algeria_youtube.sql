-- Fix Bahrain TV and Algeria TV which were reset to YouTube embed by
-- migration 20260624040000 (that migration corrected wrong stream_url values
-- but used YouTube instead of the proper HLS CDN streams).

UPDATE public.tv_channels SET
  stream_url   = 'https://5c7b683162943.streamlock.net/live/ngrp:bahraintvmain_all/playlist.m3u8',
  official_url = 'https://5c7b683162943.streamlock.net/live/ngrp:bahraintvmain_all/playlist.m3u8',
  is_active    = true
WHERE name = 'Bahrain TV';

UPDATE public.tv_channels SET
  stream_url   = 'http://185.9.2.18/chid_347/index.m3u8',
  official_url = 'http://185.9.2.18/chid_347/index.m3u8',
  is_active    = true
WHERE name = 'Algeria TV';
