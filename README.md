# LazyGrip.gg

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/lazygrip/lazygrip-gg/blob/main/LICENSE)

Community GRIP-EMS sequences for World of Warcraft. Live at [lazygrip.net](https://lazygrip.net).

## Tech stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + React 19
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Styling**: CSS variables + Tailwind utilities
- **Testing**: Vitest, run in CI ahead of the build step
- **Hosting**: Vercel
- **Domain**: lazygrip.net

---

## Setup from scratch

### 1. Create your Supabase project

1. Go to https://supabase.com and create a free account
2. Create a new project
3. Wait for it to provision (~2 minutes)
4. Go to **Settings > API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2. Run the database schema

The schema lives across `supabase/migrations/`, numbered in order (29 migrations as of this writing, `001_initial_schema.sql` through the latest). Run them against your project in order, either by pasting each into the Supabase SQL Editor or with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

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

### 5. Run the checks CI runs

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

---

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to https://vercel.com and import the repo
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `DISCORD_BOT_TOKEN` (optional) - renames and retags an existing Discord forum thread when a published sequence changes. Needs `MANAGE_THREADS` in the guild holding the sequence forum. Leaving it unset skips that sync and changes nothing else.
4. Deploy — Vercel auto-detects Next.js

`main` is a protected branch: it takes a pull request, not direct pushes, and paths under `.github/`, `supabase/`, `src/lib/supabase/`, `vercel.json`, and `next.config.js` require a code owner review (see `.github/CODEOWNERS`).

---

## Enable Battle.net login (optional)

1. Go to https://develop.battle.net and create an app
2. Set redirect URI to: `https://<your-domain>/auth/callback`
3. In Supabase: **Authentication > Providers > Battle.net**
4. Enter your Client ID and Secret

---

## Project structure

This is the shape of the app today, not the original scaffold:

```
src/
  app/
    page.tsx                 # Homepage
    browse/                  # Browse with filters, [slug] for saved filter views
    sequences/[slug]/        # Sequence detail page, /update for the version-history flow
    post/                    # Post a sequence form
    workshop/                # In-browser GRIP builder: build, convert, decode
    guide/                   # Multi-page written guide (installation, how it works, features, validating, …)
    creators/, user/[username]/  # Creator directory and public profile pages
    changelog/, faq/, about/, privacy/, tos/, welcome/
    auth/                    # login, signup, callback, reset-password, confirm
    notifications/
    api/                     # server routes backing the Workshop, comments, sequences, and Discord sync
  components/
    layout/, sequence/, browse/, auth/, editor/, guide/, ui/
  lib/
    supabase/                # client.ts, server.ts, admin.ts, public.ts
    workshop/                # GRIP/GSE/EMS encode-decode, spell catalog, converter, talent/keypress extraction
    data/                    # spell-catalog.json, CrossClassSpellCatalog.lua
    wow-data.ts              # WoW class/spec constants

supabase/
  migrations/                # 001_initial_schema.sql onward, applied in order

scripts/
  generate-spell-catalog-json.js     # regenerates spell-catalog.json from the .lua source
  generate-guide-search-index.js     # builds the guide's search index (run after `next build`)

.github/
  workflows/
    ci.yml                    # lint, typecheck, test, build on every push/PR to main
    update-grip-version.yml   # daily check against Wago for a new GRIP-EMS release, opens and auto-merges a version-bump PR
  CODEOWNERS
```

---

## What's built

- User accounts (email + Battle.net)
- Sequence posting with full metadata, version history, and private/draft status
- Star ratings, comments with replies, saves/bookmarks, view and copy counts
- In-browser Workshop: build, convert between GRIP/GSE formats, and decode existing strings
- A multi-page written guide with a search index
- Creator directory and public creator profile/dashboard pages
- Discord bridge: comment relay and thread sync on publish
- Daily automated tracking of the GRIP-EMS addon's own version, surfaced site-wide
- GA4 event tracking (publish, save, copy, comment, signup) and JSON-LD structured data for SEO
- CI on every push and pull request (lint, typecheck, Vitest, build), plus a CODEOWNERS gate on migrations, auth code, and CI/deploy config

## Open items

- Broader moderation tooling
- `/browse` and `/browse/[slug]` are still fully dynamic and are the largest active CPU cost (tracked in [#24](https://github.com/lazygrip/lazygrip-gg/issues/24))
- Wago.io-style P2P sharing integration

## License

MIT — see [LICENSE](./LICENSE).
