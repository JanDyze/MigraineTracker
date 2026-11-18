-- Manna: new users no longer get a generic "Bank" account. First-run setup asks which bank they use
-- (BDO, BPI, Maya…) and creates the accounts with those names instead.
create or replace function manna.ensure_defaults() returns void
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
    (me, 'GCash', 'ewallet', 1);

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

