# CampusConnect — A Club Event Hub

A college event platform: students discover club events, register in seconds and get a QR entry pass; organisers
create events, manage registrations and check students in at the door. Originally built with
[Lovable](https://lovable.dev/projects/c95875ab-d18f-42ce-ba36-a74f3c612a34); the backend is **Supabase**
(PostgreSQL + Auth + Row Level Security) and it deploys to **Vercel** or Lovable.

## The problem

College clubs announce events through scattered WhatsApp groups, social media posts and posters. Students miss
events, and organisers can't predict attendance or manage registrations.

## Features

**Students (no account needed)**

- Home page with categories, upcoming events and a "how registration works" guide
- Explore events: search by event or club name, category filter, clear filters, load more
- Event page with a live seat counter (refreshes every 15 s). Registration is blocked when the event is full, past
  its deadline, already started, cancelled or completed — enforced in the database, not just the UI
- Register with name, PRN and department. The same PRN can't register twice for an event, and simultaneous
  registrations can't overbook it (row lock + unique constraint)
- QR entry pass with print, download and copy-link buttons. Neither the pass nor the QR code contains the PRN
- **My Passes** lists passes registered in this browser. A pass can be added on any device by pasting its saved
  link. There is deliberately no lookup by PRN

**Organisers (sign-in + organiser role)**

- **Dashboard** (`/admin`): summary cards, capacity chart and department breakdown for the events you manage, all
  computed from the database; a one-click "Remove sample events" action
- **Create / edit events** (`/admin/events/new`, `/admin/events/:id/edit`) with full validation; mark events
  completed or cancelled (with confirmation — both are final); delete events nobody registered for
- **Registrations** (`/admin/registrations` for all your events, `/admin/events/:id/registrations` for one): event,
  department and attendance filters, search by name or PRN, pagination, counts and CSV export of the filtered rows
- **Event organisers**: the creator of an event can add co-organisers to it (button on the registrations page)
- **QR verification & check-in** (`/verify/:token`, `/admin/verify`): each pass can be checked in once, even if two
  phones scan it at the same moment
- **Team** (`/admin/team`): grant or remove organiser access · **Profile** (`/admin/profile`): edit your name and
  see your events and statistics

## Technology stack

| Layer | What the project uses |
| --- | --- |
| Frontend | React 19, TanStack Start / TanStack Router (file-based routes in `src/routes`), TanStack Query |
| UI | Tailwind CSS 4, shadcn/ui (Radix), lucide-react icons, Recharts, sonner toasts, `qrcode.react` |
| Backend | Supabase: PostgreSQL with Row Level Security, Supabase Auth (email + password), PostgREST |
| Server-side logic | PostgreSQL functions and triggers in `drizzle/migrations/*.sql` |
| Hosting | Vercel (auto-detected Nitro `vercel` preset) or Lovable (Cloudflare Workers) |
| Tooling | Vite 8, TypeScript, ESLint + Prettier, Vitest, drizzle-kit |

---

# Setup guide (step by step)

You need: [Node.js 22+](https://nodejs.org) (or [Bun](https://bun.sh)), Git, a free
[Supabase](https://supabase.com) account and, to deploy, a free [Vercel](https://vercel.com) account.

## Step 1 — Get the code

```sh
git clone https://github.com/abdulrazzaque9008/campus-festive-desk.git
cd campus-festive-desk
npm install        # or: bun install
```

## Step 2 — Create (or pick) a Supabase project

1. Sign in at <https://supabase.com/dashboard> → **New project**. Choose a name (e.g. `campus_connect`), a strong
   database password (save it in a password manager) and a region close to your college.
2. Wait until the project says it is ready.

> Using Lovable Cloud instead? Lovable already created a Supabase project for you. Its values are in the
> committed `.env`; you manage its database through Lovable (Cloud panel or by asking the Lovable agent), not
> through your own Supabase account.

## Step 3 — Find your project URL and publishable key

In the Supabase dashboard of your project:

- **Project URL** — *Project Settings → Data API* (looks like `https://abcdefghijkl.supabase.co`). The part before
  `.supabase.co` is the **project ID / ref**.
- **Publishable key** — *Project Settings → API Keys*. Copy the **publishable** key (`sb_publishable_…`). The
  legacy **anon public** key also works.

⚠️ **Never** copy the `service_role` / `sb_secret_…` key into this project, Vercel or any `VITE_` variable. Nothing
in CampusConnect needs it.

## Step 4 — Configure local environment variables

```sh
cp .env.example .env.local      # .env.local is git-ignored
```

Fill in `.env.local`:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | your Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | your publishable (or anon) key |
| `VITE_SUPABASE_PROJECT_ID` | your project ref |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` | the same three values (used by server rendering) |
| `VITE_PUBLIC_SITE_URL` *(optional)* | the public site address put in QR codes, e.g. `https://your-app.vercel.app` |

Values in `.env.local` (and real environment variables, such as Vercel's) override the committed `.env`, which
holds the Lovable Cloud project's **public** values only.

> The key variable is called `VITE_SUPABASE_PUBLISHABLE_KEY` because the Lovable-generated Supabase client
> (`src/integrations/supabase/client.ts`) reads that name. Put your anon key in it if you use the legacy key.

## Step 5 — Create the database (apply the migrations)

The whole schema, security policies and server functions live in three SQL files. Apply them **once each, in
this order**:

| # | File | What it does |
| --- | --- | --- |
| 1 | `drizzle/migrations/0000_migration.sql` | Tables (`events`, `registrations`, `profiles`, `user_roles`, `app_settings`), RLS, seat counter, registration and pass functions, 6 sample events |
| 2 | `drizzle/migrations/0001_campusconnect_completion.sql` | Secure organiser bootstrap, event edit rules, hashed pass tokens, check-in, verification, dashboard functions |
| 3 | `drizzle/migrations/0002_event_staff_and_profiles.sql` | Per-event permissions and co-organisers, organiser profile & statistics |

**Easiest way (Supabase dashboard):** *SQL Editor → New query* → paste the whole content of file 1 → **Run**.
Repeat for files 2 and 3. Finally run:

```sql
notify pgrst, 'reload schema';
```

**Or from your computer:** get a connection string from *Connect → Connection string* and run

```sh
LOVABLE_DB_MIGRATION_URL="postgresql://…" npx drizzle-kit migrate
```

(drizzle-kit remembers what it applied in `drizzle.__drizzle_migrations`.)

Notes:

- `0001` and `0002` keep all existing data and are safe to re-run. **If you re-run an earlier file, re-run every
  later file after it** (later files replace some functions with stricter versions).
- `0000` creates the tables, so run it only on a new, empty project.
- **Lovable Cloud:** after merging, check that the function `can_manage_event` exists. If not, ask the Lovable agent
  to run `0001` (if `check_in_pass` is missing too) and `0002`.

## Step 6 — Configure organiser authentication

Students never sign in. Organisers use email + password (Supabase Auth). In the Supabase dashboard:

1. *Authentication → Sign In / Providers → Email*: keep **Email** enabled. Leave **Confirm email** on (recommended).
2. *Authentication → URL Configuration*:
   - **Site URL**: your deployed address, e.g. `https://your-app.vercel.app`
   - **Redirect URLs**: add `https://your-app.vercel.app/**` and, for local work, `http://localhost:5173/**`

   Without this, confirmation emails link to the wrong address.
3. Supabase's built-in email service is rate-limited (a few emails per hour) — fine for a college demo; configure
   custom SMTP under *Authentication → Emails* for heavier use.

## Step 7 — Grant the first organiser (securely)

New accounts get **no** organiser access, so nobody can take over a fresh site just by signing up first.

1. Open the site → **Organiser login → Create account**, register with your email and click the confirmation link.
2. In Supabase *SQL Editor*, run (with your email):

   ```sql
   select public.bootstrap_organiser('you@college.edu');
   ```

   This function can only be run from the SQL editor / service role — never from the website.
3. Sign out and sign in again: the **Admin Dashboard** now works.
4. Add more organisers from **Admin → Team** (they must create an account and confirm their email first). To let a
   colleague manage *your* event, open the event's **Registrations → Event organisers** and add them.

## Step 8 — Run locally

```sh
npm run dev          # or: bun run dev   — Vite prints the URL, normally http://localhost:5173
```

## Step 9 — Deploy on Vercel

1. Push the repository to GitHub, then in Vercel: **Add New → Project → Import** the repository. The framework
   preset can stay as detected; build command `npm run build` (default). No `vercel.json` is needed — the build
   detects Vercel and produces `.vercel/output` automatically.
2. Before deploying (or afterwards under *Settings → Environment Variables*), add these for **All Environments**:

   | Key | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://YOUR-PROJECT-REF.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | your publishable / anon key |
   | `VITE_SUPABASE_PROJECT_ID` | `YOUR-PROJECT-REF` |
   | `SUPABASE_URL` | same as `VITE_SUPABASE_URL` |
   | `SUPABASE_PUBLISHABLE_KEY` | same key |
   | `SUPABASE_PROJECT_ID` | same ref |
   | `VITE_PUBLIC_SITE_URL` | `https://your-app.vercel.app` (recommended; no trailing slash) |

3. `VITE_` variables are built into the site, so after adding or changing them: *Deployments → ⋯ → **Redeploy***.
4. Put the Vercel address in Supabase **Site URL / Redirect URLs** (Step 6).

If Vercel has **no** variables, the build falls back to the committed `.env`, i.e. the Lovable Cloud database.

**Lovable hosting instead:** merge into `main` (it syncs to Lovable), apply the migrations (Step 5) and click
**Publish** in Lovable.

## Step 10 — Test it

**Automated tests**

```sh
npm test                 # unit + routing tests (Vitest)
npm run lint             # ESLint + Prettier
npx tsc --noEmit         # type check
npm run build            # production build
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres scripts/db-test/run.sh   # database tests (local PostgreSQL)
```

`scripts/db-test/run.sh` creates a **throwaway local** database (`campusconnect_test` — never point it at
production), applies the real migrations on a small Supabase stand-in and runs about 110 checks: permissions for
visitors, students, organisers and co-organisers; event rules; registration rules; pass privacy; check-in; profile;
and concurrency (20 simultaneous registrations for 5 seats, 10 with the same PRN, 10 simultaneous check-ins).

**Manual checklist on your deployed site**

1. *Event creation:* Admin → Create event → save. Reload: it is on the home page, Explore and its detail page.
2. *Registration:* open the event, register (PRN like `2023IT1045`) → you land on your pass; seats drop by one.
3. *Duplicate:* register again with the same PRN (any case) → "This PRN is already registered".
4. *Seat limit:* create an event with capacity 1, register twice → "Sorry, this event is full".
5. *Deadline / cancelled:* the button is disabled and the database rejects direct API calls too.
6. *Persistence across devices:* open Admin → Registrations on another device — the registration is there.
7. *QR:* scan the pass with a phone camera → "Valid Pass" with a masked name. Signed in as the event's organiser
   you see full details and **Check in attendee**; scanning again shows "Already Checked In"; a made-up
   `/verify/abc…` shows "Invalid Pass".
8. *Permissions:* sign in with an account that isn't an organiser → "Organiser access required". A different
   organiser can't see your event's registrations until you add them under **Event organisers**.
9. *Profile:* Admin → Profile → change your name → reload — it stays.
10. *CSV:* Registrations → filter → **Export CSV**; names starting with `=`, `+`, `-` or `@` are prefixed with `'`
    so spreadsheets don't execute them.

---

# How security works

Row Level Security is enabled on every table; the website only ever uses the public (publishable/anon) key.

| Data / action | Who | Enforced by |
| --- | --- | --- |
| Browse events | everyone | `events` SELECT policy |
| Create events | organisers | RLS `has_role(auth.uid(),'organiser')`; the creator becomes the event's organiser |
| Edit / cancel / complete / delete an event | that event's organisers | RLS `can_manage_event(id)` + `events_guard` trigger (validation, deadline ≤ start, capacity ≥ confirmed, counters read-only, cancelled/completed events locked) + `events_delete_guard` (no deleting events with registrations) |
| Register | everyone | only via `register_for_event()` (row lock, unique `(event_id, prn)`); no direct INSERT grant |
| Read registrations (incl. PRN) | that event's organisers | RLS `can_manage_event(event_id)` + column grants (token hashes never readable) |
| Change a registration | that event's organisers, `status` only | column grant + `registrations_guard` (no re-confirming a cancelled registration) |
| View own pass | holder of the secret link | `get_pass(token)` — no PRN |
| Verify a pass | everyone (masked view) / event organisers (full view) | `verify_pass(token)` — never returns the PRN |
| Check in | that event's organisers | `check_in_pass(token)`: atomic conditional UPDATE, so a pass is used once |
| Grant / remove organisers | organisers (Team page) / SQL editor (first one) | `grant_organiser`, `revoke_organiser`, `bootstrap_organiser`; `user_roles` is read-only through the API |
| Add / remove event co-organisers | that event's organisers | `add_event_staff`, `remove_event_staff` (creator can't be removed) |
| Edit profile | the signed-in user, own row only | `update_my_profile()` uses `auth.uid()`; direct writes to `profiles` are revoked |

- Roles are read from the database (`user_roles`) on every request — never from browser storage or user metadata.
- Pass tokens are 192-bit random values; only their SHA-256 hash is stored.
- Events with no owner (the seeded samples) or whose organisers all lost access can be managed by any organiser, so
  nothing becomes unmanageable.

## Sample events

`0000` seeds six events marked **Sample** (badge on every page, `is_sample = true`). When your real events are
live, use **Dashboard → Remove sample events**: samples nobody registered for are deleted; any with registrations
are kept (cancel them instead).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `column registrations.checked_in_at does not exist`, "function … does not exist", verify page always "Invalid Pass" | The site's database is missing migrations — apply `0001` and `0002` (Step 5) to **the database the site uses** (check Vercel's `VITE_SUPABASE_URL`) |
| "Organiser access required" | Run `bootstrap_organiser` (Step 7) or ask an organiser to add you on the Team page |
| "You don't manage this event" | Ask the event's creator to add you under **Event organisers** |
| Confirmation email opens localhost / wrong site | Set Supabase **Site URL** and **Redirect URLs** (Step 6) |
| `Missing Supabase environment variable(s)` | Env variables missing (Step 4 / Step 9) |
| Vercel site still shows old data/backend after changing variables | Redeploy — `VITE_` variables are fixed at build time |
| QR opens the wrong site | Set `VITE_PUBLIC_SITE_URL` and redeploy |
| Can't edit / delete an event | Cancelled and completed events are locked; events with registrations can only be cancelled |
| PRN rejected | Format is `app_settings.prn_regex` (default `^[A-Za-z0-9]{6,16}$`); change it with SQL if needed |
| `vite preview` returns 500 | Expected for the Cloudflare build — use `npx wrangler dev -c .output/server/wrangler.json` |

## Project structure

```
drizzle/migrations/        SQL migrations (schema, RLS, functions) + drizzle journal
scripts/db-test/           Local database test suite (stub, tests, concurrency)
src/routes/                Pages (file-based routing)
  _authenticated/admin.*   Organiser pages (sign-in + organiser role)
  verify.$token.tsx        Public QR verification / staff check-in
  pass.$token.tsx          Student entry pass
src/components/            Event card & form, registrations view, entry pass, header, shadcn/ui
src/lib/                   Event helpers, validation, queries
src/integrations/supabase/ Generated Supabase client and types
```
