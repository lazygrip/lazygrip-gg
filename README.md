# LazyGrip.gg

Community GRIP-EMS sequences for World of Warcraft.

## Tech stack

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Styling**: CSS variables + Tailwind utilities
- **Hosting**: Vercel (free tier)
- **Domain**: lazygrip.gg

---

## Setup from scratch

### 1. Create your Supabase project

1. Go to https://supabase.com and create a free account
2. Create a new project — name it "lazygrip"
3. Wait for it to provision (~2 minutes)
4. Go to **Settings > API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Run the database schema

1. In Supabase, go to **SQL Editor**
2. Paste the contents of `supabase/migrations/001_initial_schema.sql`
3. Click **Run**

### 3. Set up environment variables

```bash
cp .env.example .env.local
# Edit .env.local and fill in your Supabase URL and anon key
```

### 4. Install and run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to https://vercel.com and import the repo
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy — Vercel auto-detects Next.js

### Add your domain

1. Buy `lazygrip.gg` at Namecheap or Cloudflare (~$15/year for .gg)
2. In Vercel: **Settings > Domains** → add `lazygrip.gg`
3. Update DNS at your registrar with Vercel's records

---

## Enable Battle.net login (optional)

1. Go to https://develop.battle.net and create an app
2. Set redirect URI to: `https://lazygrip.gg/auth/callback`
3. In Supabase: **Authentication > Providers > Battle.net**
4. Enter your Client ID and Secret

---

## Project structure

```
src/
  app/
    page.tsx              # Homepage
    browse/page.tsx       # Browse with filters
    sequence/[slug]/      # Sequence detail page
    post/page.tsx         # Post a sequence form
    auth/
      login/page.tsx
      signup/page.tsx
      callback/route.ts   # OAuth handler
  components/
    layout/
      Header.tsx
      Footer.tsx
    sequence/
      SequenceCard.tsx    # Card used in browse listing
    auth/
      AuthForm.tsx
  lib/
    supabase/
      client.ts           # Browser client
      server.ts           # Server client
    sequences.ts          # Data fetching functions
    wow-data.ts           # WoW class/spec constants
  types/
    index.ts              # TypeScript types

supabase/
  migrations/
    001_initial_schema.sql  # Full database schema
```

---

## Adding features later

The database is already set up for:
- ✅ User accounts (email + Battle.net)
- ✅ Sequence posting with full metadata
- ✅ Star ratings (1–10)
- ✅ Comments with replies
- ✅ Saves/bookmarks
- ✅ Version history per sequence
- ✅ View count tracking
- ✅ Featured sequences

Next features to build:
- [ ] User profile pages
- [ ] Admin panel (feature sequences, moderate comments)
- [ ] Email notifications on comments
- [ ] Wago.io-style P2P sharing integration
- [ ] GRIP string validator/parser
- [ ] Sequence version history display
