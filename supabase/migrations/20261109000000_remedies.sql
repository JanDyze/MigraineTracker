-- Things besides medicine that were tried during an attack (sleep, a cold shower, menthol rub…).
-- Rated together with medications by the existing `relief` column.
alter table might.attacks add column remedies text[] not null default '{}';
