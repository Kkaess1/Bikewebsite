const express = require('express');
const nodemailer = require('nodemailer');
const requireAuth = require('../middleware/requireAuth');
const { createJob, getJobById, updateJob, getCustomerById, getBikeById, createReminder, getSetting } = require('../db/queries');
const router = express.Router();

router.use(requireAuth);

// ─── Phone helpers (US numbers only) ──────────────────────────────────────────
// Display: (+1) xxx-xxx-xxxx. Sending: bare 10 digits (gateways require this).

function formatPhone(str) {
  const s = String(str || '').trim();
  let digits = s.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) return s;
  return `(+1) ${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Returns the bare 10-digit US number, or null if it isn't one
function usPhoneDigits(str) {
  let digits = String(str || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits.length === 10 ? digits : null;
}

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
  const digits = usPhoneDigits(phone);
  if (!digits) return { skipped: true, reason: 'Not a valid 10-digit US phone number' };
  await t.transporter.sendMail({ from: t.from, to: `${digits}@${gateway}`, subject: 'B-Rads Bikes', text });
  return { sent: true };
}

function getShopContactText() {
  const configured = formatPhone((getSetting('shop_phone') || '').trim());
  return configured || '(+1) 714-235-5959';
}

// ─── Send job-finished SMS ────────────────────────────────────────────────────
async function sendJobFinishedSms(customer, customerCost, services, invoiceWasEmailed) {
  const cost = customerCost > 0 ? ` Total: $${Number(customerCost).toFixed(2)}.` : '';
  const serviceItems = (services || []).filter(s => s.description?.trim()).map(s => s.description.trim());
  const servicesText = serviceItems.length > 0 ? ` Services: ${serviceItems.join(', ')}.` : '';
  const invoiceText = invoiceWasEmailed ? ' An invoice has been emailed to you.' : '';

  const shopContact = getShopContactText();
  const text = `Hi ${customer.name}, your bike is finished and ready for pickup!${servicesText}${cost}${invoiceText} Please do not reply to this message. Please text ${shopContact} if you need to reach me.`;
  try {
    return await sendSms(customer.phone, customer.carrier, text);
  } catch (err) {
    console.error('SMS send failed:', err.message);
    return { skipped: true, reason: err.message };
  }
}


// ─── Build invoice HTML (shared by email + print) ────────────────────────────
function buildInvoiceHtml(customer, { services, charge_other, customer_cost, estimated_completion, notes, bike_name, job_date }, { forPrint = false, intro = false } = {}) {
  const d = job_date ? new Date(job_date + 'T12:00:00') : new Date();
  const dateFormatted = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const completionFormatted = estimated_completion
    ? new Date(estimated_completion + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
    : null;

  // Parts (shop expenses) are intentionally excluded from the customer-facing invoice
  const allItems = [
    ...(services     || []).filter(s => s.description?.trim()).map(s => ({ desc: s.description, price: s.price })),
    ...(charge_other || []).filter(o => o.description?.trim()).map(o => ({ desc: o.description, price: o.price })),
  ];

  const labelStyle = `color:#8A97A5;font-size:11px;letter-spacing:1.5px;font-weight:bold;`;
  const itemCell = `padding:12px 0;font-size:14px;border-bottom:1px solid #E5E9EE;`;

  const itemRows = allItems.map(item => `
              <tr>
                <td style="${itemCell}">${escapeHtml(item.desc)}</td>
                <td style="${itemCell}" align="right">$${Number(item.price).toFixed(2)}</td>
              </tr>`).join('');

  const printBtn = forPrint ? `
  <div style="text-align:center;margin-bottom:20px;">
    <button onclick="window.print()" style="padding:10px 28px;background:#002244;color:#fff;border:none;border-radius:6px;font-size:1rem;font-weight:600;cursor:pointer;">Print</button>
  </div>` : '';

  const printStyle = forPrint ? `<style>@media print { button { display:none !important; } }</style>` : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${printStyle}</head>
