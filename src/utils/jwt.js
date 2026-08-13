const jwt = require('jsonwebtoken');
const env = require('../config/env');

const verificationKey = () => {
  if (env.jwt.algorithm === 'HS256') return env.jwt.secret;
  if (!env.jwt.publicKey) throw new Error('JWT_PUBLIC_KEY não configurada');
  return env.jwt.publicKey;
};

const verify = (token) => {
  try {
    return jwt.verify(token, verificationKey(), {
      algorithms: [env.jwt.algorithm],
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
    });
  } catch (_) {
    return null;
  }
};

const verifyAccessToken = (token) => {
  const decoded = verify(token);
  return decoded?.tokenType === 'access' ? decoded : null;
};

module.exports = { verifyAccessToken };
