const express = require('express');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const requireAuth = require('../middleware/requireAuth');
const { getSetting, setSetting } = require('../db/queries');
const router = express.Router();

router.use(requireAuth);

// GET /api/settings — returns non-sensitive settings for the UI
router.get('/', (req, res) => {
  res.json({
    gmail_user: getSetting('gmail_user') || '',
    password_set: !!(getSetting('password_hash')),
    gmail_configured: !!(getSetting('gmail_user') && getSetting('gmail_app_password')),
    shop_phone: getSetting('shop_phone') || '',
    shop_carrier: getSetting('shop_carrier') || '',
  });
});

// POST /api/settings/password — change login password
router.post('/password', (req, res) => {
  const { current_password, new_password } = req.body;

  if (!new_password || new_password.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }

  // Verify current password
  const storedHash = getSetting('password_hash') ||
    bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'bikeshop123', 10);

  if (!bcrypt.compareSync(current_password || '', storedHash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const newHash = bcrypt.hashSync(new_password, 10);
  setSetting('password_hash', newHash);
  res.json({ success: true });
});

// POST /api/settings/gmail — save Gmail credentials
router.post('/gmail', (req, res) => {
  const { gmail_user, gmail_app_password } = req.body;

  if (!gmail_user || !gmail_user.includes('@')) {
    return res.status(400).json({ error: 'Please enter a valid Gmail address' });
  }
  if (!gmail_app_password || gmail_app_password.trim().length < 8) {
    return res.status(400).json({ error: 'Please enter your Gmail App Password' });
  }

  setSetting('gmail_user', gmail_user.trim());
  setSetting('gmail_app_password', gmail_app_password.trim());
  res.json({ success: true });
});

// POST /api/settings/gmail/test — send a test SMS to verify Gmail works
router.post('/gmail/test', async (req, res) => {
  const { test_phone, test_carrier } = req.body;

  const gmailUser = getSetting('gmail_user');
  const gmailPass = getSetting('gmail_app_password');

  if (!gmailUser || !gmailPass) {
    return res.status(400).json({ error: 'Gmail not configured yet — save your Gmail settings first' });
  }

  const GATEWAYS = {
    att: 'txt.att.net', verizon: 'vtext.com', tmobile: 'tmomail.net',
    boost: 'sms.myboostmobile.com', cricket: 'sms.cricketwireless.net',
    metro: 'mymetropcs.com', uscellular: 'email.uscc.net',
  };

  if (!test_phone || !test_carrier || !GATEWAYS[test_carrier]) {
    return res.status(400).json({ error: 'Please enter a phone number and select a carrier for the test' });
  }

  const digits = test_phone.replace(/\D/g, '');
  const to = `${digits}@${GATEWAYS[test_carrier]}`;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });
    await transporter.sendMail({
      from: gmailUser,
      to,
      subject: '',
      text: "Test message from B-Rads Bikes — your SMS notifications are working!",
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: `Failed to send: ${err.message}` });
  }
});

// POST /api/settings/shop — save shop phone/carrier for follow-up reminder texts to owner
router.post('/shop', (req, res) => {
  const { shop_phone, shop_carrier } = req.body;
  if (shop_phone !== undefined) setSetting('shop_phone', (shop_phone || '').trim());
  if (shop_carrier !== undefined) setSetting('shop_carrier', shop_carrier);
  res.json({ success: true });
});

module.exports = router;
