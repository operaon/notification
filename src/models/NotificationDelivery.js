const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NotificationDelivery = sequelize.define('NotificationDelivery', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  notificationId: { type: DataTypes.UUID, allowNull: false },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: false },
  channel: {
    type: DataTypes.ENUM('in_app', 'web_push', 'email', 'sms', 'whatsapp', 'webhook'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'sent', 'failed', 'dead_letter', 'skipped'),
    allowNull: false,
    defaultValue: 'pending',
  },
  provider: { type: DataTypes.STRING(120), allowNull: true },
  dedupeKey: { type: DataTypes.STRING(255), allowNull: false },
  nextAttemptAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  attemptCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lockedUntil: { type: DataTypes.DATE, allowNull: true },
  sentAt: { type: DataTypes.DATE, allowNull: true },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
  providerMessageId: { type: DataTypes.STRING(255), allowNull: true },
  lastErrorCode: { type: DataTypes.STRING(120), allowNull: true },
  lastErrorMessage: { type: DataTypes.TEXT, allowNull: true },
  metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, {
  tableName: 'notification_deliveries',
  timestamps: true,
  indexes: [
    { fields: ['tenantId', 'userId', 'channel'] },
    { fields: ['status', 'nextAttemptAt'] },
    { fields: ['lockedUntil'] },
    { fields: ['notificationId'] },
    { fields: ['dedupeKey'], unique: true, name: 'notification_deliveries_dedupe_key_unique' },
  ],
});

module.exports = NotificationDelivery;
