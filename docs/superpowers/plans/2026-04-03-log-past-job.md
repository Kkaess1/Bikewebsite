# Log Past Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small "Log Past Job" button to the homepage that opens the existing job form in a past-mode, with a date field and no notifications, and saves the job with the specified date.

**Architecture:** The existing `/job.html` form is reused via a `?past=true` URL parameter. JS detects the param on load, shows a date field, hides the notifications card, and tweaks labels. The server accepts an optional `job_date` body field; when present it overrides the default date column value and skips email/SMS entirely.

**Tech Stack:** Vanilla JS, Express/Node.js, sql.js

---

### Task 1: Add "Log Past Job" button to homepage

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Add the small link below the dashboard grid**

In `public/index.html`, replace:
```html
    </div>
  </div>

  <script>
```
with:
```html
    </div>
    <div style="text-align:center;margin-top:18px;">
      <a href="/job.html?past=true" style="font-size:0.82rem;color:#6B7A8D;text-decoration:none;border:1px solid #C8D0DC;border-radius:5px;padding:5px 14px;display:inline-block;">
        + Log Past Job
      </a>
    </div>
  </div>

  <script>
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3000`. Confirm a small muted "Log Past Job" link appears below the four main buttons. Clicking it should navigate to `/job.html?past=true` (page loads normally for now).

---

### Task 2: Add date field to job.html

**Files:**
- Modify: `public/job.html`

- [ ] **Step 1: Add the past-mode date field to the Customer card**

In `public/job.html`, find the line:
```html
    <div id="error-msg" class="msg"></div>
    <div id="success-msg" class="msg"></div>
```
Replace with:
```html
    <div id="error-msg" class="msg"></div>
    <div id="success-msg" class="msg"></div>

    <!-- Past job date (shown only in past mode) -->
    <div id="past-date-wrap" style="display:none;" class="card">
      <div class="form-group" style="margin:0;">
        <label for="job-date">Job Date <span style="color:#FA4616;">*</span></label>
        <input type="date" id="job-date" onclick="try{this.showPicker()}catch(e){}">
      </div>
    </div>
```

- [ ] **Step 2: Add id to the Notifications card so JS can hide it**

Find:
```html
    <!-- Notifications -->
    <div class="card">
```
Replace with:
```html
    <!-- Notifications -->
    <div class="card" id="notifications-card">
```

---

### Task 3: Add past-mode logic to job.js

**Files:**
- Modify: `public/js/job.js`

- [ ] **Step 1: Add past-mode detection and setup at the top of the Init section**

In `public/js/job.js`, find the Init section at the bottom:
```javascript
// ─── Init ─────────────────────────────────────────────────────────────────────
Promise.all([loadAllCustomers(), loadAllParts(), loadAllBikes()]).then(() => {
  createPartRow(document.getElementById('parts-list'));
  createSimpleRow(document.getElementById('services-list'), 'Service description');
  window.scrollTo(0, 0);
});
```
Replace with:
```javascript
// ─── Past Job Mode ────────────────────────────────────────────────────────────
const isPastMode = new URLSearchParams(location.search).get('past') === 'true';

function initPastMode() {
  document.title = 'Log Past Job — B-Rads Bikes';
  document.querySelector('h1') && (document.querySelector('h1').textContent = 'B-Rads Bikes');

  // Show date field, default to today
  const wrap = document.getElementById('past-date-wrap');
  wrap.style.display = '';
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm   = String(today.getMonth() + 1).padStart(2, '0');
  const dd   = String(today.getDate()).padStart(2, '0');
  document.getElementById('job-date').value = `${yyyy}-${mm}-${dd}`;

  // Hide notifications card
  document.getElementById('notifications-card').style.display = 'none';

  // Update page heading and button
  document.querySelector('.container > div > a').textContent = '← Back to Dashboard';
  document.getElementById('save-btn').textContent = 'Save Past Job';
}

// ─── Init ─────────────────────────────────────────────────────────────────────
Promise.all([loadAllCustomers(), loadAllParts(), loadAllBikes()]).then(() => {
  createPartRow(document.getElementById('parts-list'));
  createSimpleRow(document.getElementById('services-list'), 'Service description');
  if (isPastMode) initPastMode();
  window.scrollTo(0, 0);
});
```

- [ ] **Step 2: Send `job_date` and skip notification fields on submit**

In `public/js/job.js`, find the save handler's `body: JSON.stringify({` block:
```javascript
      body: JSON.stringify({
        customer_id: parseInt(customerId),
        notes,
        estimated_completion: estimatedCompletion,
        parts,
        services,
        bike_id,
        send_notification: sendNotification,
        reminders,
      }),
```
Replace with:
```javascript
      body: JSON.stringify({
        customer_id: parseInt(customerId),
        notes,
        estimated_completion: estimatedCompletion,
        parts,
        services,
        bike_id,
        send_notification: isPastMode ? false : sendNotification,
        reminders: isPastMode ? [] : reminders,
        job_date: isPastMode ? document.getElementById('job-date').value : undefined,
      }),
```

- [ ] **Step 3: Validate job date is filled in past mode**

Find the top of the save handler:
```javascript
  clearMessages();
  const customerId = customerIdInput.value;
  if (!customerId) { showError('Please select or create a customer first.'); return; }
```
Replace with:
```javascript
  clearMessages();
  const customerId = customerIdInput.value;
  if (!customerId) { showError('Please select or create a customer first.'); return; }
  if (isPastMode && !document.getElementById('job-date').value) {
    showError('Please enter the job date.');
    return;
  }
```

