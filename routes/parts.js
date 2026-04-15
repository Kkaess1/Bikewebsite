const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { getAllParts, getPartById, createPart, updatePart, deletePart } = require('../db/queries');
const router = express.Router();

router.use(requireAuth);

// GET /api/parts
router.get('/', (req, res) => {
  try {
    res.json(getAllParts());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load parts' });
  }
});

// POST /api/parts
router.post('/', (req, res) => {
  try {
    const { name, note, follow_up_value, follow_up_unit } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Part name is required' });
    }
    const part = createPart({ name, note, follow_up_value, follow_up_unit });
    res.status(201).json(part);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create part' });
  }
});

// PUT /api/parts/:id
router.put('/:id', (req, res) => {
  try {
    const { name, note, follow_up_value, follow_up_unit } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Part name is required' });
    }
    updatePart(parseInt(req.params.id), { name, note, follow_up_value, follow_up_unit });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update part' });
  }
});

// DELETE /api/parts/:id
router.delete('/:id', (req, res) => {
  try {
    deletePart(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete part' });
  }
});

module.exports = router;
