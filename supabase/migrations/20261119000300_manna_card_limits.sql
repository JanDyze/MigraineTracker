-- Manna: credit limits on cards. A card or pay-later account (Atome, SPayLater, a credit card) keeps what's owed as a
-- negative balance; with a limit, the app can also show what's left to spend on it ("₱4,335 left · ₱4,553 owed").
-- Optional, and only meaningful for kind 'card'.
alter table manna.accounts
  add column if not exists credit_limit numeric(14,2) check (credit_limit > 0);

comment on column manna.accounts.credit_limit is 'Cards: the spending limit, to show what is left to spend. Null = not set.';
