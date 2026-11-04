-- Layla long-term memory: one short summary per (hashed) Alexa user.
-- Service-role only: RLS is on and no policy exists for anon/authenticated.
create table if not exists public.layla_memory (
  user_hash text primary key,
  summary text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.layla_memory enable row level security;
revoke all on public.layla_memory from anon, authenticated;
grant all on public.layla_memory to service_role;
