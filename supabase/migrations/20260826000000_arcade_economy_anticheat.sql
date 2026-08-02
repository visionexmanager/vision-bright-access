-- Visionex Arcade Economy, VX rewards and anti-cheat.
-- All VX mutations are append-only in user_points and can only originate in
-- SECURITY DEFINER functions after server-side eligibility checks.

-- Close two legacy economy bypasses. Clients may read their ledger, but may no
-- longer insert arbitrary VX. Game rewards are accepted only by the verified
-- Arcade result pipeline below, never by the generic award_points RPC.
drop policy if exists "Users can insert their own points" on public.user_points;

create or replace function public.award_points(_points integer,_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare max_points integer;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  case
    when _reason='Daily login bonus' then max_points:=10;
    when _reason='Watched an ad' then max_points:=5;
    when _reason like 'Completed simulation%' then max_points:=500;
    when _reason like 'Incubator Simulation%' then max_points:=500;
    when _reason like 'Network NOC%' then max_points:=500;
    when _reason like 'Maritime decision:%' then max_points:=500;
    when _reason='Maritime simulator completion bonus' then max_points:=1000;
    when _reason like 'vehicle-diagnostics:repair:%' then max_points:=1200;
    when _reason like 'voice_room_participation%' then max_points:=20;
    when _reason like 'Engaged:%' then max_points:=50;
    when _reason='Signup bonus' then max_points:=50;
    when _reason like 'Purchase:%' then max_points:=1000;
    when _reason like 'Redeemed%' or _reason like 'Pay with points%' or _reason like 'VX Purchase:%' then max_points:=0;
    else raise exception 'Invalid reason';
  end case;
  if _points<0 and not (_reason like 'Redeemed%' or _reason like 'Pay with points%' or _reason like 'VX Purchase:%') then raise exception 'Negative points not allowed'; end if;
  if _points>max_points then raise exception 'Points exceed maximum'; end if;
  if _reason='Daily login bonus' and exists(select 1 from public.user_points where user_id=auth.uid() and reason=_reason and created_at>=current_date::timestamptz and created_at<(current_date+1)::timestamptz) then raise exception 'Already claimed'; end if;
  insert into public.user_points(user_id,points,reason) values(auth.uid(),_points,_reason);
end $$;

create table if not exists public.arcade_rewards (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  event_type text not null check (event_type in ('first_win','daily_mission','weekly_mission','level_up','achievement','tournament','record','login_streak','season')),
  title text not null, vx_amount integer not null check (vx_amount between 0 and 10000),
  xp_amount integer not null default 0 check (xp_amount between 0 and 10000),
  cooldown_hours integer not null default 0 check (cooldown_hours between 0 and 8760),
  max_claims integer not null default 1 check (max_claims > 0), active boolean not null default true,
  starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now()
);

create table if not exists public.arcade_reward_claims (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  reward_id uuid not null references public.arcade_rewards(id), source_id text not null,
  vx_amount integer not null check (vx_amount >= 0), xp_amount integer not null check (xp_amount >= 0),
  status text not null default 'granted' check (status in ('granted','held','reversed')),
  risk_score integer not null default 0 check (risk_score between 0 and 100), claimed_at timestamptz not null default now(),
  unique(user_id,reward_id,source_id)
);

create table if not exists public.arcade_wallet_transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0), direction text not null check (direction in ('credit','debit')),
  category text not null check (category in ('reward','shop','reversal','admin')),
  reference_type text not null, reference_id text not null, idempotency_key text not null unique,
  balance_after bigint not null, created_at timestamptz not null default now()
);

create table if not exists public.arcade_daily_login (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak_day integer not null default 0 check (streak_day between 0 and 30), total_streak integer not null default 0,
  last_claim_date date, cycle_started_on date, updated_at timestamptz not null default now()
);

create table if not exists public.arcade_seasons (
  id uuid primary key default gen_random_uuid(), code text not null unique, title text not null,
  theme jsonb not null default '{}', starts_at timestamptz not null, ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','scheduled','active','ended')), check (ends_at > starts_at)
);

create table if not exists public.arcade_missions (
  id uuid primary key default gen_random_uuid(), season_id uuid references public.arcade_seasons(id) on delete set null,
  code text not null unique, title text not null, description text not null,
  period text not null check (period in ('daily','weekly','monthly','special','season')),
  metric text not null check (metric in ('wins','verified_score','completion','record','achievement','login_streak','tournament_win')),
  target integer not null check (target > 0), reward_id uuid references public.arcade_rewards(id),
  starts_at timestamptz not null, ends_at timestamptz not null, active boolean not null default true, check (ends_at > starts_at)
);

create table if not exists public.arcade_mission_progress (
  mission_id uuid not null references public.arcade_missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, progress integer not null default 0,
  completed_at timestamptz, claimed_at timestamptz, updated_at timestamptz not null default now(),
  primary key(mission_id,user_id)
);

create table if not exists public.arcade_tournaments (
  id uuid primary key default gen_random_uuid(), season_id uuid references public.arcade_seasons(id) on delete set null,
  code text not null unique, title text not null, game_id text not null, rules jsonb not null default '{}',
  period text not null check (period in ('daily','weekly','monthly','seasonal')),
  starts_at timestamptz not null, ends_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft','scheduled','active','verifying','completed','cancelled')),
  prize_pool jsonb not null default '[]', max_entries integer check (max_entries is null or max_entries > 1), check (ends_at > starts_at)
);

create table if not exists public.arcade_tournament_entries (
  tournament_id uuid not null references public.arcade_tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, best_score bigint not null default 0,
  verified boolean not null default false, rank integer, joined_at timestamptz not null default now(),
  primary key(tournament_id,user_id)
);

create table if not exists public.arcade_shop_items (
  id uuid primary key default gen_random_uuid(), sku text not null unique, name text not null, description text not null,
  item_type text not null check (item_type in ('theme','avatar','badge','frame','effect')),
  vx_price integer not null check (vx_price > 0), asset_key text not null,
  metadata jsonb not null default '{}', active boolean not null default true, created_at timestamptz not null default now()
);

create table if not exists public.arcade_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.arcade_shop_items(id), acquired_at timestamptz not null default now(),
  equipped boolean not null default false, primary key(user_id,item_id)
);

create table if not exists public.arcade_result_submissions (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null, score bigint not null, result text not null, duration_seconds integer not null,
  input_count integer not null default 0, client_started_at timestamptz, integrity_hash text,
  replay_data jsonb, device_hash text, ip_hash text, risk_score integer not null default 0,
  validation_status text not null check (validation_status in ('accepted','rejected','review')),
  rejection_reason text, created_at timestamptz not null default now()
);

