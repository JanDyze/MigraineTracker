-- Manna: personal finance (expenses, budgets, debts, recurring bills, giving, savings goals).
--
-- Manna shares the OneDyze Supabase project with the owner's other apps (Might, Kept, Orbit…), so its
-- tables live in their own `manna` schema, and logins (auth.users) are shared across every app.
-- The schema must also be listed under the API's exposed schemas: `schemas` in supabase/config.toml
-- locally, and Project Settings → Data API → Exposed schemas in the cloud.
--
-- Money is numeric(14,2), always positive; a row's `kind` says which way it moves.
-- Every row belongs to one user (user_id defaults to the signed-in user) and only they can see it.

create schema if not exists manna;
grant usage on schema manna to authenticated, service_role;

create function manna.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Per-user settings: one row each, created on first sign-in by manna.ensure_defaults().
create table manna.settings (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  currency       text not null default 'PHP',
  tithe_percent  numeric(5,2) not null default 10 check (tithe_percent between 0 and 100),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Where money sits: wallet cash, GCash/Maya, bank, credit card, savings.
create table manna.accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null check (length(trim(name)) between 1 and 60),
  kind             text not null default 'cash' check (kind in ('cash', 'bank', 'ewallet', 'card', 'savings')),
  opening_balance  numeric(14,2) not null default 0,   -- balance when you started tracking (negative for card debt)
  sort             smallint not null default 0,
  archived         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- What money is for. `giving` categories (tithe, offering, missions) count toward giving, not spending.
create table manna.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 40),
  kind        text not null check (kind in ('expense', 'income', 'giving')),
  icon        text not null default 'dot',
  sort        smallint not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, kind, name)
);

-- Monthly spending limit per category. One standing amount; it applies to every month.
create table manna.budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id  uuid not null references manna.categories (id) on delete cascade,
  amount       numeric(14,2) not null check (amount > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, category_id)
);

-- People you lend to or borrow from. Manna's own list (not shared with Orbit, for now).
create table manna.people (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 60),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- A loan either way. `owed_to_me`: you lent it; `i_owe`: you borrowed it.
-- What's left = principal − the payments (transactions with this debt_id that move the other way).
create table manna.debts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  person_id   uuid not null references manna.people (id) on delete restrict,
  direction   text not null check (direction in ('owed_to_me', 'i_owe')),
  title       text not null check (length(trim(title)) between 1 and 80),
  principal   numeric(14,2) not null check (principal > 0),
  started_on  date not null default current_date,
  due_on      date,
  note        text,
  closed_at   timestamptz,   -- set when fully paid or forgiven
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Savings goals: emergency fund, tuition, a trip. Progress comes from manna.goal_entries.
create table manna.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 60),
  target      numeric(14,2) not null check (target > 0),
  target_on   date,
  icon        text not null default 'jar',
  closed_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Money set aside for (positive) or taken back from (negative) a goal.
create table manna.goal_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id      uuid not null references manna.goals (id) on delete cascade,
  amount       numeric(14,2) not null check (amount <> 0),
  occurred_on  date not null default current_date,
  note         text,
  created_at   timestamptz not null default now()
);

-- Bills and subscriptions that come back: rent, Netflix, tuition. "Mark paid" records a transaction
-- and moves next_due forward by `every` × `frequency`.
create table manna.recurring (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (length(trim(title)) between 1 and 60),
  kind         text not null default 'expense' check (kind in ('expense', 'income', 'giving')),
  amount       numeric(14,2) not null check (amount > 0),
  account_id   uuid references manna.accounts (id) on delete set null,
  category_id  uuid references manna.categories (id) on delete set null,
  frequency    text not null default 'monthly' check (frequency in ('weekly', 'monthly', 'yearly')),
  every        smallint not null default 1 check (every between 1 and 52),
  next_due     date not null,
  active       boolean not null default true,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Every movement of money.
--   expense / income / giving  one account, one category
--   transfer                   account → to_account (e.g. bank → GCash)
--   debt_out / debt_in         money out / in for a debt: lending or repaying / borrowing or collecting
create table manna.transactions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind           text not null check (kind in ('expense', 'income', 'giving', 'transfer', 'debt_out', 'debt_in')),
  amount         numeric(14,2) not null check (amount > 0),
  occurred_on    date not null default current_date,
  account_id     uuid not null references manna.accounts (id) on delete restrict,
  to_account_id  uuid references manna.accounts (id) on delete restrict,
  category_id    uuid references manna.categories (id) on delete set null,
  debt_id        uuid references manna.debts (id) on delete cascade,
  recurring_id   uuid references manna.recurring (id) on delete set null,
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint transactions_transfer_shape check (
    (kind = 'transfer') = (to_account_id is not null) and (to_account_id is null or to_account_id <> account_id)
  ),
  constraint transactions_debt_shape check ((kind in ('debt_out', 'debt_in')) = (debt_id is not null))
);

create index accounts_user_idx       on manna.accounts (user_id);
create index categories_user_idx     on manna.categories (user_id);
create index budgets_category_idx    on manna.budgets (category_id);
create index people_user_idx         on manna.people (user_id);
create index debts_user_idx          on manna.debts (user_id);
create index debts_person_idx        on manna.debts (person_id);
create index goals_user_idx          on manna.goals (user_id);
create index goal_entries_goal_idx   on manna.goal_entries (goal_id);
create index goal_entries_user_idx   on manna.goal_entries (user_id);
create index recurring_user_idx      on manna.recurring (user_id, next_due);
create index recurring_account_idx   on manna.recurring (account_id);
create index recurring_category_idx  on manna.recurring (category_id);
create index transactions_user_date_idx on manna.transactions (user_id, occurred_on desc);
create index transactions_account_idx   on manna.transactions (account_id);
create index transactions_to_account_idx on manna.transactions (to_account_id);
create index transactions_category_idx  on manna.transactions (category_id);
create index transactions_debt_idx      on manna.transactions (debt_id);
create index transactions_recurring_idx on manna.transactions (recurring_id);

