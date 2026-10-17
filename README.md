# Might — migraine tracker

**Mi**graine **T**racker. A mobile-first web app (installable PWA) for logging migraines and spotting patterns.

- `app/` — Vite + React + TypeScript frontend
- `supabase/` — local Supabase config and database migrations
- `assets/logo/` — logo files (`options/` holds the concepts that weren't picked)

## Run locally

Needs Docker Desktop running.

```sh
npx supabase start          # first run downloads images; prints URLs and keys
npx supabase status         # show them again later

cd app
cp .env.example .env.local  # paste the anon/publishable key into it
npm install
npm run dev -- --host       # --host lets you open it on your phone over Wi-Fi
```

- App: http://localhost:5180
- Supabase Studio (database UI): http://127.0.0.1:54323

Database changes go in `supabase/migrations/`. Apply them with `npx supabase db reset` (wipes local data) or `npx supabase migration up`.

## Google login

The app shows "Continue with Google" automatically once Google is enabled in Supabase.

1. [Google Cloud Console](https://console.cloud.google.com/) → create a project → **APIs & Services → OAuth consent screen**: External, add your email as a test user.
2. **Credentials → Create credentials → OAuth client ID → Web application**
   - Authorized JavaScript origins: `http://localhost:5180`
   - Authorized redirect URIs: `http://127.0.0.1:54321/auth/v1/callback`
3. `cp supabase/.env.example supabase/.env` and paste the client ID and secret.
4. In `supabase/config.toml`, set `enabled = true` under `[auth.external.google]`.
5. `npx supabase stop && npx supabase start`

When you deploy, add the production URLs to the same Google client (origin `https://your-app-domain`, redirect `https://your-supabase-domain/auth/v1/callback`) and set `site_url` accordingly. Google doesn't accept private IPs like `192.168.x.x`, so Google sign-in won't work when testing on your phone over Wi-Fi. Use email sign-in there.

## Testing on your phone

Run `npm run dev -- --host`, then open the "Network" URL Vite prints on a phone on the same Wi-Fi. Set `VITE_SUPABASE_URL` to your PC's LAN IP (e.g. `http://192.168.1.20:54321`) so the phone can reach the database.
