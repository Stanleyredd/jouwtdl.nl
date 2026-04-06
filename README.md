# Clarity System

Clarity System is now moving from a purely local MVP toward a real user-based architecture. This phase adds Supabase authentication, a user-owned database schema, row-level security, and a first fully migrated journal flow, while the rest of the product can still keep using the existing local-first planning/task foundation during the transition.

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- Supabase Auth + Postgres + Row Level Security
- Local storage persistence for not-yet-migrated planning/task flows
- Modular services for planning, storage, transcription, Supabase journal persistence, and AI-style analysis

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
lib/                  Date helpers, i18n, auth, and Supabase clients
providers/            Language, auth, app state, and journal voice providers
services/             Planning, storage, Supabase journal persistence, and analysis logic
supabase/             SQL schema and RLS setup
types/                Shared domain models and database types
```

## Current Persistence Split

- `Journal` is now user-owned and persisted in Supabase.
- `Planning`, `tasks`, and the rest of the app still use the existing local-first workspace state for this migration phase.
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

When a journal entry is saved, the app first persists the raw section memos to Supabase and then calls `app/api/journal-summary/route.ts` to generate one combined AI summary for the full day.

- Raw journal content is saved even if summary generation fails
- The summary is stored alongside the journal entry in Supabase
- The user can retry summary generation later from the journal UI
- The same `OPENAI_API_KEY` is used for transcription and journal summaries
- In development, the summary flow logs request building, API calls, raw model output, parsed summary text, and summary save results

## Authentication

This phase adds basic Supabase email/password auth:

- `login`
- `sign up`
- session persistence
- logout
- protected app routes

Important for this Next.js version: route protection is implemented with `proxy.ts`, not `middleware.ts`, because the `middleware` file convention is deprecated in the current Next.js docs bundled in `node_modules/next/dist/docs/`.

## Supabase Journal Flow

The first fully migrated vertical slice is the journal:

- one journal entry per `user + date`
- per-section journal content stored separately
- tomorrow setup stored separately
- AI summary stored on the journal entry
- journal history reloads from Supabase for the logged-in user
- journal structure itself is stored per user on `profiles.journal_config`

The key persistence pieces are:

- `/Users/stanleyreddemann/Projecten/To-do-list-app/lib/supabase/client.ts`
- `/Users/stanleyreddemann/Projecten/To-do-list-app/lib/supabase/server.ts`
- `/Users/stanleyreddemann/Projecten/To-do-list-app/lib/supabase/proxy.ts`
- `/Users/stanleyreddemann/Projecten/To-do-list-app/services/journal-persistence-service.ts`
- `/Users/stanleyreddemann/Projecten/To-do-list-app/supabase/schema.sql`

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
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_or_publishable_key
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_SUMMARY_MODEL=gpt-5-mini # optional
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is the expected public client key for this repo. If your Supabase project already uses the newer publishable key naming, you can also set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; the app supports that as a fallback.

Without Supabase configuration, the auth flow will show a setup warning and the app falls back to the older local-only behavior where possible. Without `OPENAI_API_KEY`, server transcription and AI journal summaries will return a configuration error.

### Supabase Setup

1. Create a Supabase project.
2. Copy the SQL from `/Users/stanleyreddemann/Projecten/To-do-list-app/supabase/schema.sql` into the Supabase SQL editor and run it.
3. In Supabase Auth, enable email/password sign-in.
4. Add the project URL and public key to `.env.local`.
5. Run `npm run dev` and create an account at `/signup`.

If your Supabase project already existed before the per-user journal setup fields were added, also run:

- `/Users/stanleyreddemann/Projecten/To-do-list-app/supabase/migrations/20260406_align_profiles_schema.sql`
- `/Users/stanleyreddemann/Projecten/To-do-list-app/supabase/migrations/20260406_align_journal_schema.sql`

For a fresh Supabase project, apply every SQL file in `/Users/stanleyreddemann/Projecten/To-do-list-app/supabase/migrations` in filename order after enabling email/password auth.

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
- This migration phase uses Supabase only for authentication and journals. Planning/task/dashboard persistence is intentionally still local-first for now.
- Voice transcription is tested around Chrome-style `MediaRecorder` support first. If a browser cannot record audio reliably, the journal still supports normal typing.
