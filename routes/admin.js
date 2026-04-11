const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'submissions.json');
const TEMPLATE = path.join(__dirname, '..', 'templates', 'admin-dashboard.html');

module.exports = function admin(req, res) {
  // Allow embedding in Shopify admin iframe
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://momina-designer-outfit-collection.myshopify.com https://admin.shopify.com"
  );

  let submissions = [];
  if (fs.existsSync(DATA_FILE)) {
    try { submissions = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}
  }

  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const html = template.replace('__SUBMISSIONS_JSON__', JSON.stringify(submissions));
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};
