const fs = require('fs');
const path = require('path');

const TEMPLATE_FILE = path.join(__dirname, '..', 'data', 'customer-email-template.json');

module.exports = function adminSaveTemplate(req, res) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || req.body.token !== secret) {
    return res.status(403).json({ success: false, message: 'Unauthorized' });
  }

  const { html } = req.body;
  if (html === undefined) {
    return res.status(400).json({ success: false, message: 'Missing html' });
  }

  try {
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(TEMPLATE_FILE, JSON.stringify({ html }, null, 2));
    return res.json({ success: true });
  } catch (err) {
    console.error('adminSaveTemplate error:', err);
    return res.status(500).json({ success: false, message: 'Failed to save template' });
  }
};
