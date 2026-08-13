const notificationService = require('../services/notificationService');
const { NotFoundError } = require('../utils/errors');

const getPreferences = async (req, res, next) => {
  try {
    const data = await notificationService.getPreferences(req.context.userId, req.context.tenantId);
    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

const updatePreferences = async (req, res, next) => {
  try {
    const data = await notificationService.updatePreferences(req.context.userId, req.context.tenantId, req.body);
    res.status(200).json({ success: true, message: 'Preferências de notificação atualizadas.', data });
  } catch (error) { next(error); }
};

const createNotification = async (req, res, next) => {
  try {
    const data = await notificationService.createNotification({ context: req.context, data: req.body });
    res.status(data._notificationCreated === false ? 200 : 201).json({ success: true, data, created: data._notificationCreated !== false });
  } catch (error) { next(error); }
};

const listNotifications = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const filters = { limit, offset: (page - 1) * limit, isRead: req.query.isRead === undefined ? undefined : req.query.isRead === 'true' };
    const result = await notificationService.listNotifications(req.context.tenantId, req.context.userId, filters);
    res.status(200).json({ success: true, notifications: result.rows, total: result.count, page, limit });
  } catch (error) { next(error); }
};

const getUnreadNotifications = async (req, res, next) => {
  try {
    const notifications = await notificationService.getUnreadNotifications(req.context.tenantId, req.context.userId);
    res.status(200).json({ success: true, notifications, total: notifications.length });
  } catch (error) { next(error); }
};

const countUnreadNotifications = async (req, res, next) => {
  try {
    const unreadCount = await notificationService.countUnreadNotifications(req.context.tenantId, req.context.userId);
    res.status(200).json({ success: true, unreadCount });
  } catch (error) { next(error); }
};

const markAsRead = async (req, res, next) => {
  try {
    const data = await notificationService.markAsRead({ tenantId: req.context.tenantId, userId: req.context.userId, notificationId: req.params.notificationId, requestId: req.requestId });
    res.status(200).json({ success: true, message: 'Notificação marcada como lida', data });
  } catch (error) { next(error); }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const updated = await notificationService.markAllAsRead({ tenantId: req.context.tenantId, userId: req.context.userId, requestId: req.requestId });
    res.status(200).json({ success: true, message: 'Todas as notificações foram marcadas como lidas', updated });
  } catch (error) { next(error); }
};

const deleteNotification = async (req, res, next) => {
  try {
    await notificationService.deleteNotification({ tenantId: req.context.tenantId, userId: req.context.userId, notificationId: req.params.notificationId, requestId: req.requestId });
    res.status(200).json({ success: true, message: 'Notificação deletada com sucesso' });
  } catch (error) { next(error); }
};

const deleteReadNotifications = async (req, res, next) => {
  try {
    const deleted = await notificationService.deleteReadNotifications({ tenantId: req.context.tenantId, userId: req.context.userId, requestId: req.requestId });
    res.status(200).json({ success: true, message: 'Notificações lidas deletadas com sucesso', deleted });
  } catch (error) { next(error); }
};

const getDelivery = async (req, res, next) => {
  try {
    const { NotificationDelivery } = require('../models');
    const delivery = await NotificationDelivery.findOne({ where: { id: req.params.id, tenantId: req.context.tenantId, userId: req.context.userId } });
    if (!delivery) throw new NotFoundError('Entrega não encontrada', 'DELIVERY_NOT_FOUND');
    res.status(200).json({ success: true, data: delivery });
  } catch (error) { next(error); }
};

module.exports = { getPreferences, updatePreferences, createNotification, listNotifications, getUnreadNotifications, countUnreadNotifications, markAsRead, markAllAsRead, deleteNotification, deleteReadNotifications, getDelivery };
