/**
 * Sends email via Brevo REST API (HTTPS, no SMTP ports needed).
 *
 * @param {string} to        - Recipient email address
 * @param {string} subject   - Email subject
 * @param {string} htmlBody  - HTML email body
 * @param {string} [replyTo] - Optional reply-to email address
 */
async function sendReturnEmail(to, subject, htmlBody, replyTo) {
  const payload = {
    sender: { name: 'Smart Returns — Momina', email: 'info@momina.co.uk' },
    to: [{ email: to }],
    subject,
    htmlContent: htmlBody,
    ...(replyTo && { replyTo: { email: replyTo } }),
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Brevo API error ${response.status}: ${text}`);
  }

  return response.json();
}

module.exports = { sendReturnEmail };
