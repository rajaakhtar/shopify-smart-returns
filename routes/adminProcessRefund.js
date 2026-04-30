const fs = require('fs');
const path = require('path');
const { shopifyFetch, shopifyPost } = require('../utils/shopify');

const DATA_FILE = path.join(__dirname, '..', 'data', 'submissions.json');

function buildNoteText(submission, method, giftCardCode, applyDeliveryDeduction, finalAmount) {
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const methodLabel = method === 'gift_card'
    ? `Store credit — gift card issued (${giftCardCode || 'see gift cards'})`
    : `Original payment — £${parseFloat(finalAmount).toFixed(2)}${applyDeliveryDeduction ? ' (includes £2.99 delivery deduction — remaining order fell below £70 threshold)' : ''}`;

  const itemLines = (submission.items || []).map(item => {
    const reasonText = item.otherReason
      ? `${item.reason}: ${item.otherReason}`
      : item.reason;
    const comments = item.comments ? ` | Note: ${item.comments}` : '';
    return `  ${item.sku || item.title} x${item.quantityToReturn} — ${reasonText}${comments}`;
  });

  return [
    `Return processed: ${date}`,
    `Refund: ${methodLabel}`,
    `Items returned:\n${itemLines.join('\n')}`,
  ].join('\n');
}

module.exports = async function adminProcessRefund(req, res) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.body.token !== secret) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  const {
    submissionId,
    restockChoices,
    applyDeliveryDeduction,
    finalRefundAmount,
    originalTransactionId,
    originalGateway,
    refundLineItems,
    refundShipping,
    shippingAmount,
  } = req.body;

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
  const shopifyOrderId = submission.shopifyOrderId;

  const isGiftCard = (submission.refundPreference || '').toLowerCase().includes('store credit') ||
                     (submission.refundPreference || '').toLowerCase().includes('exchange');

  try {
    // Fetch restock location from the order's fulfillment (Shopify requires location_id when restocking)
    let restockLocationId = null;
    try {
      const orderData = await shopifyFetch(`/orders/${shopifyOrderId}.json?fields=id,fulfillments`);
      restockLocationId = orderData.order?.fulfillments?.[0]?.location_id || null;
    } catch {}
    if (!restockLocationId) {
      try {
        const locData = await shopifyFetch('/locations.json');
        restockLocationId = locData.locations?.find(l => l.active)?.id || locData.locations?.[0]?.id || null;
      } catch {}
    }

    // Apply restock choices from the UI (index-matched to refundLineItems)
    const finalRefundLineItems = (refundLineItems || []).map((rli, idx) => {
      const restock_type = restockChoices?.[idx] !== false ? 'return' : 'no_restock';
      return {
        ...rli,
        restock_type,
        ...(restock_type === 'return' && restockLocationId ? { location_id: restockLocationId } : {}),
      };
    });

    let giftCardCode = null;

    if (isGiftCard) {
      // Issue a Shopify gift card
      const skus = (submission.items || []).map(i => i.sku || i.title).join(', ');
      const expiresOn = new Date();
      expiresOn.setFullYear(expiresOn.getFullYear() + 1);
      const expiresStr = expiresOn.toISOString().split('T')[0];

      const gcData = await shopifyPost('/gift_cards.json', {
        gift_card: {
          initial_value: parseFloat(finalRefundAmount).toFixed(2),
          note: `Store credit for return of order ${submission.orderNumber}. Items: ${skus}`,
          expires_on: expiresStr,
          ...(submission.customerId ? { customer_id: submission.customerId } : {}),
        },
      });

      const gc = gcData.gift_card;
      giftCardCode = gc?.masked_code || gc?.last_characters || 'issued';

      // Send gift card notification to customer
      if (gc?.id && submission.customerEmail) {
        try {
          await shopifyPost(`/gift_cards/${gc.id}/sends.json`, {
            send: { to: submission.customerEmail },
          });
        } catch (sendErr) {
          console.error('Gift card send notification failed:', sendErr.message);
        }
      }

      // Restock items via Shopify Refunds API — no financial transaction (handled by gift card)
      // The note field attaches the return details to this refund entry in the order timeline.
      if (finalRefundLineItems.length > 0) {
        const noteText = buildNoteText(submission, 'gift_card', giftCardCode, false, finalRefundAmount);
        try {
          await shopifyPost(`/orders/${shopifyOrderId}/refunds.json`, {
            refund: {
              notify: false,
              note: noteText,
              refund_line_items: finalRefundLineItems,
              transactions: [],
            },
          });
        } catch (restockErr) {
          console.error('Restock refund call failed:', restockErr.message);
        }
      }

    } else {
      // Process financial refund to original payment
      const shippingRefundAmount = refundShipping ? parseFloat(shippingAmount || 0) : 0;
      const totalTransaction = parseFloat(finalRefundAmount) + shippingRefundAmount;
      const noteText = buildNoteText(submission, 'original_payment', null, applyDeliveryDeduction, finalRefundAmount);

      await shopifyPost(`/orders/${shopifyOrderId}/refunds.json`, {
        refund: {
          notify: true,
          note: noteText,
          shipping: { full_refund: false, amount: shippingRefundAmount.toFixed(2) },
          refund_line_items: finalRefundLineItems,
          transactions: [{
            parent_id: originalTransactionId,
            amount: totalTransaction.toFixed(2),
            kind: 'refund',
            gateway: originalGateway,
          }],
        },
      });
    }

    // Update submission record and mark as processed
    submissions[index].status = 'processed';
    submissions[index].refundProcessed = true;
    submissions[index].refundProcessedAt = new Date().toISOString();
    submissions[index].refundMethod = isGiftCard ? 'gift_card' : 'original_payment';
    submissions[index].refundAmount = parseFloat(finalRefundAmount);
    if (giftCardCode) submissions[index].giftCardCode = giftCardCode;
    fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));

    return res.json({ success: true, isGiftCard, giftCardCode });

  } catch (error) {
    console.error('adminProcessRefund error:', error);
    return res.status(500).json({ success: false, message: `Failed to process refund: ${error.message}` });
  }
};
