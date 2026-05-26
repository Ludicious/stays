# Stays

Stay tracker web app for the Noteworthy Nomads RV travel YouTube channel.

- **Frontend/API:** Next.js 15 App Router on Hostinger Node.js hosting
- **Database:** MySQL on Hostinger
- **Subdomain:** stays.noteworthynomads.com
- **Auto-deploy:** github.com/Ludicious/stays → Hostinger (main branch)

---

## Session 1: Database setup

### 1. Run the schema

Connect to the Hostinger MySQL database and run:

```bash
mysql -h MYSQL_HOST -u MYSQL_USER -p MYSQL_DATABASE < sql/01_schema.sql
```

Or paste the contents of `sql/01_schema.sql` into Hostinger's phpMyAdmin SQL tab.

### 2. Run the seed data

```bash
mysql -h MYSQL_HOST -u MYSQL_USER -p MYSQL_DATABASE < sql/02_seed.sql
```

This inserts all 50 US states + DC + 13 Canadian provinces/territories, and the 3 memberships.

### 3. Import the spreadsheet

Place `Nomad_Stay_Tracker.xlsx` in the project root (same level as `package.json`).

Create `.env.local` with your Hostinger credentials:

```
MYSQL_HOST=your-hostinger-mysql-host
MYSQL_USER=your-db-user
MYSQL_PASSWORD=your-db-password
MYSQL_DATABASE=your-db-name
MYSQL_PORT=3306
```

Install dependencies and run the import:

```bash
npm install
npm run import-xlsx
```

The script will:
- Print any warnings (rows with missing Stay Type — defaults to `Paid`)
- Insert all 132 stays
- Print verification counts grouped by status and stay_type
- Print the next 5 upcoming stays

### 4. Verify

After the import, confirm these in phpMyAdmin or a MySQL client:

```sql
-- Should be 132
SELECT COUNT(*) FROM stays;

-- Mostly 'Stayed' for past, mix of statuses for future
SELECT status, COUNT(*) FROM stays GROUP BY status;

-- Paid ~78, Boondocking ~24, Harvest Host ~17, Free ~11
SELECT stay_type, COUNT(*) FROM stays GROUP BY stay_type;

-- Your actual next 5 upcoming stays
SELECT * FROM stays WHERE departure >= CURDATE() ORDER BY arrival LIMIT 5;

-- Should be 63 (50 states + DC + 12 Canadian provinces/territories)
SELECT COUNT(*) FROM states;

-- Should be 3
SELECT COUNT(*) FROM memberships;
```

---

## Session 2: App code

Coming next — Next.js routes, UI, and the upcoming-stays view.
