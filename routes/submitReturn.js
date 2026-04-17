const fs = require('fs');
const path = require('path');
const { sendReturnEmail } = require('../utils/mailer');
const { buildEmailHtml } = require('../utils/emailBuilder');
const { buildCustomerEmailHtml } = require('../utils/customerEmailBuilder');
const { calculateReturnsRate } = require('../utils/returnsRate');

const DATA_FILE = path.join(__dirname, '..', 'data', 'submissions.json');
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

function saveSubmission(submission) {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  let submissions = [];
  if (fs.existsSync(DATA_FILE)) {
    try { submissions = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { submissions = []; }
  }
  submissions.unshift(submission);
  fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
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
      !confirmations.understandsDeduction
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
      orderDate,
      customerName,
      customerEmail,
      customerId: customerId || null,
      refundPreference,
      exchangeDetails: req.body.exchangeDetails || null,
      tagsAttached,
      items,
    };

    const emailHtml = buildEmailHtml(submission);

    let emailStatus = 'sent';
    try {
      await sendReturnEmail(process.env.RETURNS_EMAIL, subject, emailHtml, customerEmail);
    } catch (emailError) {
      console.error('Email send failed:', emailError);
      emailStatus = emailError.message || 'failed';
    }

    // Send customer confirmation email (best-effort — don't fail the submission if it errors)
    try {
      const templateHtml = loadCustomerTemplate();
      const customerHtml = buildCustomerEmailHtml(submission, templateHtml);
      const customerSubject = `Your Return Request — Order ${orderNumber}`;
      await sendReturnEmail(customerEmail, customerSubject, customerHtml, process.env.RETURNS_EMAIL, 'MOMINA Designer Outfit Collection');
    } catch (customerEmailError) {
      console.error('Customer email send failed:', customerEmailError);
    }

    // Calculate returns rate (best-effort — don't fail submission if it errors)
    let returnsRate = null;
    try {
      returnsRate = await calculateReturnsRate(customerId || null, customerEmail);
    } catch {}

    saveSubmission({ ...submission, emailStatus, returnsRate });

    if (emailStatus !== 'sent') {
      return res.json({ success: false, message: `Return recorded but email failed: ${emailStatus}` });
    }

    return res.json({ success: true, message: 'Return request submitted successfully.' });
  } catch (error) {
    console.error('submitReturn error:', error);
    return res.json({ success: false, message: 'An error occurred while submitting your return. Please try again.' });
  }
};
