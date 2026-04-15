const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const { searchCustomers, createCustomer, updateCustomer, deleteCustomer, getCustomerById } = require('../db/queries');
const router = express.Router();

router.use(requireAuth);

// GET /api/customers?q=john
router.get('/', (req, res) => {
  try {
    const q = req.query.q || '';
    const customers = searchCustomers(q);
    res.json(customers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search customers' });
  }
});

// GET /api/customers/:id — full profile with job history
router.get('/:id', (req, res) => {
  try {
    const customer = getCustomerById(parseInt(req.params.id));
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load customer' });
  }
});

// POST /api/customers — { name, phone, email }
router.post('/', (req, res) => {
  try {
    const { name, phone, email, carrier } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }
    const customer = createCustomer(name.trim(), phone, email, carrier);
    res.status(201).json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// PUT /api/customers/:id — update contact info
router.put('/:id', (req, res) => {
  try {
    const { name, phone, email, carrier } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }
    updateCustomer(parseInt(req.params.id), name.trim(), phone, email, carrier);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', (req, res) => {
  try {
    deleteCustomer(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

module.exports = router;
