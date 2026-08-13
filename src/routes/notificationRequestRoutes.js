const express = require('express');
const controller = require('../controllers/notificationController');
const { authenticate, requirePermission } = require('../middlewares/auth');
const { validate } = require('../validators');

const router = express.Router();
router.use(authenticate);
router.use(requirePermission('notifications', 'send'));
router.post('/', validate('notificationRequest'), controller.createNotification);

module.exports = router;
