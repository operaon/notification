const webpush = require('web-push');
const { PushSubscription } = require('../models');
const env = require('../config/env');
const logger = require('../config/logger');

let configured = false;
if (env.delivery.pushEnabled && env.vapid.publicKey && env.vapid.privateKey) {
  webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
  configured = true;
} else {
  logger.info({ enabled: env.delivery.pushEnabled, configured: Boolean(env.vapid.publicKey && env.vapid.privateKey) }, 'web push adapter disabled or not configured');
}

const isPushConfigured = () => configured;
const getPublicKey = () => env.vapid.publicKey;

const saveSubscription = async (tenantId, userId, subscription, userAgent) => {
  const { endpoint, keys } = subscription || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    const error = new Error('Inscrição de push inválida: endpoint/keys ausentes.');
    error.statusCode = 400;
    error.code = 'PUSH_SUBSCRIPTION_INVALID';
    throw error;
  }

  const existing = await PushSubscription.findOne({ where: { endpoint } });
  if (existing) {
    await existing.update({ tenantId: tenantId || null, userId, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent || null, lastUsedAt: new Date() });
    return existing;
  }
  return PushSubscription.create({ tenantId: tenantId || null, userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent || null, lastUsedAt: new Date() });
};

const removeSubscription = async (tenantId, userId, endpoint) => {
  return PushSubscription.destroy({ where: { tenantId: tenantId || null, userId, endpoint } });
};

const removeAllSubscriptionsForUser = async (tenantId, userId) => {
  return PushSubscription.destroy({ where: { tenantId: tenantId || null, userId } });
};

const sendPushToUser = async (tenantId, userId, payload) => {
  if (!configured) return { sent: 0, failed: 0, skipped: true };
  const subscriptions = await PushSubscription.findAll({ where: { tenantId: tenantId || null, userId } });
  if (!subscriptions.length) return { sent: 0, failed: 0, skipped: false };

  const notificationPayload = JSON.stringify({
    title: payload.title,
    body: payload.message || payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: payload.relatedEntityId ? `notification-${payload.relatedEntityId}` : `notification-${payload.id}`,
    data: {
      notificationId: payload.id,
      relatedEntityType: payload.relatedEntityType,
      relatedEntityId: payload.relatedEntityId,
      url: payload.url || '/notifications',
    },
  });

  let sent = 0;
  let failed = 0;
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, notificationPayload);
      sent += 1;
      await subscription.update({ lastUsedAt: new Date() });
    } catch (error) {
      failed += 1;
      if (error.statusCode === 404 || error.statusCode === 410) {
        await subscription.destroy().catch(() => {});
      } else {
        logger.warn({ err: error, subscriptionId: subscription.id }, 'web push delivery failed');
      }
    }
  }));
  return { sent, failed, skipped: false };
};

module.exports = { isPushConfigured, getPublicKey, saveSubscription, removeSubscription, removeAllSubscriptionsForUser, sendPushToUser };
