create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  language text not null default 'nl' check (language in ('nl', 'en')),
  theme text not null default 'light' check (theme in ('light', 'dark')),
  show_tomorrow boolean not null default true,
  journal_sections_enabled jsonb not null default '[]'::jsonb,
  onboarding_completed boolean not null default false,
  journal_preset text check (journal_preset in ('trading', 'business', 'personal', 'custom')),
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
  drop constraint if exists profiles_journal_preset_check;

alter table public.profiles
  drop constraint if exists profiles_language_check;

alter table public.profiles
  drop constraint if exists profiles_theme_check;

alter table public.profiles
  add constraint profiles_language_check
  check (language in ('nl', 'en'));

alter table public.profiles
  add constraint profiles_theme_check
  check (theme in ('light', 'dark'));

alter table public.profiles
  add constraint profiles_journal_preset_check
  check (journal_preset in ('trading', 'business', 'personal', 'custom'));

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  language text not null default 'nl' check (language in ('nl', 'en')),
  raw_transcript text not null default '',
  edited_transcript text not null default '',
  ai_summary text not null default '',
  ai_summary_error text,
  ai_summary_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, entry_date),
  unique (id, user_id)
);

alter table public.journal_entries
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.journal_entries
  add column if not exists entry_date date;

alter table public.journal_entries
  add column if not exists language text not null default 'nl';

alter table public.journal_entries
  add column if not exists raw_transcript text not null default '';

alter table public.journal_entries
  add column if not exists edited_transcript text not null default '';

alter table public.journal_entries
  add column if not exists ai_summary text not null default '';

alter table public.journal_entries
  add column if not exists ai_summary_error text;

alter table public.journal_entries
  add column if not exists ai_summary_updated_at timestamptz;

alter table public.journal_entries
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.journal_entries
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.journal_entries
  drop constraint if exists journal_entries_language_check;

alter table public.journal_entries
  add constraint journal_entries_language_check
  check (language in ('nl', 'en'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'journal_entries_user_id_entry_date_key'
      and conrelid = 'public.journal_entries'::regclass
  ) then
    alter table public.journal_entries
      add constraint journal_entries_user_id_entry_date_key unique (user_id, entry_date);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'journal_entries_id_user_id_key'
      and conrelid = 'public.journal_entries'::regclass
  ) then
    alter table public.journal_entries
      add constraint journal_entries_id_user_id_key unique (id, user_id);
  end if;
end
$$;

create table if not exists public.journal_sections (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null,
  user_id uuid not null,
  section_key text not null,
  content text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (journal_entry_id, section_key),
  constraint journal_sections_entry_fk
    foreign key (journal_entry_id, user_id)
    references public.journal_entries(id, user_id)
    on delete cascade
);

alter table public.journal_sections
  add column if not exists journal_entry_id uuid;

alter table public.journal_sections
  add column if not exists user_id uuid;

alter table public.journal_sections
  add column if not exists section_key text;

alter table public.journal_sections
  add column if not exists content text not null default '';

alter table public.journal_sections
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.journal_sections
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'journal_sections_journal_entry_id_section_key_key'
      and conrelid = 'public.journal_sections'::regclass
  ) then
    alter table public.journal_sections
      add constraint journal_sections_journal_entry_id_section_key_key unique (journal_entry_id, section_key);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'journal_sections_entry_fk'
      and conrelid = 'public.journal_sections'::regclass
  ) then
    alter table public.journal_sections
      add constraint journal_sections_entry_fk
      foreign key (journal_entry_id, user_id)
      references public.journal_entries(id, user_id)
      on delete cascade;
  end if;
end
$$;

create table if not exists public.tomorrow_setups (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null unique,
  user_id uuid not null,
  focus text not null default '',
  top_tasks text[] not null default '{}'::text[],
  watch_out_for text not null default '',
  intention text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tomorrow_setups_entry_fk
    foreign key (journal_entry_id, user_id)
    references public.journal_entries(id, user_id)
    on delete cascade
);

