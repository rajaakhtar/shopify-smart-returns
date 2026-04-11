const nodemailer = require('nodemailer');

// Configure Gmail SMTP transport
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Uses STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Sends the return request email.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} textBody - Plain text email body
 * @returns {Promise<object>} - Nodemailer send result
 */
async function sendReturnEmail(to, subject, textBody) {
  const mailOptions = {
    from: `"Smart Returns" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text: textBody,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendReturnEmail };
