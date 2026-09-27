const nodemailer = require('nodemailer');
const axios = require('axios');

// Email transporter (Nodemailer)
let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT || 587),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, text, html }) {
  try {
    const t = getTransporter();
    const info = await t.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
      html
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('sendEmail error:', error.message);
    return { success: false, error: error.message };
  }
}

// SMS via Fast2SMS
async function sendSMS({ to, message }) {
  try {
    const apiKey = process.env.FAST2SMS_API_KEY;
    if (!apiKey) throw new Error('FAST2SMS_API_KEY missing');

    // Note: Fast2SMS API expects specific payload; this is a simplified wrapper.
    const res = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
      route: 'v3',
      sender_id: 'TXTIND',
      message,
      language: 'english',
      flash: 0,
      numbers: Array.isArray(to) ? to.join(',') : String(to)
    }, {
      headers: {
        authorization: apiKey
      }
    });
    return { success: true, data: res.data };
  } catch (error) {
    console.error('sendSMS error:', error.response?.data || error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { sendEmail, sendSMS };
