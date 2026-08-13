require('./env');
const env = require('./env');

module.exports = {
  development: {
    url: env.database.url,
    database: env.database.name,
    username: env.database.user,
    password: env.database.password,
    host: env.database.host,
    port: env.database.port,
    dialect: 'postgres',
    logging: false,
    dialectOptions: env.database.ssl ? { ssl: { require: true, rejectUnauthorized: true } } : {},
  },
  test: {
    url: env.database.url,
    database: env.database.name,
    username: env.database.user,
    password: env.database.password,
    host: env.database.host,
    port: env.database.port,
    dialect: 'postgres',
    logging: false,
    dialectOptions: env.database.ssl ? { ssl: { require: true, rejectUnauthorized: true } } : {},
  },
  production: {
    url: env.database.url,
    database: env.database.name,
    username: env.database.user,
    password: env.database.password,
    host: env.database.host,
    port: env.database.port,
    dialect: 'postgres',
    logging: false,
    dialectOptions: env.database.ssl ? { ssl: { require: true, rejectUnauthorized: true } } : {},
  },
};
