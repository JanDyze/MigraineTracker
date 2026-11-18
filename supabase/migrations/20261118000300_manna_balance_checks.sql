-- Manna: the month-end balance check. Once a month the person counts what each account really holds and
-- compares it with what Manna has on record. Each row is one account on one check: the recorded balance at the
-- time, the real one they counted, and the adjustment entry (if they chose to record the difference).
create table manna.balance_checks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  checked_on     date not null default current_date,
  month          text not null check (month ~ '^\d{4}-\d{2}$'),        -- the month being closed, YYYY-MM
  account_id     uuid not null references manna.accounts (id) on delete cascade,
  recorded       numeric(14,2) not null,
  actual         numeric(14,2) not null,
  adjustment_id  uuid references manna.transactions (id) on delete set null,
  note           text check (note is null or length(note) <= 200),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index balance_checks_user_idx on manna.balance_checks (user_id, month desc);

create trigger balance_checks_touch_updated_at before update on manna.balance_checks
  for each row execute function manna.touch_updated_at();

-- the account (and adjustment entry) must be the same person's
create function manna.check_balance_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from manna.accounts a where a.id = new.account_id and a.user_id = new.user_id)
     or (new.adjustment_id is not null and not exists (select 1 from manna.transactions t where t.id = new.adjustment_id and t.user_id = new.user_id)) then
    raise exception 'manna: balance check points at another user''s rows' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger balance_checks_same_owner before insert or update on manna.balance_checks
  for each row execute function manna.check_balance_owner();

alter table manna.balance_checks enable row level security;
create policy "Owner reads" on manna.balance_checks for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owner inserts" on manna.balance_checks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owner updates" on manna.balance_checks for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owner deletes" on manna.balance_checks for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on manna.balance_checks from anon;
grant select, insert, update, delete on manna.balance_checks to authenticated;
grant all on manna.balance_checks to service_role;
