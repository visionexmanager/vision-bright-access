-- Add country field to bazaar_shops
alter table public.bazaar_shops
  add column if not exists country text;
