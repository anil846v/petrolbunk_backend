const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Send password reset OTP email
 */
const sendPasswordResetEmail = async ({ to, username, otp, resetLink }) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"Petrol Bunk IOCL Enterprise Suite" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'PetrolDesk 360 - Password Reset Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }
          .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { text-align: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px; }
          .header h1 { font-size: 20px; font-weight: 800; color: #0f2440; margin: 0; }
          .header p { font-size: 12px; font-weight: 600; color: #f97316; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 1px; }
          .content { color: #334155; font-size: 14px; line-height: 1.6; }
          .otp-box { text-align: center; margin: 28px 0; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 10px; padding: 20px; }
          .otp-code { font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0f2440; font-family: monospace; }
          .otp-note { font-size: 12px; color: #64748b; margin-top: 8px; margin-bottom: 0; }
          .btn-container { text-align: center; margin: 24px 0; }
          .btn { display: inline-block; background-color: #0f2440; color: #ffffff !important; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; }
          .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1>Petrol Bunk IOCL Enterprise Suite</h1>
            <p>IOCL Dealer &bull; PetrolDesk 360 Security</p>
          </div>

          <div class="content">
            <p>Hello <strong>${username || 'Team Member'}</strong>,</p>
            <p>You requested to reset your password for the PetrolDesk 360 administration panel. Enter the 6-digit verification code below:</p>

            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <p class="otp-note">Valid for <strong>15 minutes</strong>. Do not share this code with anyone.</p>
            </div>

            ${resetLink ? `
              <div class="btn-container">
                <a href="${resetLink}" class="btn" target="_blank">Reset Password Online &rarr;</a>
              </div>
            ` : ''}

            <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
              If you didn't request a password reset, you can safely disregard this email. Your current password remains active and secure.
            </p>
          </div>

          <div class="footer">
            &copy; ${new Date().getFullYear()} Petrol Bunk IOCL Enterprise Suite &bull; Powered by PetrolDesk 360<br>
            Automated system notification &bull; Please do not reply directly to this email.
          </div>
        </div>
      </body>
      </html>
    `,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = {
  createTransporter,
  sendPasswordResetEmail,
};

