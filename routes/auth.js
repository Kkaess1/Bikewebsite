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

// Handle login form submission
router.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }
  if (bcrypt.compareSync(password, getPasswordHash())) {
    req.session.authenticated = true;
    return res.json({ success: true });
  }
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
