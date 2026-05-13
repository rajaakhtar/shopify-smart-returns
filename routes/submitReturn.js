const fs = require('fs');
const path = require('path');
const { sendReturnEmail } = require('../utils/mailer');
const { buildEmailHtml } = require('../utils/emailBuilder');
const { buildCustomerEmailHtml } = require('../utils/customerEmailBuilder');
const { calculateReturnsRate } = require('../utils/returnsRate');
const store = require('../utils/store');

const TEMPLATE_FILE = path.join(__dirname, '..', 'data', 'customer-email-template.json');

function loadCustomerTemplate() {
  try {
    if (fs.existsSync(TEMPLATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(TEMPLATE_FILE, 'utf8'));
      return data.html || '';
    }
  } catch {}
  return '';
}

/**
 * POST /proxy/api/submit-return
 *
 * Validates the return request, formats a plain-text email, and sends it to the store team.
 */
module.exports = async function submitReturn(req, res) {
  try {
    const {
      orderNumber,
      shopifyOrderId,
      customerName,
      customerEmail,
      customerId,
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
      !confirmations.understandsDeduction ||
      !confirmations.understandsDeliveryCharges
    ) {
      return res.json({ success: false, message: 'Please confirm all policy requirements.' });
    }

    const submittedAt = new Date().toISOString();
    const subject = `Return Request — Order ${orderNumber}`;
    const submission = {
      id: Date.now(),
      submittedAt,
      status: 'open',
      orderNumber,
      shopifyOrderId: shopifyOrderId || null,
      orderDate,
      customerName,
      customerEmail,
      customerId: customerId || null,
      refundPreference,
      exchangeDetails: req.body.exchangeDetails || null,
      tagsAttached,
      items,
    };

    // Save first — this is the critical gate. Only confirm to the customer if this succeeds.
    try {
      store.saveNew(submission);
    } catch (saveError) {
      console.error('Failed to save submission:', saveError);
      return res.json({ success: false, message: 'An error occurred while saving your return request. Please try again.' });
    }

    // Respond to the customer immediately — their request is on record
    res.json({ success: true, message: 'Return request submitted successfully.' });

    // Everything below is best-effort and runs after the response is sent
    const emailHtml = buildEmailHtml(submission);
    let emailStatus = 'sent';
    try {
      await sendReturnEmail(process.env.RETURNS_EMAIL, subject, emailHtml, customerEmail);
    } catch (emailError) {
      console.error('Admin email send failed:', emailError);
      emailStatus = emailError.message || 'failed';
    }

    // Send customer confirmation email
    let customerEmailStatus = 'sent';
    try {
      const templateHtml = loadCustomerTemplate();
      const customerHtml = buildCustomerEmailHtml(submission, templateHtml);
      const customerSubject = `Your Return Request — Order ${orderNumber}`;
      await sendReturnEmail(customerEmail, customerSubject, customerHtml, process.env.RETURNS_EMAIL, 'MOMINA Designer Outfit Collection');
    } catch (customerEmailError) {
      console.error('Customer email send failed:', customerEmailError);
      customerEmailStatus = customerEmailError.message || 'failed';
    }

    // Calculate returns rate
    let returnsRate = null;
    try {
      returnsRate = await calculateReturnsRate(customerId || null, customerEmail);
    } catch {}

    // Update the saved record with both email statuses and returns rate
    store.update(submission.id, { emailStatus, customerEmailStatus, returnsRate });
  } catch (error) {
    console.error('submitReturn error:', error);
    return res.json({ success: false, message: 'An error occurred while submitting your return. Please try again.' });
  }
};
