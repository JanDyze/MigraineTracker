-- Might shares one Supabase project (DyzeProj) with the owner's other apps, so each app keeps its
-- tables in its own schema: Might's live in `might`. Logins (auth.users) are shared across apps.
-- The schema must also be listed under the API's exposed schemas (config.toml locally, the
-- dashboard's Data API settings in the cloud) for the app to reach it.
create schema if not exists might;
grant usage on schema might to authenticated, service_role;

-- Moving keeps the data, indexes, trigger, RLS policies and grants.
alter table public.attacks set schema might;
alter function public.touch_updated_at() set schema might;

grant all on might.attacks to service_role;
