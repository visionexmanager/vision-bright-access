-- Atomic, idempotent billing for browser-side File Studio conversions.

create table if not exists public.file_conversion_charges (
  job_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  module_type text not null,
  target_format text not null,
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  amount integer not null check (amount > 0),
  status text not null default 'charged' check (status in ('charged', 'completed', 'refunded')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

alter table public.file_conversion_charges enable row level security;

drop policy if exists "Users read own file conversion charges" on public.file_conversion_charges;
create policy "Users read own file conversion charges"
  on public.file_conversion_charges for select to authenticated
  using (auth.uid() = user_id);

create index if not exists idx_file_conversion_charges_user_created
  on public.file_conversion_charges(user_id, created_at desc);

create or replace function public.charge_file_conversion(
  _job_id uuid,
  _module_type text,
  _target_format text,
  _file_size_bytes bigint
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _balance bigint;
  _priority boolean;
  _max_bytes bigint;
  _daily_limit integer;
  _amount integer;
  _base integer;
  _surcharge integer := 0;
begin
  if _user_id is null then raise exception 'Not authenticated'; end if;
  if _job_id is null or _file_size_bytes <= 0 then raise exception 'Invalid conversion request'; end if;

  perform pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));

  if exists (select 1 from public.file_conversion_charges where job_id = _job_id) then
    raise exception 'Conversion job already charged';
  end if;

  select coalesce(sum(points), 0) into _balance
  from public.user_points where user_id = _user_id;
  _priority := _balance >= 10000;
  _max_bytes := case when _priority then 500 else 50 end * 1024 * 1024;
  _daily_limit := case when _priority then 100 else 5 end;

  if _file_size_bytes > _max_bytes then
    raise exception 'File exceeds your plan limit of % MB', _max_bytes / 1024 / 1024;
  end if;
  if (
    select count(*) from public.file_conversion_charges
    where user_id = _user_id
      and created_at >= current_date
      and status <> 'refunded'
  ) >= _daily_limit then
    raise exception 'Daily conversion limit reached';
  end if;

  _base := case _module_type
    when 'audio' then 50
    when 'image' then 20
    when 'document' then 80
    when 'developer' then 10
    else null
  end;
  if _base is null then raise exception 'Converter unavailable'; end if;

  if not (
    (_module_type = 'audio' and _target_format in ('wav', 'webm'))
    or (_module_type = 'image' and _target_format in ('jpg', 'jpeg', 'png', 'webp'))
    or (_module_type = 'document' and _target_format in ('html', 'md', 'txt'))
    or (_module_type = 'developer' and _target_format in ('json', 'csv', 'base64', 'hex', 'txt'))
  ) then
    raise exception 'Unsupported conversion target';
  end if;

  _surcharge := case _target_format when 'avif' then 25 else 0 end;
  _amount := greatest(10, _base + _surcharge + ceil(_file_size_bytes::numeric / 1024 / 1024)::integer);

  perform public.spend_vx(
    _amount,
    'file_conversion',
    _job_id::text,
    _module_type || ' to ' || upper(_target_format)
  );

  insert into public.file_conversion_charges (
    job_id, user_id, module_type, target_format, file_size_bytes, amount
  ) values (
    _job_id, _user_id, _module_type, _target_format, _file_size_bytes, _amount
  );

  return _amount;
end;
$$;

create or replace function public.settle_file_conversion(_job_id uuid, _succeeded boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _charge public.file_conversion_charges%rowtype;
begin
  if _user_id is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));

  select * into _charge
  from public.file_conversion_charges
  where job_id = _job_id and user_id = _user_id
  for update;

  if not found then raise exception 'Conversion charge not found'; end if;
  if _charge.status <> 'charged' then return _charge.status; end if;

  if _succeeded then
    update public.file_conversion_charges
    set status = 'completed', settled_at = now()
    where job_id = _job_id;
    return 'completed';
  end if;

  insert into public.user_points (user_id, points, reason)
  values (_user_id, _charge.amount, 'File Studio refund: ' || _job_id::text);
  update public.file_conversion_charges
  set status = 'refunded', settled_at = now()
  where job_id = _job_id;
  return 'refunded';
end;
$$;

create or replace function public.refund_stale_file_conversions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _user_id uuid := auth.uid();
  _refunded integer := 0;
  _charge record;
begin
  if _user_id is null then raise exception 'Not authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));

  for _charge in
    select job_id, amount
    from public.file_conversion_charges
    where user_id = _user_id
      and status = 'charged'
      and created_at < now() - interval '1 hour'
    for update
  loop
    insert into public.user_points (user_id, points, reason)
    values (_user_id, _charge.amount, 'File Studio stale refund: ' || _charge.job_id::text);
    update public.file_conversion_charges
    set status = 'refunded', settled_at = now()
    where job_id = _charge.job_id;
    _refunded := _refunded + 1;
  end loop;
  return _refunded;
end;
$$;

revoke all on function public.charge_file_conversion(uuid, text, text, bigint) from public;
revoke all on function public.settle_file_conversion(uuid, boolean) from public;
revoke all on function public.refund_stale_file_conversions() from public;
grant execute on function public.charge_file_conversion(uuid, text, text, bigint) to authenticated;
grant execute on function public.settle_file_conversion(uuid, boolean) to authenticated;
grant execute on function public.refund_stale_file_conversions() to authenticated;
