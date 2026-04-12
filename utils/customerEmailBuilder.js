/**
 * Builds the HTML email body sent to the customer after a return is submitted.
 * @param {object} submission  - The return submission object
 * @param {string} templateHtml - The admin-editable message HTML (from WYSIWYG)
 */
function buildCustomerEmailHtml(submission, templateHtml) {
  const {
    orderNumber, orderDate, customerName, refundPreference, items,
  } = submission;

  const logoUrl = process.env.STORE_LOGO_URL || '';
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Momina" height="48" style="max-height:48px;">`
    : `<span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:3px;">MOMINA</span>`;

  const itemRows = (items || []).map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
      <td style="padding:10px 14px;border-bottom:1px solid #eeeeee;font-size:14px;color:#222222;">
        <strong>${esc(item.title)}</strong>
        ${item.variantTitle ? `<br><span style="color:#666666;font-size:13px;">${esc(item.variantTitle)}</span>` : ''}
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #eeeeee;font-size:14px;color:#444444;white-space:nowrap;">
        ${esc(item.quantityToReturn)} of ${esc(item.quantityPurchased)}
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #eeeeee;font-size:14px;color:#444444;white-space:nowrap;">
        £${esc(item.price)}
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #eeeeee;font-size:14px;color:#444444;">
        ${esc(item.reason)}${item.otherReason ? ` — ${esc(item.otherReason)}` : ''}
      </td>
    </tr>`).join('');

  // Wrap the WYSIWYG HTML so it renders correctly in email clients
  const messageHtml = templateHtml
    ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#222222;">${templateHtml}</div>`
    : `<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#555555;">Thank you for submitting your return request. We will be in touch shortly.</p>`;

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

    <!-- Greeting -->
    <tr>
      <td style="padding:28px 32px 0;">
        <p style="margin:0 0 6px;font-size:15px;color:#222222;">Dear ${esc(customerName)},</p>
      </td>
    </tr>

    <!-- Admin message -->
    <tr>
      <td style="padding:16px 32px 8px;">
        ${messageHtml}
      </td>
    </tr>

    <!-- Divider -->
    <tr>
      <td style="padding:16px 32px 0;">
        <hr style="border:none;border-top:1px solid #eeeeee;margin:0;">
      </td>
    </tr>

    <!-- Summary heading -->
    <tr>
      <td style="padding:20px 32px 0;">
        <p style="margin:0 0 4px;font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;">Your Return Summary</p>
        <p style="margin:0 0 4px;font-size:13px;color:#555555;">Order <strong>${esc(orderNumber)}</strong> &nbsp;·&nbsp; Placed ${esc(orderDate)}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#555555;">Refund preference: <strong>${esc(refundPreference)}</strong></p>
      </td>
    </tr>

    <!-- Items table -->
    <tr>
      <td style="padding:16px 32px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;border-collapse:collapse;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="padding:9px 14px;text-align:left;font-size:12px;color:#555555;font-weight:600;">Product</th>
              <th style="padding:9px 14px;text-align:left;font-size:12px;color:#555555;font-weight:600;">Qty</th>
              <th style="padding:9px 14px;text-align:left;font-size:12px;color:#555555;font-weight:600;">Price</th>
              <th style="padding:9px 14px;text-align:left;font-size:12px;color:#555555;font-weight:600;">Reason</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
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
