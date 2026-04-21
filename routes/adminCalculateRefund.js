const fs = require('fs');
const path = require('path');
const { shopifyFetch, shopifyPost } = require('../utils/shopify');

const DATA_FILE = path.join(__dirname, '..', 'data', 'submissions.json');
const FREE_DELIVERY_THRESHOLD = 70;
const DELIVERY_CHARGE = 2.99;

module.exports = async function adminCalculateRefund(req, res) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.body.token !== secret) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  const { submissionId } = req.body;
  if (!submissionId) {
    return res.status(400).json({ success: false, message: 'Missing submissionId' });
  }

  let submissions = [];
  if (fs.existsSync(DATA_FILE)) {
    try { submissions = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}
  }
  const submission = submissions.find(s => String(s.id) === String(submissionId));
  if (!submission) {
    return res.status(404).json({ success: false, message: 'Submission not found' });
  }

  const shopifyOrderId = submission.shopifyOrderId;
  if (!shopifyOrderId) {
    return res.status(400).json({ success: false, message: 'No Shopify order ID on this submission. Cannot process automatically.' });
  }

  try {
    // Fetch order (includes refunds, line items, shipping)
    const orderData = await shopifyFetch(`/orders/${shopifyOrderId}.json`);
    const order = orderData.order;

    // Build a map of already-refunded quantities by line item ID
    const refundedQty = {};
    for (const refund of (order.refunds || [])) {
      for (const rli of (refund.refund_line_items || [])) {
        const lid = String(rli.line_item_id);
        refundedQty[lid] = (refundedQty[lid] || 0) + rli.quantity;
      }
    }

    // Build a map of order line items by SKU (fallback for old submissions without lineItemId)
    const lineItemBySku = {};
    for (const li of (order.line_items || [])) {
      if (li.sku) lineItemBySku[li.sku] = li;
    }

    // Resolve lineItemId for each submission item and check for discrepancies
    let hasDiscrepancy = false;
    let allAlreadyRefunded = true;
    const discrepancyDetails = [];
    const resolvedItems = [];

    for (const item of submission.items) {
      let lineItemId = item.lineItemId;
      if (!lineItemId && item.sku) lineItemId = lineItemBySku[item.sku]?.id;

      const alreadyRefunded = refundedQty[String(lineItemId)] || 0;
      const requested = item.quantityToReturn;

      if (alreadyRefunded > 0 && alreadyRefunded < requested) {
        hasDiscrepancy = true;
        discrepancyDetails.push(`${item.sku || item.title}: ${alreadyRefunded} of ${requested} already refunded`);
      }

      if (alreadyRefunded < requested) {
        allAlreadyRefunded = false;
      }

      resolvedItems.push({ ...item, lineItemId });
    }

    if (hasDiscrepancy) {
      return res.json({
        success: true,
        discrepancy: true,
        discrepancyDetails,
        shopifyOrderId,
        orderNumber: submission.orderNumber,
      });
    }

    if (allAlreadyRefunded) {
      return res.json({
        success: true,
        alreadyProcessed: true,
        shopifyOrderId,
        orderNumber: submission.orderNumber,
      });
    }

    // Build refund_line_items for calculation
    const refundLineItems = resolvedItems
      .filter(item => item.lineItemId)
      .map(item => ({
        line_item_id: item.lineItemId,
        quantity: item.quantityToReturn,
        restock_type: 'return',
      }));

    if (refundLineItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Could not match submission items to Shopify line items. Please refund manually.' });
    }

    // Ask Shopify to calculate refund amounts
    const calcResult = await shopifyPost(`/orders/${shopifyOrderId}/refunds/calculate.json`, {
      refund: {
        shipping: { full_refund: false, amount: '0.00' },
        refund_line_items: refundLineItems,
      },
    });

    const calculatedRefund = calcResult.refund;
    const totalRefundAmount = parseFloat(
      calculatedRefund.transactions?.[0]?.amount || 0
    );

    // Check free delivery and £70 threshold
    const shippingPaid = parseFloat(order.total_shipping_price_set?.shop_money?.amount || 0);
    const hasFreeDelivery = (order.shipping_lines || []).length > 0 && shippingPaid === 0;

    const returnValue = resolvedItems.reduce((sum, item) => {
      return sum + parseFloat(item.price) * (item.quantityToReturn || 1);
    }, 0);

    const currentSubtotal = parseFloat(order.current_subtotal_price || order.subtotal_price || 0);
    const remainingSubtotal = currentSubtotal - returnValue;
    const isStoreCreditOrExchange = (submission.refundPreference || '').toLowerCase().includes('store credit') ||
                                    (submission.refundPreference || '').toLowerCase().includes('exchange');
    const applyDeliveryDeduction = hasFreeDelivery && remainingSubtotal < FREE_DELIVERY_THRESHOLD && !isStoreCreditOrExchange;
    const finalRefundAmount = applyDeliveryDeduction
      ? Math.max(0, totalRefundAmount - DELIVERY_CHARGE)
      : totalRefundAmount;

    // Get original payment transaction
    const txData = await shopifyFetch(`/orders/${shopifyOrderId}/transactions.json`);
    const originalTransaction = (txData.transactions || [])
      .filter(t => t.kind === 'sale' || t.kind === 'capture')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

    // Attach per-item calculated amounts
    const itemsWithAmounts = resolvedItems.map(item => {
      const rli = (calculatedRefund.refund_line_items || []).find(
        r => String(r.line_item_id) === String(item.lineItemId)
      );
      return {
        ...item,
        calculatedAmount: parseFloat(rli?.subtotal || 0),
      };
    });

    // Build "other items" — order line items not included in this return
    const returningLineItemIds = new Set(resolvedItems.map(i => String(i.lineItemId)));
    const otherItems = (order.line_items || [])
      .filter(li => !returningLineItemIds.has(String(li.id)))
      .map(li => ({
        title: li.title,
        variantTitle: li.variant_title || '',
        sku: li.sku || '',
        quantity: li.quantity,
        price: li.price,
      }));

    return res.json({
      success: true,
      discrepancy: false,
      alreadyProcessed: false,
      totalRefundAmount,
      finalRefundAmount,
      applyDeliveryDeduction,
      remainingSubtotal: Math.round(remainingSubtotal * 100) / 100,
      hasFreeDelivery,
      shippingPaid,
      refundLineItems,
      originalTransactionId: originalTransaction?.id || null,
      originalGateway: originalTransaction?.gateway || null,
      refundPreference: submission.refundPreference,
      items: itemsWithAmounts,
      otherItems,
    });

  } catch (error) {
    console.error('adminCalculateRefund error:', error);
    return res.status(500).json({ success: false, message: `Failed to calculate refund: ${error.message}` });
  }
};
