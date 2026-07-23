-- VXBazaar integrity and authorization hardening.

-- Store creation is performed by one transaction so charging and creation
-- cannot get out of sync. Direct inserts are no longer allowed.
drop policy if exists "Owner manages shop" on public.bazaar_shops;
drop policy if exists "Owners update bazaar shops" on public.bazaar_shops;
drop policy if exists "Owners delete bazaar shops" on public.bazaar_shops;

create policy "Owners update bazaar shops" on public.bazaar_shops
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners delete bazaar shops" on public.bazaar_shops
  for delete to authenticated
  using (auth.uid() = owner_id);

create or replace function public.create_bazaar_shop(
  _name text,
  _tier text,
  _description text default null,
  _theme_color text default '#f59e0b',
  _sign_style text default 'neon',
  _country text default null,
  _email_notifications boolean default true,
  _whatsapp_notifications boolean default false,
  _whatsapp_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _shop_id uuid;
  _setup_cost integer;
  _trial_active boolean := false;
begin
  if _user_id is null then
    raise exception 'Not authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));

  if exists (select 1 from public.bazaar_shops where owner_id = _user_id) then
    raise exception 'You already have a VXBazaar shop';
  end if;
  if length(trim(coalesce(_name, ''))) not between 2 and 80 then
    raise exception 'Shop name must be between 2 and 80 characters';
  end if;
  if _tier not in ('kiosk', 'boutique', 'store', 'flagship') then
    raise exception 'Invalid shop tier';
  end if;
  if _sign_style not in ('neon', 'royal', 'cyber', 'simple') then
    raise exception 'Invalid sign style';
  end if;
  if _theme_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Invalid theme color';
  end if;

  _setup_cost := case _tier
    when 'kiosk' then 5000
    when 'boutique' then 20000
    when 'store' then 60000
    when 'flagship' then 150000
  end;

  select coalesce(
    (select is_in_trial and trial_ends_at > now()
       from public.users_billing where user_id = _user_id),
    (select coalesce(trial_expires_at, created_at + interval '30 days') > now()
       from public.profiles where user_id = _user_id),
    false
  ) into _trial_active;

  if not coalesce(_trial_active, false) then
    perform public.spend_vx(
      _setup_cost,
      'bazaar_shop',
      null,
      initcap(_tier) || ' — ' || trim(_name)
    );
  end if;

  insert into public.bazaar_shops (
    owner_id, name, tier, description, theme_color, sign_style, country,
    is_active, email_notifications, whatsapp_notifications, whatsapp_number
  ) values (
    _user_id, trim(_name), _tier, nullif(trim(_description), ''),
    _theme_color, _sign_style, nullif(upper(trim(_country)), ''),
    true, coalesce(_email_notifications, true),
    coalesce(_whatsapp_notifications, false),
    nullif(trim(_whatsapp_number), '')
  )
  returning id into _shop_id;

  return _shop_id;
end;
$$;

revoke all on function public.create_bazaar_shop(text, text, text, text, text, text, boolean, boolean, text) from public;
grant execute on function public.create_bazaar_shop(text, text, text, text, text, text, boolean, boolean, text) to authenticated;

-- Enforce tier capacity at the database boundary, including concurrent inserts.
create or replace function public.enforce_bazaar_product_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _owner_id uuid;
  _tier text;
  _limit integer;
  _count integer;
begin
  select owner_id, tier into _owner_id, _tier
  from public.bazaar_shops
  where id = new.shop_id
  for update;

  if not found or auth.uid() is null or auth.uid() <> _owner_id then
    raise exception 'Only the shop owner can add products';
  end if;

  _limit := case _tier
    when 'kiosk' then 10
    when 'boutique' then 50
    when 'store' then 200
    else null
  end;
  if _limit is not null then
    select count(*) into _count
    from public.bazaar_products
    where shop_id = new.shop_id;
    if _count >= _limit then
      raise exception 'Product limit reached for this shop tier';
    end if;
  end if;

  new.name := trim(new.name);
  if length(new.name) not between 2 and 120 then
    raise exception 'Product name must be between 2 and 120 characters';
  end if;
  if not coalesce(new.accepts_vx, false) and not coalesce(new.accepts_cash, false) then
    raise exception 'At least one payment method is required';
  end if;
  if (new.accepts_vx and new.price_vx is null)
     or (new.accepts_cash and new.price_usd is null) then
    raise exception 'A price is required for every accepted payment method';
  end if;
  new.in_stock := coalesce(new.stock_qty, 0) > 0;
  return new;
end;
$$;

drop trigger if exists enforce_bazaar_product_capacity on public.bazaar_products;
create trigger enforce_bazaar_product_capacity
  before insert on public.bazaar_products
  for each row execute function public.enforce_bazaar_product_capacity();

-- Public catalog rows are only visible while their shop can actually trade.
drop policy if exists "Read products" on public.bazaar_products;
create policy "Read available bazaar products" on public.bazaar_products
  for select using (
    exists (
      select 1
      from public.bazaar_shops s
      where s.id = shop_id
        and (
          (s.is_active and not coalesce(s.vacation_mode, false))
          or s.owner_id = auth.uid()
        )
    )
  );

-- Sellers may read orders, but payment and ownership fields are service-managed.
drop policy if exists "Sellers update bazaar orders" on public.bazaar_orders;

-- Reviews and disputes require a completed payment for that exact product.
drop policy if exists "Users create own bazaar reviews" on public.bazaar_reviews;
create policy "Verified buyers create bazaar reviews" on public.bazaar_reviews
  for insert to authenticated with check (
    auth.uid() = reviewer_id
    and exists (
      select 1
      from public.bazaar_orders o
      join public.bazaar_order_items oi on oi.order_id = o.id
      where o.buyer_id = auth.uid()
        and o.shop_id = bazaar_reviews.shop_id
        and oi.product_id = bazaar_reviews.product_id
        and o.status in ('paid', 'processing', 'shipped', 'completed')
    )
  );

create or replace function public.mark_bazaar_review_verified()
returns trigger language plpgsql set search_path = public as $$
begin
  new.verified_purchase := true;
  return new;
end;
$$;

drop trigger if exists mark_bazaar_review_verified on public.bazaar_reviews;
create trigger mark_bazaar_review_verified
  before insert on public.bazaar_reviews
  for each row execute function public.mark_bazaar_review_verified();

create or replace function public.protect_bazaar_review_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.product_id <> old.product_id
     or new.shop_id <> old.shop_id
     or new.reviewer_id <> old.reviewer_id
     or new.verified_purchase is distinct from old.verified_purchase then
    raise exception 'Review identity fields cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_bazaar_review_identity on public.bazaar_reviews;
create trigger protect_bazaar_review_identity
  before update on public.bazaar_reviews
  for each row execute function public.protect_bazaar_review_identity();

drop policy if exists "Buyers create bazaar disputes" on public.bazaar_disputes;
create policy "Verified buyers create bazaar disputes" on public.bazaar_disputes
  for insert to authenticated with check (
    auth.uid() = buyer_id
    and exists (
      select 1
      from public.bazaar_orders o
      join public.bazaar_order_items oi on oi.order_id = o.id
      where o.buyer_id = auth.uid()
        and o.shop_id = bazaar_disputes.shop_id
        and oi.product_id = bazaar_disputes.product_id
        and o.status in ('paid', 'processing', 'shipped', 'completed')
    )
  );

drop policy if exists "Dispute parties update bazaar disputes" on public.bazaar_disputes;

-- Both checkout paths must reject closed and vacationing shops.
create or replace function public.assert_bazaar_shop_available(_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.bazaar_shops
    where id = _shop_id and is_active and not coalesce(vacation_mode, false)
  ) then
    raise exception 'This shop is currently unavailable';
  end if;
end;
$$;

revoke all on function public.assert_bazaar_shop_available(uuid) from public, anon, authenticated;
grant execute on function public.assert_bazaar_shop_available(uuid) to service_role;

create or replace function public.guard_bazaar_order_shop()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_bazaar_shop_available(new.shop_id);
  return new;
end;
$$;

drop trigger if exists guard_bazaar_order_shop on public.bazaar_orders;
create trigger guard_bazaar_order_shop
  before insert on public.bazaar_orders
  for each row execute function public.guard_bazaar_order_shop();

-- Prevent a late webhook from resurrecting an order whose inventory was released.
create or replace function public.guard_bazaar_cash_finalize()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.payment_method = 'cash'
     and new.status = 'paid'
     and old.status not in ('pending', 'paid') then
    raise exception 'Released cash order cannot be finalized';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_bazaar_cash_finalize on public.bazaar_orders;
create trigger guard_bazaar_cash_finalize
  before update on public.bazaar_orders
  for each row execute function public.guard_bazaar_cash_finalize();
