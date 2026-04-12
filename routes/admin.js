const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'submissions.json');
const CUSTOMER_TEMPLATE_FILE = path.join(__dirname, '..', 'data', 'customer-email-template.json');
const TEMPLATE = path.join(__dirname, '..', 'templates', 'admin-dashboard.html');

const ACCESS_RESTRICTED = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Access Restricted</title>
<style>body{font-family:sans-serif;background:#f7f7f7;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh}
.box{background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:48px 40px;max-width:420px;text-align:center}
h1{font-size:22px;margin:0 0 12px;color:#222}p{font-size:15px;color:#666;margin:0;line-height:1.6}</style>
</head><body><div class="box"><h1>Access Restricted</h1><p>This area is not publicly accessible.</p></div></body></html>`;

// Validate Shopify's HMAC — sent automatically when loading an embedded app
function isValidShopifyHmac(query) {
  const { hmac, signature, ...params } = query;
  if (!hmac || !process.env.SHOPIFY_API_SECRET) return false;
  const message = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  const expected = crypto.createHmac('sha256', process.env.SHOPIFY_API_SECRET).update(message).digest('hex');
  try {
    if (hmac.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
  } catch { return false; }
}

module.exports = function admin(req, res) {
  // Allow embedding in Shopify admin iframe (must be set before any response)
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://momina-designer-outfit-collection.myshopify.com https://admin.shopify.com"
  );

  // Accept either: valid Shopify HMAC (embedded app load) or secret token (direct browser access)
  const validHmac = isValidShopifyHmac(req.query);
  const validToken = process.env.ADMIN_SECRET && req.query.token === process.env.ADMIN_SECRET;

  if (!validHmac && !validToken) {
    return res.status(403).send(ACCESS_RESTRICTED);
  }

  let submissions = [];
  if (fs.existsSync(DATA_FILE)) {
    try { submissions = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}
  }

  let customerTemplateHtml = '';
  if (fs.existsSync(CUSTOMER_TEMPLATE_FILE)) {
    try {
      const tpl = JSON.parse(fs.readFileSync(CUSTOMER_TEMPLATE_FILE, 'utf8'));
      customerTemplateHtml = tpl.html || '';
    } catch {}
  }

  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const html = template
    .replace('__SUBMISSIONS_JSON__', JSON.stringify(submissions))
    .replace('__ADMIN_TOKEN__', JSON.stringify(process.env.ADMIN_SECRET || ''))
    .replace('__BASE_URL__', JSON.stringify(process.env.APP_URL || 'https://smartreturns.rajaakhtar.com'))
    .replace('__CUSTOMER_TEMPLATE_HTML__', JSON.stringify(customerTemplateHtml));
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};
