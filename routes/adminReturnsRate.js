const fs = require('fs');
const path = require('path');
const { shopifyFetch } = require('../utils/shopify');
const { calculateReturnsRate } = require('../utils/returnsRate');

const DATA_FILE = path.join(__dirname, '..', 'data', 'submissions.json');

module.exports = async function adminReturnsRate(req, res) {
  try {
    const { submissionId, token } = req.body;

    if (token !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (!submissionId) {
      return res.status(400).json({ success: false, message: 'Missing submissionId' });
    }

    let submissions = [];
    if (fs.existsSync(DATA_FILE)) {
      try { submissions = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}
    }

    const index = submissions.findIndex(s => String(s.id) === String(submissionId));
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    const submission = submissions[index];

    // Get customer ID from the order (no read_customers scope needed)
    let customerId = submission.customerId;
    if (!customerId) {
      const cleanOrderNumber = submission.orderNumber.replace(/[#\s]/g, '');
      const orderData = await shopifyFetch(`/orders.json?name=${encodeURIComponent(cleanOrderNumber)}&status=any&limit=1`);
      const order = (orderData.orders || [])[0];
      if (!order || !order.customer) {
        return res.status(400).json({ success: false, message: 'Could not find customer for this order' });
      }
      customerId = order.customer.id;
    }

    const { totalOrdered, totalReturned, rate } = await calculateReturnsRate(customerId, submission.customerEmail);

    submissions[index].returnsRate = { totalOrdered, totalReturned, rate };
    submissions[index].customerId = customerId;
    fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));

    return res.json({ success: true, totalOrdered, totalReturned, rate });
  } catch (err) {
    console.error('adminReturnsRate error:', err.message, err.stack);
    return res.status(500).json({ success: false, message: err.message || 'Failed to calculate returns rate' });
  }
};
