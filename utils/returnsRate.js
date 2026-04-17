const { shopifyFetch } = require('./shopify');

/**
 * Calculates a customer's returns rate across all historical orders.
 * Queries by both customer ID (account orders) and email (guest checkout orders)
 * and merges results to ensure complete history.
 * Physical returns: restock_type === 'return' or 'legacy_restock'.
 * Goodwill refunds (restock_type === 'no_restock') are excluded.
 */
async function calculateReturnsRate(customerId, customerEmail) {
  const allOrdersMap = new Map();

  if (customerId) {
    try {
      const data = await shopifyFetch(
        `/orders.json?customer_id=${customerId}&status=any&limit=250&created_at_min=2000-01-01T00:00:00Z`
      );
      for (const order of data.orders || []) allOrdersMap.set(order.id, order);
    } catch {}
  }

  if (customerEmail) {
    try {
      const data = await shopifyFetch(
        `/orders.json?email=${encodeURIComponent(customerEmail)}&status=any&limit=250&created_at_min=2000-01-01T00:00:00Z`
      );
      for (const order of data.orders || []) allOrdersMap.set(order.id, order);
    } catch {}
  }

  let totalOrdered = 0;
  let totalReturned = 0;

  for (const order of allOrdersMap.values()) {
    if (order.cancelled_at) continue;

    for (const item of order.line_items || []) {
      totalOrdered += item.quantity || 0;
    }

    for (const refund of order.refunds || []) {
      for (const refundItem of refund.refund_line_items || []) {
        if (refundItem.restock_type === 'return' || refundItem.restock_type === 'legacy_restock') {
          totalReturned += refundItem.quantity || 0;
        }
      }
    }
  }

  const rate = totalOrdered > 0 ? Math.round((totalReturned / totalOrdered) * 100) : 0;
  return { totalOrdered, totalReturned, rate, totalOrders: allOrdersMap.size };
}

module.exports = { calculateReturnsRate };
