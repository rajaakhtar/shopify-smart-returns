const fs = require('fs');
const path = require('path');
const { sendReturnEmail } = require('../utils/mailer');
const { buildEmailHtml } = require('../utils/emailBuilder');
const { buildCustomerEmailHtml } = require('../utils/customerEmailBuilder');

const DATA_FILE = path.join(__dirname, '..', 'data', 'submissions.json');
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

  let submissions = [];
  if (fs.existsSync(DATA_FILE)) {
    try { submissions = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}
  }

  const submission = submissions.find(s => String(s.id) === String(submissionId));
  if (!submission) {
    return res.status(404).json({ success: false, message: 'Submission not found' });
  }

  if (req.body.action === 'mark-processed') {
    submission.status = 'processed';
    fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
    return res.json({ success: true });
  }

  if (req.body.action === 'cancel') {
    submission.status = 'cancelled';
    fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));
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

    submission.emailStatus = 'sent';
    fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));

    return res.json({ success: true });
  } catch (err) {
    console.error('adminResend error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send email' });
  }
};
