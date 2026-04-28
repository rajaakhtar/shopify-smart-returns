const fs = require('fs');
const path = require('path');
const { shopifyFetch } = require('../utils/shopify');
const { calculateReturnsRate } = require('../utils/returnsRate');

const DATA_FILE = path.join(__dirname, '..', 'data', 'submissions.json');

/**
 * POST /proxy/api/lookup-order
 * Body: { orderNumber: string, email: string }
 *
 * Looks up the order in Shopify, verifies email matches, returns order data with line items.
 */
module.exports = async function lookupOrder(req, res) {
  try {
    const { orderNumber, email } = req.body;

    if (!orderNumber || !email) {
      return res.json({ success: false, message: 'Order number and email are required.' });
    }

    // Strip '#' and whitespace from order number
    const cleanOrderNumber = orderNumber.replace(/[#\s]/g, '');

    // Query Shopify Admin API
    const data = await shopifyFetch(`/orders.json?name=${encodeURIComponent(cleanOrderNumber)}&status=any`);

    if (!data.orders || data.orders.length === 0) {
      return res.json({ success: false, message: 'Order not found. Please check your order number and try again.' });
    }

    const order = data.orders[0];

    // Verify email matches (case-insensitive)
    const orderEmail = (order.email || '').trim().toLowerCase();
    const submittedEmail = (email || '').trim().toLowerCase();

    if (orderEmail !== submittedEmail) {
      return res.json({ success: false, message: 'The email address does not match this order.' });
    }

    // Format order date as "15 March 2025"
    const orderDate = new Date(order.created_at);
    const formattedDate = orderDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Build customer name
    const customerName = order.customer
      ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
      : 'Customer';

    // For variants with no variant-specific image, fall back to the product's main image
    const productImages = {};
    const missingImageIds = [...new Set(
      order.line_items
        .filter(item => !item.image?.src && item.product_id)
        .map(item => item.product_id)
    )];
    if (missingImageIds.length > 0) {
      await Promise.allSettled(
        missingImageIds.map(async (productId) => {
          const d = await shopifyFetch(`/products/${productId}.json?fields=id,image`);
          productImages[productId] = d.product?.image?.src || '';
        })
      );
    }

    const lineItems = order.line_items.map(item => ({
      id: item.id,
      lineItemId: item.id,
      title: item.title,
      variantTitle: item.variant_title || '',
      sku: item.sku || '',
      quantity: item.quantity,
      price: item.price,
      currency: order.currency,
      imageUrl: item.image?.src || productImages[item.product_id] || '',
    }));

    // Check for existing open submission for this order
    const formattedOrderNumber = `#${order.order_number}`;
    let submissions = [];
    if (fs.existsSync(DATA_FILE)) {
      try { submissions = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}
    }
    const openSubmission = submissions.find(s =>
      s.orderNumber === formattedOrderNumber && s.status !== 'processed' && s.status !== 'cancelled'
    );
    if (openSubmission) {
      return res.json({
        success: false,
        hasOpenSubmission: true,
        orderNumber: formattedOrderNumber,
        customerName,
        customerEmail: order.email,
      });
    }

    // Check returns rate — block if above 40% with at least 4 orders
    try {
      const customerId = order.customer?.id || null;
      const { rate, totalOrders } = await calculateReturnsRate(customerId, order.email);
      if (rate > 40 && totalOrders >= 4) {
        return res.json({
          success: false,
          isBlocked: true,
          rate,
        });
      }
    } catch {}

    return res.json({
      success: true,
      order: {
        orderNumber: formattedOrderNumber,
        shopifyOrderId: order.id,
        orderDate: formattedDate,
        customerName,
        customerEmail: order.email,
        customerId: order.customer?.id || null,
        lineItems,
      },
    });
  } catch (error) {
    console.error('lookupOrder error:', error);
    return res.json({ success: false, message: 'An error occurred while looking up your order. Please try again.' });
  }
};
