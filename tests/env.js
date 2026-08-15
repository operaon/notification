const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: process.env.TEST_ENV_FILE || path.resolve('/tmp/notification-test.env') });

process.env.NODE_ENV = 'test';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5432';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'operaon_notification_test';
process.env.DB_USER = process.env.DB_USER || 'dbadmin';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || '';
process.env.DB_SSL = process.env.DB_SSL || 'false';
process.env.SERVICE_API_KEY = process.env.SERVICE_API_KEY || 'notification-test-service-key';
process.env.NOTIFICATION_SERVICE_API_KEY = process.env.NOTIFICATION_SERVICE_API_KEY || process.env.SERVICE_API_KEY;
process.env.JWT_ALGORITHM = 'HS256';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'notification-test-jwt-secret-change-me';
process.env.JWT_ISSUER = process.env.JWT_ISSUER || 'operaon-identity';
process.env.JWT_AUDIENCE = 'operaon-notification';

module.exports = process.env;
