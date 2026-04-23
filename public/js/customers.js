// ─── Logout ───────────────────────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});

// ─── HTML escape helper ───────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let allCustomers = [];
let currentCustomerId = null;

// ─── Load & Render List ───────────────────────────────────────────────────────
async function loadCustomers() {
  try {
    const res = await fetch('/api/customers?q=');
    allCustomers = await res.json();
    renderList(allCustomers);
  } catch {
    document.getElementById('customer-list').innerHTML =
      '<p style="color:#c00;font-size:0.88rem;">Failed to load customers.</p>';
  }
}

function renderList(customers) {
  const el = document.getElementById('customer-list');
  if (customers.length === 0) {
    el.innerHTML = '<p class="no-results">No customers yet.</p>';
    return;
  }
  el.innerHTML = customers.map(c => `
    <div class="customer-list-row" data-id="${c.id}">
      <div class="customer-list-name">${escapeHtml(c.name)}</div>
      <div class="customer-list-contact">${escapeHtml(c.phone || '')}${c.phone && c.email ? ' &bull; ' : ''}${escapeHtml(c.email || '')}</div>
    </div>
  `).join('');

  el.querySelectorAll('.customer-list-row').forEach(row => {
    row.addEventListener('click', () => openCustomer(parseInt(row.dataset.id)));
  });
}

// ─── Search Filter ────────────────────────────────────────────────────────────
document.getElementById('search-input').addEventListener('input', function () {
  const q = this.value.toLowerCase();
  const filtered = q ? allCustomers.filter(c => c.name.toLowerCase().includes(q)) : allCustomers;
  renderList(filtered);
});

// ─── Open Customer Detail ─────────────────────────────────────────────────────
async function openCustomer(id) {
  currentCustomerId = id;
  try {
    const res = await fetch(`/api/customers/${id}`);
    const customer = await res.json();
    if (!res.ok) return;
    renderDetail(customer);
    document.getElementById('detail-panel').style.display = '';
    document.getElementById('detail-panel').scrollIntoView({ behavior: 'smooth' });
  } catch {
    alert('Failed to load customer details.');
  }
}

document.getElementById('close-detail-btn').addEventListener('click', () => {
  document.getElementById('detail-panel').style.display = 'none';
  currentCustomerId = null;
});

const CARRIER_LABELS = {
  att: 'AT&T', verizon: 'Verizon', tmobile: 'T-Mobile',
  boost: 'Boost Mobile', cricket: 'Cricket', metro: 'Metro by T-Mobile',
  uscellular: 'US Cellular',
};

