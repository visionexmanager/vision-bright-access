-- Visionex Arcade Player System & Gamification
-- XP is isolated from VX. VX rewards require a separately reviewed server-side policy.

create table if not exists public.arcade_gamer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gamer_tag text not null default 'Visionex Player' check (char_length(gamer_tag) between 2 and 40),
  avatar_url text,
  xp_total bigint not null default 0 check (xp_total >= 0),
  level integer not null default 1 check (level >= 1),
  games_played integer not null default 0 check (games_played >= 0),
  wins integer not null default 0 check (wins >= 0),
  current_win_streak integer not null default 0 check (current_win_streak >= 0),
  best_win_streak integer not null default 0 check (best_win_streak >= 0),
  favorite_game_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arcade_game_scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null check (char_length(game_id) between 1 and 80),
  score bigint not null default 0 check (score >= 0),
  result text not null check (result in ('win','loss','draw','completed')),
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 86400),
  completed boolean not null default true,
  recorded_at timestamptz not null default now()
);
create index if not exists arcade_game_scores_user_time_idx on public.arcade_game_scores(user_id, recorded_at desc);
create index if not exists arcade_game_scores_game_score_idx on public.arcade_game_scores(game_id, score desc);

create table if not exists public.arcade_achievement_definitions (
  key text primary key,
  title text not null,
  description text not null,
  category text not null check (category in ('play','win','record','special','accessibility','tournament')),
  xp_reward integer not null default 25 check (xp_reward between 0 and 10000),
  badge_asset_id text,
  active boolean not null default true
);

create table if not exists public.arcade_user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null references public.arcade_achievement_definitions(key),
  unlocked_at timestamptz not null default now(),
  source_session_id uuid,
  primary key (user_id, achievement_key)
);

create table if not exists public.arcade_xp_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount between 1 and 10000),
  reason text not null check (char_length(reason) between 1 and 160),
  source_type text not null check (source_type in ('game','win','record','achievement','challenge','admin')),
  source_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id, reason)
);
create index if not exists arcade_xp_history_user_time_idx on public.arcade_xp_history(user_id, created_at desc);

create table if not exists public.arcade_challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null,
  period text not null check (period in ('daily','weekly','event')),
  metric text not null check (metric in ('plays','wins','score','completion','educational','accessible','head_to_head')),
  target integer not null check (target > 0),
  xp_reward integer not null default 0 check (xp_reward between 0 and 10000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  check (ends_at > starts_at)
);

create table if not exists public.arcade_challenge_progress (
  challenge_id uuid not null references public.arcade_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  progress integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  claimed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create table if not exists public.arcade_player_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users(id) on delete cascade,
  opponent_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  target_score bigint,
  status text not null default 'pending' check (status in ('pending','accepted','declined','completed','expired','cancelled')),
  challenger_score bigint,
  opponent_score bigint,
  winner_id uuid references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  check (challenger_id <> opponent_id)
);

insert into public.arcade_achievement_definitions(key,title,description,category,xp_reward) values
  ('first-play','First Steps','Play your first Arcade game.','play',25),
  ('play-10','Arcade Regular','Play ten games.','play',75),
  ('play-100','Arcade Veteran','Play one hundred games.','play',500),
  ('first-win','First Victory','Win your first game.','win',50),
  ('win-streak-5','On a Roll','Win five games in a row.','win',200),
  ('record-setter','Record Setter','Set a new personal best.','record',75),
  ('hard-complete','Challenge Accepted','Complete a hard game.','special',100),
  ('accessible-player','Inclusive Player','Complete an accessible game.','accessibility',100),
  ('tournament-player','Tournament Debut','Participate in a verified tournament.','tournament',150)
on conflict (key) do update set title=excluded.title, description=excluded.description, category=excluded.category, xp_reward=excluded.xp_reward;

alter table public.arcade_gamer_profiles enable row level security;
alter table public.arcade_game_scores enable row level security;
alter table public.arcade_achievement_definitions enable row level security;
alter table public.arcade_user_achievements enable row level security;
alter table public.arcade_xp_history enable row level security;
alter table public.arcade_challenges enable row level security;
alter table public.arcade_challenge_progress enable row level security;
alter table public.arcade_player_challenges enable row level security;

create policy "Arcade profiles are visible to authenticated players" on public.arcade_gamer_profiles for select to authenticated using (true);
create policy "Players read own scores" on public.arcade_game_scores for select to authenticated using (user_id=auth.uid());
create policy "Achievement definitions are public" on public.arcade_achievement_definitions for select using (active=true);
create policy "Players read own Arcade achievements" on public.arcade_user_achievements for select to authenticated using (user_id=auth.uid());
create policy "Players read own XP history" on public.arcade_xp_history for select to authenticated using (user_id=auth.uid());
create policy "Active challenges are public" on public.arcade_challenges for select using (active=true and now() between starts_at and ends_at);
create policy "Players read own challenge progress" on public.arcade_challenge_progress for select to authenticated using (user_id=auth.uid());
create policy "Challenge participants can read invitations" on public.arcade_player_challenges for select to authenticated using (auth.uid() in (challenger_id,opponent_id));

