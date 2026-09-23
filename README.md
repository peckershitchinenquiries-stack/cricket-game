# CrickTap — Daily Cricket Quiz

A daily geography game: 5 cricket questions, one 3D globe. Tap where you think the answer is. The closer your pin, the more you score (100 · 100 · 200 · 300 · 300 = 1,000).

**Stack:** Next.js 15 (App Router) · React 19 · Tailwind CSS · react-globe.gl (three.js) · Supabase · Vercel · PWA

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

With no Supabase env vars, the app runs in **memory mode**: it uses the 30 seed questions, pre-schedules 30 days of rounds, and keeps scores in-process until restart. That's enough to play and to use `/admin` locally, where auth is skipped in dev.

## Connecting Supabase

1. Create a Supabase project.
2. Apply the migrations, either with `supabase db push` (after `supabase link`) or by pasting them into the SQL editor in order:
   - `supabase/migrations/001_initial.sql` creates the schema, RLS, stats functions and the round generator.
   - `supabase/migrations/002_seed.sql` adds the 30 questions and schedules rounds for the next 30 days.
3. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only, used by the API routes)
   - `ADMIN_EMAILS`: comma-separated emails allowed into `/admin`
   - `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_LAUNCH_DATE` (the date round #1 is played)
4. Create an admin user under Supabase → Authentication → Users → *Add user*, using an email listed in `ADMIN_EMAILS`.

## Deploying to Vercel

Import the repo, add the environment variables above, and deploy. No other config is needed. The service worker registers only in production builds.

## How it works

| Piece | Where |
|---|---|
| Scoring (Haversine, distance bands, colors) | `lib/scoring.ts` |
| Game state machine (aim → pin → confirm → reveal → next) | `hooks/useGameState.ts` |
| Globe (tap detection, pins, rings, arcs, camera) | `components/globe/GlobeCanvas.tsx` |
| Server game logic (rounds, scoring, final score) | `lib/server/game.ts` |
| Data layer (Supabase + in-memory) | `lib/server/repo.ts`, `supabase-repo.ts`, `memory-repo.ts` |
| Share card (Canvas → PNG → Web Share / clipboard) | `lib/share.ts`, `components/ShareCard.tsx` |
| Device ID, streaks, local play state | `lib/device-id.ts`, `lib/game-storage.ts` |

### Anti-cheat

- `/api/daily-questions` never includes coordinates. `/api/submit-answer` scores the guess on the server and only then returns the correct location.
- Answers are stored per device, date and question. **The first answer is final**: re-submitting returns the original result.
- `/api/submit-score` **ignores the client's totals** and recomputes the score from the stored answers. It rejects submissions until all 5 questions are answered.
- **RLS:** there are no anon/authenticated policies at all. This deliberately departs from the original spec's "public read questions" policy, which would have exposed `correct_lat`/`correct_lng` to anyone holding the anon key. All reads and writes go through the API routes using the service role.

### Rounds

- Rounds are keyed by UTC date.
- **Auto-picking:** chooses 5 active questions, avoids two answers within 300 km of each other (e.g. Lord's twice), prefers questions not used in the last 7 days, and orders them easy → hard so the heavier questions come last.
- **Missing rounds:** if an admin hasn't scheduled a date, one is generated automatically the first time it's requested.
- **Locking:** today's round can't be edited in the admin panel, because changing it would invalidate answers already in progress.

### Offline and errors

- The service worker caches the app shell and hashed JS chunks, including the globe and country borders.
- `/api/daily-questions` is network-first with a cache fallback.
- Pages fall back to `/offline`.
- If a score submission fails, it stays in localStorage and is retried on the next visit.

## Admin (`/admin`)

- **Questions:** search and filter; add or edit with a mini-globe location picker; activate or deactivate; delete (questions already used in a round are archived instead); bulk import from JSON or CSV.
- **Schedule:** month calendar; auto-fill the next 30 days; pick, re-roll or clear the round for a future date.
- **Stats:** plays today and this week, today's average, a 14-day plays chart, and the most-missed questions.

## Scripts

- `npm run generate:seed` rebuilds `002_seed.sql` from `data/seed-questions.json`.
- `npm run generate:icons` renders the PWA icons and `og-image.png` from `public/icon.svg`.
- `npm run lint` · `npm run typecheck` · `npm run build`

## Renaming the game

Change `APP_NAME` and related values in `lib/config.ts`, the wordmark in `components/Logo.tsx`, and `public/manifest.json`.

## Seed data corrections

Some seed facts from the original spec were fixed:

- **2007 T20 World Cup final:** played at the Wanderers in Johannesburg, not Durban.
- **Kane Williamson (Tauranga):** the coordinates pointed to Hamilton.
- **Bradman (Cootamundra), Lara (Santa Cruz) and Sangakkara (Matale):** the coordinates were 100+ km off.
- **2011 World Cup final:** now uses the Wankhede Stadium's exact coordinates.
