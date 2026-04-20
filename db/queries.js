const { getDb, saveDb } = require('./setup');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function all(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  const result = get('SELECT last_insert_rowid() as id');
  return result ? result.id : null;
}

// ─── Customers ────────────────────────────────────────────────────────────────

function searchCustomers(query) {
  if (!query) {
    return all('SELECT id, name, phone, email, carrier FROM customers ORDER BY name');
  }
  return all(
    'SELECT id, name, phone, email, carrier FROM customers WHERE name LIKE ? ORDER BY name LIMIT 50',
    [`%${query}%`]
  );
}

function createCustomer(name, phone, email, carrier) {
  const id = run(
    'INSERT INTO customers (name, phone, email, carrier) VALUES (?, ?, ?, ?)',
    [name, phone || '', email || '', carrier || '']
  );
  saveDb();
  return { id, name, phone: phone || '', email: email || '', carrier: carrier || '' };
}

function updateCustomer(id, name, phone, email, carrier) {
  run(
    'UPDATE customers SET name = ?, phone = ?, email = ?, carrier = ? WHERE id = ?',
    [name, phone || '', email || '', carrier || '', id]
  );
  saveDb();
}

function deleteCustomer(id) {
  const db = getDb();
  db.run('BEGIN TRANSACTION');
  try {
    const jobs = all('SELECT id FROM jobs WHERE customer_id = ?', [id]);
    for (const job of jobs) {
      db.run('DELETE FROM job_parts WHERE job_id = ?', [job.id]);
      db.run('DELETE FROM job_other WHERE job_id = ?', [job.id]);
      db.run('DELETE FROM job_services WHERE job_id = ?', [job.id]);
      db.run('DELETE FROM job_charge_other WHERE job_id = ?', [job.id]);
      db.run('DELETE FROM job_reminders WHERE job_id = ?', [job.id]);
    }
    db.run('DELETE FROM jobs WHERE customer_id = ?', [id]);
    db.run('DELETE FROM customers WHERE id = ?', [id]);
    db.run('COMMIT');
    saveDb();
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}

function getCustomerById(id) {
  const customer = get(
    'SELECT id, name, phone, email, carrier, created_at FROM customers WHERE id = ?',
    [id]
  );
  if (!customer) return null;

  const jobs = all(
    `SELECT j.id, j.date, j.notes, j.customer_cost, j.estimated_completion, j.bike_id,
            b.name AS bike_name
     FROM jobs j
     LEFT JOIN bikes b ON b.id = j.bike_id
     WHERE j.customer_id = ?
     ORDER BY j.date DESC`,
    [id]
  );

  let total_revenue = 0;
  let total_expenses = 0;

  const jobsDetail = jobs.map(job => {
    const parts = all('SELECT description, price FROM job_parts WHERE job_id = ?', [job.id]);
    const otherRows = all('SELECT description, price FROM job_other WHERE job_id = ?', [job.id]);
    const servicesRows = all('SELECT description, price FROM job_services WHERE job_id = ?', [job.id]);
    const chargeOtherRows = all('SELECT description, price FROM job_charge_other WHERE job_id = ?', [job.id]);

    const parts_total = parts.reduce((s, p) => s + (p.price || 0), 0);
    const other_total = otherRows.reduce((s, o) => s + (o.price || 0), 0);
    const services_total = servicesRows.reduce((s, sv) => s + (sv.price || 0), 0);
    const charge_other_total = chargeOtherRows.reduce((s, co) => s + (co.price || 0), 0);
    const expenses = parts_total + other_total;
    const profit = (job.customer_cost || 0) - expenses;

    total_revenue += job.customer_cost || 0;
    total_expenses += expenses;

    return {
      id: job.id,
      date: job.date,
      notes: job.notes,
      estimated_completion: job.estimated_completion,
      bike_name: job.bike_name || null,
      parts,
      other: otherRows,
      services: servicesRows,
      charge_other: chargeOtherRows,
      parts_total: round2(parts_total),
      other_total: round2(other_total),
      services_total: round2(services_total),
      charge_other_total: round2(charge_other_total),
      total_expenses: round2(expenses),
      customer_cost: round2(job.customer_cost || 0),
      profit: round2(profit),
    };
  });

  return {
    ...customer,
    jobs: jobsDetail,
    summary: {
      job_count: jobs.length,
      total_revenue: round2(total_revenue),
      total_expenses: round2(total_expenses),
      total_profit: round2(total_revenue - total_expenses),
    },
  };
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

function createJob({ customer_id, notes, customer_cost, estimated_completion, parts, other, services, charge_other, bike_id, job_date }) {
  const db = getDb();

  db.run('BEGIN TRANSACTION');
  try {
    const jobId = run(
      job_date
        ? 'INSERT INTO jobs (customer_id, notes, customer_cost, estimated_completion, bike_id, date) VALUES (?, ?, ?, ?, ?, ?)'
        : 'INSERT INTO jobs (customer_id, notes, customer_cost, estimated_completion, bike_id) VALUES (?, ?, ?, ?, ?)',
      job_date
        ? [customer_id, notes || '', customer_cost || 0, estimated_completion || '', bike_id || null, job_date]
        : [customer_id, notes || '', customer_cost || 0, estimated_completion || '', bike_id || null]
    );

    for (const p of (parts || [])) {
      if (p.description && p.description.trim()) {
        db.run('INSERT INTO job_parts (job_id, part_id, description, price) VALUES (?, ?, ?, ?)', [
          jobId, p.part_id || null, p.description.trim(), parseFloat(p.price) || 0,
        ]);
      }
    }

    for (const o of (other || [])) {
      if (o.description && o.description.trim()) {
        db.run('INSERT INTO job_other (job_id, description, price) VALUES (?, ?, ?)', [
          jobId, o.description.trim(), parseFloat(o.price) || 0,
        ]);
      }
    }

    for (const sv of (services || [])) {
      if (sv.description && sv.description.trim()) {
        db.run('INSERT INTO job_services (job_id, description, price) VALUES (?, ?, ?)', [
          jobId, sv.description.trim(), parseFloat(sv.price) || 0,
        ]);
      }
    }

    for (const co of (charge_other || [])) {
      if (co.description && co.description.trim()) {
        db.run('INSERT INTO job_charge_other (job_id, description, price) VALUES (?, ?, ?)', [
          jobId, co.description.trim(), parseFloat(co.price) || 0,
        ]);
      }
    }

    db.run('COMMIT');
    saveDb();
    return jobId;
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}

function getJobById(id) {
  const job = get(
    `SELECT j.id, j.date, j.notes, j.customer_cost, j.estimated_completion, j.customer_id, j.bike_id,
            b.name AS bike_name
     FROM jobs j
     LEFT JOIN bikes b ON b.id = j.bike_id
     WHERE j.id = ?`,
    [id]
  );
  if (!job) return null;
  const parts        = all('SELECT part_id, description, price FROM job_parts WHERE job_id = ?', [id]);
  const other        = all('SELECT description, price FROM job_other WHERE job_id = ?', [id]);
  const services     = all('SELECT description, price FROM job_services WHERE job_id = ?', [id]);
  const charge_other = all('SELECT description, price FROM job_charge_other WHERE job_id = ?', [id]);
  return { ...job, parts, other, services, charge_other };
}

function updateJob(id, { customer_id, notes, customer_cost, estimated_completion, parts, other, services, charge_other, bike_id }) {
  const db = getDb();
  db.run('BEGIN TRANSACTION');
  try {
    db.run(
      'UPDATE jobs SET customer_id=?, notes=?, customer_cost=?, estimated_completion=?, bike_id=? WHERE id=?',
      [customer_id, notes || '', customer_cost || 0, estimated_completion || '', bike_id || null, id]
    );
    db.run('DELETE FROM job_parts WHERE job_id=?', [id]);
    db.run('DELETE FROM job_other WHERE job_id=?', [id]);
    db.run('DELETE FROM job_services WHERE job_id=?', [id]);
    db.run('DELETE FROM job_charge_other WHERE job_id=?', [id]);

    for (const p of (parts || [])) {
      if (p.description?.trim()) {
        db.run('INSERT INTO job_parts (job_id, part_id, description, price) VALUES (?, ?, ?, ?)',
          [id, p.part_id || null, p.description.trim(), parseFloat(p.price) || 0]);
      }
    }
    for (const o of (other || [])) {
      if (o.description?.trim()) {
        db.run('INSERT INTO job_other (job_id, description, price) VALUES (?, ?, ?)',
          [id, o.description.trim(), parseFloat(o.price) || 0]);
      }
    }
    for (const sv of (services || [])) {
      if (sv.description?.trim()) {
        db.run('INSERT INTO job_services (job_id, description, price) VALUES (?, ?, ?)',
          [id, sv.description.trim(), parseFloat(sv.price) || 0]);
      }
    }
    for (const co of (charge_other || [])) {
      if (co.description?.trim()) {
        db.run('INSERT INTO job_charge_other (job_id, description, price) VALUES (?, ?, ?)',
          [id, co.description.trim(), parseFloat(co.price) || 0]);
      }
    }
    db.run('COMMIT');
    saveDb();
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}

// ─── Parts Catalog ────────────────────────────────────────────────────────────

function getAllParts() {
  return all('SELECT id, name, note, follow_up_value, follow_up_unit FROM parts ORDER BY name COLLATE NOCASE');
}

function getPartById(id) {
  return get('SELECT id, name, note, follow_up_value, follow_up_unit FROM parts WHERE id = ?', [id]);
}

function createPart({ name, note, follow_up_value, follow_up_unit }) {
  const id = run(
    'INSERT INTO parts (name, note, follow_up_value, follow_up_unit) VALUES (?, ?, ?, ?)',
    [name.trim(), note || '', follow_up_value || null, follow_up_unit || null]
  );
  saveDb();
  return getPartById(id);
}

function updatePart(id, { name, note, follow_up_value, follow_up_unit }) {
  run(
    'UPDATE parts SET name = ?, note = ?, follow_up_value = ?, follow_up_unit = ? WHERE id = ?',
    [name.trim(), note || '', follow_up_value || null, follow_up_unit || null, id]
  );
  saveDb();
}

function deletePart(id) {
  run('DELETE FROM parts WHERE id = ?', [id]);
  saveDb();
}

// ─── Bikes Catalog ────────────────────────────────────────────────────────────

function getAllBikes() {
  return all('SELECT id, name, description FROM bikes ORDER BY name COLLATE NOCASE');
}

function getBikeById(id) {
  return get('SELECT id, name, description FROM bikes WHERE id = ?', [id]);
}

function createBike({ name, description }) {
  const id = run(
    'INSERT INTO bikes (name, description) VALUES (?, ?)',
    [name.trim(), description || '']
  );
  saveDb();
  return get('SELECT id, name, description FROM bikes WHERE id = ?', [id]);
}

function updateBike(id, { name, description }) {
  run(
    'UPDATE bikes SET name = ?, description = ? WHERE id = ?',
    [name.trim(), description || '', id]
  );
  saveDb();
}

function deleteBike(id) {
  run('DELETE FROM bikes WHERE id = ?', [id]);
  saveDb();
}

// ─── Job Reminders ────────────────────────────────────────────────────────────

function createReminder({ job_id, customer_id, part_name, send_at, cust_message, shop_message }) {
  const id = run(
    'INSERT INTO job_reminders (job_id, customer_id, part_name, send_at, cust_message, shop_message) VALUES (?, ?, ?, ?, ?, ?)',
    [job_id, customer_id, part_name, send_at, cust_message || '', shop_message || '']
  );
  saveDb();
  return id;
}

function getDueReminders() {
  return all(
    `SELECT r.*, c.name AS customer_name, c.phone, c.email, c.carrier
     FROM job_reminders r
     JOIN customers c ON c.id = r.customer_id
     WHERE r.sent = 0 AND r.send_at <= datetime('now')`,
    []
  );
}

function markReminderSent(id) {
  run('UPDATE job_reminders SET sent = 1 WHERE id = ?', [id]);
  saveDb();
}

// ─── Reports ──────────────────────────────────────────────────────────────────

function getReport(from, to) {
  const jobs = all(
    `SELECT j.id, j.date, j.notes, j.customer_cost, j.bike_id,
            c.name AS customer_name, b.name AS bike_name
     FROM jobs j
     JOIN customers c ON c.id = j.customer_id
     LEFT JOIN bikes b ON b.id = j.bike_id
     WHERE j.date >= ? AND j.date <= ?
     ORDER BY j.date DESC`,
    [from, to]
  );

  const result = [];

  for (const job of jobs) {
    const parts = all('SELECT description, price FROM job_parts WHERE job_id = ?', [job.id]);
    const otherRows = all('SELECT description, price FROM job_other WHERE job_id = ?', [job.id]);
    const servicesRows = all('SELECT description, price FROM job_services WHERE job_id = ?', [job.id]);
    const chargeOtherRows = all('SELECT description, price FROM job_charge_other WHERE job_id = ?', [job.id]);

    const parts_total = parts.reduce((s, p) => s + (p.price || 0), 0);
    const other_total = otherRows.reduce((s, o) => s + (o.price || 0), 0);
    const services_total = servicesRows.reduce((s, sv) => s + (sv.price || 0), 0);
    const charge_other_total = chargeOtherRows.reduce((s, co) => s + (co.price || 0), 0);
    const total_expenses = parts_total + other_total;
    const profit = (job.customer_cost || 0) - total_expenses;

    result.push({
      id: job.id,
      date: job.date,
      customer_name: job.customer_name,
      bike_name: job.bike_name || null,
      notes: job.notes,
      parts,
      other: otherRows,
      services: servicesRows,
      charge_other: chargeOtherRows,
      parts_total: round2(parts_total),
      other_total: round2(other_total),
      services_total: round2(services_total),
      charge_other_total: round2(charge_other_total),
      total_expenses: round2(total_expenses),
      customer_cost: round2(job.customer_cost || 0),
      profit: round2(profit),
    });
  }

  // Parts usage stats for the period
  const partsUsage = all(
    `SELECT jp.description AS part_name, COUNT(*) AS times_used, SUM(jp.price) AS total_spent
     FROM job_parts jp
     JOIN jobs j ON j.id = jp.job_id
     WHERE j.date >= ? AND j.date <= ? AND jp.description != ''
     GROUP BY jp.description
     ORDER BY times_used DESC, total_spent DESC`,
    [from, to]
  );

  const summary = {
    job_count: result.length,
    parts_total: round2(result.reduce((s, j) => s + j.parts_total, 0)),
    other_total: round2(result.reduce((s, j) => s + j.other_total, 0)),
    services_total: round2(result.reduce((s, j) => s + j.services_total, 0)),
    charge_other_total: round2(result.reduce((s, j) => s + j.charge_other_total, 0)),
    total_expenses: round2(result.reduce((s, j) => s + j.total_expenses, 0)),
    total_revenue: round2(result.reduce((s, j) => s + j.customer_cost, 0)),
    total_profit: round2(result.reduce((s, j) => s + j.profit, 0)),
  };

  return { jobs: result, summary, parts_usage: partsUsage };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function getSetting(key) {
  const row = get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

function setSetting(key, value) {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
  saveDb();
}

module.exports = {
  searchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerById,
  createJob,
  getJobById,
  updateJob,
  getAllParts,
  getPartById,
  createPart,
  updatePart,
  deletePart,
  getAllBikes,
  getBikeById,
  createBike,
  updateBike,
  deleteBike,
  createReminder,
  getDueReminders,
  markReminderSent,
  getReport,
  getSetting,
  setSetting,
};
