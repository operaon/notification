const pino = require('pino');

module.exports = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'refreshToken',
      'accessToken',
      'token',
      'secret',
      'privateKey',
      'p256dh',
      'auth',
      'endpoint',
      'smtp.password',
      'smtp.user',
      'payload',
    ],
    censor: '[REDACTED]',
  },
});
