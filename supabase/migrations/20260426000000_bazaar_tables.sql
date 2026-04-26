-- VXBazaar: Shops table
create table if not exists public.bazaar_shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  name text not null,
  tier text not null check (tier in ('kiosk', 'boutique', 'store', 'flagship')),
  description text,
  theme_color text default '#f59e0b',
  bg_image text,
  sign_style text default 'neon',
  is_active boolean default true,
  last_rent_paid timestamptz default now(),
  created_at timestamptz default now()
);

-- VXBazaar: Products table
create table if not exists public.bazaar_products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.bazaar_shops(id) on delete cascade not null,
  name text not null,
  description text,
  price numeric not null check (price >= 0),
  image text,
  shelf_position text,
  in_stock boolean default true,
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.bazaar_shops enable row level security;
alter table public.bazaar_products enable row level security;

-- Shops: anyone can read active shops
create policy "Read active shops" on public.bazaar_shops
  for select using (is_active = true);

-- Shops: owner can insert/update/delete their own shop
create policy "Owner manages shop" on public.bazaar_shops
  for all using (auth.uid() = owner_id);

-- Products: anyone can read
create policy "Read products" on public.bazaar_products
  for select using (true);

-- Products: shop owner can manage products
create policy "Owner manages products" on public.bazaar_products
  for all using (
    auth.uid() = (select owner_id from public.bazaar_shops where id = shop_id)
  );

-- Index for performance
create index if not exists idx_bazaar_shops_owner on public.bazaar_shops(owner_id);
create index if not exists idx_bazaar_products_shop on public.bazaar_products(shop_id);