function renderDetail(customer) {
  document.getElementById('detail-name').textContent = customer.name;
  document.getElementById('detail-phone').textContent = customer.phone || '—';
  document.getElementById('detail-email').textContent = customer.email || '—';
  document.getElementById('detail-carrier').textContent = CARRIER_LABELS[customer.carrier] || '—';

  // Pre-fill edit form
  document.getElementById('edit-name').value = customer.name;
  document.getElementById('edit-phone').value = customer.phone || '';
  document.getElementById('edit-email').value = customer.email || '';
  document.getElementById('edit-carrier').value = customer.carrier || '';

  // Close edit form if open
  document.getElementById('contact-edit').style.display = 'none';
  document.getElementById('contact-view').style.display = '';

  // Summary (collapsible, closed by default)
  const s = customer.summary;
  const summaryEl = document.getElementById('customer-summary');
  summaryEl.classList.remove('open');
  const toggleEl = document.getElementById('summary-toggle');
  toggleEl.classList.remove('open');
  summaryEl.innerHTML = `
    <div style="padding-top:14px;">
      <div class="totals-grid">
        <div class="total-box">
          <label>Total Jobs</label>
          <div class="amount">${s.job_count}</div>
        </div>
        <div class="total-box">
          <label>Total Expenses</label>
          <div class="amount">$${s.total_expenses.toFixed(2)}</div>
        </div>
        <div class="total-box highlight">
          <label>Total Revenue</label>
          <div class="amount">$${s.total_revenue.toFixed(2)}</div>
        </div>
        <div class="total-box ${s.total_profit >= 0 ? 'profit-positive' : 'profit-negative'}">
          <label>Total Profit</label>
          <div class="amount">$${s.total_profit.toFixed(2)}</div>
        </div>
      </div>
    </div>
  `;

  // Job history
  const histEl = document.getElementById('job-history');
  if (customer.jobs.length === 0) {
    histEl.innerHTML = '<p class="no-results">No jobs on record.</p>';
    return;
  }

  histEl.innerHTML = customer.jobs.map((job, i) => {
    const detailId = `jd-${i}`;
    const partsHtml       = (job.parts || []).map(p => `<li>${escapeHtml(p.description)}: $${p.price.toFixed(2)}</li>`).join('');
    const otherHtml       = (job.other || []).map(o => `<li>${escapeHtml(o.description)}: $${o.price.toFixed(2)}</li>`).join('');
    const servicesHtml    = (job.services || []).map(s => `<li>${escapeHtml(s.description)}: $${s.price.toFixed(2)}</li>`).join('');
    const chargeOtherHtml = (job.charge_other || []).map(co => `<li>${escapeHtml(co.description)}: $${co.price.toFixed(2)}</li>`).join('');
    const hasDetail = (job.parts || []).length || (job.other || []).length
      || (job.services || []).length || (job.charge_other || []).length || job.notes;
    const profitClass = job.profit >= 0 ? 'profit-pos' : 'profit-neg';

    const amountsId = `ja-${i}`;
    return `
      <div class="job-history-row">
        <div class="job-history-header">
          <span class="job-history-date">${job.date}</span>
          ${job.bike_name ? `<span style="font-size:0.82rem;color:#6B7A8D;">${escapeHtml(job.bike_name)}</span>` : ''}
          <span style="margin-left:auto;display:flex;gap:10px;align-items:center;">
            <button class="btn btn-secondary" style="font-size:0.75rem;padding:3px 10px;" onclick="window.location.href='/job.html?edit=${job.id}'">Edit</button>
            <button class="btn btn-secondary" style="font-size:0.75rem;padding:3px 10px;" onclick="printInvoice(${job.id})">Print</button>
            <button class="btn btn-secondary" style="font-size:0.75rem;padding:3px 10px;" onclick="resendInvoice(${job.id}, this)">Resend</button>
            <span class="detail-toggle" onclick="toggleAmounts('${amountsId}')">&#9660; amounts</span>
            ${hasDetail ? `<span class="detail-toggle" onclick="toggleJobDetail('${detailId}')">&#9660; details</span>` : ''}
          </span>
        </div>
        <div class="job-detail" id="${amountsId}">
          <span class="job-history-amounts">
            Charged: <strong>$${job.customer_cost.toFixed(2)}</strong>
            ${job.tip > 0 ? `&nbsp;&nbsp;Tip: <strong style="color:#1a7a1a;">$${job.tip.toFixed(2)}</strong>` : ''}
            &nbsp;&nbsp;Profit: <strong class="${profitClass}">$${job.profit.toFixed(2)}</strong>
          </span>
        </div>
        ${job.notes ? `<div style="font-size:0.82rem;color:#555;margin-top:2px;">${escapeHtml(job.notes)}</div>` : ''}
        ${job.estimated_completion ? `<div style="font-size:0.82rem;color:#555;">Completion Date: ${escapeHtml(job.estimated_completion)}</div>` : ''}
        <div class="job-detail" id="${detailId}">
          ${(job.services || []).length ? `<strong style="font-size:0.78rem;">Services</strong><ul>${servicesHtml}</ul>` : ''}
          ${(job.charge_other || []).length ? `<strong style="font-size:0.78rem;">Other Charges</strong><ul>${chargeOtherHtml}</ul>` : ''}
          ${(job.parts || []).length ? `<strong style="font-size:0.78rem;">Parts</strong><ul>${partsHtml}</ul>` : ''}
          ${(job.other || []).length ? `<strong style="font-size:0.78rem;">Other (Expenses)</strong><ul>${otherHtml}</ul>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function toggleJobDetail(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

function toggleAmounts(id) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

// ─── Summary Toggle ───────────────────────────────────────────────────────────
document.getElementById('summary-toggle').addEventListener('click', () => {
  const body = document.getElementById('customer-summary');
  const toggle = document.getElementById('summary-toggle');
  body.classList.toggle('open');
  toggle.classList.toggle('open');
});

// ─── Edit Contact Info ────────────────────────────────────────────────────────
document.getElementById('edit-contact-btn').addEventListener('click', () => {
  document.getElementById('contact-view').style.display = 'none';
  document.getElementById('contact-edit').style.display = '';
  document.getElementById('edit-name').focus();
});

document.getElementById('cancel-edit-btn').addEventListener('click', () => {
  document.getElementById('contact-edit').style.display = 'none';
  document.getElementById('contact-view').style.display = '';
  document.getElementById('edit-error').style.display = 'none';
});

document.getElementById('save-contact-btn').addEventListener('click', async () => {
  const errorEl = document.getElementById('edit-error');
  errorEl.style.display = 'none';

  const name = document.getElementById('edit-name').value.trim();
  const phone = document.getElementById('edit-phone').value.trim();
  const email = document.getElementById('edit-email').value.trim();
  const carrier = document.getElementById('edit-carrier').value;

  if (!name) {
    errorEl.textContent = 'Name is required.';
    errorEl.style.display = '';
    return;
  }

  try {
    const res = await fetch(`/api/customers/${currentCustomerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, carrier }),
    });
    if (!res.ok) {
      const d = await res.json();
      errorEl.textContent = d.error || 'Failed to save.';
      errorEl.style.display = '';
      return;
    }
    // Update local list
    const idx = allCustomers.findIndex(c => c.id === currentCustomerId);
    if (idx !== -1) { allCustomers[idx] = { ...allCustomers[idx], name, phone, email, carrier }; }
    renderList(allCustomers);

    // Reload detail
    document.getElementById('detail-name').textContent = name;
    document.getElementById('detail-phone').textContent = phone || '—';
    document.getElementById('detail-email').textContent = email || '—';
    document.getElementById('detail-carrier').textContent = CARRIER_LABELS[carrier] || '—';
    document.getElementById('contact-edit').style.display = 'none';
    document.getElementById('contact-view').style.display = '';
  } catch {
    errorEl.textContent = 'Connection error.';
    errorEl.style.display = '';
  }
});