<body style="font-family:Arial,Helvetica,sans-serif;color:#333333;background:#ffffff;margin:0;padding:24px 10px;">

  ${printBtn}

  ${intro ? `<p style="text-align:center;font-size:15px;margin:0 auto 18px;max-width:650px;">Your bike is finished and ready for pickup! Your invoice is below.</p>` : ''}

  <table role="presentation" width="650" cellpadding="0" cellspacing="0" align="center" style="max-width:650px;width:100%;margin:0 auto;border-collapse:collapse;border:1px solid #E5E9EE;">
    <tr>
      <td style="background:#002244;padding:22px 30px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td>
            <div style="color:#FFFFFF;font-size:21px;font-weight:bold;">B-Rads Bikes</div>
            <div style="color:#FA9B7E;font-size:12px;margin-top:2px;">B-Rad and ride a bike</div>
          </td>
          <td align="right">
            <div style="color:#9FB3C8;font-size:12px;letter-spacing:3px;">INVOICE</div>
            <div style="color:#FFFFFF;font-size:13px;margin-top:3px;">${dateFormatted}</div>
          </td>
        </tr></table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 30px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top">
            <div style="${labelStyle}">PREPARED FOR</div>
            <div style="font-size:15px;font-weight:bold;color:#1C2733;margin-top:4px;">${escapeHtml(customer.name || '')}</div>
            ${customer.phone ? `<div style="font-size:13px;color:#5C6B7A;margin-top:2px;">${escapeHtml(formatPhone(customer.phone))}</div>` : ''}
            ${customer.email ? `<div style="font-size:13px;color:#5C6B7A;">${escapeHtml(customer.email)}</div>` : ''}
          </td>
          <td valign="top" align="right">
            ${bike_name ? `<div style="${labelStyle}">BIKE</div>
            <div style="font-size:14px;color:#1C2733;margin-top:4px;">${escapeHtml(bike_name)}</div>` : ''}
            ${completionFormatted ? `<div style="${labelStyle}margin-top:${bike_name ? '10px' : '0'};">COMPLETED</div>
            <div style="font-size:13px;color:#1C2733;margin-top:3px;">${completionFormatted}</div>` : ''}
          </td>
        </tr></table>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 30px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:0 0 8px;${labelStyle}border-bottom:2px solid #002244;">WORK PERFORMED</td>
            <td style="padding:0 0 8px;border-bottom:2px solid #002244;" align="right"></td>
          </tr>
          ${itemRows || `<tr><td style="${itemCell}color:#8A97A5;" colspan="2">No itemized charges</td></tr>`}
          <tr>
            <td style="padding:16px 0 0;" align="right"></td>
            <td style="padding:16px 0 0;" align="right">
              <div style="${labelStyle}">TOTAL</div>
              <div style="color:#002244;font-size:26px;font-weight:bold;margin-top:2px;">$${Number(customer_cost).toFixed(2)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${notes ? `<tr>
      <td style="padding:20px 30px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="background:#F4F6F8;border-left:3px solid #FA4616;padding:12px 16px;font-size:13px;color:#44515F;">
            <span style="font-weight:bold;color:#1C2733;">Observations:</span>
            ${escapeHtml(notes)}
          </td>
        </tr></table>
      </td>
    </tr>` : ''}
    <tr>
      <td style="padding:26px 30px 28px;" align="center">
        <div style="font-family:Georgia,serif;font-style:italic;font-size:13px;color:#5C6B7A;">&ldquo;I treat your bike like it&rsquo;s mine until you come pick it up&rdquo;</div>
        <div style="font-size:12px;color:#8A97A5;margin-top:8px;">Questions? Text ${getShopContactText()}</div>
      </td>
    </tr>
  </table>
</body></html>`;
}

// ─── Send invoice email ───────────────────────────────────────────────────────
async function sendInvoiceEmail(customer, jobData) {
  if (!customer.email) return { skipped: true, reason: 'No email on file' };
  const t = makeTransporter();
  if (!t) return { skipped: true, reason: 'Gmail not configured' };
  const html = buildInvoiceHtml(customer, jobData, { intro: true });
  try {
    await t.transporter.sendMail({ from: t.from, to: customer.email, subject: 'Your bike is ready — B-Rads Bikes Invoice', html });
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
      tip,
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: 'Customer is required' });
    }
    if (job_date && !/^\d{4}-\d{2}-\d{2}$/.test(job_date)) {
      return res.status(400).json({ error: 'job_date must be in YYYY-MM-DD format' });
    }

    // Compute customer_cost server-side: services + charge_other (labor removed)
    const services_total     = (services || []).reduce((s, sv) => s + (parseFloat(sv.price) || 0), 0);
    const charge_other_total = (charge_other || []).reduce((s, co) => s + (parseFloat(co.price) || 0), 0);
    const customer_cost = services_total + charge_other_total;

    // Fall back to the server's local date (the DB default is UTC, which is wrong in the evening)
    const localToday = new Date().toLocaleDateString('en-CA');
    const jobId = createJob({ customer_id, notes, customer_cost, estimated_completion, parts, other, services, charge_other, bike_id, job_date: job_date || localToday, tip: parseFloat(tip) || 0 });

    const customer = getCustomerById(parseInt(customer_id));
    const bike = bike_id ? getBikeById(parseInt(bike_id)) : null;

    // Schedule follow-up reminders if opted in — skip for past jobs
    if (!is_past_job && reminders && reminders.length > 0 && customer) {
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
          cust_message: `Hi ${customer.name}, This is a reminder from B-Rad's Bikes! It might be time for your ${r.part_name} service. Contact me if you'd like to schedule a service. ${shopContact}\nPlease do not reply to this message.`,
          shop_message: `B-Rads Bikes reminder: ${customer.name} (${formatPhone(customer.phone) || 'no phone'}) has been notified that it's time for their ${r.part_name} service.`,
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

    // Optionally send job-finished SMS — skip for past jobs
    let smsResult = null;
    if (send_notification && customer && !is_past_job) {
      try {
        smsResult = await sendJobFinishedSms(customer, customer_cost, services, invoiceResult?.sent === true);
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
    const { customer_id, notes, parts, other, services, charge_other, bike_id, tip, job_date } = req.body;

    if (!customer_id) return res.status(400).json({ error: 'Customer is required' });
    if (job_date && !/^\d{4}-\d{2}-\d{2}$/.test(job_date)) {
      return res.status(400).json({ error: 'job_date must be in YYYY-MM-DD format' });
    }

    const services_total     = (services || []).reduce((s, sv) => s + (parseFloat(sv.price) || 0), 0);
    const charge_other_total = (charge_other || []).reduce((s, co) => s + (parseFloat(co.price) || 0), 0);
    const customer_cost = services_total + charge_other_total;

    updateJob(id, { customer_id, notes, customer_cost, parts: parts || [], other: other || [], services: services || [], charge_other: charge_other || [], bike_id, tip: parseFloat(tip) || 0, job_date });
    res.json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

module.exports = router;
