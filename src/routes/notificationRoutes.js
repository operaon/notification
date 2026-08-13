const express = require('express');
const controller = require('../controllers/notificationController');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../validators');
const { z } = require('zod');

const router = express.Router();
const validateNotificationId = (req, _res, next) => {
  const result = z.string().uuid().safeParse(req.params.notificationId);
  if (!result.success) return next(Object.assign(new Error('notificationId inválido'), { statusCode: 422, code: 'VALIDATION_ERROR' }));
  return next();
};

router.use(authenticate);
router.get('/preferences', controller.getPreferences);
router.put('/preferences', validate('updatePreferences'), controller.updatePreferences);
router.post('/', validate('notificationRequest'), controller.createNotification);
router.get('/', controller.listNotifications);
router.get('/unread', controller.getUnreadNotifications);
router.get('/count', controller.countUnreadNotifications);
router.put('/all/read', controller.markAllAsRead);
router.delete('/read', controller.deleteReadNotifications);
router.put('/:notificationId/read', validateNotificationId, controller.markAsRead);
router.delete('/:notificationId', validateNotificationId, controller.deleteNotification);

module.exports = router;
