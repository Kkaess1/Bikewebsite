const express = require('express');
const nodemailer = require('nodemailer');
const requireAuth = require('../middleware/requireAuth');
const { createJob, getJobById, updateJob, getCustomerById, getBikeById, createReminder, getSetting } = require('../db/queries');
const router = express.Router();

router.use(requireAuth);

// ─── HTML escape helper ───────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Carrier gateway map ──────────────────────────────────────────────────────
const GATEWAYS = {
  att:       'txt.att.net',
  verizon:   'vtext.com',
  tmobile:   'tmomail.net',
  boost:     'sms.myboostmobile.com',
  cricket:   'sms.cricketwireless.net',
  metro:     'mymetropcs.com',
  uscellular:'email.uscc.net',
};

// ─── Nodemailer transporter factory ──────────────────────────────────────────
function makeTransporter() {
  const gmailUser = getSetting('gmail_user') || process.env.GMAIL_USER;
  const gmailPass = getSetting('gmail_app_password') || process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass || gmailUser.includes('your@gmail')) return null;
  return {
    transporter: nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } }),
    from: gmailUser,
  };
}

// ─── Send SMS via email-to-SMS gateway ───────────────────────────────────────
async function sendSms(phone, carrier, text) {
  const t = makeTransporter();
  if (!t) return { skipped: true, reason: 'Gmail not configured' };
  if (!phone) return { skipped: true, reason: 'No phone number on file' };
  const gateway = GATEWAYS[carrier];
  if (!gateway) return { skipped: true, reason: 'No carrier on file — cannot determine SMS gateway' };
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return { skipped: true, reason: 'Phone number too short' };
  await t.transporter.sendMail({ from: t.from, to: `${digits}@${gateway}`, subject: 'B-Rads Bikes', text });
  return { sent: true };
}

function getShopContactText() {
  const configured = (getSetting('shop_phone') || '').trim();
  return configured || '(714)-235-5959';
}

