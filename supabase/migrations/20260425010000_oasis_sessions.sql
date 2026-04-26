-- Empathy Oasis: tracks user wellness sessions (breathing, sound, affirmations)
create table if not exists public.oasis_sessions (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  session_type     text        not null check (session_type in ('breathing', 'sound', 'affirmation')),
  duration_seconds integer     not null default 0,
  completed_at     timestamptz not null default now()
);

alter table public.oasis_sessions enable row level security;

create policy "Users can insert own oasis sessions"
  on public.oasis_sessions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can view own oasis sessions"
  on public.oasis_sessions for select
  to authenticated
  using (auth.uid() = user_id);