create or replace function public.arcade_record_game_result(
  _session_id uuid, _game_id text, _score bigint, _result text, _duration_seconds integer
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  _uid uuid := auth.uid(); _xp integer := 10; _old_high bigint := 0; _is_record boolean := false; _profile public.arcade_gamer_profiles;
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  if _game_id is null or char_length(_game_id) not between 1 and 80 then raise exception 'Invalid game id'; end if;
  if _score < 0 or _score > 1000000000 then raise exception 'Invalid score'; end if;
  if _result not in ('win','loss','draw','completed') then raise exception 'Invalid result'; end if;
  if _duration_seconds not between 0 and 86400 then raise exception 'Invalid duration'; end if;
  if exists(select 1 from public.arcade_game_scores where session_id=_session_id) then raise exception 'Session already recorded'; end if;

  select coalesce(max(score),0) into _old_high from public.arcade_game_scores where user_id=_uid and game_id=_game_id;
  _is_record := _score > _old_high and _score > 0;
  _xp := _xp + 20 + case when _result='win' then 50 else 0 end + case when _is_record then 30 else 0 end;

  insert into public.arcade_game_scores(session_id,user_id,game_id,score,result,duration_seconds) values(_session_id,_uid,_game_id,_score,_result,_duration_seconds);
  insert into public.arcade_xp_history(user_id,amount,reason,source_type,source_id)
    values(_uid,_xp,'Verified Arcade result','game',_session_id::text);

  insert into public.arcade_gamer_profiles(user_id,xp_total,level,games_played,wins,current_win_streak,best_win_streak)
    values(_uid,_xp,floor(sqrt(_xp::numeric/100))::integer+1,1,case when _result='win' then 1 else 0 end,case when _result='win' then 1 else 0 end,case when _result='win' then 1 else 0 end)
  on conflict(user_id) do update set
    xp_total=arcade_gamer_profiles.xp_total+_xp,
    level=floor(sqrt((arcade_gamer_profiles.xp_total+_xp)::numeric/100))::integer+1,
    games_played=arcade_gamer_profiles.games_played+1,
    wins=arcade_gamer_profiles.wins+case when _result='win' then 1 else 0 end,
    current_win_streak=case when _result='win' then arcade_gamer_profiles.current_win_streak+1 else 0 end,
    best_win_streak=greatest(arcade_gamer_profiles.best_win_streak,case when _result='win' then arcade_gamer_profiles.current_win_streak+1 else 0 end),
    updated_at=now()
  returning * into _profile;

  return jsonb_build_object('xp_awarded',_xp,'xp_total',_profile.xp_total,'level',_profile.level,'new_record',_is_record);
end;
$$;

revoke all on function public.arcade_record_game_result(uuid,text,bigint,text,integer) from public;
grant execute on function public.arcade_record_game_result(uuid,text,bigint,text,integer) to authenticated;

create or replace function public.arcade_update_gamer_profile(_gamer_tag text, _avatar_url text, _favorite_game_ids text[])
returns void language plpgsql security definer set search_path=public as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'Not authenticated'; end if;
  if char_length(trim(_gamer_tag)) not between 2 and 40 then raise exception 'Invalid gamer tag'; end if;
  if _avatar_url is not null and char_length(_avatar_url) > 500 then raise exception 'Invalid avatar URL'; end if;
  if cardinality(_favorite_game_ids) > 100 or exists(select 1 from unnest(_favorite_game_ids) value where char_length(value) not between 1 and 80) then raise exception 'Invalid favorites'; end if;
  insert into public.arcade_gamer_profiles(user_id,gamer_tag,avatar_url,favorite_game_ids) values(_uid,trim(_gamer_tag),_avatar_url,coalesce(_favorite_game_ids,'{}'))
  on conflict(user_id) do update set gamer_tag=excluded.gamer_tag,avatar_url=excluded.avatar_url,favorite_game_ids=excluded.favorite_game_ids,updated_at=now();
end;
$$;
revoke all on function public.arcade_update_gamer_profile(text,text,text[]) from public;
grant execute on function public.arcade_update_gamer_profile(text,text,text[]) to authenticated;

create or replace function public.arcade_leaderboard(_period text default 'all', _metric text default 'xp', _limit integer default 50)
returns table(rank bigint,user_id uuid,gamer_tag text,avatar_url text,value bigint)
language sql stable security definer set search_path=public as $$
  with scores as (
    select p.user_id,p.gamer_tag,p.avatar_url,
      case _metric when 'wins' then p.wins::bigint when 'achievements' then (select count(*) from public.arcade_user_achievements a where a.user_id=p.user_id)::bigint when 'score' then coalesce((select sum(s.score) from public.arcade_game_scores s where s.user_id=p.user_id and (_period='all' or s.recorded_at >= case _period when 'day' then now()-interval '1 day' when 'week' then now()-interval '7 days' when 'month' then now()-interval '30 days' else '-infinity'::timestamptz end)),0)::bigint else p.xp_total end as value
    from public.arcade_gamer_profiles p
  ) select row_number() over(order by value desc,user_id)::bigint,user_id,gamer_tag,avatar_url,value from scores order by value desc,user_id limit least(greatest(_limit,1),100);
$$;
grant execute on function public.arcade_leaderboard(text,text,integer) to authenticated;
