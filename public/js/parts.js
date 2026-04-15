// ─── Logout ───────────────────────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});

// ─── State ────────────────────────────────────────────────────────────────────
let allParts = [];
let allBikes = [];

// ─── Load ─────────────────────────────────────────────────────────────────────
async function loadParts() {
  try {
    const res = await fetch('/api/parts');
    allParts = await res.json();
    renderParts(allParts);
  } catch {
    document.getElementById('parts-list').innerHTML = '<p style="color:#c00;">Failed to load parts.</p>';
  }
}

async function loadBikes() {
  try {
    const res = await fetch('/api/bikes');
    allBikes = await res.json();
    renderBikes(allBikes);
  } catch {
    document.getElementById('bikes-list').innerHTML = '<p style="color:#c00;">Failed to load bikes.</p>';
  }
}

// ─── Render Parts ─────────────────────────────────────────────────────────────
function renderParts(parts) {
  const el = document.getElementById('parts-list');
  if (parts.length === 0) {
    el.innerHTML = '<p class="no-results">No parts in catalog yet. Click + Add Part to get started.</p>';
    return;
  }
  el.innerHTML = parts.map(p => {
    const followUp = (p.follow_up_value && p.follow_up_unit)
      ? `Follow-up: ${p.follow_up_value} ${p.follow_up_unit}` : '';
    return `
      <div class="part-list-row" data-id="${p.id}">
        <div>
          <div class="part-list-name">${p.name}</div>
          ${p.note ? `<div class="part-list-meta">${p.note}</div>` : ''}
          ${followUp ? `<div class="part-list-meta" style="color:#FA4616;">${followUp}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn btn-secondary" style="font-size:0.8rem;padding:5px 12px;" onclick="editPart(${p.id})">Edit</button>
          <button class="btn" style="background:#fff0f0;color:#c00;border:1px solid #fbb;font-size:0.8rem;padding:5px 12px;" onclick="deletePart(${p.id}, '${p.name.replace(/'/g,"\\'")}')">Delete</button>
        </div>
      </div>`;
  }).join('');
}

// ─── Render Bikes ─────────────────────────────────────────────────────────────
function renderBikes(bikes) {
  const el = document.getElementById('bikes-list');
  if (bikes.length === 0) {
    el.innerHTML = '<p class="no-results">No bikes in catalog yet. Click + Add Bike to get started.</p>';
    return;
  }
  el.innerHTML = bikes.map(b => `
    <div class="part-list-row" data-id="${b.id}">
      <div>
        <div class="part-list-name">${b.name}</div>
        ${b.description ? `<div class="part-list-meta">${b.description}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="btn btn-secondary" style="font-size:0.8rem;padding:5px 12px;" onclick="editBike(${b.id})">Edit</button>
        <button class="btn" style="background:#fff0f0;color:#c00;border:1px solid #fbb;font-size:0.8rem;padding:5px 12px;" onclick="deleteBike(${b.id}, '${b.name.replace(/'/g,"\\'")}')">Delete</button>
      </div>
    </div>`).join('');
}

// ─── Search ───────────────────────────────────────────────────────────────────
document.getElementById('search-parts').addEventListener('input', function () {
  const q = this.value.toLowerCase();
  renderParts(q ? allParts.filter(p => p.name.toLowerCase().includes(q)) : allParts);
});

document.getElementById('search-bikes').addEventListener('input', function () {
  const q = this.value.toLowerCase();
  renderBikes(q ? allBikes.filter(b => b.name.toLowerCase().includes(q)) : allBikes);
});

// ─── Part Form ────────────────────────────────────────────────────────────────
document.getElementById('add-part-btn').addEventListener('click', () => {
  document.getElementById('edit-part-id').value = '';
  document.getElementById('form-title').textContent = 'Add New Part';
  document.getElementById('part-name').value = '';
  document.getElementById('part-note').value = '';
  document.getElementById('part-followup-value').value = '';
  document.getElementById('part-followup-unit').value = '';
  document.getElementById('part-form-error').style.display = 'none';
  document.getElementById('part-form').style.display = '';
  document.getElementById('part-name').focus();
});

document.getElementById('cancel-part-btn').addEventListener('click', () => {
  document.getElementById('part-form').style.display = 'none';
});

function editPart(id) {
  const part = allParts.find(p => p.id === id);
  if (!part) return;
  document.getElementById('edit-part-id').value = id;
  document.getElementById('form-title').textContent = 'Edit Part';
  document.getElementById('part-name').value = part.name;
  document.getElementById('part-note').value = part.note || '';
  document.getElementById('part-followup-value').value = part.follow_up_value || '';
  document.getElementById('part-followup-unit').value = part.follow_up_unit || '';
  document.getElementById('part-form-error').style.display = 'none';
  document.getElementById('part-form').style.display = '';
  document.getElementById('part-name').focus();
}

document.getElementById('save-part-btn').addEventListener('click', savePart);
document.getElementById('part-name').addEventListener('keydown', e => { if (e.key === 'Enter') savePart(); });

async function savePart() {
  const errorEl = document.getElementById('part-form-error');
  errorEl.style.display = 'none';
  const id   = document.getElementById('edit-part-id').value;
  const name = document.getElementById('part-name').value.trim();
  const note = document.getElementById('part-note').value.trim();
  const follow_up_value = document.getElementById('part-followup-value').value || null;
  const follow_up_unit  = document.getElementById('part-followup-unit').value  || null;

  if (!name) { errorEl.textContent = 'Part name is required.'; errorEl.style.display = ''; return; }

  const btn = document.getElementById('save-part-btn');
  btn.disabled = true;
  try {
    const method = id ? 'PUT' : 'POST';
    const url    = id ? `/api/parts/${id}` : '/api/parts';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, note, follow_up_value, follow_up_unit }),
    });
    const data = await res.json();
    if (!res.ok) { errorEl.textContent = data.error || 'Failed to save.'; errorEl.style.display = ''; return; }

    document.getElementById('part-form').style.display = 'none';
    await loadParts();
    showSuccess(id ? 'Part updated.' : 'Part added to catalog.');
  } catch {
    errorEl.textContent = 'Connection error.';
    errorEl.style.display = '';
  } finally {
    btn.disabled = false;
  }
}

