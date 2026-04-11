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

create table if not exists public.monthly_goals (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  description text not null default '',
  month integer not null check (month between 1 and 12),
  year integer not null,
  life_area text not null default '',
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'paused')),
  progress integer not null default 0 check (progress between 0 and 100),
  due_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id)
);

alter table public.monthly_goals
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.monthly_goals
  add column if not exists title text not null default '';
alter table public.monthly_goals
  add column if not exists description text not null default '';
alter table public.monthly_goals
  add column if not exists month integer;
alter table public.monthly_goals
  add column if not exists year integer;
alter table public.monthly_goals
  add column if not exists life_area text not null default '';
alter table public.monthly_goals
  add column if not exists status text not null default 'not_started';
alter table public.monthly_goals
  add column if not exists progress integer not null default 0;
alter table public.monthly_goals
  add column if not exists due_date date;
alter table public.monthly_goals
  add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.monthly_goals
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.monthly_goals
  drop constraint if exists monthly_goals_month_check;
alter table public.monthly_goals
  drop constraint if exists monthly_goals_status_check;
alter table public.monthly_goals
  drop constraint if exists monthly_goals_progress_check;
alter table public.monthly_goals
  add constraint monthly_goals_month_check
  check (month between 1 and 12);
alter table public.monthly_goals
  add constraint monthly_goals_status_check
  check (status in ('not_started', 'in_progress', 'completed', 'paused'));
alter table public.monthly_goals
  add constraint monthly_goals_progress_check
  check (progress between 0 and 100);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'monthly_goals_id_user_id_key'
      and conrelid = 'public.monthly_goals'::regclass
  ) then
    alter table public.monthly_goals
      add constraint monthly_goals_id_user_id_key unique (id, user_id);
  end if;
end
$$;

create table if not exists public.weekly_goals (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  monthly_goal_id text,
  title text not null default '',
  description text not null default '',
  week_number integer not null,
  start_date date not null,
  end_date date not null,
  life_area text not null default '',
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'paused')),
  progress integer not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  constraint weekly_goals_monthly_goal_fk
    foreign key (monthly_goal_id, user_id)
    references public.monthly_goals(id, user_id)
    on delete set null
);

alter table public.weekly_goals
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.weekly_goals
  add column if not exists monthly_goal_id text;
alter table public.weekly_goals
  add column if not exists title text not null default '';
alter table public.weekly_goals
  add column if not exists description text not null default '';
alter table public.weekly_goals
  add column if not exists week_number integer;
alter table public.weekly_goals
  add column if not exists start_date date;
alter table public.weekly_goals
  add column if not exists end_date date;
alter table public.weekly_goals
  add column if not exists life_area text not null default '';
alter table public.weekly_goals
  add column if not exists status text not null default 'not_started';
alter table public.weekly_goals
  add column if not exists progress integer not null default 0;
alter table public.weekly_goals
  add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.weekly_goals
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.weekly_goals
  drop constraint if exists weekly_goals_status_check;
alter table public.weekly_goals
  drop constraint if exists weekly_goals_progress_check;
alter table public.weekly_goals
  add constraint weekly_goals_status_check
  check (status in ('not_started', 'in_progress', 'completed', 'paused'));
alter table public.weekly_goals
  add constraint weekly_goals_progress_check
  check (progress between 0 and 100);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'weekly_goals_id_user_id_key'
      and conrelid = 'public.weekly_goals'::regclass
  ) then
    alter table public.weekly_goals
      add constraint weekly_goals_id_user_id_key unique (id, user_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'weekly_goals_monthly_goal_fk'
      and conrelid = 'public.weekly_goals'::regclass
  ) then
    alter table public.weekly_goals
      add constraint weekly_goals_monthly_goal_fk
      foreign key (monthly_goal_id, user_id)
      references public.monthly_goals(id, user_id)
      on delete set null;
  end if;
end
$$;

create table if not exists public.daily_tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  weekly_goal_id text,
  title text not null default '',
  note text not null default '',
  date date not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  life_area text not null default '',
  completed boolean not null default false,
  carry_over_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id),
  constraint daily_tasks_weekly_goal_fk
    foreign key (weekly_goal_id, user_id)
    references public.weekly_goals(id, user_id)
    on delete set null
);

alter table public.daily_tasks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.daily_tasks
  add column if not exists weekly_goal_id text;
alter table public.daily_tasks
  add column if not exists title text not null default '';
alter table public.daily_tasks
  add column if not exists note text not null default '';
alter table public.daily_tasks
  add column if not exists date date;
alter table public.daily_tasks
  add column if not exists priority text not null default 'medium';
alter table public.daily_tasks
  add column if not exists life_area text not null default '';
alter table public.daily_tasks
  add column if not exists completed boolean not null default false;
alter table public.daily_tasks
  add column if not exists carry_over_count integer not null default 0;
alter table public.daily_tasks
  add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.daily_tasks
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.daily_tasks
  drop constraint if exists daily_tasks_priority_check;
