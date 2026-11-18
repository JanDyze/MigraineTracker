-- Manna: the order of entries within one day. Activity lets the person drag a day's entries into the order they
-- happened (or any order they like); Claude can do the same with arrange_day.
--
-- day_order = 1 is the top of the day. Null means never arranged: those entries show first, newest first, as before,
-- so nothing changes for existing rows. Moving an entry to another day clears it.
alter table manna.transactions
  add column if not exists day_order integer;

comment on column manna.transactions.day_order is
  'Place within its day once arranged (1 = top); null = never arranged, shown first, newest first.';
