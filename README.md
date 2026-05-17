# jouwtdl

jouwtdl is moving in careful phases from a purely local MVP toward a fully self-hosted multi-user product. The active login, signup, session, and profile runtime now use Auth.js credentials auth + Prisma on self-hosted PostgreSQL, while older Supabase schema assets remain in the repo as legacy migration/reference material for later persistence phases.

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Auth.js / NextAuth credentials auth
- Prisma + self-hosted PostgreSQL
- Local storage persistence for not-yet-migrated planning/task flows
- Modular services for planning, storage, transcription, profile persistence, and AI-style analysis

## Core Modules

- `Today`: daily focus, top tasks, progress snapshot, AI nudge, tomorrow preview
- `Planning`: a simple hub for day, week, and month planning
- `Dashboard`: progress, consistency, and completed vs open work
- `Journal`: section-based journal memos, voice transcription, AI save-time summaries, and journal-to-action conversion
- `Tips`: weekly insight cards, mood/productivity correlation, blocker detection, and life-area balance
- `Weekly Review`: completed work, incomplete work, journal recap, weekly state
- `Monthly Pattern Profile`: strongest patterns, blockers, productive conditions, life-area distribution

## Architecture

```text
app/                  Routes and page composition
components/           Reusable UI blocks and forms
data/                 Journal schema, default life areas, seed state
hooks/                App state and voice transcription hooks
lib/                  Date helpers, i18n, auth, Prisma client, and legacy Supabase helpers
providers/            Language, auth, app state, and journal voice providers
prisma/               Prisma schema foundation for the self-hosted PostgreSQL migration
prisma.config.ts      Prisma 7 datasource config for CLI commands
services/             Planning, storage, auth/profile persistence, and analysis logic
supabase/             Legacy SQL schema and RLS setup kept for later migration work
types/                Shared domain models and database types
```

## Database Migration Direction

- Auth.js credentials + Prisma now power the active auth and profile flow.
- Prisma-backed PostgreSQL is the active source of truth for login, signup, session, and profile setup.
- Legacy Supabase helpers remain in the codebase for later migration work, but auth no longer depends on Supabase.
- `/api/db-health` verifies that `DATABASE_URL` is reachable.

## Current Persistence Split

- `Auth` and `profile/setup` are now stored in PostgreSQL through Prisma.
- `Planning`, `tasks`, and `journal entry` state still keep their local-first fallback while the broader persistence migration continues.
- Local storage remains in place so the product stays stable while the rest of the data model is migrated later.

## Journal Setup Per User

The journal is no longer one fixed structure for everyone.

- Each user gets a `journal_preset` and `journal_config` on their `profiles` row.
- First login now routes the user through `/setup` until onboarding is completed.
- The user can choose a starting point such as `Trading`, `Business`, `Personal`, or `Custom`.
- The user can then rename sections, change helper copy, change placeholders, reorder sections, enable or disable sections, and decide whether the tomorrow block should be shown.
- The same editor is available later at `/settings/journal`, so the journal structure can keep evolving with the user.

The active journal UI now renders directly from that saved profile config rather than from one hardcoded trading template.

## Voice Transcription

Voice input now records audio in the browser with `MediaRecorder`, uploads the finished recording to `app/api/transcribe/route.ts`, and transcribes it with the OpenAI transcription API. This is more reliable for Dutch journaling and longer spoken reflections than browser-native speech recognition.

- Dutch is the default transcription language
- The user explicitly starts and stops recording
- Each journal section has a single voice entry point and one editable memo field
- The tomorrow setup includes one voice memo for `Focus for tomorrow` and one for `Top tasks`
- Recording startup is guarded by a short timeout, so the UI resets cleanly if recording never begins
- Transcript text is appended into the active journal field and remains editable
- Unsupported browsers still fall back cleanly to manual typing
- In development, voice checkpoints stay available in the browser console for debugging without leaking internal state into the UI
- The hook remains modular so a different transcription provider can replace OpenAI later

## Journal Summaries

When a journal entry is saved, the app first persists the raw section memos to the current app persistence layer and then calls `app/api/journal-summary/route.ts` to generate one combined AI summary for the full day.

- Raw journal content is saved even if summary generation fails
- The summary is stored alongside the journal entry in the current journal record
- The user can retry summary generation later from the journal UI
- The same `OPENAI_API_KEY` is used for transcription and journal summaries
- In development, the summary flow logs request building, API calls, raw model output, parsed summary text, and summary save results

## Authentication

The active auth flow now uses Auth.js credentials auth with Prisma-backed PostgreSQL:

- `login`
- `sign up`
- session persistence with cookies
- logout
- protected app routes
- profile hydration through `/api/profile`

Important for this Next.js version: route protection is implemented with `proxy.ts`, not `middleware.ts`, because the `middleware` file convention is deprecated in the current Next.js docs bundled in `node_modules/next/dist/docs/`.

