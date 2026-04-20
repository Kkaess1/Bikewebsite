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

// ─── State ────────────────────────────────────────────────────────────────────
let allCustomers = [];
let allParts = [];
let allBikes = [];
let editJobId = null;
let editJobChargeOther = [];
let editJobOther = [];

// ─── Load Data ────────────────────────────────────────────────────────────────
async function loadAllCustomers() {
  try {
    const res = await fetch('/api/customers?q=');
    allCustomers = await res.json();
  } catch { allCustomers = []; }
}

async function loadAllParts() {
  try {
    const res = await fetch('/api/parts');
    allParts = await res.json();
  } catch { allParts = []; }
}

async function loadAllBikes() {
  try {
    const res = await fetch('/api/bikes');
    allBikes = await res.json();
  } catch { allBikes = []; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER DROPDOWN
// ═══════════════════════════════════════════════════════════════════════════════
const customerInput    = document.getElementById('customer-input');
const customerDropdown = document.getElementById('customer-dropdown');
const customerIdInput  = document.getElementById('customer-id');
const customerSelected = document.getElementById('customer-selected');

function showCustomerDropdown(filter) {
  const q = (filter || '').toLowerCase();
  const filtered = q ? allCustomers.filter(c => c.name.toLowerCase().includes(q)) : allCustomers;
  customerDropdown.innerHTML = '';
  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No customers found';
    li.style.cssText = 'color:#aaa;font-style:italic;';
    customerDropdown.appendChild(li);
  } else {
    filtered.forEach(c => {
      const li = document.createElement('li');
      li.textContent = c.name;
      li.addEventListener('mousedown', () => selectCustomer(c.id, c.name));
      customerDropdown.appendChild(li);
    });
  }
  customerDropdown.classList.add('open');
}

customerInput.addEventListener('focus', () => {
  customerIdInput.value = '';
  customerSelected.textContent = '';
  document.getElementById('edit-customer-btn').style.display = 'none';
  showCustomerDropdown(customerInput.value);
});
customerInput.addEventListener('input', () => {
  customerIdInput.value = '';
  customerSelected.textContent = '';
  document.getElementById('edit-customer-btn').style.display = 'none';
  showCustomerDropdown(customerInput.value.trim());
});
customerInput.addEventListener('blur', () => setTimeout(() => customerDropdown.classList.remove('open'), 150));

function selectCustomer(id, name) {
  customerIdInput.value = id;
  customerInput.value = name;
  customerSelected.textContent = `Selected: ${name}`;
  customerDropdown.classList.remove('open');
  document.getElementById('edit-customer-btn').style.display = '';
  const notifLabel = document.querySelector('#send-notification + span');
  if (notifLabel) notifLabel.textContent = `Send ${name} a text message that their job has started`;
  // Pre-fill edit form
  const c = allCustomers.find(c => c.id === id);
  if (c) {
    document.getElementById('ec-name').value    = c.name || '';
    document.getElementById('ec-phone').value   = c.phone || '';
    document.getElementById('ec-email').value   = c.email || '';
    document.getElementById('ec-carrier').value = c.carrier || '';
  }
}

// ─── Add Customer ─────────────────────────────────────────────────────────────
document.getElementById('add-customer-btn').addEventListener('click', () => {
  document.getElementById('edit-customer-form').style.display = 'none';
  document.getElementById('new-customer-form').style.display = '';
  document.getElementById('new-customer-name').focus();
});
document.getElementById('cancel-new-customer-btn').addEventListener('click', () => {
  document.getElementById('new-customer-form').style.display = 'none';
  clearNewCustomerForm();
});
document.getElementById('confirm-new-customer-btn').addEventListener('click', saveNewCustomer);
document.getElementById('new-customer-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveNewCustomer(); });

function clearNewCustomerForm() {
  ['new-customer-name','new-customer-phone','new-customer-email'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('new-customer-carrier').value = '';
  document.getElementById('new-customer-error').style.display = 'none';
}

async function saveNewCustomer() {
  const errorEl = document.getElementById('new-customer-error');
  errorEl.style.display = 'none';
  const name    = document.getElementById('new-customer-name').value.trim();
  const phone   = document.getElementById('new-customer-phone').value.trim();
  const email   = document.getElementById('new-customer-email').value.trim();
  const carrier = document.getElementById('new-customer-carrier').value;
  if (!name) { errorEl.textContent = 'Please enter a name.'; errorEl.style.display = ''; return; }
  try {
    const res = await fetch('/api/customers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, carrier }),
    });
    const customer = await res.json();
    if (res.ok) {
      allCustomers.push(customer);
      allCustomers.sort((a, b) => a.name.localeCompare(b.name));
      selectCustomer(customer.id, customer.name);
      document.getElementById('new-customer-form').style.display = 'none';
      clearNewCustomerForm();
    } else {
      errorEl.textContent = customer.error || 'Failed to save customer.';
      errorEl.style.display = '';
    }
  } catch {
    errorEl.textContent = 'Connection error. Please try again.';
    errorEl.style.display = '';
  }
}

// ─── Edit Customer (inline) ───────────────────────────────────────────────────
document.getElementById('edit-customer-btn').addEventListener('click', () => {
  document.getElementById('new-customer-form').style.display = 'none';
  document.getElementById('edit-customer-form').style.display = '';
  document.getElementById('ec-name').focus();
});
document.getElementById('cancel-edit-customer-btn').addEventListener('click', () => {
  document.getElementById('edit-customer-form').style.display = 'none';
  document.getElementById('edit-customer-error').style.display = 'none';
});
document.getElementById('confirm-edit-customer-btn').addEventListener('click', saveEditCustomer);

async function saveEditCustomer() {
  const errorEl = document.getElementById('edit-customer-error');
  errorEl.style.display = 'none';
  const id      = customerIdInput.value;
  const name    = document.getElementById('ec-name').value.trim();
  const phone   = document.getElementById('ec-phone').value.trim();
  const email   = document.getElementById('ec-email').value.trim();
  const carrier = document.getElementById('ec-carrier').value;
  if (!name) { errorEl.textContent = 'Name is required.'; errorEl.style.display = ''; return; }
  try {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, carrier }),
    });
    if (res.ok) {
      const idx = allCustomers.findIndex(c => String(c.id) === String(id));
      if (idx !== -1) allCustomers[idx] = { ...allCustomers[idx], name, phone, email, carrier };
      customerInput.value = name;
      customerSelected.textContent = `Selected: ${name}`;
      document.getElementById('edit-customer-form').style.display = 'none';
    } else {
      const d = await res.json();
      errorEl.textContent = d.error || 'Failed to update.';
      errorEl.style.display = '';
    }
  } catch {
    errorEl.textContent = 'Connection error.';
    errorEl.style.display = '';
  }
}

