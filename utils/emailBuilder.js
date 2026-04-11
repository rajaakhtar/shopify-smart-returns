/**
 * Builds the HTML email body for a return request submission.
 */
function buildEmailHtml(submission) {
  const {
    orderNumber, orderDate, customerName, customerEmail,
    refundPreference, tagsAttached, items, submittedAt,
  } = submission;

  const logoUrl = process.env.STORE_LOGO_URL || '';
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Momina" height="48" style="max-height:48px;display:block;">`
    : `<span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:3px;">MOMINA</span>`;

  const formattedDate = new Date(submittedAt).toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
  });

  const itemRows = (items || []).map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
      <td style="padding:12px 14px;border-bottom:1px solid #eeeeee;font-size:14px;color:#222222;">
        <strong>${esc(item.title)}</strong>
        ${item.variantTitle ? `<br><span style="color:#666666;font-size:13px;">${esc(item.variantTitle)}</span>` : ''}
      </td>
      <td style="padding:12px 14px;border-bottom:1px solid #eeeeee;font-size:14px;color:#444444;white-space:nowrap;">
        ${esc(item.quantityToReturn)} of ${esc(item.quantityPurchased)}
      </td>
      <td style="padding:12px 14px;border-bottom:1px solid #eeeeee;font-size:14px;color:#444444;white-space:nowrap;">
        £${esc(item.price)}
      </td>
      <td style="padding:12px 14px;border-bottom:1px solid #eeeeee;font-size:14px;color:#444444;">
        ${esc(item.reason)}${item.otherReason ? ` — ${esc(item.otherReason)}` : ''}
        ${item.comments ? `<br><span style="color:#888888;font-size:12px;font-style:italic;">${esc(item.comments)}</span>` : ''}
      </td>
    </tr>`).join('');

  const check = `<span style="color:#2e7d32;font-weight:bold;">✓</span>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Return Request — ${esc(orderNumber)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;">

    <!-- Header -->
    <tr>
      <td style="background:#1a1a1a;padding:24px 32px;">
        ${logoHtml}
      </td>
    </tr>

    <!-- Title bar -->
    <tr>
      <td style="background:#2d2d2d;padding:14px 32px;">
        <p style="margin:0;color:#ffffff;font-size:16px;font-weight:700;">Return Request — ${esc(orderNumber)}</p>
      </td>
    </tr>

    <!-- Customer details -->
    <tr>
      <td style="padding:24px 32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom:16px;">
              <p style="margin:0 0 4px;font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;">Customer</p>
              <p style="margin:0;font-size:15px;color:#222222;font-weight:600;">${esc(customerName)}</p>
              <p style="margin:2px 0 0;font-size:14px;color:#555555;">${esc(customerEmail)}</p>
            </td>
            <td style="padding-bottom:16px;text-align:right;">
              <p style="margin:0 0 4px;font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;">Order</p>
              <p style="margin:0;font-size:15px;color:#222222;font-weight:600;">${esc(orderNumber)}</p>
              <p style="margin:2px 0 0;font-size:13px;color:#666666;">Placed ${esc(orderDate)}</p>
            </td>
          </tr>
        </table>
        <hr style="border:none;border-top:1px solid #eeeeee;margin:0 0 20px;">
      </td>
    </tr>

    <!-- Refund preference -->
    <tr>
      <td style="padding:0 32px 20px;">
        <p style="margin:0 0 8px;font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;">Refund Preference</p>
        <p style="margin:0;font-size:14px;color:#222222;background:#f7f7f7;padding:10px 14px;border-radius:5px;border-left:3px solid #1a1a1a;">${esc(refundPreference)}</p>
      </td>
    </tr>

    <!-- Items table -->
    <tr>
      <td style="padding:0 32px 24px;">
        <p style="margin:0 0 10px;font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;">Items to Return</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;border-collapse:collapse;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="padding:10px 14px;text-align:left;font-size:12px;color:#555555;font-weight:600;">Product</th>
              <th style="padding:10px 14px;text-align:left;font-size:12px;color:#555555;font-weight:600;">Qty</th>
              <th style="padding:10px 14px;text-align:left;font-size:12px;color:#555555;font-weight:600;">Price</th>
              <th style="padding:10px 14px;text-align:left;font-size:12px;color:#555555;font-weight:600;">Reason</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </td>
    </tr>

    <!-- Policy confirmations -->
    <tr>
      <td style="padding:0 32px 24px;">
        <p style="margin:0 0 10px;font-size:12px;color:#888888;text-transform:uppercase;letter-spacing:0.5px;">Policy Confirmations</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fdf9;border:1px solid #c8e6c9;border-radius:6px;padding:14px;">
          <tr><td style="padding:4px 14px;font-size:13px;color:#333333;">${check} Tags &amp; ribbons still attached: <strong>${esc(tagsAttached)}</strong></td></tr>
          <tr><td style="padding:4px 14px;font-size:13px;color:#333333;">${check} Read returns policy</td></tr>
          <tr><td style="padding:4px 14px;font-size:13px;color:#333333;">${check} Order delivered within last 14 days</td></tr>
          <tr><td style="padding:4px 14px;font-size:13px;color:#333333;">${check} Responsible for safe return postage</td></tr>
          <tr><td style="padding:4px 14px;font-size:13px;color:#333333;">${check} Understands 15% deduction condition</td></tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background:#f7f7f7;padding:16px 32px;border-top:1px solid #eeeeee;">
        <p style="margin:0;font-size:12px;color:#999999;">Submitted: ${formattedDate}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#999999;">Reply to this email to respond directly to the customer.</p>
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

module.exports = { buildEmailHtml };
