-- Voice room AI access.
-- One purchase unlocks the Visionex AI companion in any voice room.
-- Trial users and admins can activate it without a VX charge.

create table if not exists public.voice_room_ai_purchases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  price_vx integer not null default 10000,
  purchased_at timestamptz not null default now(),
  source text not null default 'vx'
);

alter table public.voice_room_ai_purchases enable row level security;

drop policy if exists "voice_room_ai_purchases_select_own" on public.voice_room_ai_purchases;
create policy "voice_room_ai_purchases_select_own"
on public.voice_room_ai_purchases
for select
to authenticated
using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

create or replace function public.activate_voice_room_ai()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _is_admin boolean := false;
  _is_trial boolean := false;
  _has_purchase boolean := false;
  _price integer := 10000;
begin
  if _user_id is null then
    raise exception 'Not authenticated';
  end if;

  select public.has_role(_user_id, 'admin') into _is_admin;

  select coalesce(trial_expires_at, created_at + interval '30 days') > now()
  into _is_trial
  from public.profiles
  where user_id = _user_id;

  select exists (
    select 1 from public.voice_room_ai_purchases where user_id = _user_id
  ) into _has_purchase;

  if _is_admin then
    return jsonb_build_object('enabled', true, 'source', 'admin', 'charged_vx', 0);
  end if;

  if _is_trial then
    return jsonb_build_object('enabled', true, 'source', 'trial', 'charged_vx', 0);
  end if;

  if _has_purchase then
    return jsonb_build_object('enabled', true, 'source', 'purchased', 'charged_vx', 0);
  end if;

  perform public.spend_vx(_price, 'voice_room_ai', 'visionex-ai-room-companion', 'Visionex AI voice room companion');

  insert into public.voice_room_ai_purchases (user_id, price_vx, source)
  values (_user_id, _price, 'vx')
  on conflict (user_id) do nothing;

  return jsonb_build_object('enabled', true, 'source', 'purchased', 'charged_vx', _price);
end;
$$;

grant execute on function public.activate_voice_room_ai() to authenticated;