- [ ] **Step 4: Fix save button reset text for past mode**

Find in the `finally` block:
```javascript
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Job';
```
Replace with:
```javascript
    saveBtn.disabled = false;
    saveBtn.textContent = isPastMode ? 'Save Past Job' : 'Save Job';
```

- [ ] **Step 5: Suppress invoice message in success toast for past mode**

Find:
```javascript
      let msg = 'Job saved successfully!';
      if (data.invoice?.sent) msg += ' Invoice emailed.';
      if (sendNotification && data.sms?.sent) msg += ' Text sent.';
      else if (sendNotification && data.sms?.skipped) msg += ` (SMS skipped: ${data.sms.reason})`;
```
Replace with:
```javascript
      let msg = 'Job saved successfully!';
      if (!isPastMode && data.invoice?.sent) msg += ' Invoice emailed.';
      if (!isPastMode && sendNotification && data.sms?.sent) msg += ' Text sent.';
      else if (!isPastMode && sendNotification && data.sms?.skipped) msg += ` (SMS skipped: ${data.sms.reason})`;
```

---

### Task 4: Accept `job_date` on the server and skip notifications

**Files:**
- Modify: `routes/jobs.js`

- [ ] **Step 1: Destructure `job_date` from the request body**

Find:
```javascript
    const {
      customer_id,
      notes,
      estimated_completion,
      parts,
      other,
      services,
      charge_other,
      bike_id,
      send_notification,
      reminders,
    } = req.body;
```
Replace with:
```javascript
    const {
      customer_id,
      notes,
      estimated_completion,
      parts,
      other,
      services,
      charge_other,
      bike_id,
      send_notification,
      reminders,
      job_date,
    } = req.body;
```

- [ ] **Step 2: Pass `job_date` to `createJob`**

Find:
```javascript
    const jobId = createJob({ customer_id, notes, customer_cost, estimated_completion, parts, other, services, charge_other, bike_id });
```
Replace with:
```javascript
    const jobId = createJob({ customer_id, notes, customer_cost, estimated_completion, parts, other, services, charge_other, bike_id, job_date });
```

- [ ] **Step 3: Skip email and SMS when `job_date` is present**

Find:
```javascript
    // Always send invoice email (even if SMS is not opted in)
    let invoiceResult = null;
    if (customer) {
      try {
        invoiceResult = await sendInvoiceEmail(customer, { services, parts, charge_other, customer_cost, estimated_completion, notes, bike_name: bike?.name || null });
      } catch (err) {
        console.error('Invoice error:', err.message);
        invoiceResult = { skipped: true, reason: err.message };
      }
    }

    // Optionally send job-start SMS
    let smsResult = null;
    if (send_notification && customer) {
```
Replace with:
```javascript
    // Always send invoice email (even if SMS is not opted in) — skip for past jobs
    let invoiceResult = null;
    if (customer && !job_date) {
      try {
        invoiceResult = await sendInvoiceEmail(customer, { services, parts, charge_other, customer_cost, estimated_completion, notes, bike_name: bike?.name || null });
      } catch (err) {
        console.error('Invoice error:', err.message);
        invoiceResult = { skipped: true, reason: err.message };
      }
    }

    // Optionally send job-start SMS — skip for past jobs
    let smsResult = null;
    if (send_notification && customer && !job_date) {
```

- [ ] **Step 4: Use `job_date` in `createJob` in db/queries.js**

Open `db/queries.js` and find the `createJob` function. Look for where `date` is set on the insert. Find the INSERT statement for the jobs table and modify it to accept the optional `job_date`.

Find the `createJob` function (search for `function createJob`):
```javascript
function createJob({ customer_id, notes, customer_cost, estimated_completion, parts, other, services, charge_other, bike_id }) {
```
Replace with:
```javascript
function createJob({ customer_id, notes, customer_cost, estimated_completion, parts, other, services, charge_other, bike_id, job_date }) {
```

Then find the INSERT into `jobs` inside that function:
```javascript
  const jobId = run(
    'INSERT INTO jobs (customer_id, notes, customer_cost, estimated_completion, bike_id) VALUES (?, ?, ?, ?, ?)',
    [customer_id, notes || '', customer_cost || 0, estimated_completion || '', bike_id || null]
  );
```
Replace with:
```javascript
  const jobId = run(
    job_date
      ? 'INSERT INTO jobs (customer_id, notes, customer_cost, estimated_completion, bike_id, date) VALUES (?, ?, ?, ?, ?, ?)'
      : 'INSERT INTO jobs (customer_id, notes, customer_cost, estimated_completion, bike_id) VALUES (?, ?, ?, ?, ?)',
    job_date
      ? [customer_id, notes || '', customer_cost || 0, estimated_completion || '', bike_id || null, job_date]
      : [customer_id, notes || '', customer_cost || 0, estimated_completion || '', bike_id || null]
  );
```

---

### Task 5: Verify end-to-end

- [ ] Restart the server (`npm start`)
- [ ] Go to `http://localhost:3000` — confirm the small "Log Past Job" link is present below the grid
- [ ] Click it — confirm the page shows "Log Past Job" as the save button, a date field at the top, and no notifications card
- [ ] Fill in a customer, set a past date (e.g. 2026-01-15), add a service, and save
- [ ] Confirm success message appears with no mention of email or SMS
- [ ] Go to `http://localhost:3000/report.html` and generate a report covering the past date — confirm the job appears
- [ ] Do a normal new job from the homepage "Start a Job" button — confirm the date field is absent and notifications card is still visible