// ─── SMS notification warning ─────────────────────────────────────────────────
document.getElementById('send-notification').addEventListener('change', function () {
  const warning = document.getElementById('sms-warning');
  if (!this.checked) { warning.style.display = 'none'; return; }
  const id = customerIdInput.value;
  if (!id) { warning.textContent = 'Select a customer first.'; warning.style.display = ''; return; }
  const c = allCustomers.find(c => String(c.id) === String(id));
  if (c && !c.phone) {
    warning.textContent = 'This customer has no phone number — text will not be sent.';
    warning.style.display = '';
  } else {
    warning.style.display = 'none';
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BIKE DROPDOWN
// ═══════════════════════════════════════════════════════════════════════════════
const bikeInput    = document.getElementById('bike-input');
const bikeDropdown = document.getElementById('bike-dropdown');
const bikeIdInput  = document.getElementById('bike-id');
const bikeSelected = document.getElementById('bike-selected');

function showBikeDropdown(filter) {
  const q = (filter || '').toLowerCase();
  const filtered = q ? allBikes.filter(b => b.name.toLowerCase().includes(q)) : allBikes;
  bikeDropdown.innerHTML = '';
  if (filtered.length === 0) {
    const li = document.createElement('li');
    li.textContent = allBikes.length === 0 ? 'No bikes in catalog yet' : 'No match found';
    li.style.cssText = 'color:#aaa;font-style:italic;';
    bikeDropdown.appendChild(li);
  } else {
    filtered.forEach(b => {
      const li = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = b.name;
      li.appendChild(strong);
      if (b.description) {
        const span = document.createElement('span');
        span.style.cssText = 'font-size:0.82rem;color:#888;margin-left:6px;';
        span.textContent = b.description;
        li.appendChild(span);
      }
      li.addEventListener('mousedown', () => selectBike(b.id, b.name));
      bikeDropdown.appendChild(li);
    });
  }
  bikeDropdown.classList.add('open');
}

bikeInput.addEventListener('focus', () => { bikeIdInput.value = ''; bikeSelected.textContent = ''; showBikeDropdown(bikeInput.value); });
bikeInput.addEventListener('input', () => { bikeIdInput.value = ''; bikeSelected.textContent = ''; showBikeDropdown(bikeInput.value.trim()); });
bikeInput.addEventListener('blur', () => setTimeout(() => bikeDropdown.classList.remove('open'), 150));

function selectBike(id, name) {
  bikeIdInput.value = id;
  bikeInput.value = name;
  bikeSelected.textContent = `Selected: ${name}`;
  bikeDropdown.classList.remove('open');
}

// ─── Add Bike inline ──────────────────────────────────────────────────────────
document.getElementById('add-bike-inline-btn').addEventListener('click', () => {
  document.getElementById('new-bike-form').style.display = '';
  document.getElementById('nb-name').focus();
});
document.getElementById('cancel-new-bike-btn').addEventListener('click', () => {
  document.getElementById('new-bike-form').style.display = 'none';
});
document.getElementById('save-new-bike-btn').addEventListener('click', saveNewBike);

async function saveNewBike() {
  const errorEl = document.getElementById('new-bike-error');
  errorEl.style.display = 'none';
  const name        = document.getElementById('nb-name').value.trim();
  const description = document.getElementById('nb-description').value.trim();
  if (!name) { errorEl.textContent = 'Bike name is required.'; errorEl.style.display = ''; return; }
  try {
    const res = await fetch('/api/bikes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    const bike = await res.json();
    if (res.ok) {
      allBikes.push(bike);
      allBikes.sort((a, b) => a.name.localeCompare(b.name));
      selectBike(bike.id, bike.name);
      document.getElementById('new-bike-form').style.display = 'none';
      document.getElementById('nb-name').value = '';
      document.getElementById('nb-description').value = '';
    } else {
      errorEl.textContent = bike.error || 'Failed to save bike.';
      errorEl.style.display = '';
    }
  } catch {
    errorEl.textContent = 'Connection error.';
    errorEl.style.display = '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTS ROWS (catalog dropdown)
// ═══════════════════════════════════════════════════════════════════════════════
function createPartRow(container, { noFocus = false } = {}) {
  const row = document.createElement('div');
  row.className = 'line-item-row';
  row.dataset.partId = '';
  row.dataset.followUpValue = '';
  row.dataset.followUpUnit  = '';

  // Part search input + hidden dropdown
  const wrap = document.createElement('div');
  wrap.className = 'customer-wrap';
  wrap.style.position = 'relative';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'desc-input';
  nameInput.placeholder = 'Search part catalog...';
  nameInput.autocomplete = 'off';

  const dropdown = document.createElement('ul');
  dropdown.className = 'customer-dropdown';

  function showPartDropdown(filter) {
    const q = (filter || '').toLowerCase();
    const filtered = q ? allParts.filter(p => p.name.toLowerCase().includes(q)) : allParts;
    dropdown.innerHTML = '';
    if (filtered.length === 0) {
      const li = document.createElement('li');
      li.textContent = allParts.length === 0 ? 'No parts in catalog' : 'No match';
      li.style.cssText = 'color:#aaa;font-style:italic;';
      dropdown.appendChild(li);
    } else {
      filtered.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.name;
        li.addEventListener('mousedown', () => {
          nameInput.value = p.name;
          row.dataset.partId = p.id;
          row.dataset.followUpValue = p.follow_up_value || '';
          row.dataset.followUpUnit  = p.follow_up_unit  || '';
          dropdown.classList.remove('open');
          updateReminderSection();
        });
        dropdown.appendChild(li);
      });
    }
    dropdown.classList.add('open');
  }

  nameInput.addEventListener('focus', () => { row.dataset.partId = ''; showPartDropdown(nameInput.value); });
  nameInput.addEventListener('input', () => { row.dataset.partId = ''; row.dataset.followUpValue = ''; row.dataset.followUpUnit = ''; showPartDropdown(nameInput.value.trim()); updateReminderSection(); });
  nameInput.addEventListener('blur',  () => setTimeout(() => dropdown.classList.remove('open'), 150));

  wrap.appendChild(nameInput);
  wrap.appendChild(dropdown);

  const priceInput = document.createElement('input');
  priceInput.type = 'text';
  priceInput.inputMode = 'decimal';
  priceInput.className = 'price-input';
  priceInput.placeholder = '0.00';
  priceInput.addEventListener('input', recalculate);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn-remove';
  removeBtn.title = 'Remove';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => { row.remove(); recalculate(); updateReminderSection(); });

  row.appendChild(wrap);
  row.appendChild(priceInput);
  row.appendChild(removeBtn);
  container.appendChild(row);
  if (!noFocus) nameInput.focus();
  return row;
}

function createSimpleRow(container, descPlaceholder, { noFocus = false } = {}) {
  const row = document.createElement('div');
  row.className = 'line-item-row';
  row.innerHTML = `
    <input type="text" class="desc-input" placeholder="${descPlaceholder}">
    <input type="text" inputmode="decimal" class="price-input" placeholder="0.00">
    <button class="btn-remove" title="Remove">&times;</button>
  `;
  row.querySelector('.price-input').addEventListener('input', recalculate);
  row.querySelector('.btn-remove').addEventListener('click', () => { row.remove(); recalculate(); });
  container.appendChild(row);
  if (!noFocus) row.querySelector('.desc-input').focus();
  return row;
}

document.getElementById('add-part-row-btn').addEventListener('click', () => {
  createPartRow(document.getElementById('parts-list'));
});
document.getElementById('add-service-btn').addEventListener('click', () => {
  createSimpleRow(document.getElementById('services-list'), 'Service description');
});


// ─── Add Part to Catalog (inline) ─────────────────────────────────────────────
document.getElementById('add-part-catalog-btn').addEventListener('click', () => {
  document.getElementById('new-part-catalog-form').style.display = '';
  document.getElementById('np-name').focus();
});
document.getElementById('cancel-new-part-btn').addEventListener('click', () => {
  document.getElementById('new-part-catalog-form').style.display = 'none';
});
document.getElementById('save-new-part-btn').addEventListener('click', saveNewPartToCatalog);

async function saveNewPartToCatalog() {
  const errorEl = document.getElementById('new-part-error');
  errorEl.style.display = 'none';
  const name            = document.getElementById('np-name').value.trim();
  const note            = document.getElementById('np-note').value.trim();
  const follow_up_value = document.getElementById('np-followup-value').value || null;
  const follow_up_unit  = document.getElementById('np-followup-unit').value  || null;
  if (!name) { errorEl.textContent = 'Part name is required.'; errorEl.style.display = ''; return; }
  try {
    const res = await fetch('/api/parts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, note, follow_up_value, follow_up_unit }),
    });
    const part = await res.json();
    if (res.ok) {
      allParts.push(part);
      allParts.sort((a, b) => a.name.localeCompare(b.name));
      document.getElementById('new-part-catalog-form').style.display = 'none';
      document.getElementById('np-name').value = '';
      document.getElementById('np-note').value = '';
      document.getElementById('np-followup-value').value = '';
      document.getElementById('np-followup-unit').value = '';
    } else {
      errorEl.textContent = part.error || 'Failed to save.';
      errorEl.style.display = '';
    }
  } catch {
    errorEl.textContent = 'Connection error.';
    errorEl.style.display = '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UP REMINDER SECTION
// ═══════════════════════════════════════════════════════════════════════════════
function updateReminderSection() {
  const partsRows = document.querySelectorAll('#parts-list .line-item-row');
  const partsWithReminder = [];
  partsRows.forEach(row => {
    const fv = row.dataset.followUpValue;
    const fu = row.dataset.followUpUnit;
    const name = row.querySelector('.desc-input')?.value?.trim();
    if (name && fv && fu) {
      partsWithReminder.push({ part_name: name, follow_up_value: fv, follow_up_unit: fu });
    }
  });

  const section = document.getElementById('reminder-section');
  const details = document.getElementById('reminder-details');

  if (partsWithReminder.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  details.innerHTML = 'Reminder will be sent for: ' + partsWithReminder.map(r =>
    `<strong>${escapeHtml(r.part_name)}</strong> in ${escapeHtml(String(r.follow_up_value))} ${escapeHtml(r.follow_up_unit)}`
  ).join(', ') + '.';
}

function getScheduledReminders() {
  if (!document.getElementById('send-reminders').checked) return [];
  const partsRows = document.querySelectorAll('#parts-list .line-item-row');
  const result = [];
  partsRows.forEach(row => {
    const fv   = row.dataset.followUpValue;
    const fu   = row.dataset.followUpUnit;
    const name = row.querySelector('.desc-input')?.value?.trim();
    if (name && fv && fu) {
      result.push({ part_name: name, follow_up_value: parseInt(fv), follow_up_unit: fu });
    }
  });
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECALCULATE TOTALS
// ═══════════════════════════════════════════════════════════════════════════════
function sumList(containerId) {
  let total = 0;
  document.querySelectorAll(`#${containerId} .price-input`).forEach(input => {
    total += parseFloat(input.value) || 0;
  });
  return total;
}

function fmt(n) { return '$' + n.toFixed(2); }

function recalculate() {
  const parts = sumList('parts-list');
  const services = sumList('services-list');

  const expenses = parts;
  const customer_cost = services;
  const profit        = customer_cost - expenses;

  document.getElementById('total-expenses').textContent = fmt(expenses);
  document.getElementById('services-total').textContent = fmt(services);
  document.getElementById('customer-cost-display').textContent = fmt(customer_cost);
  document.getElementById('profit-amount').textContent = fmt(profit);

  const profitBox = document.getElementById('profit-box');
  profitBox.className = 'total-box';
  profitBox.style.gridColumn = '1/-1';
  if (profit > 0) profitBox.classList.add('profit-positive');
  else if (profit < 0) profitBox.classList.add('profit-negative');
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLLECT & SAVE
// ═══════════════════════════════════════════════════════════════════════════════
function collectPartRows() {
  const result = [];
  document.querySelectorAll('#parts-list .line-item-row').forEach(row => {
    const desc  = row.querySelector('.desc-input')?.value?.trim();
    const price = parseFloat(row.querySelector('.price-input')?.value) || 0;
    const partId = row.dataset.partId ? parseInt(row.dataset.partId) : null;
    if (desc) result.push({ part_id: partId, description: desc, price });
  });
  return result;
}

function collectSimpleRows(containerId, priceKey) {
  const result = [];
  document.querySelectorAll(`#${containerId} .line-item-row`).forEach(row => {
    const desc  = row.querySelector('.desc-input')?.value?.trim();
    const price = parseFloat(row.querySelector('.price-input')?.value) || 0;
    if (desc) result.push({ description: desc, [priceKey]: price });
  });
  return result;
}

document.getElementById('save-btn').addEventListener('click', async () => {
  clearMessages();
  const customerId = customerIdInput.value;
  if (!customerId) { showError('Please select or create a customer first.'); return; }

  const parts        = collectPartRows();
  const other = [];
  const services = collectSimpleRows('services-list', 'price');
  const charge_other = [];
  const notes = document.getElementById('job-notes').value.trim();
  const estimatedCompletion = document.getElementById('estimated-completion').value.trim();
  const bike_id             = bikeIdInput.value ? parseInt(bikeIdInput.value) : null;

  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    let res;
    if (editJobId) {
      res = await fetch(`/api/jobs/${editJobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: parseInt(customerId), notes, estimated_completion: estimatedCompletion, parts, other: editJobOther, services, charge_other: editJobChargeOther, bike_id }),
      });
    } else {
      const sendNotification = document.getElementById('send-notification').checked;
      const reminders        = getScheduledReminders();
      res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: parseInt(customerId), notes, estimated_completion: estimatedCompletion, parts, other, services, charge_other, bike_id, send_notification: sendNotification, reminders }),
      });
    }

    const data = await res.json();
    if (res.ok) {
      if (editJobId) {
        showSuccess('Job updated!');
        setTimeout(() => window.location.href = '/customers.html', 1000);
      } else {
        let msg = 'Job saved successfully!';
        if (data.invoice?.sent) msg += ' Invoice emailed.';
        const sendNotification = document.getElementById('send-notification').checked;
        if (sendNotification && data.sms?.sent) msg += ' Text sent.';
        else if (sendNotification && data.sms?.skipped) msg += ` (SMS skipped: ${data.sms.reason})`;
        showSuccess(msg);
        setTimeout(() => window.location.href = '/', 1500);
      }
    } else {
      showError(data.error || 'Failed to save job');
    }
  } catch {
    showError('Connection error. Please try again.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = editJobId ? 'Save Changes' : 'Save Job';
  }
});

// ─── Messages ─────────────────────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg; el.className = 'msg error';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function showSuccess(msg) {
  const el = document.getElementById('success-msg');
  el.textContent = msg; el.className = 'msg success';
}
function clearMessages() {
  document.getElementById('error-msg').className = 'msg';
  document.getElementById('success-msg').className = 'msg';
}

// ─── Collapsible Sections ─────────────────────────────────────────────────────
function setupToggle(toggleId, bodyId) {
  const toggle = document.getElementById(toggleId);
  const body   = document.getElementById(bodyId);
  if (!toggle || !body) return;
  toggle.addEventListener('click', () => {
    const isOpen = body.classList.contains('open');
    body.classList.toggle('open', !isOpen);
    toggle.classList.toggle('open', !isOpen);
  });
}

// ─── Add-a-Note expand ───────────────────────────────────────────────────────
function setupNoteField() {
  const trigger  = document.getElementById('add-note-trigger');
  const expand   = document.getElementById('note-expand');
  const textarea = document.getElementById('job-notes');
  if (!trigger || !expand || !textarea) return;

  function open() {
    trigger.classList.add('hidden');
    expand.classList.add('open');
    textarea.focus();
  }

  function collapse() {
    if (!textarea.value.trim()) {
      expand.classList.remove('open');
      trigger.classList.remove('hidden');
    }
  }

  trigger.addEventListener('click', open);
  textarea.addEventListener('blur', collapse);
}

// ─── Edit Mode Prefill ────────────────────────────────────────────────────────
async function prefillEditMode(jobId) {
  let job;
  try {
    const res = await fetch(`/api/jobs/${jobId}/data`);
    if (!res.ok) { showError('Could not load job for editing.'); return; }
    job = await res.json();
  } catch { showError('Connection error loading job.'); return; }

  // Preserve fields the form doesn't edit
  editJobChargeOther = job.charge_other || [];
  editJobOther       = job.other || [];

  // Customer
  const customer = allCustomers.find(c => c.id === job.customer_id);
  if (customer) selectCustomer(customer.id, customer.name);
  else { customerIdInput.value = job.customer_id; }

  // Bike
  if (job.bike_id) {
    const bike = allBikes.find(b => b.id === job.bike_id);
    if (bike) selectBike(bike.id, bike.name);
  }

  // Completion date
  if (job.estimated_completion) {
    document.getElementById('estimated-completion').value = job.estimated_completion;
  }

  // Notes
  if (job.notes) {
    const textarea = document.getElementById('job-notes');
    const trigger  = document.getElementById('add-note-trigger');
    const expand   = document.getElementById('note-expand');
    textarea.value = job.notes;
    trigger.classList.add('hidden');
    expand.classList.add('open');
  }

  // Parts rows
  const partsContainer = document.getElementById('parts-list');
  partsContainer.innerHTML = '';
  (job.parts || []).forEach(p => {
    const row = createPartRow(partsContainer, { noFocus: true });
    row.querySelector('.desc-input').value = p.description;
    row.querySelector('.price-input').value = Number(p.price).toFixed(2);
    if (p.part_id) {
      row.dataset.partId = p.part_id;
      const catalogPart = allParts.find(ap => ap.id === p.part_id);
      if (catalogPart) {
        row.dataset.followUpValue = catalogPart.follow_up_value || '';
        row.dataset.followUpUnit  = catalogPart.follow_up_unit  || '';
      }
    }
  });

  // Service rows
  const servicesContainer = document.getElementById('services-list');
  servicesContainer.innerHTML = '';
  (job.services || []).forEach(s => {
    const row = createSimpleRow(servicesContainer, 'Service description', { noFocus: true });
    row.querySelector('.desc-input').value = s.description;
    row.querySelector('.price-input').value = Number(s.price).toFixed(2);
  });

  recalculate();

  // UI adjustments for edit mode
  document.title = 'Edit Job — B-Rads Bikes';
  document.getElementById('save-btn').textContent = 'Save Changes';
  document.getElementById('notifications-card').style.display = 'none';
}

// ─── Init ─────────────────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const editParam = urlParams.get('edit');
if (editParam) editJobId = parseInt(editParam);

Promise.all([loadAllCustomers(), loadAllParts(), loadAllBikes()]).then(() => {
  if (editJobId) {
    prefillEditMode(editJobId);
  } else {
    createPartRow(document.getElementById('parts-list'));
    createSimpleRow(document.getElementById('services-list'), 'Service description');
  }
  setupNoteField();
  window.scrollTo(0, 0);
});
