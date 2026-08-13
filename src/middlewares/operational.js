const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { toErrorResponse } = require('../utils/errors');
const logger = require('../config/logger');
const env = require('../config/env');

const requestContext = (req, res, next) => {
  req.requestId = req.get('x-request-id') || crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
};

const apiRateLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

const errorHandler = (error, req, res, _next) => {
  const statusCode = error.statusCode || 500;
  logger.error({ err: error, requestId: req.requestId, statusCode }, 'request failed');
  res.status(statusCode).json({ ...toErrorResponse(error), requestId: req.requestId });
};

module.exports = { requestContext, apiRateLimiter, errorHandler };
