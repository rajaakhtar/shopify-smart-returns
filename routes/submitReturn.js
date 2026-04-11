const { sendReturnEmail } = require('../utils/mailer');

/**
 * POST /proxy/api/submit-return
 *
 * Validates the return request, formats a plain-text email, and sends it to the store team.
 */
module.exports = async function submitReturn(req, res) {
  try {
    const {
      orderNumber,
      customerName,
      customerEmail,
      orderDate,
      refundPreference,
      tagsAttached,
      policyConfirmations,
      items,
    } = req.body;

    // Validation
    if (!items || items.length === 0) {
      return res.json({ success: false, message: 'Please select at least one item to return.' });
    }

    if (!refundPreference) {
      return res.json({ success: false, message: 'Please select a refund preference.' });
    }

    if (!tagsAttached) {
      return res.json({ success: false, message: 'Please confirm whether tags and ribbons are still attached.' });
    }

    const confirmations = policyConfirmations || {};
    if (
      !confirmations.readReturnsPolicy ||
      !confirmations.within14Days ||
      !confirmations.responsibleForPostage ||
      !confirmations.understandsDeduction
    ) {
      return res.json({ success: false, message: 'Please confirm all policy requirements.' });
    }

    // Format plain-text email body
    const separator = '─'.repeat(40);
    const submittedAt = new Date().toUTCString();

    let itemsList = '';
    items.forEach((item, index) => {
      itemsList += `${index + 1}. ${item.title}`;
      if (item.variantTitle) itemsList += ` — ${item.variantTitle}`;
      itemsList += `\n`;
      itemsList += `   Price: £${item.price}\n`;
      itemsList += `   Qty to return: ${item.quantityToReturn} of ${item.quantityPurchased}\n`;
      itemsList += `   Reason: ${item.reason}\n`;
      if (item.otherReason) itemsList += `   Specified reason: ${item.otherReason}\n`;
      itemsList += `   Comments: ${item.comments || '—'}\n\n`;
    });

    const emailBody = `Return Request — Order ${orderNumber}

Customer: ${customerName} (${customerEmail})
Order: ${orderNumber} (placed ${orderDate})

Refund Preference: ${refundPreference}

Items to Return:
${separator}
${itemsList}${separator}

Policy Confirmations:
✓ Tags and ribbons still attached: ${tagsAttached.toUpperCase()}
✓ Read returns policy: YES
✓ Order delivered within 14 days: YES
✓ Responsible for safe return postage: YES
✓ Understands 15% deduction condition: YES

Submitted: ${submittedAt}
`;

    const subject = `Return Request — Order ${orderNumber}`;

    await sendReturnEmail(process.env.RETURNS_EMAIL, subject, emailBody);

    return res.json({ success: true, message: 'Return request submitted successfully.' });
  } catch (error) {
    console.error('submitReturn error:', error);
    return res.json({ success: false, message: 'An error occurred while submitting your return. Please try again.' });
  }
};
