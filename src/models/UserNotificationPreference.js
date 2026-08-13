const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserNotificationPreference = sequelize.define('UserNotificationPreference', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false, unique: true },
  tenantId: { type: DataTypes.UUID, allowNull: true },
  emailEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  pushEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sessionReportsEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  reportWeekday: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  reportHour: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 8 },
  categoryOverrides: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, {
  tableName: 'user_notification_preferences',
  timestamps: true,
  indexes: [
    { fields: ['userId'], unique: true, name: 'user_notification_preferences_user_unique' },
    { fields: ['tenantId'] },
    { fields: ['sessionReportsEnabled'] },
  ],
});

module.exports = UserNotificationPreference;
