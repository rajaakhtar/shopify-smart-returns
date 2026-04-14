/**
 * Builds the HTML email body sent to the customer after a return is submitted.
 * @param {object} submission   - The return submission object
 * @param {string} templateHtml - The admin-editable message HTML (from WYSIWYG)
 */
function buildCustomerEmailHtml(submission, templateHtml) {
  const { orderNumber, customerName } = submission;

  const logoUrl = process.env.STORE_LOGO_URL || '';
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Momina" height="48" style="max-height:48px;">`
    : `<span style="color:#ffffff;text-align:center;font-size:20px;font-weight:700;letter-spacing:3px;">MOMINA</span>`;

  const messageHtml = templateHtml
    ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.8;color:#222222;">${templateHtml}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Return Request Received — ${esc(orderNumber)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;">

    <!-- Header -->
    <tr>
      <td style="background:#4a1e5d;padding:20px 32px 15px;text-align:center;">
        ${logoHtml}
      </td>
    </tr>

    <!-- Title bar -->
    <tr>
      <td style="background:#2d2d2d;padding:14px 32px;">
        <p style="margin:0;color:#ffffff;font-size:16px;font-weight:700;">Return Request Received — ${esc(orderNumber)}</p>
      </td>
    </tr>

    <!-- Greeting + message -->
    <tr>
      <td style="padding:28px 32px 32px;">
        <p style="margin:0 0 16px;font-size:15px;color:#222222;">Dear ${esc(customerName)},</p>
        ${messageHtml}
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background:#f7f7f7;padding:16px 32px;border-top:1px solid #eeeeee;">
        <p style="margin:0;font-size:12px;color:#999999;">This email was sent automatically following your return request submission at momina.co.uk</p>
      </td>
    </tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
}

function esc(val) {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { buildCustomerEmailHtml };
