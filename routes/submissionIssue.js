const { sendReturnEmail } = require('../utils/mailer');

module.exports = async function submissionIssue(req, res) {
  const { orderNumber, customerName, customerEmail, message } = req.body;

  if (!orderNumber || !message || !message.trim()) {
    return res.json({ success: false, message: 'Missing required fields.' });
  }

  const logoUrl = process.env.STORE_LOGO_URL || '';
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Momina" height="48" style="max-height:48px;">`
    : `<span style="color:#ffffff;text-align:center;font-size:20px;font-weight:700;letter-spacing:3px;">MOMINA</span>`;

  const subject = `Returns Issue — Order ${orderNumber}`;
  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;border:1px solid #e0e0e0;margin:0 auto;">
  <tr><td style="background:#4a1e5d;padding:20px 32px 15px;text-align:center;border-radius:8px 8px 0 0;">
    ${logoHtml}
  </td></tr>
  <tr><td style="background:#2d2d2d;padding:12px 32px;">
    <p style="margin:0;color:#ffffff;font-size:15px;font-weight:700;">Returns Issue — ${orderNumber}</p>
  </td></tr>
  <tr><td style="padding:24px 32px 0;">
    <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Customer</p>
    <p style="margin:0 0 16px;font-size:14px;color:#222;">${customerName || 'Unknown'} &lt;${customerEmail || 'Unknown'}&gt;</p>
    <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Message</p>
    <p style="margin:0;font-size:14px;color:#222;background:#f7f7f7;padding:12px 14px;border-radius:5px;border-left:3px solid #4a1e5d;white-space:pre-wrap;">${message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
  </td></tr>
  <tr><td style="padding:24px 32px;font-size:12px;color:#aaa;border-top:1px solid #eee;margin-top:24px;">
    Submitted via the returns portal on momina.co.uk
  </td></tr>
</table>
</body></html>`;

  try {
    await sendReturnEmail(process.env.RETURNS_EMAIL, subject, htmlBody, customerEmail);
    return res.json({ success: true });
  } catch (err) {
    console.error('submissionIssue email error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send message. Please try again.' });
  }
};
