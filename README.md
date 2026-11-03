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

## Deploy (free)

The database goes on **Supabase Cloud's free plan**, and the app on **Cloudflare Pages**, which is also free. Pages serves the files over HTTPS, and the PWA needs HTTPS to install.

### 1. Supabase Cloud

1. Sign up at [supabase.com](https://supabase.com) → **New project**. Pick the region closest to you and save the database password somewhere safe.
2. Push the tables and security rules from `supabase/migrations/`:
   ```sh
   npx supabase login
   npx supabase link --project-ref <project-ref>   # the id in your project's dashboard URL
   npx supabase db push
   ```
3. **Authentication → URL Configuration**: set *Site URL* to your app's address (e.g. `https://might.pages.dev`, which you'll get in step 2 below) and add it under *Redirect URLs*.
4. **Authentication → Sign In / Providers → Email**: "Confirm email" is on by default in the cloud (it's off locally). The built-in mailer only sends a few emails an hour, which is fine for personal use. Turn confirmation off if you'd rather skip it.
5. Google login (optional): enable Google under *Providers* and paste the same client ID and secret. In Google Cloud Console, add the origin `https://might.pages.dev` and the redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`.
6. Click **Connect** (or *Project Settings → API*) and copy the **Project URL** and the **anon / publishable key**.

Free plan limits: 2 active projects, 500 MB database, and a project **pauses after 7 days with no activity**. Your data is kept, and you restore it from the dashboard. Backups are a paid feature, so export your data now and then.

### 2. Cloudflare Pages

1. Commit and push to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick this repo. (If it offers a Worker first, look for the *Pages* option.)
3. Build settings:
   - Framework preset: **None** (or *React (Vite)*)
   - Root directory: `app`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (from step 1.6) and `NODE_VERSION` = `22`
4. **Save and Deploy**. Every push to `master` redeploys.

Pages already sends every route to `index.html`. `app/public/_headers` keeps `sw.js` from being cached and caches the hashed files forever.

### 3. Install it on your phone

Open the site, then **Android (Chrome)**: menu → *Install app*. **iPhone (Safari)**: Share → *Add to Home Screen*.

After the first visit the app opens offline, but logging still needs a connection, because entries are saved straight to Supabase.
To check the PWA before deploying: `npm run build && npm run preview`, then open DevTools → *Application* → *Manifest* / *Service workers*.