async function deletePart(id, name) {
  if (!confirm(`Delete "${name}" from the parts catalog?`)) return;
  try {
    const res = await fetch(`/api/parts/${id}`, { method: 'DELETE' });
    if (res.ok) { await loadParts(); showSuccess('Part deleted.'); }
    else { const d = await res.json(); showError(d.error || 'Failed to delete.'); }
  } catch { showError('Connection error.'); }
}

// ─── Bike Form ────────────────────────────────────────────────────────────────
document.getElementById('add-bike-btn').addEventListener('click', () => {
  document.getElementById('edit-bike-id').value = '';
  document.getElementById('bike-form-title').textContent = 'Add New Bike';
  document.getElementById('bike-name').value = '';
  document.getElementById('bike-description').value = '';
  document.getElementById('bike-form-error').style.display = 'none';
  document.getElementById('bike-form').style.display = '';
  document.getElementById('bike-name').focus();
});

document.getElementById('cancel-bike-btn').addEventListener('click', () => {
  document.getElementById('bike-form').style.display = 'none';
});

function editBike(id) {
  const bike = allBikes.find(b => b.id === id);
  if (!bike) return;
  document.getElementById('edit-bike-id').value = id;
  document.getElementById('bike-form-title').textContent = 'Edit Bike';
  document.getElementById('bike-name').value = bike.name;
  document.getElementById('bike-description').value = bike.description || '';
  document.getElementById('bike-form-error').style.display = 'none';
  document.getElementById('bike-form').style.display = '';
  document.getElementById('bike-name').focus();
}

document.getElementById('save-bike-btn').addEventListener('click', saveBike);
document.getElementById('bike-name').addEventListener('keydown', e => { if (e.key === 'Enter') saveBike(); });

async function saveBike() {
  const errorEl = document.getElementById('bike-form-error');
  errorEl.style.display = 'none';
  const id          = document.getElementById('edit-bike-id').value;
  const name        = document.getElementById('bike-name').value.trim();
  const description = document.getElementById('bike-description').value.trim();

  if (!name) { errorEl.textContent = 'Bike name is required.'; errorEl.style.display = ''; return; }

  const btn = document.getElementById('save-bike-btn');
  btn.disabled = true;
  try {
    const method = id ? 'PUT' : 'POST';
    const url    = id ? `/api/bikes/${id}` : '/api/bikes';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    if (!res.ok) { errorEl.textContent = data.error || 'Failed to save.'; errorEl.style.display = ''; return; }

    document.getElementById('bike-form').style.display = 'none';
    await loadBikes();
    showSuccess(id ? 'Bike updated.' : 'Bike added to catalog.');
  } catch {
    errorEl.textContent = 'Connection error.';
    errorEl.style.display = '';
  } finally {
    btn.disabled = false;
  }
}

async function deleteBike(id, name) {
  if (!confirm(`Delete "${name}" from the bike catalog?`)) return;
  try {
    const res = await fetch(`/api/bikes/${id}`, { method: 'DELETE' });
    if (res.ok) { await loadBikes(); showSuccess('Bike deleted.'); }
    else { const d = await res.json(); showError(d.error || 'Failed to delete.'); }
  } catch { showError('Connection error.'); }
}

// ─── Messages ─────────────────────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg; el.className = 'msg error';
}
function showSuccess(msg) {
  const el = document.getElementById('success-msg');
  el.textContent = msg; el.className = 'msg success';
  setTimeout(() => { el.className = 'msg'; }, 3000);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
loadParts();
loadBikes();
