const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PushSubscription = sequelize.define('PushSubscription', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  endpoint: { type: DataTypes.TEXT, allowNull: false },
  p256dh: { type: DataTypes.TEXT, allowNull: false },
  auth: { type: DataTypes.TEXT, allowNull: false },
  userAgent: { type: DataTypes.STRING(500), allowNull: true },
  lastUsedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'push_subscriptions',
  timestamps: true,
  indexes: [
    { fields: ['tenantId', 'userId'] },
    { fields: ['endpoint'], unique: true, name: 'push_subscriptions_endpoint_unique' },
  ],
});

module.exports = PushSubscription;
