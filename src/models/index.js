const sequelize = require('../config/database');
const Notification = require('./Notification');
const NotificationDelivery = require('./NotificationDelivery');
const NotificationDeliveryAttempt = require('./NotificationDeliveryAttempt');
const PushSubscription = require('./PushSubscription');
const UserNotificationPreference = require('./UserNotificationPreference');
const NotificationAuditEvent = require('./NotificationAuditEvent');

Notification.hasMany(NotificationDelivery, { foreignKey: 'notificationId', as: 'deliveries', onDelete: 'CASCADE' });
NotificationDelivery.belongsTo(Notification, { foreignKey: 'notificationId', as: 'notification' });
NotificationDelivery.hasMany(NotificationDeliveryAttempt, { foreignKey: 'deliveryId', as: 'attempts', onDelete: 'CASCADE' });
NotificationDeliveryAttempt.belongsTo(NotificationDelivery, { foreignKey: 'deliveryId', as: 'delivery' });

module.exports = {
  sequelize,
  Notification,
  NotificationDelivery,
  NotificationDeliveryAttempt,
  PushSubscription,
  UserNotificationPreference,
  NotificationAuditEvent,
};
