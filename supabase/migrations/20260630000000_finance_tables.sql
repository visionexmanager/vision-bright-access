-- Finance: portfolios and watchlists tables
-- RLS: each user can only access their own rows

-- Portfolios
create table if not exists finance_portfolios (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  currency   text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table finance_portfolios enable row level security;

drop policy if exists "Users manage own portfolios" on finance_portfolios;
create policy "Users manage own portfolios"
  on finance_portfolios for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Portfolio holdings
create table if not exists finance_holdings (
  id           uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references finance_portfolios(id) on delete cascade,
  symbol       text not null,
  name         text not null,
  asset_class  text not null default 'stock',
  quantity     numeric not null default 0,
  avg_buy_price numeric not null default 0,
  currency     text not null default 'USD',
  created_at   timestamptz not null default now()
);

alter table finance_holdings enable row level security;

drop policy if exists "Users manage own holdings" on finance_holdings;
create policy "Users manage own holdings"
  on finance_holdings for all
  using (
    portfolio_id in (
      select id from finance_portfolios where user_id = auth.uid()
    )
  )
  with check (
    portfolio_id in (
      select id from finance_portfolios where user_id = auth.uid()
    )
  );

-- Watchlists
create table if not exists finance_watchlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

alter table finance_watchlists enable row level security;

drop policy if exists "Users manage own watchlists" on finance_watchlists;
create policy "Users manage own watchlists"
  on finance_watchlists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Watchlist items
create table if not exists finance_watchlist_items (
  id           uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references finance_watchlists(id) on delete cascade,
  symbol       text not null,
  name         text not null,
  asset_class  text not null default 'stock',
  note         text,
  alert_price  numeric,
  added_at     timestamptz not null default now()
);

alter table finance_watchlist_items enable row level security;

drop policy if exists "Users manage own watchlist items" on finance_watchlist_items;
create policy "Users manage own watchlist items"
  on finance_watchlist_items for all
  using (
    watchlist_id in (
      select id from finance_watchlists where user_id = auth.uid()
    )
  )
  with check (
    watchlist_id in (
      select id from finance_watchlists where user_id = auth.uid()
    )
  );