// ─── Send job-start SMS ───────────────────────────────────────────────────────
async function sendJobStartSms(customer, estimatedCompletion, customerCost, services) {
  const completionFormatted = estimatedCompletion
    ? new Date(estimatedCompletion + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : null;
  const completion = completionFormatted ? ` Estimated completion: ${completionFormatted}.` : '';
  const cost = customerCost > 0 ? ` Total: $${Number(customerCost).toFixed(2)}.` : '';
  const serviceItems = (services || []).filter(s => s.description?.trim()).map(s => s.description.trim());
  const servicesText = serviceItems.length > 0 ? ` Services: ${serviceItems.join(', ')}.` : '';

  const shopContact = getShopContactText();
  const text = `Hi ${customer.name}, I've started working on your bike!${servicesText}${cost}${completion} I'll reach out when it's ready. Please do not reply to this message. Please text ${shopContact} if you need to reach me.`;
  try {
    return await sendSms(customer.phone, customer.carrier, text);
  } catch (err) {
    console.error('SMS send failed:', err.message);
    return { skipped: true, reason: err.message };
  }
}


// ─── Build invoice HTML (shared by email + print) ────────────────────────────
function buildInvoiceHtml(customer, { services, charge_other, customer_cost, estimated_completion, notes, bike_name, job_date }, { forPrint = false } = {}) {
  const d = job_date ? new Date(job_date + 'T12:00:00') : new Date();
  const dateFormatted = `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`;

  const completionFormatted = estimated_completion
    ? new Date(estimated_completion + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
    : null;

  const border = '1px solid #000';
  const cellStyle = `padding:6px 10px;border-bottom:${border};`;
  // Parts (shop expenses) are intentionally excluded from the customer-facing invoice
  const allItems = [
    ...(services     || []).filter(s => s.description?.trim()).map(s => ({ desc: s.description, price: s.price })),
    ...(charge_other || []).filter(o => o.description?.trim()).map(o => ({ desc: o.description, price: o.price })),
  ];
  const allItemsHtml = allItems.map(item =>
    `<tr><td style="${cellStyle}">${escapeHtml(item.desc)}</td><td style="${cellStyle}width:90px;">$${Number(item.price).toFixed(2)}</td></tr>`
  ).join('');

  const printBtn = forPrint ? `
  <div style="text-align:center;margin-bottom:20px;">
    <button onclick="window.print()" style="padding:10px 28px;background:#002244;color:#fff;border:none;border-radius:6px;font-size:1rem;font-weight:600;cursor:pointer;">Print</button>
  </div>` : '';

  const printStyle = forPrint ? `<style>@media print { button { display:none !important; } }</style>` : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${printStyle}</head>
<body style="font-family:Arial,sans-serif;max-width:650px;margin:0 auto;padding:20px;color:#333;background:#fff;">

  ${printBtn}

  <h1 style="text-align:center;font-size:2rem;font-weight:bold;margin:0 0 4px;">Invoice</h1>
  <p style="text-align:center;font-weight:bold;margin:0 0 16px;">B-Rad and ride a bike</p>

  <table style="width:100%;border-collapse:collapse;border:${border};">
    <tr>
      <td style="padding:6px 10px;border-right:${border};width:70%;"></td>
      <td style="padding:6px 10px;"><strong>Date Created: ${dateFormatted}</strong></td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;border:${border};border-top:none;">
    <tr>
      <td colspan="3" style="text-align:center;font-weight:bold;font-size:1rem;padding:8px;border-bottom:${border};">Customer Info</td>
    </tr>
    <tr>
      <td style="${cellStyle}border-right:${border};width:14%;">Name</td>
      <td colspan="2" style="${cellStyle}">${escapeHtml(customer.name || '')}</td>
    </tr>
    <tr>
      <td style="${cellStyle}border-right:${border};">Phone</td>
      <td style="${cellStyle}border-right:${border};width:36%;">${customer.phone || ''}</td>
      <td style="${cellStyle}"><strong>Bike Make/Model</strong><br>${escapeHtml(bike_name || '')}</td>
    </tr>
    <tr>
      <td style="padding:6px 10px;border-right:${border};">Email</td>
      <td colspan="2" style="padding:6px 10px;">${customer.email || ''}</td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;border:${border};border-top:none;">
    <tr>
      <td colspan="2" style="text-align:center;font-weight:bold;font-size:1rem;padding:8px;border-bottom:${border};">Work Performed</td>
    </tr>
    ${allItemsHtml}
    <tr>
      <td style="padding:8px 10px;border-top:2px solid #000;text-align:right;font-weight:bold;">Grand Total</td>
      <td style="padding:8px 10px;border-top:2px solid #000;font-weight:bold;width:90px;">$${Number(customer_cost).toFixed(2)}</td>
    </tr>
  </table>

  ${completionFormatted ? `
  <table style="width:100%;border-collapse:collapse;border:${border};border-top:none;">
    <tr>
      <td style="padding:8px 10px;">Completion Date: <strong>${completionFormatted}</strong></td>
    </tr>
  </table>` : ''}

  ${notes ? `
  <table style="width:100%;border-collapse:collapse;border:${border};border-top:none;">
    <tr>
      <td style="text-align:center;font-weight:bold;font-size:1rem;padding:8px;border-bottom:${border};">Observations of Bike</td>
    </tr>
    <tr>
      <td style="padding:8px 10px;">${escapeHtml(notes)}</td>
    </tr>
  </table>` : ''}

  <p style="text-align:center;font-style:italic;margin-top:24px;">&ldquo;I treat your bike like it&rsquo;s mine until you come pick it up&rdquo;</p>
</body></html>`;
}

// ─── Send invoice email ───────────────────────────────────────────────────────
async function sendInvoiceEmail(customer, jobData) {
  if (!customer.email) return { skipped: true, reason: 'No email on file' };
  const t = makeTransporter();
  if (!t) return { skipped: true, reason: 'Gmail not configured' };
  const html = buildInvoiceHtml(customer, jobData);
  try {
    await t.transporter.sendMail({ from: t.from, to: customer.email, subject: 'B-Rads Bikes — Service Invoice', html });
    return { sent: true };
  } catch (err) {
    console.error('Invoice email failed:', err.message);
    return { skipped: true, reason: err.message };
  }
}

// ─── POST /api/jobs ───────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
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
      is_past_job,
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: 'Customer is required' });
    }

    // Compute customer_cost server-side: services + charge_other (labor removed)
    const services_total     = (services || []).reduce((s, sv) => s + (parseFloat(sv.price) || 0), 0);
    const charge_other_total = (charge_other || []).reduce((s, co) => s + (parseFloat(co.price) || 0), 0);
    const customer_cost = services_total + charge_other_total;

    const jobId = createJob({ customer_id, notes, customer_cost, estimated_completion, parts, other, services, charge_other, bike_id, job_date });

    const customer = getCustomerById(parseInt(customer_id));
    const bike = bike_id ? getBikeById(parseInt(bike_id)) : null;

    // Schedule follow-up reminders if opted in
    if (reminders && reminders.length > 0 && customer) {
      const shopContact = getShopContactText();
      for (const r of reminders) {
        if (!r.part_name || !r.follow_up_value || !r.follow_up_unit) continue;
        const sendAt = new Date();
        const val = parseInt(r.follow_up_value);
        if (r.follow_up_unit === 'days')        sendAt.setDate(sendAt.getDate() + val);
        else if (r.follow_up_unit === 'weeks')  sendAt.setDate(sendAt.getDate() + val * 7);
        else if (r.follow_up_unit === 'months') sendAt.setMonth(sendAt.getMonth() + val);

        createReminder({
          job_id: jobId,
          customer_id: parseInt(customer_id),
          part_name: r.part_name,
          send_at: sendAt.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ''),
          cust_message: `Hi ${customer.name}, This is a reminder from B-Rad's Bikes! It might be time for your ${r.part_name} service. Contact me if you'd like to schedule a service. (714) 235-5959\nPlease do not reply to this message.`,
          shop_message: `B-Rads Bikes reminder: ${customer.name} (${customer.phone || 'no phone'}) has been notified that it's time for their ${r.part_name} service.`,
        });
      }
    }

    // Always send invoice email (even if SMS is not opted in) — skip for past jobs
    let invoiceResult = null;
    if (customer && !is_past_job) {
      try {
        invoiceResult = await sendInvoiceEmail(customer, { services, parts, charge_other, customer_cost, estimated_completion, notes, bike_name: bike?.name || null, job_date: undefined });
      } catch (err) {
        console.error('Invoice error:', err.message);
        invoiceResult = { skipped: true, reason: err.message };
      }
    }

    // Optionally send job-start SMS — skip for past jobs
    let smsResult = null;
    if (send_notification && customer && !is_past_job) {
      try {
        smsResult = await sendJobStartSms(customer, estimated_completion, customer_cost, services);
      } catch (smsErr) {
        console.error('SMS error:', smsErr.message);
        smsResult = { skipped: true, reason: smsErr.message };
      }
    }

    res.status(201).json({ id: jobId, sms: smsResult, invoice: invoiceResult });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save job' });
  }
});