alter table public.tomorrow_setups
  add column if not exists journal_entry_id uuid;

alter table public.tomorrow_setups
  add column if not exists user_id uuid;

alter table public.tomorrow_setups
  add column if not exists focus text not null default '';

alter table public.tomorrow_setups
  add column if not exists top_tasks text[] not null default '{}'::text[];

alter table public.tomorrow_setups
  add column if not exists watch_out_for text not null default '';

alter table public.tomorrow_setups
  add column if not exists intention text not null default '';

alter table public.tomorrow_setups
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table public.tomorrow_setups
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tomorrow_setups_journal_entry_id_key'
      and conrelid = 'public.tomorrow_setups'::regclass
  ) then
    alter table public.tomorrow_setups
      add constraint tomorrow_setups_journal_entry_id_key unique (journal_entry_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tomorrow_setups_entry_fk'
      and conrelid = 'public.tomorrow_setups'::regclass
  ) then
    alter table public.tomorrow_setups
      add constraint tomorrow_setups_entry_fk
      foreign key (journal_entry_id, user_id)
      references public.journal_entries(id, user_id)
      on delete cascade;
  end if;
end
$$;

create index if not exists journal_entries_user_date_idx
  on public.journal_entries (user_id, entry_date);

create index if not exists journal_sections_user_entry_idx
  on public.journal_sections (user_id, journal_entry_id);

create index if not exists tomorrow_setups_user_entry_idx
  on public.tomorrow_setups (user_id, journal_entry_id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists journal_entries_set_updated_at on public.journal_entries;
create trigger journal_entries_set_updated_at
before update on public.journal_entries
for each row
execute function public.set_updated_at();

drop trigger if exists journal_sections_set_updated_at on public.journal_sections;
create trigger journal_sections_set_updated_at
before update on public.journal_sections
for each row
execute function public.set_updated_at();

drop trigger if exists tomorrow_setups_set_updated_at on public.tomorrow_setups;
create trigger tomorrow_setups_set_updated_at
before update on public.tomorrow_setups
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
alter table public.journal_entries enable row level security;
alter table public.journal_sections enable row level security;
alter table public.tomorrow_setups enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.journal_entries to authenticated;
grant select, insert, update, delete on public.journal_sections to authenticated;
grant select, insert, update, delete on public.tomorrow_setups to authenticated;

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

drop policy if exists "journal_entries_select_own" on public.journal_entries;
create policy "journal_entries_select_own"
on public.journal_entries
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "journal_entries_insert_own" on public.journal_entries;
create policy "journal_entries_insert_own"
on public.journal_entries
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "journal_entries_update_own" on public.journal_entries;
create policy "journal_entries_update_own"
on public.journal_entries
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "journal_entries_delete_own" on public.journal_entries;
create policy "journal_entries_delete_own"
on public.journal_entries
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "journal_sections_select_own" on public.journal_sections;
create policy "journal_sections_select_own"
on public.journal_sections
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "journal_sections_insert_own" on public.journal_sections;
create policy "journal_sections_insert_own"
on public.journal_sections
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "journal_sections_update_own" on public.journal_sections;
create policy "journal_sections_update_own"
on public.journal_sections
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "journal_sections_delete_own" on public.journal_sections;
create policy "journal_sections_delete_own"
on public.journal_sections
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "tomorrow_setups_select_own" on public.tomorrow_setups;
create policy "tomorrow_setups_select_own"
on public.tomorrow_setups
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "tomorrow_setups_insert_own" on public.tomorrow_setups;
create policy "tomorrow_setups_insert_own"
on public.tomorrow_setups
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "tomorrow_setups_update_own" on public.tomorrow_setups;
create policy "tomorrow_setups_update_own"
on public.tomorrow_setups
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "tomorrow_setups_delete_own" on public.tomorrow_setups;
create policy "tomorrow_setups_delete_own"
on public.tomorrow_setups
for delete
to authenticated
using ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
