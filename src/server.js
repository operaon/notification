const http = require('http');
const { createApp } = require('./app');
const { sequelize } = require('./models');
const env = require('./config/env');
const logger = require('./config/logger');
const deliveryDispatcher = require('./services/deliveryDispatcher');

let server;

const start = async () => {
  await sequelize.authenticate();
  const app = createApp();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(env.port, env.host, resolve));
  deliveryDispatcher.start();
  logger.info({ host: env.host, port: env.port, workerEnabled: env.delivery.workerEnabled }, 'notification service started');
  return server;
};

const stop = async (signal = 'SIGTERM') => {
  deliveryDispatcher.stop();
  if (server) await new Promise((resolve) => server.close(resolve));
  await sequelize.close();
  logger.info({ signal }, 'notification service stopped');
};

if (require.main === module) {
  start().catch((error) => {
    logger.fatal({ err: error }, 'notification service failed to start');
    process.exitCode = 1;
  });
  process.once('SIGTERM', () => stop('SIGTERM').catch(() => {}));
  process.once('SIGINT', () => stop('SIGINT').catch(() => {}));
}

module.exports = { start, stop };
