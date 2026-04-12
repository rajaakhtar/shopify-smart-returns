const fs = require('fs');
const path = require('path');
const { sendReturnEmail } = require('../utils/mailer');
const { buildEmailHtml } = require('../utils/emailBuilder');

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
    const { html: encodedHtml, quillHtml: encodedQuillHtml } = req.body;
    if (encodedHtml === undefined) {
      return res.status(400).json({ success: false, message: 'Missing html' });
    }
    try {
      const html = Buffer.from(encodedHtml, 'base64').toString('utf8');
      const quillHtml = encodedQuillHtml ? Buffer.from(encodedQuillHtml, 'base64').toString('utf8') : html;
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(TEMPLATE_FILE, JSON.stringify({ html, quillHtml }, null, 2));
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

  try {
    const subject = `Return Request — Order ${submission.orderNumber}`;
    const html = buildEmailHtml(submission);
    await sendReturnEmail(process.env.RETURNS_EMAIL, subject, html, submission.customerEmail);

    // Update status in file
    submission.emailStatus = 'sent';
    fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2));

    return res.json({ success: true });
  } catch (err) {
    console.error('adminResend error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send email' });
  }
};
