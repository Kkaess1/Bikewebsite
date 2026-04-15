function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  // API requests get 401, page requests get redirect
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.redirect('/login');
}

module.exports = requireAuth;
