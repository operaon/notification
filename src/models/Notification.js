const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: false },
  type: { type: DataTypes.STRING(120), allowNull: false },
  title: { type: DataTypes.STRING(240), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  relatedEntityType: { type: DataTypes.STRING(120), allowNull: true },
  relatedEntityId: { type: DataTypes.UUID, allowNull: true },
  dedupeKey: { type: DataTypes.STRING(255), allowNull: true },
  sourceEventId: { type: DataTypes.STRING(255), allowNull: true },
  metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  readAt: { type: DataTypes.DATE, allowNull: true },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'notifications',
  timestamps: true,
  indexes: [
    { fields: ['tenantId', 'userId', 'createdAt'] },
    { fields: ['tenantId', 'userId', 'isRead'] },
    { fields: ['dedupeKey'], unique: true, name: 'notifications_dedupe_key_unique' },
    { fields: ['sourceEventId'] },
    { fields: ['expiresAt'] },
  ],
});

module.exports = Notification;
