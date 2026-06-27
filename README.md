# Stays

Internal web app for tracking RV campground reservations and history for the Noteworthy Nomads YouTube channel.

**Live:** https://stays.noteworthynomads.com

---

## What it does

- Tracks upcoming campground reservations with cab-of-the-truck access — gate codes, addresses, check-in info, balances owed
- Replaces an Excel spreadsheet that lived on a NAS that was offline on travel days
- Quick-add form with Google Places Autocomplete for fast entry on mobile
- Full inline editing on the stay detail page — every field editable without a separate edit screen
- Sortable history of every stay since 2024 (132+ rows and growing)

---

## Stack

- Next.js 15 (App Router), Node 22.x
- Hostinger Node.js hosting — not Vercel; see Gotchas below
- MySQL on Hostinger
- Google Places Autocomplete via `use-places-autocomplete`
- GitHub auto-deploy: push to `main` → Hostinger rebuilds in 1–2 minutes

---

## Environment variables

Set these in the Hostinger Node.js panel before deploy. They must exist at build time or the app will fail to start. Restart the app after any changes.

| Variable | Required | Description |
|---|---|---|
| `MYSQL_HOST` | Yes | Hostinger MySQL hostname |
| `MYSQL_USER` | Yes | Database user |
| `MYSQL_PASSWORD` | Yes | Database password |
| `MYSQL_DATABASE` | Yes | Database name |
| `MYSQL_PORT` | Yes | MySQL port (usually 3306) |
| `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` | Yes | Google Places API key, restricted to `*.noteworthynomads.com` |
| `INSTANCE_NAME` | No | Short label for non-default deployments (e.g. `AR`). Shows `[AR]` prefix in page titles and a muted footer badge. Leave unset on the primary instance. |

Do not rely on `.env.local` for production — Hostinger reads from its own environment panel, not from files in the repo.

---

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in your values
npm run dev
```

Open http://localhost:3000. The root redirects to `/upcoming`.

---

## Database setup

For first-time setup or a full rebuild, run the SQL files in order against your Hostinger MySQL database via phpMyAdmin or a MySQL client:

| File | Purpose |
|---|---|
| `sql/01_schema.sql` | Creates the `stays`, `states`, and `memberships` tables |
| `sql/02_seed.sql` | Inserts 50 US states + DC + 13 Canadian provinces/territories, and 3 memberships |
| `sql/03_migration_places.sql` | Adds `lat`, `lng`, `place_id` columns (added in Session 2) |
| `scripts/import-xlsx.ts` | One-time import from `Nomad_Stay_Tracker.xlsx`; already run, included for reference |

To re-run the spreadsheet import locally:

```bash
npm run import-xlsx
```

The script truncates `stays` before inserting, so it is safe to run more than once.

---

## Spinning up a second instance

Both instances build from the same `main` branch. The only thing that differentiates them is environment variables. No forking, no branching.

### Steps

**1. Create the Hostinger website**

In Hostinger's panel, create a new Node.js website. Point it at the same GitHub repo (`Ludicious/stays`) and the same branch (`main`). Hostinger will auto-deploy on every push to `main` exactly like the primary instance.

**2. Create a new MySQL database and user**

In Hostinger's Databases section, create a new database and a dedicated user with full privileges on that database. Note the hostname, username, password, and database name — you'll need them in step 3.

**3. Set environment variables before first deploy**

In the Hostinger Node.js panel for the new website, set all of the following before triggering any deploy. Missing vars at build time will cause the app to fail to start.

| Variable | Value |
|---|---|
| `MYSQL_HOST` | New database hostname |
| `MYSQL_USER` | New database user |
| `MYSQL_PASSWORD` | New database password |
| `MYSQL_DATABASE` | New database name |
| `MYSQL_PORT` | `3306` |
| `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` | Same key as primary (already restricted to `*.noteworthynomads.com`) |
| `INSTANCE_NAME` | Short label, e.g. `AR` |

Restart the app after setting vars. Deploy only after vars are confirmed.

**4. Run migrations against the new database**

The new database needs the same schema and seed data as the primary. Run the SQL files in order via phpMyAdmin or a MySQL client pointed at the new database:

```
TODO: exact migration command TBD — mechanism (phpMyAdmin / mysql CLI / Hostinger terminal) not yet decided
```

Files to run, in order:

| File | Purpose |
|---|---|
| `sql/01_schema.sql` | Tables: `stays`, `states`, `memberships` |
| `sql/02_seed.sql` | Seed data for `states` and `memberships` |
| `sql/03_migration_places.sql` | Adds `lat`, `lng`, `place_id` to `stays` |

**Verify after seeding:** `states` should have 63 rows (50 US states + DC + 12 Canadian provinces/territories), `memberships` should have 3 rows.

**5. Connect the subdomain**

In Hostinger DNS, add a CNAME record pointing the new subdomain (e.g. `stays-ar.noteworthynomads.com`) to the new website. SSL will provision automatically.

**6. Verify the instance badge**

Load the new subdomain. You should see:
- `[AR]` prefix in the browser tab title
- A small muted `AR` footer badge at the bottom of every page

If the badge is missing, check that `INSTANCE_NAME` is set in the Hostinger panel and that the app has been restarted since the var was added.

---

## Hostinger gotchas

These bit us during Slate-web development and apply here too.

- **No edge runtime.** Do not set `runtime = 'edge'` anywhere. Hostinger runs Node only.
- **Env vars must be set before first deploy.** If they are missing at build time, the app fails to start with a confusing error. Set them in the Hostinger Node.js panel, then restart the app after any change.
- **Standard scripts only.** Hostinger expects `npm run build` followed by `npm start`. Do not use `next export` or any static export mode.
- **Long-running API routes.** Routes that take more than a few seconds need streaming Route Handlers, not standard `NextResponse.json()`. No slow routes in this project currently — keep an eye on it if adding LLM calls or slow integrations.
- **`maxDuration` goes on page files,** not Server Actions.

---

## Routes

| Route | Description |
|---|---|
| `/` | Redirects to `/upcoming` |
| `/upcoming` | Primary view — current stay hero card plus next 5 upcoming |
| `/quick-add` | Mobile-first 3-field entry form |
| `/stays` | Sortable history table of all stays |
| `/stays/[id]` | Single stay detail page with full inline editing |
| `/api/stays` (GET, POST) | List all stays or create a new one |
| `/api/stays/[id]` (GET, PATCH, DELETE) | Read, update, or delete a single stay |

---

## Schema summary

Three tables. See `sql/01_schema.sql` for full column definitions.

| Table | Purpose |
|---|---|
| `stays` | One row per campground stay — the primary table |
| `memberships` | Thousand Trails, KOA Rewards, Good Sam — kept for future ROI calculations |
| `states` | US states and Canadian provinces lookup, used to normalize the `state` column |

`stays.nights` and `stays.balance_due` are MySQL generated columns (computed from `arrival`/`departure` and `total_charged`/`deposit_paid` respectively) — do not write to them directly.

---

## Build history

Built in three sessions in May 2026 using Claude (Opus for architecture and planning, Sonnet for execution). Session 1 established the schema and data import pipeline. Session 2 built the core app — upcoming view, quick-add form, Google Places integration, and the live Hostinger deployment. Session 3 added full inline editing, the history table, delete, and this documentation. Session prompts are archived in `/prompts/` (gitignored).

---

## Future enhancements

Not commitments — just notes for future sessions.

- Public landing page with by-state map and travel infographics
- Reporting dashboard (spend trends, nights by type, membership ROI)
- Slate read-API integration so Stays is the source of truth for episode location data
- Push notifications for upcoming arrivals
