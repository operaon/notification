const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NotificationDeliveryAttempt = sequelize.define('NotificationDeliveryAttempt', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  deliveryId: { type: DataTypes.UUID, allowNull: false },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  attemptNumber: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('processing', 'sent', 'failed'), allowNull: false },
  provider: { type: DataTypes.STRING(120), allowNull: true },
  startedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  httpStatus: { type: DataTypes.INTEGER, allowNull: true },
  providerMessageId: { type: DataTypes.STRING(255), allowNull: true },
  errorCode: { type: DataTypes.STRING(120), allowNull: true },
  errorMessage: { type: DataTypes.TEXT, allowNull: true },
  metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, {
  tableName: 'notification_delivery_attempts',
  timestamps: true,
  indexes: [
    { fields: ['deliveryId', 'attemptNumber'], unique: true, name: 'notification_attempt_delivery_number_unique' },
    { fields: ['tenantId', 'createdAt'] },
  ],
});

module.exports = NotificationDeliveryAttempt;
