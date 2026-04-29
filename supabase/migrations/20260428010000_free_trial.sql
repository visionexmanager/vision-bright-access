-- Add trial_expires_at to profiles
alter table public.profiles
  add column if not exists trial_expires_at timestamptz;

-- Update handle_new_user: remove welcome bonus, set 30-day trial instead
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, display_name, trial_expires_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.email),
    now() + interval '30 days'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;
