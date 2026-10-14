# CampusConnect — A Club Event Hub

**Live app:** https://campus-festive-desk.lovable.app · Built with [Lovable](https://lovable.dev/projects/c95875ab-d18f-42ce-ba36-a74f3c612a34)

## The problem

College clubs announce events through scattered WhatsApp groups, social media posts and posters. Students miss
events, and organisers can't predict attendance or manage registrations.

## The solution

CampusConnect is one place where students discover upcoming club events, register with their college details in
seconds and receive a QR entry pass. Authorised organisers create and manage events, see registrations, export them
and check students in at the door by scanning their passes.

## Features

**Students (no account needed)**

- Home page with categories, upcoming events and a "how registration works" guide
- Explore events: search by event or club name, category filter, clear filters, load more
- Event page with a live seat counter (refreshes every 15 s). Registration is blocked when the event is full, past
  its deadline, already started, cancelled or completed — enforced in the database, not just the UI
- Register with name, PRN and department. The same PRN can't register twice for an event, and simultaneous
  registrations can't overbook it (row lock + unique constraint)
- QR entry pass with print, download QR and copy-link buttons. Neither the pass nor the QR contains the PRN
- **My Passes** lists passes registered in this browser. Passes can be added back on any device by pasting the saved
  pass link. There is deliberately no lookup by PRN

**Organisers (sign-in required, organiser role required)**

- Dashboard: summary cards (events, upcoming, confirmed registrations, checked in, full events), capacity chart and a
  department breakdown computed in the database
- Create and edit events (`/admin/events/new`, `/admin/events/:id/edit`) with full validation
- Mark events completed or cancel them (with confirmation; both are final). Delete events that have no registrations
- Per-event registrations (`/admin/events/:id/registrations`): search by name/PRN, department and attendance filters,
  pagination, counts, and CSV export of the filtered rows
- QR verification and check-in (`/verify/:token`, `/admin/verify`). Each pass can only be checked in once, even if
  scanned on two phones at the same moment
- Team page (`/admin/team`) to grant or remove organiser access

## Technology stack

| Layer | What the project uses |
| --- | --- |
| Frontend | React 19, TanStack Start / TanStack Router (file-based routes in `src/routes`), TanStack Query |
| UI | Tailwind CSS 4, shadcn/ui (Radix), lucide-react icons, Recharts, sonner toasts, `qrcode.react` |
| Backend | Lovable Cloud (Supabase): PostgreSQL with Row Level Security, Supabase Auth (email + password), PostgREST |
| Server-side logic | PostgreSQL functions and triggers (`drizzle/migrations/*.sql`) |
| Hosting | Lovable (server-side rendering on Cloudflare Workers through Nitro) |
| Tooling | Vite 8, TypeScript, ESLint + Prettier, Vitest, drizzle-kit (for migrations) |

## Prerequisites

