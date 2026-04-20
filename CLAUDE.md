# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

```bash
npm start          # starts the server on http://localhost:3000
```

Double-click `start.bat` for a one-click launch on Windows. Default password: `bikeshop123`.

There are no build steps, linters, or tests. Changes to server-side files require restarting the Node process. Frontend changes (HTML/CSS/JS in `public/`) take effect on browser refresh.

## Architecture

**Stack:** Node.js + Express server, sql.js (in-memory SQLite), vanilla JS frontend — no frameworks, no bundler.

**Why sql.js instead of better-sqlite3:** The machine has no Visual Studio Build Tools, so native Node addons can't compile. sql.js is a pure-JS WebAssembly SQLite port that works without compilation. The database is loaded into memory on startup from `data/bikes.db`, and `saveDb()` must be called after every write to flush it back to disk.

**Request flow:**
1. All page routes serve static HTML from `public/`
2. All data routes are under `/api/` and protected by `requireAuth` middleware
3. Frontend JS calls `/api/` endpoints; `public/js/auth-guard.js` intercepts any 401 and redirects to `/login`
4. Sessions are in-memory (`express-session` default) — they clear on server restart, requiring re-login

**Auth:**
- Single shared password (no user accounts)
- Password hash stored in the `settings` table; falls back to `FALLBACK_HASH` (bikeshop123) until changed via the Settings page
- `requireAuth` checks `req.originalUrl` (not `req.path`) to distinguish API vs page requests — this distinction is critical

**Database layer (`db/`):**
- `setup.js` — initializes tables, runs column migrations in a try/catch loop (safe to re-run), exports `getDb()` / `saveDb()` / `initDb()`
- `queries.js` — all SQL lives here; `all()`, `get()`, `run()` are thin wrappers around sql.js's statement API

**Job data model:**
- A `jobs` row holds `customer_cost` (auto-calculated server-side) and `estimated_completion`
- Line items split across four child tables: `job_parts`, `job_other`, `job_services`, `job_charge_other`
- **Expenses** = `job_parts` + `job_other` totals only
- **Customer cost** = `job_services` + `job_charge_other` totals (computed in `routes/jobs.js` before insert, never entered manually)
- **Profit** = customer_cost − expenses

**SMS notifications:**
- Free, via email-to-SMS carrier gateways (nodemailer → Gmail SMTP)
- Configured in Settings page (gmail_user, gmail_app_password stored in `settings` table)
- Sending is wrapped in its own try/catch in `routes/jobs.js` so SMS failure never blocks the job save response
- Message includes: services, labor, parts, total cost, estimated completion

**Frontend pages** (`public/`):
- `index.html` / `customers.html` — customer list and detail view
- `job.html` — new job form
- `report.html` — date-range and quarterly reports with print support
- `settings.html` — password change, Gmail/SMS config
- Each page has a matching `public/js/<page>.js`; shared auth guard is `public/js/auth-guard.js`

## Key Gotchas

- After any write in `queries.js`, `saveDb()` must be called or the change is lost on restart
- `req.path` inside a router is relative (always `/`); use `req.originalUrl` to check full paths
- sql.js's `run()` does not return affected rows; last insert ID is retrieved via `SELECT last_insert_rowid()`
- Foreign keys are enabled via `PRAGMA foreign_keys = ON` but `deleteCustomer` manually cascades deletes because sql.js's FK cascade support can be unreliable
