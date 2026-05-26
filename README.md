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

| Variable | Description |
|---|---|
| `MYSQL_HOST` | Hostinger MySQL hostname |
| `MYSQL_USER` | Database user |
| `MYSQL_PASSWORD` | Database password |
| `MYSQL_DATABASE` | Database name |
| `MYSQL_PORT` | MySQL port (usually 3306) |
| `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` | Google Places API key, restricted to `*.noteworthynomads.com` |

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
