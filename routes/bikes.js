const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { getAllBikes, createBike, updateBike, deleteBike } = require('../db/queries');
const router = express.Router();

router.use(requireAuth);

// GET /api/bikes
router.get('/', (req, res) => {
  try {
    res.json(getAllBikes());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load bikes' });
  }
});

// POST /api/bikes
router.post('/', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Bike name is required' });
    }
    const bike = createBike({ name, description });
    res.status(201).json(bike);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create bike' });
  }
});

// PUT /api/bikes/:id
router.put('/:id', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Bike name is required' });
    }
    updateBike(parseInt(req.params.id), { name, description });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update bike' });
  }
});

// DELETE /api/bikes/:id
router.delete('/:id', (req, res) => {
  try {
    deleteBike(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete bike' });
  }
});

module.exports = router;
