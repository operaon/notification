const { Op } = require('sequelize');
const {
  sequelize,
  Notification,
  NotificationDelivery,
  NotificationDeliveryAttempt,
} = require('../models');
const preferenceService = require('./notificationPreferenceService');
const pushService = require('./pushService');
const emailService = require('./emailService');
const env = require('../config/env');
const logger = require('../config/logger');

let timer = null;
let ticking = false;

class SkipDelivery extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.skip = true;
  }
}

const backoffSeconds = (attemptNumber) => env.delivery.retryBaseSeconds * (2 ** Math.max(0, attemptNumber - 1));

const acquireBatch = async () => {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + env.delivery.leaseSeconds * 1000);
  return sequelize.transaction(async (transaction) => {
    const deliveries = await NotificationDelivery.findAll({
      where: {
        status: { [Op.in]: ['pending', 'failed', 'processing'] },
        nextAttemptAt: { [Op.lte]: now },
        [Op.or]: [{ lockedUntil: null }, { lockedUntil: { [Op.lt]: now } }],
        [Op.and]: [{ [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }] }],
      },
      order: [['nextAttemptAt', 'ASC'], ['createdAt', 'ASC']],
      limit: env.delivery.batchSize,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
      transaction,
    });
    for (const delivery of deliveries) {
      await delivery.update({ status: 'processing', lockedUntil: leaseUntil, attemptCount: delivery.attemptCount + 1 }, { transaction });
    }
    return deliveries;
  });
};

const resolveChannel = async (delivery, notification) => {
  const category = delivery.metadata?.preferenceCategory || notification.type;
  const channelForPreference = delivery.channel === 'web_push' ? 'push' : delivery.channel;
  if (delivery.channel !== 'in_app' && !await preferenceService.canDeliver(delivery.userId, delivery.tenantId, category, channelForPreference)) {
    throw new SkipDelivery('PREFERENCE_DISABLED', 'Canal desativado nas preferências do usuário');
  }

  if (delivery.channel === 'in_app') return { provider: 'in_app', providerMessageId: null };
  if (delivery.channel === 'web_push') {
    if (!pushService.isPushConfigured()) throw new SkipDelivery('PUSH_NOT_CONFIGURED', 'Web Push não está configurado');
    const result = await pushService.sendPushToUser(delivery.tenantId, delivery.userId, { ...notification.toJSON(), url: delivery.metadata?.url });
    if (!result.sent && !result.failed) throw new SkipDelivery('PUSH_NO_SUBSCRIPTION', 'Usuário não possui inscrição Web Push ativa');
    if (result.failed && !result.sent) throw Object.assign(new Error('Falha ao enviar Web Push'), { code: 'PUSH_DELIVERY_FAILED' });
    return { provider: 'web_push', providerMessageId: null };
  }
  if (delivery.channel === 'email') {
    if (!emailService.isEmailConfigured()) throw new SkipDelivery('EMAIL_NOT_CONFIGURED', 'SMTP não está configurado');
    const email = delivery.metadata?.email || {};
    if (!email.to) throw Object.assign(new Error('Destinatário de e-mail ausente'), { code: 'EMAIL_RECIPIENT_MISSING' });
    return emailService.sendEmail({
      to: email.to,
      subject: email.subject || notification.title,
      html: email.html,
      text: notification.message,
    });
  }
  throw Object.assign(new Error(`Adapter não implementado para o canal ${delivery.channel}`), { code: 'CHANNEL_PROVIDER_UNAVAILABLE' });
};

const processDelivery = async (delivery) => {
  const notification = await Notification.findByPk(delivery.notificationId);
  if (!notification) {
    await delivery.update({ status: 'dead_letter', lockedUntil: null, lastErrorCode: 'NOTIFICATION_NOT_FOUND', lastErrorMessage: 'Notificação pai não encontrada' });
    return { status: 'dead_letter' };
  }

  const attempt = await NotificationDeliveryAttempt.create({
    deliveryId: delivery.id,
    tenantId: delivery.tenantId,
    attemptNumber: delivery.attemptCount,
    status: 'processing',
    provider: delivery.provider,
    startedAt: new Date(),
  });

  try {
    const result = await resolveChannel(delivery, notification);
    if (result?.skip) throw new SkipDelivery(result.code, result.message);
    const completedAt = new Date();
    await attempt.update({ status: 'sent', completedAt, provider: result.provider || delivery.provider, providerMessageId: result.providerMessageId || null });
    await delivery.update({ status: 'sent', sentAt: completedAt, lockedUntil: null, provider: result.provider || delivery.provider, providerMessageId: result.providerMessageId || null, lastErrorCode: null, lastErrorMessage: null });
    return { status: 'sent' };
  } catch (error) {
    if (error.skip) {
      await attempt.update({ status: 'failed', completedAt: new Date(), errorCode: error.code, errorMessage: error.message });
      await delivery.update({ status: 'skipped', lockedUntil: null, lastErrorCode: error.code, lastErrorMessage: error.message });
      return { status: 'skipped' };
    }

    const terminal = delivery.attemptCount >= env.delivery.maxAttempts;
    const nextAttemptAt = new Date(Date.now() + backoffSeconds(delivery.attemptCount) * 1000);
    await attempt.update({ status: 'failed', completedAt: new Date(), errorCode: error.code || 'DELIVERY_FAILED', errorMessage: error.message });
    await delivery.update({
      status: terminal ? 'dead_letter' : 'failed',
      lockedUntil: null,
      nextAttemptAt,
      lastErrorCode: error.code || 'DELIVERY_FAILED',
      lastErrorMessage: error.message,
    });
    logger.warn({ err: error, deliveryId: delivery.id, attempt: delivery.attemptCount, terminal }, 'notification delivery failed');
    return { status: terminal ? 'dead_letter' : 'failed' };
  }
};

const expireDeliveries = async () => {
  const [updated] = await NotificationDelivery.update({ status: 'skipped', lastErrorCode: 'DELIVERY_EXPIRED', lastErrorMessage: 'Entrega expirada', lockedUntil: null }, {
    where: { status: { [Op.in]: ['pending', 'failed', 'processing'] }, expiresAt: { [Op.lt]: new Date() } },
  });
  return updated;
};

const tick = async () => {
  if (ticking) return { acquired: 0, skipped: true };
  ticking = true;
  try {
    await expireDeliveries();
    const batch = await acquireBatch();
    const results = [];
    for (const delivery of batch) results.push(await processDelivery(delivery));
    return { acquired: batch.length, results };
  } finally {
    ticking = false;
  }
};

const start = () => {
  if (!env.delivery.workerEnabled || timer) return () => {};
  timer = setInterval(() => tick().catch((error) => logger.error({ err: error }, 'notification worker tick failed')), env.delivery.pollIntervalMs);
  timer.unref?.();
  tick().catch((error) => logger.error({ err: error }, 'notification worker initial tick failed'));
  logger.info({ intervalMs: env.delivery.pollIntervalMs, batchSize: env.delivery.batchSize }, 'notification delivery worker started');
  return stop;
};

const stop = () => {
  if (timer) clearInterval(timer);
  timer = null;
  logger.info('notification delivery worker stopped');
};

const isRunning = () => Boolean(timer);

module.exports = { start, stop, tick, isRunning, acquireBatch, processDelivery, expireDeliveries };
