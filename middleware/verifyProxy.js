const crypto = require('crypto');

const ACCESS_RESTRICTED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Restricted</title>
  <style>
    body { font-family: sans-serif; background: #f7f7f7; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .box { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 48px 40px; max-width: 420px; text-align: center; }
    h1 { font-size: 22px; margin: 0 0 12px; color: #222; }
    p { font-size: 15px; color: #666; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Access Restricted</h1>
    <p>This service is only available through the official store website.</p>
  </div>
</body>
</html>`;

module.exports = function verifyProxy(req, res, next) {
  const { signature, ...params } = req.query;

  if (!signature) {
    return res.status(403).send(ACCESS_RESTRICTED_HTML);
  }

  // Sort params alphabetically and concatenate as key=value (no separator)
  const message = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('');

  const hmac = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');

  // Timing-safe comparison
  try {
    const signatureBuffer = Buffer.from(signature, 'hex');
    const hmacBuffer = Buffer.from(hmac, 'hex');
    if (signatureBuffer.length !== hmacBuffer.length) {
      return res.status(401).send('Unauthorized');
    }
    if (!crypto.timingSafeEqual(signatureBuffer, hmacBuffer)) {
      return res.status(403).send(ACCESS_RESTRICTED_HTML);
    }
  } catch (e) {
    return res.status(403).send(ACCESS_RESTRICTED_HTML);
  }

  next();
};