- Node.js 22+ and npm, **or** [Bun](https://bun.sh) (the repo has a `bun.lock`)
- Git
- A Supabase project: Lovable Cloud creates one automatically; you can also bring your own
- Optional, for the database tests: PostgreSQL 14+ client tools and a local PostgreSQL server

## 1. Get the code

```sh
git clone https://github.com/abdulrazzaque9008/campus-festive-desk.git
cd campus-festive-desk
```

(Or download the ZIP from GitHub and extract it.)

## 2. Install dependencies

```sh
bun install      # or: npm install
```

## 3. Environment variables

The Lovable-managed `.env` is committed. It contains only **public** values: the Supabase URL and its
*publishable* key are shipped to every browser by design, and Row Level Security protects the data. For your own
backend, copy the template and fill it in:

```sh
cp .env.example .env.local   # *.local files are git-ignored
```

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | Backend used by the browser |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` | Same values for server-side rendering |
| `VITE_PUBLIC_SITE_URL` | Public base URL encoded in QR passes (see section 9) |
| `LOVABLE_DB_MIGRATION_URL` | Only for `drizzle-kit migrate`: a Postgres connection string. **Never commit it** |

Never put the Supabase service-role / `sb_secret_…` key in this project. Nothing in the app needs it.

## 4. Database setup and migrations

The whole schema lives in ordered SQL migrations:

| File | Contents |
| --- | --- |
| `drizzle/migrations/0000_migration.sql` | Tables (`events`, `registrations`, `profiles`, `user_roles`, `app_settings`), RLS policies, seat counter trigger, `register_for_event`, `get_pass`, six sample events |
| `drizzle/migrations/0001_campusconnect_completion.sql` | Secure organiser bootstrap, event edit and lock rules, hashed pass tokens, attendance check-in, verification and dashboard functions, Team functions |

`0001` is **non-destructive and idempotent**: it keeps every event, registration and organiser and can be run more
than once. Existing passes keep working because their tokens are re-keyed to a SHA-256 hash in place.

**Apply the migration together with the code.** The new pages call functions that `0001` creates, so deploy the code
and the migration together. Pick one way:

- **Lovable Cloud:** after merging, check that the new functions exist (e.g. `check_in_pass`). If Lovable didn't
  apply the migration on its own, ask the Lovable agent to run `drizzle/migrations/0001_campusconnect_completion.sql`,
  or paste the file into the backend's SQL editor.
- **Your own Supabase project:** paste each file, in order, into *Dashboard → SQL Editor*. Or:

  ```sh
  LOVABLE_DB_MIGRATION_URL="postgresql://…" npx drizzle-kit migrate
  ```

  drizzle-kit records applied files in `drizzle.__drizzle_migrations` (journal: `drizzle/migrations/meta/_journal.json`).

## 5. Database security model

Row Level Security is on for every table, and the API roles have least-privilege grants:

| Data / action | Who | How it's enforced |
| --- | --- | --- |
| Browse events | everyone | `events` SELECT policy |
| Create / edit / cancel / complete events | organisers | RLS `has_role(auth.uid(),'organiser')` and the `events_guard` trigger (validation, deadline ≤ start, capacity ≥ confirmed, cancelled/completed events locked, counters read-only) |
| Delete events | organisers, only with no registrations | `events_delete_guard` trigger (prevents cascading deletes of registrations) |
| Register | everyone | `register_for_event()` only — `registrations` has no INSERT grant |
| Read registrations (incl. PRN) | organisers | RLS + column grants. Token hashes are never readable |
| Change registrations | organisers, `status` column only | column grant + `registrations_guard` (a cancelled registration can't be re-confirmed) |
| View own pass | holder of the secret token | `get_pass(token)`, no PRN returned |
| Verify a pass | everyone (minimal view) / organisers (full view) | `verify_pass(token)`: masked name for the public, no PRN for anyone |
| Check in | organisers | `check_in_pass(token)`, an atomic conditional UPDATE |
| Grant / remove organisers | organisers | `grant_organiser(email)` / `revoke_organiser(id)`. `user_roles` is read-only through the API |

Pass tokens are 192-bit random values. The database stores only their SHA-256 hash (`registrations.token_hash`),
so even someone with read access to the database can't recreate a pass.

## 6. Initial organiser setup (secure bootstrap)

New accounts get **no** organiser access. The old behaviour, where the very first sign-up became an organiser, has
been removed, so nobody can take over a fresh deployment by signing up first. Existing organisers keep their access.

To create the first organiser:

1. Open the app, go to **Organiser login → Create account**, register with the organiser's email and confirm it.
2. In the backend's SQL editor (Lovable Cloud backend, or *Supabase Dashboard → SQL Editor*), run:

   ```sql
   select public.bootstrap_organiser('organiser@your-college.edu');
   ```

   This function can only be called with database-owner / service-role rights, never from the website.
3. Sign in again. The **Admin Dashboard** is now available. Add further organisers from **Admin → Team**; they must
   create an account and confirm their email first.

## 7. Local development

```sh
bun run dev        # or: npm run dev   — Vite prints the URL (normally http://localhost:5173)
```

The dev server talks to the backend in your env file. The committed `.env` points at the **live** Lovable Cloud
database, so anything you create locally is real data.

## 8. Build, test and production

```sh
bun run build      # production build into .output/ (Cloudflare Worker + static assets)
bun run test       # Vitest unit + routing tests
bun run lint       # ESLint + Prettier check
npx tsc --noEmit   # type check
```

Note: `vite preview` does not work with this Cloudflare build output. To run the production build locally, use
Wrangler, the Cloudflare Workers runtime (`npx` downloads it; it isn't a project dependency):
`npx wrangler dev -c .output/server/wrangler.json`.

**Deploying (Lovable):** changes merged into the connected branch (`main`) sync to Lovable. Click **Publish** in the
Lovable editor to update https://campus-festive-desk.lovable.app. Apply the database migration as in section 4.
Lovable serves every route through server-side rendering, so refreshing a nested URL such as `/admin/team` or
`/verify/…` does not 404.

## 9. Public site URL for QR passes

Each QR code encodes `VITE_PUBLIC_SITE_URL + /verify/<token>`. Set `VITE_PUBLIC_SITE_URL` to the published URL (it
is set to `https://campus-festive-desk.lovable.app` in `.env`), so passes issued from a preview link or a laptop
still open the live site. If you move to a custom domain, update it and rebuild. Passes printed earlier keep working
as long as the old domain still reaches the app.

Passes issued before this version encoded `/admin/verify?token=…`. That URL now redirects to the public verification
page, so already-printed passes still scan correctly.

## 10. How to test

**Automated**

```sh
bun run test                                                   # 30 unit/routing tests
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres scripts/db-test/run.sh
```

`scripts/db-test/run.sh` creates a **throwaway** local database called `campusconnect_test`. Never point it at
production. It loads a tiny Supabase stand-in (`supabase-stub.sql`), applies the real migrations and runs about 80
assertions:

- permissions for anonymous users, students and organisers, plus organiser bootstrap
- event validation and lock rules
- registration rules
- pass privacy
- check-in, including a pass issued before the migration

It also runs concurrency tests:

- 20 simultaneous registrations for 5 seats
- 10 simultaneous registrations with the same PRN
- 10 simultaneous check-ins of one pass

**Manual walkthrough (on the live or a test backend)**

1. *Registration:* open an event and register (PRN like `2023IT1045`). You land on your pass, and the seat counter
   drops by one.
2. *Duplicate prevention:* register again with the same PRN, in any case or with spaces. You get "This PRN is already
   registered".
3. *Seat limit:* create an event with capacity 1, register once, then try again with another PRN. You get "Sorry,
   this event is full".
4. *Deadline / cancelled:* the button is disabled, and the database also rejects direct API calls.
5. *QR verification:* scan the pass with a phone camera. Visitors see "Valid Pass" with a masked name. Signed-in
   organisers see the full name and department and a **Check in attendee** button. Scanning again shows "Already
   Checked In". A random `/verify/abc…` shows "Invalid Pass".
6. *Registrations:* open **Registrations** for the event, search and filter, then **Export CSV**. Names starting with
   `=`, `+`, `-` or `@` are prefixed with `'` so spreadsheets don't run them.

## 11. Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Organiser access required" after signing in | The account has no organiser role. Run `bootstrap_organiser` (section 6) or ask an organiser to add you on the Team page |
| Verification page always says "Invalid Pass" / dashboard errors like `function … does not exist` | Migration `0001` hasn't been applied to this database (section 4) |
| `Missing Supabase environment variable(s)` | Env file missing or incomplete (section 3) |
| QR opens a preview / localhost URL | Set `VITE_PUBLIC_SITE_URL` and rebuild / republish |
| "That account hasn't confirmed its email address yet" when adding an organiser | They must click the confirmation email first |
| Can't edit an event | Cancelled and completed events are locked on purpose; create a new event instead |
| Can't lower capacity | Capacity can't go below the number of confirmed registrations |
| Can't delete an event | Events with registrations can only be cancelled, so student records are kept |
| `vite preview` returns 500 | Use Wrangler for the Cloudflare build (section 8) |
| PRN rejected | The format comes from `app_settings.prn_regex` (default `^[A-Za-z0-9]{6,16}$`); change it with SQL if your college uses another format |

## Project structure

```
drizzle/migrations/        SQL migrations (schema, RLS, functions) + drizzle journal
scripts/db-test/           Local database test suite (stub, tests, concurrency)
src/routes/                Pages (file-based routing)
  _authenticated/admin.*   Organiser pages (sign-in + organiser role)
  verify.$token.tsx        Public QR verification / staff check-in
  pass.$token.tsx          Student entry pass
src/components/            Event card, event form, entry pass, header, shadcn/ui
src/lib/                   Event helpers, validation, queries
src/integrations/supabase/ Generated Supabase client and types
```
