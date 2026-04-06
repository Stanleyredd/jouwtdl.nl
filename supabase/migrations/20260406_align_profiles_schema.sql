create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  language text not null default 'nl',
  theme text not null default 'light',
  show_tomorrow boolean not null default true,
  journal_sections_enabled jsonb not null default '[]'::jsonb,
  onboarding_completed boolean not null default false,
  journal_preset text,
  journal_config jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists email text not null default '';

alter table public.profiles
  add column if not exists language text not null default 'nl';

alter table public.profiles
  add column if not exists theme text not null default 'light';

alter table public.profiles
  add column if not exists show_tomorrow boolean not null default true;

alter table public.profiles
  add column if not exists journal_sections_enabled jsonb not null default '[]'::jsonb;

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

alter table public.profiles
  add column if not exists journal_preset text;

alter table public.profiles
  add column if not exists journal_config jsonb;

alter table public.profiles
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.profiles
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.profiles
  drop constraint if exists profiles_language_check;

alter table public.profiles
  drop constraint if exists profiles_theme_check;

alter table public.profiles
  drop constraint if exists profiles_journal_preset_check;

alter table public.profiles
  add constraint profiles_language_check
  check (language in ('nl', 'en'));

alter table public.profiles
  add constraint profiles_theme_check
  check (theme in ('light', 'dark'));

alter table public.profiles
  add constraint profiles_journal_preset_check
  check (journal_preset in ('trading', 'business', 'personal', 'custom'));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update
    set email = excluded.email,
        updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

alter table public.profiles enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
on public.profiles
for delete
to authenticated
using ((select auth.uid()) = id);

notify pgrst, 'reload schema';
