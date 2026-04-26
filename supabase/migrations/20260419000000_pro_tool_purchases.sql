-- Track which users have purchased which professional tools
create table if not exists tool_purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  tool_id text not null,
  points_spent integer not null default 1000,
  created_at timestamptz default now() not null,
  unique(user_id, tool_id)
);

alter table tool_purchases enable row level security;

do $$ begin
  create policy "Users can view their own tool purchases"
    on tool_purchases for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can insert their own tool purchases"
    on tool_purchases for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
