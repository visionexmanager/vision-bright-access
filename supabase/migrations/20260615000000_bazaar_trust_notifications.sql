-- VXBazaar trust, support, analytics, and seller notification preferences.

alter table public.bazaar_shops
  add column if not exists email_notifications boolean default true,
  add column if not exists whatsapp_notifications boolean default false,
  add column if not exists whatsapp_number text,
  add column if not exists vacation_mode boolean default false,
  add column if not exists trust_score integer default 70 check (trust_score between 0 and 100),
  add column if not exists response_rate integer default 0 check (response_rate between 0 and 100);

alter table public.bazaar_products
  add column if not exists category text default 'assistive',
  add column if not exists product_type text default 'physical' check (product_type in ('physical', 'digital', 'service')),
  add column if not exists alt_text text,
  add column if not exists stock_qty integer default 1 check (stock_qty >= 0),
  add column if not exists delivery_time text,
  add column if not exists shipping_from text,
  add column if not exists shipping_cost numeric default 0 check (shipping_cost >= 0),
  add column if not exists return_policy text,
  add column if not exists is_accessible boolean default false,
  add column if not exists is_featured boolean default false,
  add column if not exists views_count integer default 0 check (views_count >= 0),
  add column if not exists cart_count integer default 0 check (cart_count >= 0),
  add column if not exists sold_count integer default 0 check (sold_count >= 0);

create table if not exists public.bazaar_product_interactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.bazaar_products(id) on delete cascade not null,
  shop_id uuid references public.bazaar_shops(id) on delete cascade not null,
  actor_id uuid references auth.users,
  interaction_type text not null check (interaction_type in ('view', 'add_to_cart', 'wishlist', 'message', 'report')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.bazaar_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.bazaar_products(id) on delete cascade not null,
  shop_id uuid references public.bazaar_shops(id) on delete cascade not null,
  reviewer_id uuid references auth.users not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  verified_purchase boolean default false,
  created_at timestamptz default now(),
  unique(product_id, reviewer_id)
);

create table if not exists public.bazaar_disputes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.bazaar_products(id) on delete set null,
  shop_id uuid references public.bazaar_shops(id) on delete cascade not null,
  buyer_id uuid references auth.users not null,
  reason text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'seller_response', 'reviewing', 'resolved', 'closed')),
  seller_response text,
  resolution text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.bazaar_product_interactions enable row level security;
alter table public.bazaar_reviews enable row level security;
alter table public.bazaar_disputes enable row level security;

drop policy if exists "Users create bazaar interactions" on public.bazaar_product_interactions;
create policy "Users create bazaar interactions" on public.bazaar_product_interactions
  for insert to authenticated with check (auth.uid() = actor_id or actor_id is null);

drop policy if exists "Shop owners read bazaar interactions" on public.bazaar_product_interactions;
create policy "Shop owners read bazaar interactions" on public.bazaar_product_interactions
  for select to authenticated using (
    auth.uid() = (select owner_id from public.bazaar_shops where id = shop_id)
  );

drop policy if exists "Anyone reads bazaar reviews" on public.bazaar_reviews;
create policy "Anyone reads bazaar reviews" on public.bazaar_reviews
  for select using (true);

drop policy if exists "Users create own bazaar reviews" on public.bazaar_reviews;
create policy "Users create own bazaar reviews" on public.bazaar_reviews
  for insert to authenticated with check (auth.uid() = reviewer_id);

drop policy if exists "Reviewers update own bazaar reviews" on public.bazaar_reviews;
create policy "Reviewers update own bazaar reviews" on public.bazaar_reviews
  for update to authenticated using (auth.uid() = reviewer_id);

drop policy if exists "Buyers create bazaar disputes" on public.bazaar_disputes;
create policy "Buyers create bazaar disputes" on public.bazaar_disputes
  for insert to authenticated with check (auth.uid() = buyer_id);

drop policy if exists "Dispute parties read bazaar disputes" on public.bazaar_disputes;
create policy "Dispute parties read bazaar disputes" on public.bazaar_disputes
  for select to authenticated using (
    auth.uid() = buyer_id
    or auth.uid() = (select owner_id from public.bazaar_shops where id = shop_id)
  );

drop policy if exists "Dispute parties update bazaar disputes" on public.bazaar_disputes;
create policy "Dispute parties update bazaar disputes" on public.bazaar_disputes
  for update to authenticated using (
    auth.uid() = buyer_id
    or auth.uid() = (select owner_id from public.bazaar_shops where id = shop_id)
  );

create index if not exists idx_bazaar_products_shop_category on public.bazaar_products(shop_id, category);
create index if not exists idx_bazaar_interactions_shop_created on public.bazaar_product_interactions(shop_id, created_at desc);
create index if not exists idx_bazaar_reviews_product on public.bazaar_reviews(product_id);
create index if not exists idx_bazaar_disputes_shop_status on public.bazaar_disputes(shop_id, status);

create or replace function public.touch_bazaar_dispute_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_bazaar_dispute_updated_at on public.bazaar_disputes;
create trigger touch_bazaar_dispute_updated_at
  before update on public.bazaar_disputes
  for each row execute function public.touch_bazaar_dispute_updated_at();
