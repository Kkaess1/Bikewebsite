require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDb } = require('./db/setup');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'brads-bikes-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
}));

// Routes
const authRoutes     = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const jobRoutes      = require('./routes/jobs');
const reportRoutes   = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const partsRoutes    = require('./routes/parts');
const bikesRoutes    = require('./routes/bikes');

app.use('/', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/jobs',      jobRoutes);
app.use('/api/reports',   reportRoutes);
app.use('/api/settings',  settingsRoutes);
app.use('/api/parts',     partsRoutes);
app.use('/api/bikes',     bikesRoutes);

// Require login for HTML pages (login page excepted); CSS/JS stay public
app.use((req, res, next) => {
  const isPage = req.path === '/' || req.path.endsWith('.html');
  if (!isPage || req.path === '/login.html') return next();
  if (req.session && req.session.authenticated) return next();
  res.redirect('/login');
});

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// ─── Follow-up Reminder Scheduler ────────────────────────────────────────────
function startReminderScheduler() {
  const { getDueReminders, markReminderSent, getSetting } = require('./db/queries');
  const nodemailer = require('nodemailer');

  const GATEWAYS = {
    att: 'txt.att.net', verizon: 'vtext.com', tmobile: 'tmomail.net',
    boost: 'sms.myboostmobile.com', cricket: 'sms.cricketwireless.net',
    metro: 'mymetropcs.com', uscellular: 'email.uscc.net',
  };

  async function sendSmsDirect(phone, carrier, text, transporter, from) {
    if (!phone || !carrier) return;
    const gateway = GATEWAYS[carrier];
    if (!gateway) return;
    // US numbers only: gateways need the bare 10 digits (any +1 prefix stripped)
    let digits = String(phone).replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
    if (digits.length !== 10) return;
    await transporter.sendMail({ from, to: `${digits}@${gateway}`, subject: 'B-Rads Bikes', text });
  }

  async function processReminders() {
    let due;
    try {
      due = getDueReminders();
    } catch (err) {
      console.error('Reminder scheduler error (getDueReminders):', err.message);
      return;
    }
    if (!due || due.length === 0) return;

    const gmailUser = getSetting('gmail_user');
    const gmailPass = getSetting('gmail_app_password');
    if (!gmailUser || !gmailPass) return;

    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailPass } });
    const shopPhone   = getSetting('shop_phone');
    const shopCarrier = getSetting('shop_carrier');

    for (const r of due) {
      try {
        await sendSmsDirect(r.phone, r.carrier, r.cust_message, transporter, gmailUser);
        if (shopPhone && shopCarrier) {
          await sendSmsDirect(shopPhone, shopCarrier, r.shop_message, transporter, gmailUser);
        }
        markReminderSent(r.id);
        console.log(`Reminder sent: ${r.customer_name} — ${r.part_name}`);
      } catch (err) {
        console.error(`Reminder failed for reminder ${r.id}:`, err.message);
      }
    }
  }

  // Check immediately on startup, then every 15 minutes
  processReminders();
  setInterval(processReminders, 15 * 60 * 1000);
}

// Start server after DB is ready
initDb().then(() => {
  startReminderScheduler();
  app.listen(PORT, () => {
    console.log(`B-Rads Bikes running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
