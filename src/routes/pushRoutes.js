const express = require('express');
const controller = require('../controllers/pushController');
const { authenticate } = require('../middlewares/auth');
const { validate } = require('../validators');

const router = express.Router();
router.use(authenticate);
router.get('/vapid-public-key', controller.getVapidPublicKey);
router.post('/subscribe', validate('pushSubscription'), controller.subscribe);
router.post('/unsubscribe', validate('unsubscribe'), controller.unsubscribe);

module.exports = router;
