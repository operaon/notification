'use strict';

require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');
const { sequelize, Notification, NotificationDelivery, PushSubscription, UserNotificationPreference } = require('../src/models');

const bool = (value, fallback) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'sim'].includes(String(value).toLowerCase());
};
const dryRun = bool(process.env.BACKFILL_DRY_RUN, true);
const batchSize = Number(process.env.BACKFILL_BATCH_SIZE || 500);
const hasLegacyCredentials = Boolean(process.env.LEGACY_DATABASE_URL || process.env.LEGACY_DB_PASSWORD);
if (!hasLegacyCredentials) {
  throw new Error('Backfill bloqueado: informe LEGACY_DATABASE_URL ou LEGACY_DB_PASSWORD antes de acessar o banco legado.');
}
const legacy = new Sequelize(process.env.LEGACY_DATABASE_URL || {
  database: process.env.LEGACY_DB_NAME || 'velyon_api',
  username: process.env.LEGACY_DB_USER || 'dbadmin',
  password: process.env.LEGACY_DB_PASSWORD,
  host: process.env.LEGACY_DB_HOST || 'localhost',
  port: Number(process.env.LEGACY_DB_PORT || 5432),
  dialect: 'postgres',
  logging: false,
});

const hasTable = async (tableName) => {
  const rows = await legacy.query('SELECT 1 FROM information_schema.tables WHERE table_schema = \'public\' AND table_name = :tableName', { replacements: { tableName }, type: QueryTypes.SELECT });
  return rows.length > 0;
};
const fetchRows = async (tableName, columns) => {
  if (!await hasTable(tableName)) return [];
  return legacy.query(`SELECT ${columns.join(', ')} FROM "${tableName}" ORDER BY "createdAt" ASC`, { type: QueryTypes.SELECT });
};
const count = (summary, key) => { summary[key] = (summary[key] || 0) + 1; };
const scopedDedupe = (row) => row.dedupeKey ? `${row.tenantId}:${row.userId}:${row.dedupeKey}` : null;

const importNotifications = async (summary) => {
  const rows = await fetchRows('notifications', ['"id"', '"tenantId"', '"userId"', '"type"', '"title"', '"message"', '"relatedEntityType"', '"relatedEntityId"', '"dedupeKey"', '"isRead"', '"readAt"', '"createdAt"', '"updatedAt"']);
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    for (const row of rows.slice(offset, offset + batchSize)) {
      const existing = await Notification.findByPk(row.id);
      if (existing) { count(summary, 'notificationsSkipped'); continue; }
      if (dryRun) { count(summary, 'notificationsWouldImport'); continue; }
      const notification = await Notification.create({
        id: row.id, tenantId: row.tenantId, userId: row.userId, type: row.type, title: row.title, message: row.message,
        relatedEntityType: row.relatedEntityType, relatedEntityId: row.relatedEntityId, dedupeKey: scopedDedupe(row),
        isRead: row.isRead, readAt: row.readAt, createdAt: row.createdAt, updatedAt: row.updatedAt,
        metadata: row.dedupeKey ? { clientDedupeKey: row.dedupeKey, migratedFrom: 'api.notifications' } : { migratedFrom: 'api.notifications' },
        expiresAt: null,
      });
      await NotificationDelivery.findOrCreate({
        where: { dedupeKey: `${notification.id}:in_app` },
        defaults: { notificationId: notification.id, tenantId: row.tenantId, userId: row.userId, channel: 'in_app', status: 'sent', provider: 'in_app', dedupeKey: `${notification.id}:in_app`, sentAt: row.createdAt || new Date(), expiresAt: null, metadata: { migratedFrom: 'api.notifications' } },
      });
      count(summary, 'notificationsImported');
    }
  }
};

const importPushSubscriptions = async (summary) => {
  const rows = await fetchRows('push_subscriptions', ['"id"', '"tenantId"', '"userId"', '"endpoint"', '"p256dh"', '"auth"', '"userAgent"', '"lastUsedAt"', '"createdAt"', '"updatedAt"']);
  for (const row of rows) {
    const existing = await PushSubscription.findOne({ where: { endpoint: row.endpoint } });
    if (existing) { count(summary, 'pushSkipped'); continue; }
    if (dryRun) { count(summary, 'pushWouldImport'); continue; }
    await PushSubscription.create({ id: row.id, tenantId: row.tenantId, userId: row.userId, endpoint: row.endpoint, subscription: { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, userAgent: row.userAgent, lastUsedAt: row.lastUsedAt, createdAt: row.createdAt, updatedAt: row.updatedAt, metadata: { migratedFrom: 'api.push_subscriptions' } });
    count(summary, 'pushImported');
  }
};

const importPreferences = async (summary) => {
  const rows = await fetchRows('user_notification_preferences', ['"id"', '"userId"', '"tenantId"', '"emailEnabled"', '"pushEnabled"', '"sessionReportsEnabled"', '"reportWeekday"', '"reportHour"', '"createdAt"', '"updatedAt"']);
  for (const row of rows) {
    const existing = await UserNotificationPreference.findOne({ where: { userId: row.userId } });
    if (existing) { count(summary, 'preferencesSkipped'); continue; }
    if (dryRun) { count(summary, 'preferencesWouldImport'); continue; }
    await UserNotificationPreference.create({ id: row.id, userId: row.userId, tenantId: row.tenantId, emailEnabled: row.emailEnabled, pushEnabled: row.pushEnabled, sessionReportsEnabled: row.sessionReportsEnabled, reportWeekday: row.reportWeekday, reportHour: row.reportHour, createdAt: row.createdAt, updatedAt: row.updatedAt });
    count(summary, 'preferencesImported');
  }
};

const run = async () => {
  const summary = { mode: dryRun ? 'dry-run' : 'write' };
  await legacy.authenticate();
  await sequelize.authenticate();
  await importNotifications(summary);
  await importPushSubscriptions(summary);
  await importPreferences(summary);
  console.log(JSON.stringify(summary, null, 2));
};

run().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => { await legacy.close().catch(() => {}); await sequelize.close().catch(() => {}); });
