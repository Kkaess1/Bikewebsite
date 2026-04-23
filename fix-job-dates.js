const { initDb, getDb, saveDb } = require('./db/setup');

async function run() {
  await initDb();
  const db = getDb();

  // Find jobs where estimated_completion is earlier than the stored date.
  // These are past jobs that were entered with today's date by mistake.
  const candidates = db.exec(`
    SELECT id, date, estimated_completion
    FROM jobs
    WHERE estimated_completion IS NOT NULL
      AND estimated_completion != ''
      AND estimated_completion < date
  `);

  const rows = candidates[0]?.values || [];

  if (rows.length === 0) {
    console.log('No jobs need fixing.');
    return;
  }

  console.log(`Found ${rows.length} job(s) to fix:\n`);
  for (const [id, wrongDate, correctDate] of rows) {
    console.log(`  Job #${id}: ${wrongDate}  →  ${correctDate}`);
    db.run('UPDATE jobs SET date = ? WHERE id = ?', [correctDate, id]);
  }

  saveDb();
  console.log(`\nDone. ${rows.length} job(s) updated.`);
}

run().catch(err => { console.error('Failed:', err.message); process.exit(1); });
