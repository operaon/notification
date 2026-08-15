require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const requiredInProduction = (name, fallback) => {
  const value = process.env[name] || fallback;
  if (isProduction && !value) throw new Error(`${name} é obrigatório em produção`);
  return value;
};

const parseList = (value, fallback = []) => {
  if (!value) return fallback;
  return value.split(',').map((item) => item.trim()).filter(Boolean);
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const parsePositiveInt = (name, fallback) => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} deve ser um inteiro positivo`);
  return value;
};

const port = parsePositiveInt('PORT', process.env.NOTIFICATION_PORT || 4720);
const jwtAlgorithm = process.env.JWT_ALGORITHM || 'HS256';
if (!['HS256', 'RS256', 'EdDSA'].includes(jwtAlgorithm)) {
  throw new Error('JWT_ALGORITHM deve ser HS256, RS256 ou EdDSA');
}

const jwtSecret = requiredInProduction(
  'JWT_SECRET',
  isTest ? 'notification-test-jwt-secret-at-least-32-characters' : 'notification-development-jwt-secret-change-me'
);
if (jwtAlgorithm === 'HS256' && isProduction && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET precisa ter pelo menos 32 caracteres em produção');
}

const normalizeKey = (value) => (value ? value.replace(/\\n/g, '\n') : undefined);
const serviceApiKey = requiredInProduction(
  'SERVICE_API_KEY',
  process.env.NOTIFICATION_SERVICE_API_KEY || (isTest ? 'notification-test-service-key' : 'notification-development-service-key')
);

module.exports = {
  nodeEnv,
  isProduction,
  isTest,
  host: process.env.HOST || process.env.NOTIFICATION_HOST || '0.0.0.0',
  port,
  serviceName: process.env.SERVICE_NAME || 'operaon_notification',
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS || 1),
  serviceApiKey,
  jwt: {
    algorithm: jwtAlgorithm,
    secret: jwtSecret,
    privateKey: normalizeKey(process.env.JWT_PRIVATE_KEY),
    publicKey: normalizeKey(process.env.JWT_PUBLIC_KEY),
    issuer: process.env.JWT_ISSUER || 'operaon-identity',
    audience: parseList(process.env.JWT_AUDIENCE, ['operaon-notification']),
    accessTtl: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshTtl: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },
  database: {
    url: process.env.DATABASE_URL,
    name: process.env.DB_NAME || 'operaon_notification',
    user: process.env.DB_USER || 'dbadmin',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    dialect: 'postgres',
    ssl: parseBoolean(process.env.DB_SSL, false),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || (isProduction ? '' : '*'),
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    limit: Number(process.env.RATE_LIMIT_LIMIT || 300),
  },
  delivery: {
    workerEnabled: parseBoolean(process.env.NOTIFICATION_WORKER_ENABLED, !isTest),
    pollIntervalMs: Number(process.env.NOTIFICATION_WORKER_POLL_INTERVAL_MS || 1000),
    batchSize: Number(process.env.NOTIFICATION_WORKER_BATCH_SIZE || 20),
    leaseSeconds: Number(process.env.NOTIFICATION_WORKER_LEASE_SECONDS || 60),
    maxAttempts: Number(process.env.NOTIFICATION_MAX_ATTEMPTS || 5),
    retryBaseSeconds: Number(process.env.NOTIFICATION_RETRY_BASE_SECONDS || 30),
    timeoutMs: Number(process.env.NOTIFICATION_DELIVERY_TIMEOUT_MS || 10000),
    defaultExpirationDays: Number(process.env.NOTIFICATION_DEFAULT_EXPIRATION_DAYS || 30),
    inAppEnabled: parseBoolean(process.env.NOTIFICATION_IN_APP_ENABLED, true),
    emailEnabled: parseBoolean(process.env.NOTIFICATION_EMAIL_ENABLED, false),
    pushEnabled: parseBoolean(process.env.NOTIFICATION_PUSH_ENABLED, false),
  },
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || null,
    privateKey: process.env.VAPID_PRIVATE_KEY || null,
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@operaon.local',
  },
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: Number(process.env.SMTP_PORT || 587),
    secure: parseBoolean(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || null,
    password: process.env.SMTP_PASSWORD || null,
    from: process.env.EMAIL_FROM || 'no-reply@operaon.local',
    fromName: process.env.EMAIL_FROM_NAME || 'Operaon',
  },
};
