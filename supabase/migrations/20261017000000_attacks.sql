-- One row per migraine attack. Tag-style fields are text arrays so users can add their own values.
create table public.attacks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,                -- null while the attack is ongoing
  intensity   smallint not null check (intensity between 1 and 10),
  locations   text[] not null default '{}',
  symptoms    text[] not null default '{}',
  triggers    text[] not null default '{}',
  medications text[] not null default '{}',
  relief      smallint check (relief between 0 and 3),  -- 0 none, 1 some, 2 good, 3 complete
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint attacks_end_after_start check (ended_at is null or ended_at >= started_at)
);

create index attacks_user_started_idx on public.attacks (user_id, started_at desc);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger attacks_touch_updated_at
  before update on public.attacks
  for each row execute function public.touch_updated_at();

-- Health data: every row is visible only to its owner.
alter table public.attacks enable row level security;

create policy "Users read own attacks" on public.attacks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own attacks" on public.attacks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own attacks" on public.attacks
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own attacks" on public.attacks
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.attacks from anon;
grant select, insert, update, delete on public.attacks to authenticated;