-- updated_at, row-level security (owner only) and grants, the same for every table.
do $$
declare t text;
begin
  foreach t in array array['settings', 'accounts', 'categories', 'budgets', 'people', 'debts', 'goals',
                           'goal_entries', 'recurring', 'transactions'] loop
    if t <> 'goal_entries' then
      execute format('create trigger %1$s_touch_updated_at before update on manna.%1$s
                      for each row execute function manna.touch_updated_at()', t);
    end if;
    execute format('alter table manna.%s enable row level security', t);
    execute format('create policy "Owner reads" on manna.%s for select to authenticated
                    using ((select auth.uid()) = user_id)', t);
    execute format('create policy "Owner inserts" on manna.%s for insert to authenticated
                    with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "Owner updates" on manna.%s for update to authenticated
                    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "Owner deletes" on manna.%s for delete to authenticated
                    using ((select auth.uid()) = user_id)', t);
    execute format('revoke all on manna.%s from anon', t);
    execute format('grant select, insert, update, delete on manna.%s to authenticated', t);
    execute format('grant all on manna.%s to service_role', t);
  end loop;
end;
$$;

-- RLS checks each row's owner, but a row could still point at someone else's account or category
-- by id. This trigger makes every reference point at the same user's rows.
create function manna.check_same_owner() returns trigger
language plpgsql set search_path = '' as $$
declare
  ref record;
begin
  for ref in
    select * from (values
      ('accounts', case when tg_table_name in ('transactions', 'recurring') then to_jsonb(new) ->> 'account_id' end),
      ('accounts', case when tg_table_name = 'transactions' then to_jsonb(new) ->> 'to_account_id' end),
      ('categories', case when tg_table_name in ('transactions', 'recurring', 'budgets') then to_jsonb(new) ->> 'category_id' end),
      ('debts', case when tg_table_name = 'transactions' then to_jsonb(new) ->> 'debt_id' end),
      ('recurring', case when tg_table_name = 'transactions' then to_jsonb(new) ->> 'recurring_id' end),
      ('people', case when tg_table_name = 'debts' then to_jsonb(new) ->> 'person_id' end),
      ('goals', case when tg_table_name = 'goal_entries' then to_jsonb(new) ->> 'goal_id' end)
    ) as r (tbl, id)
    where r.id is not null
  loop
    if not exists (
      select 1 from (
        select id, user_id from manna.accounts where ref.tbl = 'accounts'
        union all select id, user_id from manna.categories where ref.tbl = 'categories'
        union all select id, user_id from manna.debts where ref.tbl = 'debts'
        union all select id, user_id from manna.recurring where ref.tbl = 'recurring'
        union all select id, user_id from manna.people where ref.tbl = 'people'
        union all select id, user_id from manna.goals where ref.tbl = 'goals'
      ) o
      where o.id = ref.id::uuid and o.user_id = new.user_id
    ) then
      raise exception 'manna: % % does not belong to this user', ref.tbl, ref.id using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

create trigger transactions_same_owner before insert or update on manna.transactions
  for each row execute function manna.check_same_owner();
create trigger recurring_same_owner before insert or update on manna.recurring
  for each row execute function manna.check_same_owner();
create trigger budgets_same_owner before insert or update on manna.budgets
  for each row execute function manna.check_same_owner();
create trigger debts_same_owner before insert or update on manna.debts
  for each row execute function manna.check_same_owner();
create trigger goal_entries_same_owner before insert or update on manna.goal_entries
  for each row execute function manna.check_same_owner();

-- First sign-in: a settings row, a Wallet, and starter categories. Safe to call every time;
-- it does nothing once the user has settings. Runs as the caller, so RLS still applies.
create function manna.ensure_defaults() returns void
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'manna: not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from manna.settings where user_id = me) then
    return;
  end if;

  insert into manna.settings (user_id) values (me);

  insert into manna.accounts (user_id, name, kind, sort) values
    (me, 'Wallet', 'cash', 0),
    (me, 'GCash', 'ewallet', 1),
    (me, 'Bank', 'bank', 2);

  insert into manna.categories (user_id, kind, name, icon, sort) values
    (me, 'expense', 'Food', 'food', 0),
    (me, 'expense', 'Transport', 'transport', 1),
    (me, 'expense', 'Bills', 'bolt', 2),
    (me, 'expense', 'Rent', 'home', 3),
    (me, 'expense', 'Groceries', 'basket', 4),
    (me, 'expense', 'Health', 'heart', 5),
    (me, 'expense', 'Family', 'people', 6),
    (me, 'expense', 'Shopping', 'bag', 7),
    (me, 'expense', 'Fun', 'spark', 8),
    (me, 'expense', 'Subscriptions', 'repeat', 9),
    (me, 'expense', 'Other', 'dot', 10),
    (me, 'income', 'Salary', 'briefcase', 0),
    (me, 'income', 'Side work', 'tool', 1),
    (me, 'income', 'Gift', 'gift', 2),
    (me, 'income', 'Other', 'dot', 3),
    (me, 'giving', 'Tithe', 'wheat', 0),
    (me, 'giving', 'Offering', 'hands', 1),
    (me, 'giving', 'Missions', 'globe', 2),
    (me, 'giving', 'Helping others', 'heart', 3);
end;
$$;

revoke all on function manna.ensure_defaults() from public, anon;
grant execute on function manna.ensure_defaults() to authenticated;
