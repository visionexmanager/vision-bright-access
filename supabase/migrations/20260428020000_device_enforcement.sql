-- device_fingerprints: one row per (device_id, user_id) pair
create table if not exists public.device_fingerprints (
  id           uuid primary key default gen_random_uuid(),
  device_id    text not null,
  user_id      uuid references auth.users(id) on delete cascade,
  ip_address   text,
  user_agent   text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  unique (device_id, user_id)
);

-- device_bans: banned device fingerprints and/or IPs
create table if not exists public.device_bans (
  id         uuid primary key default gen_random_uuid(),
  device_id  text,
  ip_address text,
  reason     text not null,
  banned_by  uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint device_bans_has_target check (device_id is not null or ip_address is not null)
);

alter table public.device_fingerprints enable row level security;
alter table public.device_bans enable row level security;

-- Admins can read both tables
create policy "admin_select_device_fps" on public.device_fingerprints
  for select using (
    exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
  );

create policy "admin_select_device_bans" on public.device_bans
  for select using (
    exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
  );

-- ── Helper: upsert a device fingerprint (called from browser, pre-auth) ──────
create or replace function public.record_device_fingerprint(
  _device_id  text,
  _user_id    uuid,
  _user_agent text default null
) returns void
language sql security definer set search_path = public as $$
  insert into public.device_fingerprints (device_id, user_id, user_agent)
  values (_device_id, _user_id, _user_agent)
  on conflict (device_id, user_id) do update
    set last_seen_at = now(),
        user_agent   = coalesce(_user_agent, device_fingerprints.user_agent);
$$;

-- ── Helper: is this device/IP banned? ────────────────────────────────────────
create or replace function public.is_device_banned(
  _device_id text,
  _ip        text default null
) returns boolean
language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.device_bans
    where device_id = _device_id
       or (_ip is not null and ip_address = _ip)
  );
$$;

-- ── Helper: has this device already claimed a free trial? ────────────────────
create or replace function public.device_trial_used(_device_id text)
returns boolean
language sql security definer set search_path = public as $$
  select exists (
    select 1
    from   public.device_fingerprints df
    join   public.profiles p on p.user_id = df.user_id
    where  df.device_id = _device_id
      and  p.trial_expires_at is not null
  );
$$;

-- ── Helper: revoke trial if device already had one (called after signup) ─────
create or replace function public.maybe_revoke_trial(
  _user_id   uuid,
  _device_id text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  prior_count int;
begin
  select count(*) into prior_count
  from   public.device_fingerprints df
  join   public.profiles p on p.user_id = df.user_id
  where  df.device_id = _device_id
    and  df.user_id   != _user_id
    and  p.trial_expires_at is not null;

  if prior_count > 0 then
    -- Expire the trial immediately for this new account
    update public.profiles
    set    trial_expires_at = now() - interval '1 second'
    where  user_id = _user_id;
  end if;
end;
$$;

-- ── Admin: ban a device fingerprint ──────────────────────────────────────────
create or replace function public.ban_device(
  _device_id text,
  _reason    text,
  _ip        text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Unauthorized';
  end if;

  insert into public.device_bans (device_id, ip_address, reason, banned_by)
  values (_device_id, _ip, _reason, auth.uid());

  -- Also ban the account-level status for all users on this device
  update public.profiles
  set    status     = 'banned',
         ban_reason = _reason
  where  user_id in (
    select user_id from public.device_fingerprints where device_id = _device_id
  );
end;
$$;

-- ── Admin: unban a device fingerprint ────────────────────────────────────────
create or replace function public.unban_device(_device_id text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Unauthorized';
  end if;

  delete from public.device_bans where device_id = _device_id;
end;
$$;
