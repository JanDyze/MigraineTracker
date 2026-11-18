-- Manna: KATY's notes. Things the person asks KATY to remember, like "Jonathan asked if I could help with his
-- father's medicine; not yet". KATY reads them back when it matters, and they can be ticked off when settled.
create table manna.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body        text not null check (length(trim(body)) between 1 and 500),
  person      text check (person is null or length(trim(person)) between 1 and 60),  -- who it's about, as said
  amount      numeric(14,2) check (amount is null or amount > 0),                      -- if money was mentioned
  remind_on   date,                                                                      -- bring it up again on this day
  done_at     timestamptz,                                                               -- settled or no longer needed
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index notes_user_idx on manna.notes (user_id, created_at desc);

create trigger notes_touch_updated_at before update on manna.notes
  for each row execute function manna.touch_updated_at();

alter table manna.notes enable row level security;
create policy "Owner reads" on manna.notes for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owner inserts" on manna.notes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owner updates" on manna.notes for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owner deletes" on manna.notes for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on manna.notes from anon;
grant select, insert, update, delete on manna.notes to authenticated;
grant all on manna.notes to service_role;