// ─── Delete Customer ──────────────────────────────────────────────────────────
const deleteModal = document.getElementById('delete-modal');

document.getElementById('delete-customer-btn').addEventListener('click', () => {
  const name = document.getElementById('detail-name').textContent;
  document.getElementById('modal-customer-name').textContent = name;
  deleteModal.style.display = 'flex';
});

document.getElementById('cancel-delete-btn').addEventListener('click', () => {
  deleteModal.style.display = 'none';
});

// Close modal if clicking the dark backdrop
deleteModal.addEventListener('click', (e) => {
  if (e.target === deleteModal) deleteModal.style.display = 'none';
});

document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
  const btn = document.getElementById('confirm-delete-btn');
  btn.disabled = true;
  btn.textContent = 'Deleting...';

  try {
    const res = await fetch(`/api/customers/${currentCustomerId}`, { method: 'DELETE' });
    if (res.ok) {
      deleteModal.style.display = 'none';
      document.getElementById('detail-panel').style.display = 'none';
      allCustomers = allCustomers.filter(c => c.id !== currentCustomerId);
      currentCustomerId = null;
      renderList(allCustomers);
    } else {
      const d = await res.json();
      alert(d.error || 'Failed to delete customer.');
    }
  } catch {
    alert('Connection error. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Yes, Delete Everything';
  }
});

// ─── Invoice Actions ──────────────────────────────────────────────────────────
function printInvoice(jobId) {
  window.open(`/api/jobs/${jobId}/invoice`, '_blank');
}

async function resendInvoice(jobId, btn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const res = await fetch(`/api/jobs/${jobId}/resend-invoice`, { method: 'POST' });
    const data = await res.json();
    if (data.sent) {
      btn.textContent = 'Sent!';
      setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2000);
    } else {
      alert(`Could not send: ${data.reason || data.error || 'Unknown error'}`);
      btn.textContent = original;
      btn.disabled = false;
    }
  } catch {
    alert('Connection error.');
    btn.textContent = original;
    btn.disabled = false;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
loadCustomers();