create table if not exists public.arcade_security_events (
  id bigint generated always as identity primary key, user_id uuid references auth.users(id) on delete set null,
  event_type text not null, severity text not null check (severity in ('info','warning','high','critical')),
  session_id uuid, details jsonb not null default '{}', reviewed_at timestamptz, reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.arcade_economy_audit_logs (
  id bigint generated always as identity primary key, actor_id uuid, user_id uuid,
  action text not null, entity_type text not null, entity_id text not null,
  before_data jsonb, after_data jsonb, request_id uuid not null default gen_random_uuid(), created_at timestamptz not null default now()
);

create index if not exists arcade_wallet_user_time_idx on public.arcade_wallet_transactions(user_id,created_at desc);
create index if not exists arcade_results_user_time_idx on public.arcade_result_submissions(user_id,created_at desc);
create index if not exists arcade_security_review_idx on public.arcade_security_events(reviewed_at,severity,created_at desc);

insert into public.arcade_rewards(code,event_type,title,vx_amount,xp_amount,cooldown_hours,max_claims) values
 ('first-win','first_win','First verified win',5,50,0,1),
 ('daily-mission','daily_mission','Daily mission complete',3,75,20,1),
 ('weekly-mission','weekly_mission','Weekly mission complete',15,250,144,1),
 ('level-up','level_up','New Arcade level',5,0,0,100),
 ('new-achievement','achievement','New achievement',3,25,0,100),
 ('tournament-win','tournament','Verified tournament win',50,500,0,20),
 ('new-record','record','Verified personal record',4,30,20,100),
 ('login-streak','login_streak','Daily login streak',2,10,20,30)
on conflict(code) do update set vx_amount=excluded.vx_amount,xp_amount=excluded.xp_amount;

insert into public.arcade_shop_items(sku,name,description,item_type,vx_price,asset_key) values
 ('frame-neon','Neon Frame','Cosmetic profile frame.','frame',120,'arcade/frame-neon'),
 ('theme-midnight','Midnight Theme','Cosmetic Arcade theme.','theme',200,'arcade/theme-midnight'),
 ('badge-founder','Arcade Founder Badge','Cosmetic profile badge.','badge',300,'arcade/badge-founder')
on conflict(sku) do nothing;

do $$ declare t text; begin foreach t in array array['arcade_rewards','arcade_reward_claims','arcade_wallet_transactions','arcade_daily_login','arcade_seasons','arcade_missions','arcade_mission_progress','arcade_tournaments','arcade_tournament_entries','arcade_shop_items','arcade_inventory','arcade_result_submissions','arcade_security_events','arcade_economy_audit_logs'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;

create policy "Active Arcade rewards are visible" on public.arcade_rewards for select using(active and (starts_at is null or now()>=starts_at) and (ends_at is null or now()<ends_at));
create policy "Players read own reward claims" on public.arcade_reward_claims for select to authenticated using(user_id=auth.uid());
create policy "Players read own Arcade wallet ledger" on public.arcade_wallet_transactions for select to authenticated using(user_id=auth.uid());
create policy "Players read own daily login" on public.arcade_daily_login for select to authenticated using(user_id=auth.uid());
create policy "Visible Arcade seasons" on public.arcade_seasons for select using(status in ('scheduled','active','ended'));
create policy "Active Arcade missions" on public.arcade_missions for select using(active and now() between starts_at and ends_at);
create policy "Players read own mission progress" on public.arcade_mission_progress for select to authenticated using(user_id=auth.uid());
create policy "Visible Arcade tournaments" on public.arcade_tournaments for select using(status in ('scheduled','active','verifying','completed'));
create policy "Tournament leaderboard is visible" on public.arcade_tournament_entries for select to authenticated using(true);
create policy "Active Arcade shop is visible" on public.arcade_shop_items for select using(active);
create policy "Players read own Arcade inventory" on public.arcade_inventory for select to authenticated using(user_id=auth.uid());
create policy "Players read own result submissions" on public.arcade_result_submissions for select to authenticated using(user_id=auth.uid());
create policy "Admins read security events" on public.arcade_security_events for select to authenticated using(public.has_role(auth.uid(),'admin'));
create policy "Admins manage security events" on public.arcade_security_events for update to authenticated using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
create policy "Admins read economy audit" on public.arcade_economy_audit_logs for select to authenticated using(public.has_role(auth.uid(),'admin'));

create or replace function public.arcade_wallet_balance(_uid uuid) returns bigint language sql stable security definer set search_path=public as $$ select coalesce(sum(points),0)::bigint from public.user_points where user_id=_uid $$;
revoke all on function public.arcade_wallet_balance(uuid) from public,anon,authenticated;

create or replace function public.arcade_append_vx(_uid uuid,_amount integer,_category text,_reference_type text,_reference_id text,_idempotency_key text)
returns bigint language plpgsql security definer set search_path=public as $$
declare b bigint;
begin
  if _amount=0 then raise exception 'Zero transaction'; end if;
  perform pg_advisory_xact_lock(hashtextextended(_uid::text,0));
  if exists(select 1 from public.arcade_wallet_transactions where idempotency_key=_idempotency_key) then
    return (select balance_after from public.arcade_wallet_transactions where idempotency_key=_idempotency_key);
  end if;
  b:=public.arcade_wallet_balance(_uid);
  if b+_amount<0 then raise exception 'Insufficient VX'; end if;
  insert into public.user_points(user_id,points,reason) values(_uid,_amount,'Arcade economy: '||_category||':'||_reference_type||':'||_reference_id);
  b:=b+_amount;
  insert into public.arcade_wallet_transactions(user_id,amount,direction,category,reference_type,reference_id,idempotency_key,balance_after)
  values(_uid,_amount,case when _amount>0 then 'credit' else 'debit' end,_category,_reference_type,_reference_id,_idempotency_key,b);
  insert into public.arcade_economy_audit_logs(actor_id,user_id,action,entity_type,entity_id,after_data)
  values(auth.uid(),_uid,case when _amount>0 then 'vx_credit' else 'vx_debit' end,_reference_type,_reference_id,jsonb_build_object('amount',_amount,'balance',b));
  return b;
end $$;
revoke all on function public.arcade_append_vx(uuid,integer,text,text,text,text) from public,anon,authenticated;

create or replace function public.arcade_claim_daily_login() returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); s public.arcade_daily_login; day_no integer; reward integer; b bigint;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
  select * into s from public.arcade_daily_login where user_id=uid for update;
  if s.last_claim_date=current_date then return jsonb_build_object('claimed',false,'reason','already_claimed','day',s.streak_day); end if;
  if s.last_claim_date=current_date-1 then day_no:=(s.streak_day%30)+1; else day_no:=1; end if;
  reward:=case when day_no=30 then 30 when day_no%7=0 then 10 else 2 end;
  insert into public.arcade_daily_login(user_id,streak_day,total_streak,last_claim_date,cycle_started_on)
  values(uid,day_no,coalesce(s.total_streak,0)+1,current_date,case when day_no=1 then current_date else s.cycle_started_on end)
  on conflict(user_id) do update set streak_day=excluded.streak_day,total_streak=excluded.total_streak,last_claim_date=current_date,cycle_started_on=excluded.cycle_started_on,updated_at=now();
  b:=public.arcade_append_vx(uid,reward,'reward','daily_login',current_date::text,'login:'||uid||':'||current_date);
  return jsonb_build_object('claimed',true,'day',day_no,'vx',reward,'balance',b);
end $$;
grant execute on function public.arcade_claim_daily_login() to authenticated;

create or replace function public.arcade_buy_shop_item(_item_id uuid,_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); item public.arcade_shop_items; b bigint;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into item from public.arcade_shop_items where id=_item_id and active for share;
  if item.id is null then raise exception 'Item unavailable'; end if;
  if exists(select 1 from public.arcade_inventory where user_id=uid and item_id=item.id) then raise exception 'Already owned'; end if;
  b:=public.arcade_append_vx(uid,-item.vx_price,'shop','shop_item',item.id::text,'shop:'||uid||':'||_idempotency_key);
  insert into public.arcade_inventory(user_id,item_id) values(uid,item.id) on conflict do nothing;
  return jsonb_build_object('purchased',true,'balance',b,'item_id',item.id);
end $$;
grant execute on function public.arcade_buy_shop_item(uuid,uuid) to authenticated;

create or replace function public.arcade_buy_shop_item_by_sku(_sku text,_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare item_id uuid;
begin
  select id into item_id from public.arcade_shop_items where sku=_sku and active;
  if item_id is null then raise exception 'Item unavailable'; end if;
  return public.arcade_buy_shop_item(item_id,_idempotency_key);
end $$;
grant execute on function public.arcade_buy_shop_item_by_sku(text,uuid) to authenticated;

create or replace function public.arcade_submit_verified_result(_session_id uuid,_game_id text,_score bigint,_result text,_duration_seconds integer,_input_count integer default 0,_integrity_hash text default null,_replay_data jsonb default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); risk integer:=0; verdict text:='accepted'; reason text; recent integer; first_win boolean:=false; reward integer:=0;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if exists(select 1 from public.arcade_result_submissions where id=_session_id) then raise exception 'Duplicate session'; end if;
  select count(*) into recent from public.arcade_result_submissions where user_id=uid and created_at>now()-interval '1 minute';
  if recent>=12 then risk:=risk+70; reason:='rate_limit'; end if;
  if _duration_seconds<2 or _duration_seconds>86400 then risk:=risk+60; reason:=coalesce(reason,'invalid_duration'); end if;
  if _score<0 or _score>1000000000 then risk:=risk+80; reason:=coalesce(reason,'invalid_score'); end if;
  if _result not in ('win','loss','draw','completed') then risk:=100; reason:='invalid_result'; end if;
  if _input_count>0 and _duration_seconds>0 and (_input_count::numeric/_duration_seconds)>30 then risk:=risk+50; reason:=coalesce(reason,'automation_pattern'); end if;
  if _result='win' and _input_count=0 then risk:=risk+25; reason:=coalesce(reason,'missing_input_evidence'); end if;
  risk:=least(risk,100); verdict:=case when risk>=70 then 'rejected' when risk>=35 then 'review' else 'accepted' end;
  insert into public.arcade_result_submissions(id,user_id,game_id,score,result,duration_seconds,input_count,integrity_hash,replay_data,risk_score,validation_status,rejection_reason)
  values(_session_id,uid,left(_game_id,80),_score,_result,_duration_seconds,greatest(_input_count,0),left(_integrity_hash,128),_replay_data,risk,verdict,reason);
  if verdict<>'accepted' then
    insert into public.arcade_security_events(user_id,event_type,severity,session_id,details) values(uid,coalesce(reason,'integrity_review'),case when verdict='rejected' then 'high' else 'warning' end,_session_id,jsonb_build_object('risk',risk,'game',_game_id));
    return jsonb_build_object('accepted',false,'status',verdict,'risk_score',risk);
  end if;
  perform public.arcade_record_game_result(_session_id,_game_id,_score,_result,_duration_seconds);
  if _result='win' and not exists(select 1 from public.arcade_result_submissions where user_id=uid and result='win' and validation_status='accepted' and id<>_session_id) then first_win:=true; reward:=5; perform public.arcade_append_vx(uid,reward,'reward','first_win',_session_id::text,'reward:first-win:'||uid); end if;
  return jsonb_build_object('accepted',true,'status','accepted','risk_score',risk,'first_win',first_win,'vx_reward',reward);
end $$;
grant execute on function public.arcade_submit_verified_result(uuid,text,bigint,text,integer,integer,text,jsonb) to authenticated;

create or replace function public.arcade_join_tournament(_tournament_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); t public.arcade_tournaments;
begin if uid is null then raise exception 'Not authenticated'; end if; select * into t from public.arcade_tournaments where id=_tournament_id and status='active' and now() between starts_at and ends_at; if t.id is null then raise exception 'Tournament unavailable'; end if; insert into public.arcade_tournament_entries(tournament_id,user_id) values(t.id,uid) on conflict do nothing; end $$;
grant execute on function public.arcade_join_tournament(uuid) to authenticated;

create or replace function public.arcade_admin_upsert_content(_entity text,_payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); entity_id uuid:=coalesce((_payload->>'id')::uuid,gen_random_uuid());
begin
  if uid is null or not public.has_role(uid,'admin') then raise exception 'Forbidden'; end if;
  if _entity='season' then insert into public.arcade_seasons(id,code,title,theme,starts_at,ends_at,status) values(entity_id,_payload->>'code',_payload->>'title',coalesce(_payload->'theme','{}'),(_payload->>'starts_at')::timestamptz,(_payload->>'ends_at')::timestamptz,coalesce(_payload->>'status','draft')) on conflict(id) do update set title=excluded.title,theme=excluded.theme,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status=excluded.status;
  elsif _entity='tournament' then insert into public.arcade_tournaments(id,code,title,game_id,rules,period,starts_at,ends_at,status,prize_pool) values(entity_id,_payload->>'code',_payload->>'title',_payload->>'game_id',coalesce(_payload->'rules','{}'),_payload->>'period',(_payload->>'starts_at')::timestamptz,(_payload->>'ends_at')::timestamptz,coalesce(_payload->>'status','draft'),coalesce(_payload->'prize_pool','[]')) on conflict(id) do update set title=excluded.title,rules=excluded.rules,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status=excluded.status,prize_pool=excluded.prize_pool;
  else raise exception 'Unsupported entity'; end if;
  insert into public.arcade_economy_audit_logs(actor_id,user_id,action,entity_type,entity_id,after_data) values(uid,uid,'admin_upsert',_entity,entity_id::text,_payload);
  return entity_id;
end $$;
grant execute on function public.arcade_admin_upsert_content(text,jsonb) to authenticated;
