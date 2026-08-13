'use strict';

const path = require('path');
const dotenv = require('dotenv');

process.env.NODE_ENV = 'test';
dotenv.config({ path: process.env.TEST_ENV_FILE || path.resolve('/tmp/notification-test.env') });

module.exports = process.env;
