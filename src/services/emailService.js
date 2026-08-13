const nodemailer = require('nodemailer');
const env = require('../config/env');
const { AppError } = require('../utils/errors');

let transporter = null;

const isEmailConfigured = () => Boolean(env.delivery.emailEnabled && env.smtp.host && env.smtp.from);

const getTransporter = () => {
  if (!isEmailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure || env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
      connectionTimeout: env.delivery.timeoutMs,
      greetingTimeout: env.delivery.timeoutMs,
      socketTimeout: env.delivery.timeoutMs,
    });
  }
  return transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const mailer = getTransporter();
  if (!mailer) throw new AppError('Canal de e-mail não configurado', 503, 'EMAIL_NOT_CONFIGURED');
  const info = await mailer.sendMail({
    from: env.smtp.fromName ? `"${env.smtp.fromName}" <${env.smtp.from}>` : env.smtp.from,
    to,
    subject,
    html: html || undefined,
    text: text || undefined,
  });
  return { provider: 'smtp', providerMessageId: info.messageId || null };
};

module.exports = { isEmailConfigured, sendEmail };
