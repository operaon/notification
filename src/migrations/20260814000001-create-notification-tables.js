'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('notifications', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      tenantId: { type: Sequelize.UUID, allowNull: false },
      userId: { type: Sequelize.UUID, allowNull: false },
      type: { type: Sequelize.STRING(120), allowNull: false },
      title: { type: Sequelize.STRING(240), allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false },
      relatedEntityType: { type: Sequelize.STRING(120), allowNull: true },
      relatedEntityId: { type: Sequelize.UUID, allowNull: true },
      dedupeKey: { type: Sequelize.STRING(255), allowNull: true },
      sourceEventId: { type: Sequelize.STRING(255), allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      isRead: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      readAt: { type: Sequelize.DATE, allowNull: true },
      expiresAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.createTable('notification_deliveries', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      notificationId: { type: Sequelize.UUID, allowNull: false, references: { model: 'notifications', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      tenantId: { type: Sequelize.UUID, allowNull: false },
      userId: { type: Sequelize.UUID, allowNull: false },
      channel: { type: Sequelize.ENUM('in_app', 'web_push', 'email', 'sms', 'whatsapp', 'webhook'), allowNull: false },
      status: { type: Sequelize.ENUM('pending', 'processing', 'sent', 'failed', 'dead_letter', 'skipped'), allowNull: false, defaultValue: 'pending' },
      provider: { type: Sequelize.STRING(120), allowNull: true },
      dedupeKey: { type: Sequelize.STRING(255), allowNull: false },
      nextAttemptAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      attemptCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      lockedUntil: { type: Sequelize.DATE, allowNull: true },
      sentAt: { type: Sequelize.DATE, allowNull: true },
      expiresAt: { type: Sequelize.DATE, allowNull: true },
      providerMessageId: { type: Sequelize.STRING(255), allowNull: true },
      lastErrorCode: { type: Sequelize.STRING(120), allowNull: true },
      lastErrorMessage: { type: Sequelize.TEXT, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.createTable('notification_delivery_attempts', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      deliveryId: { type: Sequelize.UUID, allowNull: false, references: { model: 'notification_deliveries', key: 'id' }, onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      tenantId: { type: Sequelize.UUID, allowNull: false },
      attemptNumber: { type: Sequelize.INTEGER, allowNull: false },
      status: { type: Sequelize.ENUM('processing', 'sent', 'failed'), allowNull: false },
      provider: { type: Sequelize.STRING(120), allowNull: true },
      startedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      completedAt: { type: Sequelize.DATE, allowNull: true },
      httpStatus: { type: Sequelize.INTEGER, allowNull: true },
      providerMessageId: { type: Sequelize.STRING(255), allowNull: true },
      errorCode: { type: Sequelize.STRING(120), allowNull: true },
      errorMessage: { type: Sequelize.TEXT, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.createTable('push_subscriptions', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      tenantId: { type: Sequelize.UUID, allowNull: true },
      userId: { type: Sequelize.UUID, allowNull: false },
      endpoint: { type: Sequelize.TEXT, allowNull: false },
      p256dh: { type: Sequelize.TEXT, allowNull: false },
      auth: { type: Sequelize.TEXT, allowNull: false },
      userAgent: { type: Sequelize.STRING(500), allowNull: true },
      lastUsedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.createTable('user_notification_preferences', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false },
      tenantId: { type: Sequelize.UUID, allowNull: true },
      emailEnabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      pushEnabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      sessionReportsEnabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      reportWeekday: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      reportHour: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 8 },
      categoryOverrides: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.createTable('notification_audit_events', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      tenantId: { type: Sequelize.UUID, allowNull: true },
      actorUserId: { type: Sequelize.UUID, allowNull: true },
      entityType: { type: Sequelize.STRING(120), allowNull: false },
      entityId: { type: Sequelize.UUID, allowNull: false },
      action: { type: Sequelize.STRING(120), allowNull: false },
      requestId: { type: Sequelize.STRING(120), allowNull: true },
      details: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.addIndex('notifications', ['tenantId', 'userId', 'createdAt']);
    await queryInterface.addIndex('notifications', ['tenantId', 'userId', 'isRead']);
    await queryInterface.addIndex('notifications', ['dedupeKey'], { unique: true, name: 'notifications_dedupe_key_unique' });
    await queryInterface.addIndex('notifications', ['sourceEventId']);
    await queryInterface.addIndex('notifications', ['expiresAt']);
    await queryInterface.addIndex('notification_deliveries', ['tenantId', 'userId', 'channel']);
    await queryInterface.addIndex('notification_deliveries', ['status', 'nextAttemptAt']);
    await queryInterface.addIndex('notification_deliveries', ['lockedUntil']);
    await queryInterface.addIndex('notification_deliveries', ['notificationId']);
    await queryInterface.addIndex('notification_deliveries', ['dedupeKey'], { unique: true, name: 'notification_deliveries_dedupe_key_unique' });
    await queryInterface.addIndex('notification_delivery_attempts', ['deliveryId', 'attemptNumber'], { unique: true, name: 'notification_attempt_delivery_number_unique' });
    await queryInterface.addIndex('notification_delivery_attempts', ['tenantId', 'createdAt']);
    await queryInterface.addIndex('push_subscriptions', ['tenantId', 'userId']);
    await queryInterface.addIndex('push_subscriptions', ['endpoint'], { unique: true, name: 'push_subscriptions_endpoint_unique' });
    await queryInterface.addIndex('user_notification_preferences', ['userId'], { unique: true, name: 'user_notification_preferences_user_unique' });
    await queryInterface.addIndex('user_notification_preferences', ['tenantId']);
    await queryInterface.addIndex('user_notification_preferences', ['sessionReportsEnabled']);
    await queryInterface.addIndex('notification_audit_events', ['tenantId', 'createdAt']);
    await queryInterface.addIndex('notification_audit_events', ['entityType', 'entityId']);
    await queryInterface.addIndex('notification_audit_events', ['actorUserId']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('notification_audit_events');
    await queryInterface.dropTable('user_notification_preferences');
    await queryInterface.dropTable('push_subscriptions');
    await queryInterface.dropTable('notification_delivery_attempts');
    await queryInterface.dropTable('notification_deliveries');
    await queryInterface.dropTable('notifications');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notification_deliveries_channel"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notification_deliveries_status"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_notification_delivery_attempts_status"');
  },
};
