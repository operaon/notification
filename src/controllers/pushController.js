const pushService = require('../services/pushService');

const getVapidPublicKey = async (_req, res, next) => {
  try {
    const publicKey = pushService.getPublicKey();
    if (!publicKey || !pushService.isPushConfigured()) return res.status(503).json({ success: false, message: 'Serviço de push não configurado no servidor.' });
    return res.status(200).json({ success: true, publicKey });
  } catch (error) { return next(error); }
};

const subscribe = async (req, res, next) => {
  try {
    const record = await pushService.saveSubscription(req.context.tenantId, req.context.userId, req.body.subscription, req.body.userAgent || req.get('user-agent'));
    return res.status(200).json({ success: true, message: 'Inscrição de push salva.', data: record });
  } catch (error) { return next(error); }
};

const unsubscribe = async (req, res, next) => {
  try {
    await pushService.removeSubscription(req.context.tenantId, req.context.userId, req.body.endpoint);
    return res.status(200).json({ success: true, message: 'Inscrição de push removida.' });
  } catch (error) { return next(error); }
};

module.exports = { getVapidPublicKey, subscribe, unsubscribe };
