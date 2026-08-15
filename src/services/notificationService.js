const { Op } = require('sequelize');
const {
  sequelize,
  Notification,
  NotificationDelivery,
  NotificationAuditEvent,
} = require('../models');
const preferenceService = require('./notificationPreferenceService');
const { NotFoundError, ValidationError, AuthorizationError } = require('../utils/errors');
const env = require('../config/env');

const toJSON = (record) => (record?.toJSON ? record.toJSON() : record);
const scopedKey = (tenantId, userId, key) => `${tenantId}:${userId}:${key}`;

const recordAudit = async ({ tenantId, actorUserId, entityType, entityId, action, requestId, details = {} }) => {
  return NotificationAuditEvent.create({ tenantId: tenantId || null, actorUserId: actorUserId || null, entityType, entityId, action, requestId: requestId || null, details });
};

const createNotification = async ({ context, data }) => {
  const tenantId = data.tenantId || context.tenantId;
  const userId = data.userId || context.userId;
  if (!tenantId) throw new ValidationError('tenantId é obrigatório para criar uma notificação', 'TENANT_CONTEXT_MISSING');
  if (!userId) throw new ValidationError('userId é obrigatório para criar uma notificação', 'NOTIFICATION_USER_REQUIRED');
  if (data.tenantId && data.tenantId !== context.tenantId && !context.permissions.includes('notifications:send')) {
    throw new AuthorizationError('Tenant de destino não corresponde ao contexto autenticado', 'TENANT_CONTEXT_MISMATCH');
  }
  if (data.userId && data.userId !== context.userId && !context.permissions.includes('notifications:send')) {
    throw new AuthorizationError('Não é permitido criar notificações para outro usuário', 'NOTIFICATION_TARGET_FORBIDDEN');
  }

  const expiresAt = data.expiresAt || new Date(Date.now() + env.delivery.defaultExpirationDays * 24 * 60 * 60 * 1000);
  if (expiresAt <= new Date()) throw new ValidationError('expiresAt precisa estar no futuro', 'NOTIFICATION_EXPIRED');
  const channels = data.channels || ['in_app'];
  const clientDedupeKey = data.dedupeKey || null;
  const persistedDedupeKey = clientDedupeKey ? scopedKey(tenantId, userId, clientDedupeKey) : null;
  const metadata = { ...(data.metadata || {}), ...(clientDedupeKey ? { clientDedupeKey } : {}) };

  const result = await sequelize.transaction(async (transaction) => {
    let notification;
    let created = true;
    if (persistedDedupeKey) {
      [notification, created] = await Notification.findOrCreate({
        where: { dedupeKey: persistedDedupeKey },
        defaults: {
          tenantId, userId, type: data.type, title: data.title, message: data.message,
          relatedEntityType: data.relatedEntityType || null, relatedEntityId: data.relatedEntityId || null,
          dedupeKey: persistedDedupeKey, sourceEventId: data.sourceEventId || null, metadata, expiresAt,
        },
        transaction,
      });
    } else {
      notification = await Notification.create({
        tenantId, userId, type: data.type, title: data.title, message: data.message,
        relatedEntityType: data.relatedEntityType || null, relatedEntityId: data.relatedEntityId || null,
        sourceEventId: data.sourceEventId || null, metadata, expiresAt,
      }, { transaction });
    }

    if (created) {
      for (const channel of channels) {
        const deliveryKey = `${notification.id}:${channel}`;
        await NotificationDelivery.findOrCreate({
          where: { dedupeKey: deliveryKey },
          defaults: {
            notificationId: notification.id, tenantId, userId, channel,
            status: channel === 'in_app' && !env.delivery.inAppEnabled ? 'skipped' : 'pending',
            provider: channel === 'in_app' ? 'in_app' : null,
            dedupeKey: deliveryKey, nextAttemptAt: new Date(), expiresAt,
            metadata: {
              url: data.url || null,
              email: data.email || null,
              preferenceCategory: data.preferenceCategory || data.type,
            },
          },
          transaction,
        });
      }
    }
    return { notification, created };
  });

  if (result.created) {
    await recordAudit({
      tenantId,
      actorUserId: context.userId,
      entityType: 'Notification',
      entityId: result.notification.id,
      action: 'create',
      requestId: context.requestId,
      details: { channels, type: data.type, userId },
    });
  }
  result.notification._notificationCreated = result.created;
  return result.notification;
};

const createBulkNotifications = async ({ context, userIds, data }) => {
  const results = [];
  for (const userId of userIds) results.push(await createNotification({ context: { ...context, userId }, data: { ...data, userId } }));
  return results;
};

const listNotifications = async (tenantId, userId, filters = {}) => {
  const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
  const offset = Math.max(0, Number(filters.offset || 0));
  const where = { tenantId, userId };
  if (filters.isRead !== undefined) where.isRead = filters.isRead;
  const { rows, count } = await Notification.findAndCountAll({ where, order: [['createdAt', 'DESC']], limit, offset });
  return { rows, count };
};

const getUnreadNotifications = async (tenantId, userId) => Notification.findAll({ where: { tenantId, userId, isRead: false, [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }] }, order: [['createdAt', 'DESC']] });
const countUnreadNotifications = async (tenantId, userId) => Notification.count({ where: { tenantId, userId, isRead: false, [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: new Date() } }] } });

const markAsRead = async ({ tenantId, userId, notificationId, requestId }) => {
  const notification = await Notification.findOne({ where: { id: notificationId, tenantId, userId } });
  if (!notification) throw new NotFoundError('Notificação não encontrada', 'NOTIFICATION_NOT_FOUND');
  await notification.update({ isRead: true, readAt: new Date() });
  await recordAudit({ tenantId, actorUserId: userId, entityType: 'Notification', entityId: notification.id, action: 'mark_read', requestId });
  return notification;
};

const markAllAsRead = async ({ tenantId, userId, requestId }) => {
  const [updated] = await Notification.update({ isRead: true, readAt: new Date() }, { where: { tenantId, userId, isRead: false } });
  await recordAudit({ tenantId, actorUserId: userId, entityType: 'Notification', entityId: userId, action: 'mark_all_read', requestId, details: { updated } });
  return updated;
};

const deleteNotification = async ({ tenantId, userId, notificationId, requestId }) => {
  const notification = await Notification.findOne({ where: { id: notificationId, tenantId, userId } });
  if (!notification) throw new NotFoundError('Notificação não encontrada', 'NOTIFICATION_NOT_FOUND');
  await notification.destroy();
  await recordAudit({ tenantId, actorUserId: userId, entityType: 'Notification', entityId: notification.id, action: 'delete', requestId });
  return notification;
};

const deleteReadNotifications = async ({ tenantId, userId, requestId }) => {
  const deleted = await Notification.destroy({ where: { tenantId, userId, isRead: true } });
  await recordAudit({ tenantId, actorUserId: userId, entityType: 'Notification', entityId: userId, action: 'delete_read', requestId, details: { deleted } });
  return deleted;
};

const getPreferences = async (userId, tenantId) => preferenceService.getPreferences(userId, tenantId);
const updatePreferences = async (userId, tenantId, changes) => preferenceService.updatePreferences(userId, tenantId, changes);

module.exports = {
  createNotification,
  createBulkNotifications,
  listNotifications,
  getUnreadNotifications,
  countUnreadNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteReadNotifications,
  getPreferences,
  updatePreferences,
  recordAudit,
};
