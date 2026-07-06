const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const router = express.Router();

// Fallback hash used only before a password has been set via the settings page
const FALLBACK_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'bikeshop123', 10);

function getPasswordHash() {
  try {
    const { getSetting } = require('../db/queries');
    return getSetting('password_hash') || FALLBACK_HASH;
  } catch {
    return FALLBACK_HASH;
  }
}

// Serve login page
router.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

// Brute-force protection: 5 failed attempts locks login for 15 minutes per IP
const failedAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

// Handle login form submission
router.post('/api/login', (req, res) => {
  const rec = failedAttempts.get(req.ip);
  if (rec && rec.count >= MAX_ATTEMPTS && Date.now() - rec.last < LOCKOUT_MS) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
  }
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }
  if (bcrypt.compareSync(password, getPasswordHash())) {
    failedAttempts.delete(req.ip);
    req.session.authenticated = true;
    return res.json({ success: true });
  }
  const count = (rec && Date.now() - rec.last < LOCKOUT_MS) ? rec.count + 1 : 1;
  failedAttempts.set(req.ip, { count, last: Date.now() });
  res.status(401).json({ error: 'Incorrect password' });
});

// Auth check
router.get('/api/auth/check', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.json({ authenticated: true });
  }
  res.status(401).json({ authenticated: false });
});

// Logout
router.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

module.exports = router;
