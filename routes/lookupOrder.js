const { shopifyFetch } = require('../utils/shopify');

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

    // Map line items
    const lineItems = order.line_items.map(item => ({
      id: item.id,
      title: item.title,
      variantTitle: item.variant_title || '',
      quantity: item.quantity,
      price: item.price,
      currency: order.currency,
      imageUrl: item.image ? item.image.src : '',
    }));

    return res.json({
      success: true,
      order: {
        orderNumber: `#${order.order_number}`,
        orderDate: formattedDate,
        customerName,
        customerEmail: order.email,
        lineItems,
      },
    });
  } catch (error) {
    console.error('lookupOrder error:', error);
    return res.json({ success: false, message: 'An error occurred while looking up your order. Please try again.' });
  }
};
