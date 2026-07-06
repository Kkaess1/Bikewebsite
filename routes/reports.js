const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { getReport } = require('../db/queries');
const router = express.Router();

router.use(requireAuth);

// GET /api/reports?from=2026-01-01&to=2026-03-29
router.get('/', (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to dates are required' });
    }
    // Basic date format validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format' });
    }
    if (from > to) {
      return res.status(400).json({ error: '"From" date must not be after "To" date' });
    }
    const data = getReport(from, to);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;
