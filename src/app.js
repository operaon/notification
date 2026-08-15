const express = require('express');
const { collectMetrics } = require('./middlewares/observabilityMetrics');
const observabilityMetricsController = require('./controllers/observabilityMetricsController');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const pinoHttp = require('pino-http');
const env = require('./config/env');
const logger = require('./config/logger');
const { sequelize } = require('./models');
const { requestContext, apiRateLimiter, errorHandler } = require('./middlewares/operational');
const notificationRoutes = require('./routes/notificationRoutes');
const notificationRequestRoutes = require('./routes/notificationRequestRoutes');
const pushRoutes = require('./routes/pushRoutes');

const createApp = () => {
  const { communicationContext } = require('./middlewares/communicationContext');

const app = express();
app.use(communicationContext);
  app.use(collectMetrics);
  app.get('/metrics', observabilityMetricsController.metrics);
  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxyHops);
  app.use(requestContext);
  app.use(pinoHttp({ logger, customProps: (req) => ({ requestId: req.requestId }) }));
  app.use(helmet());
  const allowedCorsOrigins = String(env.cors.origin || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin && origin !== '*');
  app.use(cors({
    origin: (origin, callback) => callback(null, !origin || allowedCorsOrigins.includes(origin)),
    credentials: allowedCorsOrigins.length > 0,
  }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(apiRateLimiter);

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', service: env.serviceName, version: '0.1.0' }));
  app.get('/ready', async (_req, res) => {
    try {
      await sequelize.authenticate();
      return res.status(200).json({ status: 'ready', service: env.serviceName, database: 'ok' });
    } catch (error) {
      return res.status(503).json({ status: 'not_ready', service: env.serviceName, database: 'unavailable' });
    }
  });

  app.use('/api/notifications', notificationRoutes);
  app.use('/api/notification-requests', notificationRequestRoutes);
  app.use('/api/push', pushRoutes);

  app.use((_req, _res, next) => {
    const error = new Error('Rota não encontrada');
    error.statusCode = 404;
    error.code = 'ROUTE_NOT_FOUND';
    next(error);
  });
  app.use(errorHandler);
  return app;
};

module.exports = { createApp };
