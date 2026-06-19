-- VXBazaar commerce: dual VX/cash pricing, orders, wishlists, and seller payouts.

alter table public.bazaar_shops
  add column if not exists stripe_account_id text,
  add column if not exists stripe_onboarding_complete boolean not null default false,
  add column if not exists order_notifications boolean not null default true,
  add column if not exists message_notifications boolean not null default true,
  add column if not exists review_notifications boolean not null default true,
  add column if not exists low_stock_notifications boolean not null default true;

alter table public.bazaar_products
  add column if not exists price_vx integer check (price_vx is null or price_vx > 0),
  add column if not exists price_usd numeric(12,2) check (price_usd is null or price_usd > 0),
  add column if not exists accepts_vx boolean not null default true,
  add column if not exists accepts_cash boolean not null default false;

update public.bazaar_products
set price_vx = greatest(1, round(price)::integer)
where price_vx is null and price is not null;

create table if not exists public.bazaar_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users(id) on delete restrict,
  shop_id uuid not null references public.bazaar_shops(id) on delete restrict,
  payment_method text not null check (payment_method in ('vx', 'cash')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled', 'refunded', 'payment_failed')),
  total_vx integer check (total_vx is null or total_vx >= 0),
  total_usd numeric(12,2) check (total_usd is null or total_usd >= 0),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  shipping_name text,
  shipping_email text,
  shipping_phone text,
  shipping_address jsonb,
  buyer_note text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bazaar_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.bazaar_orders(id) on delete cascade,
  product_id uuid references public.bazaar_products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_vx integer,
  unit_price_usd numeric(12,2),
  product_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bazaar_wishlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.bazaar_products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists idx_bazaar_orders_buyer_created
  on public.bazaar_orders(buyer_id, created_at desc);
create index if not exists idx_bazaar_orders_shop_created
  on public.bazaar_orders(shop_id, created_at desc);
create index if not exists idx_bazaar_order_items_order
  on public.bazaar_order_items(order_id);
create index if not exists idx_bazaar_wishlists_user_created
  on public.bazaar_wishlists(user_id, created_at desc);

alter table public.bazaar_orders enable row level security;
alter table public.bazaar_order_items enable row level security;
alter table public.bazaar_wishlists enable row level security;

drop policy if exists "Order parties read bazaar orders" on public.bazaar_orders;
create policy "Order parties read bazaar orders" on public.bazaar_orders
  for select to authenticated using (
    auth.uid() = buyer_id
    or auth.uid() = (select owner_id from public.bazaar_shops where id = shop_id)
  );

drop policy if exists "Sellers update bazaar orders" on public.bazaar_orders;
create policy "Sellers update bazaar orders" on public.bazaar_orders
  for update to authenticated using (
    auth.uid() = (select owner_id from public.bazaar_shops where id = shop_id)
  ) with check (
    auth.uid() = (select owner_id from public.bazaar_shops where id = shop_id)
  );

drop policy if exists "Order parties read bazaar order items" on public.bazaar_order_items;
create policy "Order parties read bazaar order items" on public.bazaar_order_items
  for select to authenticated using (
    exists (
      select 1 from public.bazaar_orders o
      join public.bazaar_shops s on s.id = o.shop_id
      where o.id = order_id and (o.buyer_id = auth.uid() or s.owner_id = auth.uid())
    )
  );

drop policy if exists "Users manage own wishlist" on public.bazaar_wishlists;
create policy "Users manage own wishlist" on public.bazaar_wishlists
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.create_bazaar_vx_order(
  _shop_id uuid,
  _items jsonb,
  _buyer_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _buyer_id uuid := auth.uid();
  _order_id uuid;
  _item jsonb;
  _product public.bazaar_products%rowtype;
  _quantity integer;
  _total integer := 0;
begin
  if _buyer_id is null then
    raise exception 'Not authenticated';
  end if;
  if jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then
    raise exception 'Cart is empty';
  end if;
  if exists (select 1 from public.bazaar_shops where id = _shop_id and owner_id = _buyer_id) then
    raise exception 'You cannot purchase from your own shop';
  end if;

  -- Serialize wallet purchases for this buyer so two checkouts cannot overspend.
  perform pg_advisory_xact_lock(hashtextextended(_buyer_id::text, 0));

  insert into public.bazaar_orders (buyer_id, shop_id, payment_method, status, buyer_note)
  values (_buyer_id, _shop_id, 'vx', 'pending', nullif(trim(_buyer_note), ''))
  returning id into _order_id;

  for _item in select value from jsonb_array_elements(_items)
  loop
    _quantity := greatest(1, least(99, coalesce((_item->>'quantity')::integer, 1)));

    select * into _product
    from public.bazaar_products
    where id = (_item->>'product_id')::uuid
      and shop_id = _shop_id
    for update;

    if not found or not _product.in_stock or not _product.accepts_vx or _product.price_vx is null then
      raise exception 'Product is not available for VX purchase';
    end if;
    if coalesce(_product.stock_qty, 0) < _quantity then
      raise exception 'Insufficient stock for %', _product.name;
    end if;

    _total := _total + (_product.price_vx * _quantity);

    insert into public.bazaar_order_items (
      order_id, product_id, product_name, quantity, unit_price_vx, product_snapshot
    ) values (
      _order_id, _product.id, _product.name, _quantity, _product.price_vx,
      jsonb_build_object('image', _product.image, 'type', _product.product_type)
    );

    update public.bazaar_products
    set stock_qty = stock_qty - _quantity,
        in_stock = stock_qty - _quantity > 0,
        sold_count = coalesce(sold_count, 0) + _quantity
    where id = _product.id;
  end loop;

  perform public.spend_vx(_total, 'bazaar_order', _order_id::text, 'VXBazaar order');

  update public.bazaar_orders
  set total_vx = _total, status = 'paid', paid_at = now(), updated_at = now()
  where id = _order_id;

  insert into public.notifications (user_id, title, body, type, sent_by)
  select owner_id, 'New VXBazaar order', 'A paid VX order is ready to process.', 'success', _buyer_id
  from public.bazaar_shops where id = _shop_id;

  return _order_id;
end;
$$;

grant execute on function public.create_bazaar_vx_order(uuid, jsonb, text) to authenticated;

create or replace function public.create_bazaar_cash_order(
  _buyer_id uuid,
  _shop_id uuid,
  _items jsonb,
  _buyer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _order_id uuid;
  _item jsonb;
  _product public.bazaar_products%rowtype;
  _quantity integer;
  _total numeric(12,2) := 0;
begin
  if _buyer_id is null or jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then
    raise exception 'Invalid cash order';
  end if;
  if exists (select 1 from public.bazaar_shops where id = _shop_id and owner_id = _buyer_id) then
    raise exception 'You cannot purchase from your own shop';
  end if;

  insert into public.bazaar_orders (buyer_id, shop_id, payment_method, status, buyer_note)
  values (_buyer_id, _shop_id, 'cash', 'pending', nullif(trim(_buyer_note), ''))
  returning id into _order_id;

  for _item in select value from jsonb_array_elements(_items)
  loop
    _quantity := greatest(1, least(99, coalesce((_item->>'quantity')::integer, 1)));
    select * into _product
    from public.bazaar_products
    where id = (_item->>'product_id')::uuid and shop_id = _shop_id
    for update;

    if not found or not _product.in_stock or not _product.accepts_cash or _product.price_usd is null then
      raise exception 'Product is not available for cash purchase';
    end if;
    if coalesce(_product.stock_qty, 0) < _quantity then
      raise exception 'Insufficient stock for %', _product.name;
    end if;

    _total := _total + (_product.price_usd * _quantity);
    insert into public.bazaar_order_items (
      order_id, product_id, product_name, quantity, unit_price_usd, product_snapshot
    ) values (
      _order_id, _product.id, _product.name, _quantity, _product.price_usd,
      jsonb_build_object('image', _product.image, 'type', _product.product_type)
    );

    update public.bazaar_products
    set stock_qty = stock_qty - _quantity,
        in_stock = stock_qty - _quantity > 0
    where id = _product.id;
  end loop;

  update public.bazaar_orders set total_usd = _total where id = _order_id;
  return jsonb_build_object('order_id', _order_id, 'total_usd', _total);
end;
$$;

revoke all on function public.create_bazaar_cash_order(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_bazaar_cash_order(uuid, uuid, jsonb, text) to service_role;

create or replace function public.release_bazaar_cash_order(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _order public.bazaar_orders%rowtype;
  _line record;
begin
  select * into _order from public.bazaar_orders where id = _order_id for update;
  if not found or _order.payment_method <> 'cash' or _order.status <> 'pending' then
    return;
  end if;

  for _line in select product_id, quantity from public.bazaar_order_items where order_id = _order_id
  loop
    update public.bazaar_products
    set stock_qty = stock_qty + _line.quantity, in_stock = true
    where id = _line.product_id;
  end loop;

  update public.bazaar_orders
  set status = 'cancelled', updated_at = now()
  where id = _order_id;
end;
$$;

revoke all on function public.release_bazaar_cash_order(uuid) from public, anon, authenticated;
grant execute on function public.release_bazaar_cash_order(uuid) to service_role;

create or replace function public.finalize_bazaar_cash_order(
  _order_id uuid,
  _checkout_session_id text,
  _payment_intent_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _order public.bazaar_orders%rowtype;
  _line record;
begin
  select * into _order from public.bazaar_orders where id = _order_id for update;
  if not found or _order.payment_method <> 'cash' then
    raise exception 'Cash order not found';
  end if;
  if _order.status = 'paid' then
    return;
  end if;

  update public.bazaar_products p
  set sold_count = coalesce(p.sold_count, 0) + sold.quantity
  from (
    select product_id, sum(quantity)::integer as quantity
    from public.bazaar_order_items
    where order_id = _order_id
    group by product_id
  ) sold
  where p.id = sold.product_id;

  update public.bazaar_orders
  set status = 'paid',
      stripe_checkout_session_id = _checkout_session_id,
      stripe_payment_intent_id = _payment_intent_id,
      paid_at = now(),
      updated_at = now()
  where id = _order_id;

  insert into public.notifications (user_id, title, body, type, sent_by)
  select s.owner_id, 'New paid VXBazaar order',
    'A cash order was paid and is ready to process.', 'success', _order.buyer_id
  from public.bazaar_shops s where s.id = _order.shop_id;
end;
$$;

revoke all on function public.finalize_bazaar_cash_order(uuid, text, text) from public, anon, authenticated;
grant execute on function public.finalize_bazaar_cash_order(uuid, text, text) to service_role;

create or replace function public.touch_bazaar_order_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_bazaar_order_updated_at on public.bazaar_orders;
create trigger touch_bazaar_order_updated_at
  before update on public.bazaar_orders
  for each row execute function public.touch_bazaar_order_updated_at();
