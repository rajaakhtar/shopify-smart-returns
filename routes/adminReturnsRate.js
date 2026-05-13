const { shopifyFetch } = require('../utils/shopify');
const { calculateReturnsRate } = require('../utils/returnsRate');
const store = require('../utils/store');

module.exports = async function adminReturnsRate(req, res) {
  try {
    const { submissionId, token } = req.body;

    if (token !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (!submissionId) {
      return res.status(400).json({ success: false, message: 'Missing submissionId' });
    }

    const found = store.findById(submissionId);
    if (!found) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    const submission = found.submission;

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

    store.update(submissionId, { returnsRate: { totalOrdered, totalReturned, rate }, customerId });

    return res.json({ success: true, totalOrdered, totalReturned, rate });
  } catch (err) {
    console.error('adminReturnsRate error:', err.message, err.stack);
    return res.status(500).json({ success: false, message: err.message || 'Failed to calculate returns rate' });
  }
};
