require('dotenv').config();

const express = require('express');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const proxyRoute = require('./routes/proxy');
const lookupOrderRoute = require('./routes/lookupOrder');
const submitReturnRoute = require('./routes/submitReturn');
const adminRoute = require('./routes/admin');
const adminResendRoute = require('./routes/adminResend');
const checkOrigin = require('./middleware/checkOrigin');

// GET / - Admin dashboard (embedded in Shopify admin)
app.get('/', adminRoute);

// POST /admin-resend - Re-send admin email for a submission (called from admin dashboard)
app.post('/admin-resend', adminResendRoute);

// GET /proxy - Serve the returns form HTML (Shopify app proxy)
// This route goes through HMAC verification
app.use('/proxy', proxyRoute);

// POST /proxy/api/lookup-order - Order lookup (called by frontend JS)
// Restricted to requests originating from momina.co.uk or the Shopify store
app.post('/proxy/api/lookup-order', checkOrigin, lookupOrderRoute);

// POST /proxy/api/submit-return - Submit return request (called by frontend JS)
// Restricted to requests originating from momina.co.uk or the Shopify store
app.post('/proxy/api/submit-return', checkOrigin, submitReturnRoute);

// Catch-all: any other direct access to this server returns Access Restricted
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

app.use((req, res) => {
  res.status(403).send(ACCESS_RESTRICTED_HTML);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Smart Returns app running on port ${PORT}`);
});