// ─── GET /api/jobs/:id/invoice — printable invoice page ──────────────────────
router.get('/:id/invoice', (req, res) => {
  try {
    const job = getJobById(parseInt(req.params.id));
    if (!job) return res.status(404).send('Job not found');
    const customer = getCustomerById(job.customer_id);
    if (!customer) return res.status(404).send('Customer not found');
    const html = buildInvoiceHtml(customer, {
      services: job.services,
      charge_other: job.charge_other,
      customer_cost: job.customer_cost,
      estimated_completion: job.estimated_completion,
      notes: job.notes,
      bike_name: job.bike_name,
      job_date: job.date,
    }, { forPrint: true });
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to generate invoice');
  }
});

// ─── POST /api/jobs/:id/resend-invoice — resend invoice email ─────────────────
router.post('/:id/resend-invoice', async (req, res) => {
  try {
    const job = getJobById(parseInt(req.params.id));
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const customer = getCustomerById(job.customer_id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const result = await sendInvoiceEmail(customer, {
      services: job.services,
      charge_other: job.charge_other,
      customer_cost: job.customer_cost,
      estimated_completion: job.estimated_completion,
      notes: job.notes,
      bike_name: job.bike_name,
      job_date: job.date,
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to resend invoice' });
  }
});

// ─── GET /api/jobs/:id/data — fetch job for editing ──────────────────────────
router.get('/:id/data', (req, res) => {
  try {
    const job = getJobById(parseInt(req.params.id));
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// ─── PUT /api/jobs/:id — update existing job ─────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { customer_id, notes, estimated_completion, parts, other, services, charge_other, bike_id } = req.body;

    if (!customer_id) return res.status(400).json({ error: 'Customer is required' });

    const services_total     = (services || []).reduce((s, sv) => s + (parseFloat(sv.price) || 0), 0);
    const charge_other_total = (charge_other || []).reduce((s, co) => s + (parseFloat(co.price) || 0), 0);
    const customer_cost = services_total + charge_other_total;

    updateJob(id, { customer_id, notes, customer_cost, estimated_completion, parts: parts || [], other: other || [], services: services || [], charge_other: charge_other || [], bike_id });
    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

module.exports = router;