## Languages

The app includes a simple app-wide language toggle in the shell:

- `Nederlands`
- `English`

Dutch is the default. The dictionaries live in `lib/i18n.ts`, and the current language state is managed in `providers/language-provider.tsx`.

## Mock AI Layer

The AI layer is intentionally deterministic for the MVP. It uses:

- keyword-based blocker detection
- tone and sentiment signals from journal text
- power-level and completion-rate correlation
- carry-over task analysis
- life-area balance summaries
- weekly and monthly pattern generation

The service lives in `services/analysis-service.ts` and is designed so a real LLM-backed service can replace or extend it later.

## Run Locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Environment

Create `.env.local` with:

```bash
DATABASE_URL="postgresql://jouwtdl_user:Wewillenverdienen3!@localhost:5432/jouwtdl"
AUTH_SECRET=your_auth_secret_here
NEXTAUTH_URL=https://jouwtdl.nl
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_SUMMARY_MODEL=gpt-5-mini # optional
```

You can start from `/Users/stanleyreddemann/Projecten/To-do-list-app/.env.example`.

No Supabase environment variables are required for the active login/signup/session/profile flow anymore. Without `OPENAI_API_KEY`, server transcription and AI journal summaries will return a configuration error.

### PostgreSQL + Prisma Setup

1. Make sure PostgreSQL is running and that the database in `DATABASE_URL` exists.
2. Copy `/Users/stanleyreddemann/Projecten/To-do-list-app/.env.example` to `.env.local` and fill in the values you want to use.
3. Run `npm install`.
4. Run `npx prisma generate`.
5. Apply the Prisma SQL migration for credentials auth if your database does not have `profiles.password_hash` yet.
6. Start the app with `npm run dev`.
7. Open [http://localhost:3000/api/db-health](http://localhost:3000/api/db-health) to verify Prisma can connect to PostgreSQL.

The auth-related migration added in this phase is:

- `/Users/stanleyreddemann/Projecten/To-do-list-app/prisma/migrations/20260517154500_add_profile_password_hash/migration.sql`

This adds `profiles.password_hash` and a unique email index for the credentials login flow.

Prisma 7 note:

- CLI connection config now lives in `/Users/stanleyreddemann/Projecten/To-do-list-app/prisma.config.ts`
- runtime database access uses a PostgreSQL driver adapter from `@prisma/adapter-pg`
- the app still imports Prisma through `/Users/stanleyreddemann/Projecten/To-do-list-app/lib/prisma.ts`

### Legacy Supabase Reference

The SQL files in `/Users/stanleyreddemann/Projecten/To-do-list-app/supabase/` are kept as reference and migration history for older persistence work. They are no longer required for the active login/signup/session/profile flow.

If you are still referencing an older Supabase-backed schema for migration history, you may also want to keep these align scripts nearby:

- `/Users/stanleyreddemann/Projecten/To-do-list-app/supabase/migrations/20260406_align_profiles_schema.sql`
- `/Users/stanleyreddemann/Projecten/To-do-list-app/supabase/migrations/20260406_align_journal_schema.sql`

For a fresh legacy Supabase reference environment, apply every SQL file in `/Users/stanleyreddemann/Projecten/To-do-list-app/supabase/migrations` in filename order after enabling email/password auth.

The profile migration adds `onboarding_completed`, `journal_preset`, and `journal_config` to `public.profiles` if they are missing, restores the profile trigger from `auth.users`, and refreshes the PostgREST schema cache with `notify pgrst, 'reload schema';`.

The journal migration aligns existing `journal_entries`, `journal_sections`, and `tomorrow_setups` tables with the current app contract, adds the required grants for authenticated users, restores the unique constraints used by `upsert`, and refreshes the PostgREST schema cache.

The SQL schema includes:

- `profiles`
- `journal_entries`
- `journal_sections`
- `tomorrow_setups`
- `updated_at` triggers
- profile auto-creation trigger from `auth.users`
- RLS policies so each user can only access their own rows

The `profiles` table now also stores:

- `onboarding_completed`
- `journal_preset`
- `journal_config`

## Build

```bash
npm run build
npm run start
```

## Notes

- The journal now renders from each user’s saved config. Trading remains the safe fallback preset for older profiles that do not have a `journal_config` yet.
- Existing journal entries remain readable even if a user later renames, disables, or reorders sections, because journal content is still stored generically as `section_key + content`.
- The UI is intentionally quiet and spacious rather than dashboard-heavy.
- Planning/task/dashboard persistence is intentionally still local-first for now while the broader PostgreSQL migration continues.
- Voice transcription is tested around Chrome-style `MediaRecorder` support first. If a browser cannot record audio reliably, the journal still supports normal typing.
