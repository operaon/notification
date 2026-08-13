const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NotificationAuditEvent = sequelize.define('NotificationAuditEvent', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenantId: { type: DataTypes.UUID, allowNull: true },
  actorUserId: { type: DataTypes.UUID, allowNull: true },
  entityType: { type: DataTypes.STRING(120), allowNull: false },
  entityId: { type: DataTypes.UUID, allowNull: false },
  action: { type: DataTypes.STRING(120), allowNull: false },
  requestId: { type: DataTypes.STRING(120), allowNull: true },
  details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, {
  tableName: 'notification_audit_events',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['tenantId', 'createdAt'] },
    { fields: ['entityType', 'entityId'] },
    { fields: ['actorUserId'] },
  ],
});

module.exports = NotificationAuditEvent;