alter table public.daily_tasks
  add constraint daily_tasks_priority_check
  check (priority in ('low', 'medium', 'high'));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_tasks_id_user_id_key'
      and conrelid = 'public.daily_tasks'::regclass
  ) then
    alter table public.daily_tasks
      add constraint daily_tasks_id_user_id_key unique (id, user_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_tasks_weekly_goal_fk'
      and conrelid = 'public.daily_tasks'::regclass
  ) then
    alter table public.daily_tasks
      add constraint daily_tasks_weekly_goal_fk
      foreign key (weekly_goal_id, user_id)
      references public.weekly_goals(id, user_id)
      on delete set null;
  end if;
end
$$;

create table if not exists public.daily_focuses (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  main_focus text not null default '',
  secondary_focuses text[] not null default '{}'::text[],
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, date)
);

alter table public.daily_focuses
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.daily_focuses
  add column if not exists date date;
alter table public.daily_focuses
  add column if not exists main_focus text not null default '';
alter table public.daily_focuses
  add column if not exists secondary_focuses text[] not null default '{}'::text[];
alter table public.daily_focuses
  add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.daily_focuses
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_focuses_user_id_date_key'
      and conrelid = 'public.daily_focuses'::regclass
  ) then
    alter table public.daily_focuses
      add constraint daily_focuses_user_id_date_key unique (user_id, date);
  end if;
end
$$;

create index if not exists monthly_goals_user_month_idx
  on public.monthly_goals (user_id, year, month);
create index if not exists weekly_goals_user_range_idx
  on public.weekly_goals (user_id, start_date, end_date);
create index if not exists daily_tasks_user_date_idx
  on public.daily_tasks (user_id, date);
create index if not exists daily_focuses_user_date_idx
  on public.daily_focuses (user_id, date);

drop trigger if exists monthly_goals_set_updated_at on public.monthly_goals;
create trigger monthly_goals_set_updated_at
before update on public.monthly_goals
for each row
execute function public.set_updated_at();

drop trigger if exists weekly_goals_set_updated_at on public.weekly_goals;
create trigger weekly_goals_set_updated_at
before update on public.weekly_goals
for each row
execute function public.set_updated_at();

drop trigger if exists daily_tasks_set_updated_at on public.daily_tasks;
create trigger daily_tasks_set_updated_at
before update on public.daily_tasks
for each row
execute function public.set_updated_at();

drop trigger if exists daily_focuses_set_updated_at on public.daily_focuses;
create trigger daily_focuses_set_updated_at
before update on public.daily_focuses
for each row
execute function public.set_updated_at();

alter table public.monthly_goals enable row level security;
alter table public.weekly_goals enable row level security;
alter table public.daily_tasks enable row level security;
alter table public.daily_focuses enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.monthly_goals to authenticated;
grant select, insert, update, delete on public.weekly_goals to authenticated;
grant select, insert, update, delete on public.daily_tasks to authenticated;
grant select, insert, update, delete on public.daily_focuses to authenticated;

drop policy if exists "monthly_goals_select_own" on public.monthly_goals;
create policy "monthly_goals_select_own"
on public.monthly_goals
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "monthly_goals_insert_own" on public.monthly_goals;
create policy "monthly_goals_insert_own"
on public.monthly_goals
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "monthly_goals_update_own" on public.monthly_goals;
create policy "monthly_goals_update_own"
on public.monthly_goals
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "monthly_goals_delete_own" on public.monthly_goals;
create policy "monthly_goals_delete_own"
on public.monthly_goals
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "weekly_goals_select_own" on public.weekly_goals;
create policy "weekly_goals_select_own"
on public.weekly_goals
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "weekly_goals_insert_own" on public.weekly_goals;
create policy "weekly_goals_insert_own"
on public.weekly_goals
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "weekly_goals_update_own" on public.weekly_goals;
create policy "weekly_goals_update_own"
on public.weekly_goals
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "weekly_goals_delete_own" on public.weekly_goals;
create policy "weekly_goals_delete_own"
on public.weekly_goals
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "daily_tasks_select_own" on public.daily_tasks;
create policy "daily_tasks_select_own"
on public.daily_tasks
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "daily_tasks_insert_own" on public.daily_tasks;
create policy "daily_tasks_insert_own"
on public.daily_tasks
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "daily_tasks_update_own" on public.daily_tasks;
create policy "daily_tasks_update_own"
on public.daily_tasks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "daily_tasks_delete_own" on public.daily_tasks;
create policy "daily_tasks_delete_own"
on public.daily_tasks
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "daily_focuses_select_own" on public.daily_focuses;
create policy "daily_focuses_select_own"
on public.daily_focuses
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "daily_focuses_insert_own" on public.daily_focuses;
create policy "daily_focuses_insert_own"
on public.daily_focuses
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "daily_focuses_update_own" on public.daily_focuses;
create policy "daily_focuses_update_own"
on public.daily_focuses
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "daily_focuses_delete_own" on public.daily_focuses;
create policy "daily_focuses_delete_own"
on public.daily_focuses
for delete
to authenticated
using ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
