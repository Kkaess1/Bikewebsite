// ─── Logout ───────────────────────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});

// ─── Load current settings ────────────────────────────────────────────────────
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();

    if (data.gmail_user) {
      document.getElementById('gmail-user').value = data.gmail_user;
    }

    const statusEl = document.getElementById('gmail-status');
    if (data.gmail_configured) {
      statusEl.innerHTML = '<span style="color:#1a7a1a;font-weight:600;font-size:0.88rem;">&#10003; Gmail SMS is configured and active</span>';
    } else {
      statusEl.innerHTML = '<span style="color:#b86000;font-size:0.88rem;">&#9888; Gmail not configured — text notifications are disabled</span>';
    }

    if (data.shop_phone) document.getElementById('shop-phone').value = data.shop_phone;
    if (data.shop_carrier) document.getElementById('shop-carrier').value = data.shop_carrier;
  } catch {
    // ignore
  }
}

// ─── Change Password ──────────────────────────────────────────────────────────
document.getElementById('save-password-btn').addEventListener('click', async () => {
  clearMsg('pw-success');
  clearMsg('pw-error');

  const current = document.getElementById('current-password').value;
  const newPw   = document.getElementById('new-password').value;
  const confirm = document.getElementById('confirm-password').value;

  if (!newPw) { showMsg('pw-error', 'Please enter a new password.'); return; }
  if (newPw !== confirm) { showMsg('pw-error', 'New passwords do not match.'); return; }

  const btn = document.getElementById('save-password-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await fetch('/api/settings/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: current, new_password: newPw }),
    });
    const data = await res.json();
    if (res.ok) {
      showMsg('pw-success', 'Password updated successfully!');
      document.getElementById('current-password').value = '';
      document.getElementById('new-password').value = '';
      document.getElementById('confirm-password').value = '';
    } else {
      showMsg('pw-error', data.error || 'Failed to update password.');
    }
  } catch {
    showMsg('pw-error', 'Connection error. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Update Password';
  }
});

// ─── Save Gmail Settings ──────────────────────────────────────────────────────
document.getElementById('save-gmail-btn').addEventListener('click', async () => {
  clearMsg('gmail-success');
  clearMsg('gmail-error');

  const gmail_user         = document.getElementById('gmail-user').value.trim();
  const gmail_app_password = document.getElementById('gmail-app-password').value.trim();

  const btn = document.getElementById('save-gmail-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const res = await fetch('/api/settings/gmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gmail_user, gmail_app_password }),
    });
    const data = await res.json();
    if (res.ok) {
      showMsg('gmail-success', 'Gmail settings saved!');
      loadSettings();
    } else {
      showMsg('gmail-error', data.error || 'Failed to save.');
    }
  } catch {
    showMsg('gmail-error', 'Connection error. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Gmail Settings';
  }
});

// ─── Show / hide app password ──────────────────────────────────────────────────
document.getElementById('toggle-app-pw').addEventListener('click', function () {
  const input = document.getElementById('gmail-app-password');
  if (input.type === 'password') {
    input.type = 'text';
    this.textContent = 'Hide';
  } else {
    input.type = 'password';
    this.textContent = 'Show';
  }
});

// ─── Send Test Text ───────────────────────────────────────────────────────────
document.getElementById('test-sms-btn').addEventListener('click', async () => {
  clearMsg('test-success');
  clearMsg('test-error');

  const test_phone   = document.getElementById('test-phone').value.trim();
  const test_carrier = document.getElementById('test-carrier').value;

  const btn = document.getElementById('test-sms-btn');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch('/api/settings/gmail/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test_phone, test_carrier }),
    });
    const data = await res.json();
    if (res.ok) {
      showMsg('test-success', 'Test text sent! Check the phone to confirm it arrived.');
    } else {
      showMsg('test-error', data.error || 'Failed to send test text.');
    }
  } catch {
    showMsg('test-error', 'Connection error. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Test Text';
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showMsg(id, text, type = 'error') {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = 'msg ' + (id.includes('success') ? 'success' : 'error');
}

function clearMsg(id) {
  document.getElementById(id).className = 'msg';
}

// ─── Save Shop Contact ────────────────────────────────────────────────────────
document.getElementById('save-shop-btn').addEventListener('click', async () => {
  clearMsg('shop-success');
  clearMsg('shop-error');
  const shop_phone   = document.getElementById('shop-phone').value.trim();
  const shop_carrier = document.getElementById('shop-carrier').value;
  const btn = document.getElementById('save-shop-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  try {
    const res = await fetch('/api/settings/shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop_phone, shop_carrier }),
    });
    const data = await res.json();
    if (res.ok) showMsg('shop-success', 'Shop contact saved!');
    else showMsg('shop-error', data.error || 'Failed to save.');
  } catch {
    showMsg('shop-error', 'Connection error. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Shop Contact';
  }
});

loadSettings();
