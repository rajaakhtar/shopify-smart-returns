const fs = require('fs');
const path = require('path');
const { sendReturnEmail } = require('../utils/mailer');
const { buildEmailHtml } = require('../utils/emailBuilder');
const { buildCustomerEmailHtml, buildOverdueEmailHtml } = require('../utils/customerEmailBuilder');

const store = require('../utils/store');
const TEMPLATE_FILE = path.join(__dirname, '..', 'data', 'customer-email-template.json');

module.exports = async function adminResend(req, res) {
  // Auth: token in request body
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.body.token !== secret) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  // Handle save-template action
  if (req.body.action === 'save-template') {
    const { html: encodedHtml } = req.body;
    if (encodedHtml === undefined) {
      return res.status(400).json({ success: false, message: 'Missing html' });
    }
    try {
      const html = Buffer.from(encodedHtml, 'base64').toString('utf8');
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(TEMPLATE_FILE, JSON.stringify({ html }, null, 2));
      return res.json({ success: true });
    } catch (err) {
      console.error('saveTemplate error:', err);
      return res.status(500).json({ success: false, message: 'Failed to save template' });
    }
  }

  const { submissionId } = req.body;
  if (!submissionId) {
    return res.status(400).json({ success: false, message: 'Missing submissionId' });
  }

  const found = store.findById(submissionId);
  if (!found) {
    return res.status(404).json({ success: false, message: 'Submission not found' });
  }
  const submission = found.submission;

  if (req.body.action === 'mark-processed') {
    store.moveTo(submissionId, 'processed');
    return res.json({ success: true });
  }

  if (req.body.action === 'cancel') {
    store.moveTo(submissionId, 'cancelled');
    return res.json({ success: true });
  }

  if (req.body.action === 'cancel-overdue') {
    store.moveTo(submissionId, 'cancelled');
    const submittedDate = new Date(submission.submittedAt).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    const html = buildOverdueEmailHtml(submission, submittedDate);
    try {
      await sendReturnEmail(
        submission.customerEmail,
        `Return Request Closed — Order ${submission.orderNumber}`,
        html,
        process.env.RETURNS_EMAIL,
        'MOMINA Designer Outfit Collection'
      );
    } catch (err) {
      console.error('cancel-overdue email failed:', err.message);
    }
    return res.json({ success: true });
  }

  if (req.body.action === 'resend-customer') {
    try {
      let templateHtml = '';
      if (fs.existsSync(TEMPLATE_FILE)) {
        try { templateHtml = JSON.parse(fs.readFileSync(TEMPLATE_FILE, 'utf8')).html || ''; } catch {}
      }
      const html = buildCustomerEmailHtml(submission, templateHtml);
      const subject = `Your Return Request — Order ${submission.orderNumber}`;
      await sendReturnEmail(submission.customerEmail, subject, html, process.env.RETURNS_EMAIL, 'MOMINA Designer Outfit Collection');
      return res.json({ success: true });
    } catch (err) {
      console.error('resend-customer error:', err);
      return res.status(500).json({ success: false, message: 'Failed to send customer email' });
    }
  }

  try {
    const subject = `Return Request — Order ${submission.orderNumber}`;
    const html = buildEmailHtml(submission);
    await sendReturnEmail(process.env.RETURNS_EMAIL, subject, html, submission.customerEmail);

    store.update(submissionId, { emailStatus: 'sent' });

    return res.json({ success: true });
  } catch (err) {
    console.error('adminResend error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send email' });
  }
};
