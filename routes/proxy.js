const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const verifyProxy = require('../middleware/verifyProxy');

// Apply HMAC verification to all GET requests on this router
router.use(verifyProxy);

router.get('/', (req, res) => {
  const templatePath = path.join(__dirname, '../templates/returns-form.html');
  const html = fs.readFileSync(templatePath, 'utf8');
  // Content-Type must be application/liquid for Shopify to render it inside the store theme
  res.setHeader('Content-Type', 'application/liquid');
  res.send(html);
});

module.exports = router;
