-- Visionex Arcade enterprise operations: monitoring, AI signals, optimized
-- analytics views and backup audit metadata. Physical backups remain a hosting
-- responsibility and are documented in docs/ARCADE_PRODUCTION.md.

create table if not exists public.arcade_runtime_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check(event_type in ('runtime_error','failed_request','broken_asset','slow_operation')),
  game_id text, route text not null, message text not null check(char_length(message)<=1000),
  duration_ms integer check(duration_ms is null or duration_ms>=0),
  release_version text, created_at timestamptz not null default now()
);

create table if not exists public.arcade_ai_reports (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  report_type text not null check(report_type in ('difficulty','recommendation','anomaly')),
  game_id text, risk_score integer check(risk_score between 0 and 100),
  explanation text not null, signals jsonb not null default '{}', reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id), created_at timestamptz not null default now()
);

create table if not exists public.arcade_backup_runs (
  id uuid primary key default gen_random_uuid(), backup_type text not null check(backup_type in ('database','assets','configuration','restore_test')),
  provider_ref text not null, status text not null check(status in ('started','succeeded','failed','verified')),
  checksum text, size_bytes bigint check(size_bytes is null or size_bytes>=0),
  started_at timestamptz not null default now(), completed_at timestamptz,
  initiated_by uuid references auth.users(id), notes text
);

create index if not exists arcade_runtime_events_time_idx on public.arcade_runtime_events(created_at desc);
create index if not exists arcade_runtime_events_game_idx on public.arcade_runtime_events(game_id,event_type,created_at desc);
create index if not exists arcade_ai_reports_review_idx on public.arcade_ai_reports(reviewed_at,report_type,created_at desc);
create index if not exists arcade_scores_retention_idx on public.arcade_game_scores(user_id,game_id,recorded_at desc);
create index if not exists arcade_claims_user_time_idx on public.arcade_reward_claims(user_id,claimed_at desc);

alter table public.arcade_runtime_events enable row level security;
alter table public.arcade_ai_reports enable row level security;
alter table public.arcade_backup_runs enable row level security;
create policy "Admins read Arcade runtime events" on public.arcade_runtime_events for select to authenticated using(public.has_role(auth.uid(),'admin'));
create policy "Admins read Arcade AI reports" on public.arcade_ai_reports for select to authenticated using(public.has_role(auth.uid(),'admin'));
create policy "Admins review Arcade AI reports" on public.arcade_ai_reports for update to authenticated using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
create policy "Admins manage backup audit" on public.arcade_backup_runs for all to authenticated using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));

create or replace view public.arcade_game_analytics_daily with (security_invoker=true) as
select date_trunc('day',recorded_at) as day,game_id,count(*) as plays,
  count(distinct user_id) as unique_players,
  coalesce(sum(duration_seconds),0) as play_seconds,
  count(*) filter(where result='win') as wins,
  round(100.0*count(*) filter(where completed)/nullif(count(*),0),2) as completion_rate
from public.arcade_game_scores group by 1,2;

create or replace view public.arcade_device_analytics_daily with (security_invoker=true) as
select date_trunc('day',created_at) as day,
  coalesce(details->>'device_class','unknown') as device_class,count(*) as events
from public.arcade_security_events group by 1,2;

create or replace function public.arcade_admin_operations_summary() returns jsonb
language sql stable security definer set search_path=public as $$
  select case when auth.uid() is null or not public.has_role(auth.uid(),'admin') then null else jsonb_build_object(
    'games',(select count(distinct game_id) from public.arcade_game_scores),
    'players',(select count(distinct user_id) from public.arcade_game_scores),
    'plays',(select count(*) from public.arcade_game_scores),
    'play_seconds',(select coalesce(sum(duration_seconds),0) from public.arcade_game_scores),
    'security_open',(select count(*) from public.arcade_security_events where reviewed_at is null),
    'runtime_errors',(select count(*) from public.arcade_runtime_events where created_at>now()-interval '24 hours'),
    'vx_rewarded',(select coalesce(sum(amount),0) from public.arcade_wallet_transactions where category='reward' and amount>0),
    'active_tournaments',(select count(*) from public.arcade_tournaments where status='active' and now() between starts_at and ends_at)
  ) end
$$;
grant execute on function public.arcade_admin_operations_summary() to authenticated;

