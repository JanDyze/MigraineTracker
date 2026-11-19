-- Manna: card payments as bills, and bills that end.
--
-- Pay-later services (Atome, SPayLater) and credit cards are 'card' accounts: a purchase is an expense from the card,
-- so its balance goes negative (what's owed), and each installment is a transfer from a bank or e-wallet to the card.
-- A 'transfer' bill reminds before that installment is due; marking it paid records the transfer.
--
-- payments_left counts down with each payment (any kind of bill, e.g. the last 3 of a motor loan). At 0 the bill is
-- finished and stops reminding (active = false). Null means it doesn't end.

alter table manna.recurring drop constraint if exists recurring_kind_check;
alter table manna.recurring add constraint recurring_kind_check
  check (kind in ('expense', 'income', 'giving', 'transfer'));

-- deleting the card deletes its payment bill (past payments stay as entries)
alter table manna.recurring
  add column if not exists to_account_id uuid references manna.accounts (id) on delete cascade,
  add column if not exists payments_left smallint check (payments_left between 0 and 999);

alter table manna.recurring drop constraint if exists recurring_transfer_shape;
alter table manna.recurring add constraint recurring_transfer_shape check (
  (kind = 'transfer') = (to_account_id is not null)
  and (account_id is null or to_account_id is null or to_account_id <> account_id)
);

comment on column manna.recurring.to_account_id is 'Card payments (kind transfer): the card or pay-later account the money goes to.';
comment on column manna.recurring.payments_left is 'Payments still to make; counts down when paid, and the bill finishes at 0. Null = no end.';

-- the same-owner check now covers a bill's to_account too
create or replace function manna.check_same_owner() returns trigger
language plpgsql set search_path = '' as $$
declare
  ref record;
begin
  for ref in
    select * from (values
      ('accounts', case when tg_table_name in ('transactions', 'recurring') then to_jsonb(new) ->> 'account_id' end),
      ('accounts', case when tg_table_name in ('transactions', 'recurring') then to_jsonb(new) ->> 'to_account_id' end),
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
