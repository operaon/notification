require('./env');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { sequelize, Notification, NotificationDelivery, PushSubscription, UserNotificationPreference } = require('../src/models');
const deliveryDispatcher = require('../src/services/deliveryDispatcher');
const env = require('../src/config/env');

const app = createApp();
const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const tokenFor = ({ tenantId = tenantA, userId = userA, permissions = [], audience = env.jwt.audience, tokenType = 'access', service = false } = {}) => jwt.sign({
  sub: userId,
  tenantId,
  tokenType,
  service,
  iss: env.jwt.issuer,
  aud: audience,
  permissions,
  roles: [],
}, env.jwt.secret, { algorithm: env.jwt.algorithm, expiresIn: '10m' });

const headersFor = (options = {}) => ({
  Authorization: `Bearer ${tokenFor(options)}`,
  'X-Service-Key': options.serviceKey || env.serviceApiKey,
  'X-Tenant-Id': options.tenantId || tenantA,
});

beforeAll(async () => {
  await sequelize.authenticate();
});

beforeEach(async () => {
  await sequelize.query('TRUNCATE TABLE notification_audit_events, notification_delivery_attempts, notification_deliveries, notifications, push_subscriptions, user_notification_preferences CASCADE');
});

afterAll(async () => {
  await sequelize.close();
});

describe('Notification & Delivery standalone contract', () => {
  test('expõe health sem autenticação e rejeita chamada de negócio sem credenciais', async () => {
    await request(app).get('/health').expect(200);
    await request(app).get('/api/notifications').expect(401);
    await request(app).get('/api/notifications').set('X-Service-Key', env.serviceApiKey).expect(401);
  });

  test('rejeita audience incorreta, refresh token e credencial de serviço inválida', async () => {
    await request(app).get('/api/notifications').set(headersFor({ audience: ['operaon-api'] })).expect(401);
    await request(app).get('/api/notifications').set(headersFor({ tokenType: 'refresh' })).expect(401);
    await request(app).get('/api/notifications').set(headersFor({ serviceKey: 'invalid-service-key' })).expect(401);
  });

  test('não concede privilégio implícito a token de serviço sem permissão dinâmica', async () => {
    await request(app).post('/api/notifications').set(headersFor({ service: true })).send({
      userId: userB,
      tenantId: tenantA,
      type: 'system',
      title: 'Sem privilégio',
      message: 'não deve passar',
      channels: ['in_app'],
    }).expect(403);
  });

  test('cria uma notificação in-app, aplica dedupe e preserva o contrato de inbox', async () => {
    const body = { type: 'alert', title: 'Aviso', message: 'Mensagem de teste', dedupeKey: 'alert-001', channels: ['in_app'] };
    const first = await request(app).post('/api/notifications').set(headersFor()).send(body).expect(201);
    expect(first.body.created).toBe(true);
    const second = await request(app).post('/api/notifications').set(headersFor()).send(body).expect(200);
    expect(second.body.created).toBe(false);
    expect(await Notification.count()).toBe(1);
    expect(await NotificationDelivery.count()).toBe(1);
    const list = await request(app).get('/api/notifications?page=1&limit=20').set(headersFor()).expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.notifications[0].isRead).toBe(false);
  });

  test('mantém isolamento tenant/user para leitura e mutação', async () => {
    const created = await request(app).post('/api/notifications').set(headersFor()).send({ type: 'system', title: 'Privado', message: 'Tenant A', channels: ['in_app'] }).expect(201);
    const notificationId = created.body.data.id;
    const tenantBList = await request(app).get('/api/notifications').set(headersFor({ tenantId: tenantB, userId: userB })).expect(200);
    expect(tenantBList.body.total).toBe(0);
    await request(app).put(`/api/notifications/${notificationId}/read`).set(headersFor({ tenantId: tenantB, userId: userB })).expect(404);
  });

  test('permite criar para outro usuário somente com permissão dinâmica', async () => {
    await request(app).post('/api/notification-requests').set(headersFor()).send({ userId: userB, tenantId: tenantA, type: 'progress_update', title: 'Sem permissão', message: 'não deve passar' }).expect(403);
    const response = await request(app).post('/api/notification-requests').set(headersFor({ permissions: ['notifications:send'] })).send({ userId: userB, tenantId: tenantA, type: 'progress_update', title: 'Permitido', message: 'deve passar', channels: ['in_app'] }).expect(201);
    expect(response.body.data.userId).toBe(userB);
  });

  test('atualiza preferências e salva inscrição de push no escopo autenticado', async () => {
    const preferences = await request(app).put('/api/notifications/preferences').set(headersFor()).send({ emailEnabled: false, pushEnabled: true, reportHour: 9 }).expect(200);
    expect(preferences.body.data.emailEnabled).toBe(false);
    const push = await request(app).post('/api/push/subscribe').set(headersFor()).send({ subscription: { endpoint: 'https://push.example.test/subscription-a', keys: { p256dh: 'p256dh-test', auth: 'auth-test' } }, userAgent: 'jest' }).expect(200);
    expect(push.body.data.userId).toBe(userA);
    expect(await PushSubscription.count()).toBe(1);
    expect(await UserNotificationPreference.count()).toBe(1);
  });

  test('processa entrega in-app e registra tentativa no worker', async () => {
    const created = await request(app).post('/api/notifications').set(headersFor()).send({ type: 'system', title: 'Worker', message: 'processar', channels: ['in_app'] }).expect(201);
    const result = await deliveryDispatcher.tick();
    expect(result.acquired).toBe(1);
    const delivery = await NotificationDelivery.findOne({ where: { notificationId: created.body.data.id } });
    expect(delivery.status).toBe('sent');
    expect(delivery.attemptCount).toBe(1);
    const attempts = await sequelize.models.NotificationDeliveryAttempt.count();
    expect(attempts).toBe(1);
  });

  test('marca canal sem provider como skipped sem derrubar a inbox', async () => {
    const created = await request(app).post('/api/notifications').set(headersFor()).send({ type: 'system', title: 'Push', message: 'sem VAPID', channels: ['web_push'] }).expect(201);
    await deliveryDispatcher.tick();
    const delivery = await NotificationDelivery.findOne({ where: { notificationId: created.body.data.id } });
    expect(delivery.status).toBe('skipped');
    const unread = await request(app).get('/api/notifications/unread').set(headersFor()).expect(200);
    expect(unread.body.total).toBe(1);
  });
});
