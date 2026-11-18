-- Manna: history-only entries. When someone starts tracking partway through a month, the balances they type in
-- already reflect what they spent before that. Those earlier entries still belong in the month's spending, giving,
-- budgets and tithe, but they must not come out of an account a second time.
--
-- affects_balance = false marks such an entry: it counts everywhere except account balances. Everything else
-- (and every existing row) keeps the default, true.
alter table manna.transactions
  add column if not exists affects_balance boolean not null default true;

comment on column manna.transactions.affects_balance is
  'false = history only: counted in totals, budgets and the tithe, but not in account balances.';
