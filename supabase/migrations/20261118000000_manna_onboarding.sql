-- Manna: remember when someone finished (or skipped) first-run setup.
-- Anyone who already has entries is treated as set up, so they never see the welcome again.
alter table manna.settings add column if not exists onboarded_at timestamptz;

update manna.settings s
   set onboarded_at = now()
 where s.onboarded_at is null
   and exists (select 1 from manna.transactions t where t.user_id = s.user_id);
