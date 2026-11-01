# RackTrack v1.0

Free inventory manager for network / IT engineers (switch, AP, router, firewall, server).
Next.js (App Router) · Tailwind · Auth.js v5 (Google) · Drizzle ORM · Neon Postgres · Vercel.

## Run locally — in this order

Run everything from the project folder.

```bash
# 1. install
npm install

# 2. env file (then open .env.local and fill every value)
cp .env.example .env.local
npx auth secret          # generates AUTH_SECRET into .env.local (or: openssl rand -base64 33)

# 3. create the tables in Neon
npm run db:push

# 4. load seed/devices.seed.json into the account of SEED_OWNER_EMAIL
npm run seed

# 5. start
npm run dev              # http://localhost:3000
```

Then sign in with **the same Google account** as `SEED_OWNER_EMAIL` and the 99 seed devices are there.

### Before step 3: one-time setup

1. **Neon**: create a project, copy the connection string into `DATABASE_URL`.
2. **Google OAuth**: Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* → Web application.
   Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://racktrack.online/api/auth/callback/google`

   Copy the client ID / secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.
3. **Seed**: set `SEED_OWNER_EMAIL` in `.env.local` to your Google email. `seed/devices.seed.json` is git-ignored on purpose (real customer names and serials). The seed refuses to run twice; use `npm run seed -- --append` to add on top.

## Deploy on Vercel — checklist

- [ ] Push the repo to GitHub and import it in Vercel (framework: Next.js, defaults are fine)
- [ ] Env var `DATABASE_URL`
- [ ] Env var `AUTH_SECRET` (use a different value from local if you like)
- [ ] Env var `AUTH_GOOGLE_ID`
- [ ] Env var `AUTH_GOOGLE_SECRET`
- [ ] Do **not** add `SEED_OWNER_EMAIL` (local only)
- [ ] Google Console: redirect URI `https://racktrack.online/api/auth/callback/google` is added
- [ ] Google Console: OAuth consent screen set to *In production* (otherwise only test users can log in)
- [ ] Vercel → Domains: add `racktrack.online`, then point DNS at Vercel from Hostinger (A / CNAME records Vercel shows)
- [ ] Run `npm run db:push` once against the production `DATABASE_URL` (same Neon DB as local unless you made a separate branch)

## How it works

- `src/lib/schema.ts` — Auth.js tables + `devices` + `device_history`.
- `src/app/app/actions.ts` — all writes. Every query filters by the session user's id; ids sent from the browser are never trusted on their own.
- 300-device limit is checked server-side in `createDevice` and `importDevices` (import is all-or-nothing and tells you how many slots are left).
- Status / location / customer changes write a row to `device_history` (no UI until v1.2).
- Groups (Wireless / Networking / Lainnya) are derived from category in `src/lib/categories.ts`.
- Sessions use the JWT strategy so the middleware can protect `/app` on the edge; the `session` table exists only because the adapter expects it.

## Known limits

- The 300 cap is check-then-insert, so two simultaneous requests from the same account could land a few devices over. Fine for v1.0; a DB-level guard can come later.
- Out of scope for v1.0: photos, map / POC pins, share links, QR codes, export, history UI.
