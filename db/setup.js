const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'bikes.db');

let db = null;

async function initDb() {
  const SQL = await initSqlJs();

  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON;');

  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL COLLATE NOCASE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS jobs (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id   INTEGER NOT NULL REFERENCES customers(id),
      date          TEXT NOT NULL DEFAULT (date('now')),
      notes         TEXT,
      customer_cost REAL NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS job_parts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      part_id     INTEGER REFERENCES parts(id),
      description TEXT NOT NULL,
      price       REAL NOT NULL DEFAULT 0
    )
  `);

  db.run(`DROP TABLE IF EXISTS job_labor`);

  db.run(`
    CREATE TABLE IF NOT EXISTS job_other (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      price       REAL NOT NULL DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS job_services (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      price       REAL NOT NULL DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS job_charge_other (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      price       REAL NOT NULL DEFAULT 0
    )
  `);

  // Parts catalog
  db.run(`
    CREATE TABLE IF NOT EXISTS parts (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT NOT NULL,
      note             TEXT NOT NULL DEFAULT '',
      follow_up_value  INTEGER,
      follow_up_unit   TEXT
    )
  `);

  // Bikes catalog
  db.run(`
    CREATE TABLE IF NOT EXISTS bikes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT ''
    )
  `);

  // Scheduled follow-up reminders
  db.run(`
    CREATE TABLE IF NOT EXISTS job_reminders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id      INTEGER NOT NULL REFERENCES jobs(id),
      customer_id INTEGER NOT NULL,
      part_name   TEXT NOT NULL,
      send_at     TEXT NOT NULL,
      sent        INTEGER NOT NULL DEFAULT 0,
      cust_message  TEXT NOT NULL DEFAULT '',
      shop_message  TEXT NOT NULL DEFAULT ''
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_jobs_date ON jobs(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_reminders_send ON job_reminders(send_at, sent)`);

  // Settings table + column migrations
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    )
  `);

  const migrations = [
    "ALTER TABLE customers ADD COLUMN phone TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE customers ADD COLUMN email TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE customers ADD COLUMN carrier TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE jobs ADD COLUMN estimated_completion TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE jobs ADD COLUMN bike_id INTEGER",
    "ALTER TABLE job_parts ADD COLUMN part_id INTEGER",
    "ALTER TABLE jobs ADD COLUMN tip REAL NOT NULL DEFAULT 0",
  ];
  for (const sql of migrations) {
    try { db.run(sql); } catch (_) { /* column already exists */ }
  }

  saveDb();
  console.log('Database initialized at', DB_PATH);
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function getDb() {
  return db;
}

module.exports = { initDb, saveDb, getDb };
