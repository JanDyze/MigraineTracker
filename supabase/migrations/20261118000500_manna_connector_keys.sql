-- Manna: connector links, so Claude (or any MCP client) can read and add to one person's Manna through the
-- `manna-mcp` Edge Function. A link carries a secret key (mk_…); only its SHA-256 hash is kept here, so a key is
-- shown once, when it's made, and can be revoked any time from Settings → Claude.
create extension if not exists pgcrypto with schema extensions;

create table manna.connector_keys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label         text not null default 'Claude' check (length(trim(label)) between 1 and 40),
  key_hash      text not null unique,      -- sha256 hex of the key; the key itself is never stored
  key_hint      text not null,             -- its last 4 characters, to tell links apart
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

create index connector_keys_user_idx on manna.connector_keys (user_id, created_at desc);

-- People see their own links and may rename or revoke them; new ones only come from create_connector_key().
alter table manna.connector_keys enable row level security;
create policy "Owner reads" on manna.connector_keys for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owner updates" on manna.connector_keys for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on manna.connector_keys from anon, authenticated;
grant select (id, label, key_hint, created_at, last_used_at, revoked_at) on manna.connector_keys to authenticated;
grant update (label, revoked_at) on manna.connector_keys to authenticated;
grant all on manna.connector_keys to service_role;

-- Make a new link for the signed-in person. Returns the key; it can't be read back later.
create function manna.create_connector_key(p_label text default 'Claude') returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  k  text;
begin
  if me is null then
    raise exception 'manna: not signed in' using errcode = '42501';
  end if;
  if (select count(*) from manna.connector_keys where user_id = me and revoked_at is null) >= 5 then
    raise exception 'manna: you already have 5 connector links; revoke one first' using errcode = '54000';
  end if;
  k := 'mk_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into manna.connector_keys (user_id, label, key_hash, key_hint)
  values (me, coalesce(nullif(trim(p_label), ''), 'Claude'), encode(extensions.digest(k, 'sha256'), 'hex'), right(k, 4));
  return k;
end;
$$;

revoke all on function manna.create_connector_key(text) from public, anon;
grant execute on function manna.create_connector_key(text) to authenticated;

-- For the Edge Function only: whose key is this? Null when unknown or revoked. Notes the use (at most once a minute).
create function manna.connector_user(p_key text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  h   text := encode(extensions.digest(coalesce(p_key, ''), 'sha256'), 'hex');
  who uuid;
begin
  update manna.connector_keys
     set last_used_at = now()
   where key_hash = h and revoked_at is null
     and (last_used_at is null or last_used_at < now() - interval '1 minute');
  select user_id into who from manna.connector_keys where key_hash = h and revoked_at is null;
  return who;
end;
$$;

revoke all on function manna.connector_user(text) from public, anon, authenticated;
grant execute on function manna.connector_user(text) to service_role;
