const { z } = require('zod');

const uuid = z.string().uuid();
const channel = z.enum(['in_app', 'web_push', 'email', 'sms', 'whatsapp', 'webhook']);
const notificationType = z.string().min(1).max(120);

const notificationRequest = z.object({
  userId: uuid.optional(),
  tenantId: uuid.optional(),
  type: notificationType,
  title: z.string().min(1).max(240),
  message: z.string().min(1).max(20000),
  channels: z.array(channel).min(1).max(6).optional(),
  preferenceCategory: z.string().min(1).max(120).optional(),
  relatedEntityType: z.string().max(120).optional().nullable(),
  relatedEntityId: uuid.optional().nullable(),
  dedupeKey: z.string().min(1).max(255).optional().nullable(),
  sourceEventId: z.string().min(1).max(255).optional().nullable(),
  metadata: z.record(z.any()).optional(),
  expiresAt: z.coerce.date().optional().nullable(),
  url: z.string().max(2000).optional(),
  email: z.object({
    to: z.string().email(),
    subject: z.string().min(1).max(255).optional(),
    html: z.string().max(100000).optional(),
  }).optional(),
}).passthrough();

const updatePreferences = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  sessionReportsEnabled: z.boolean().optional(),
  reportWeekday: z.coerce.number().int().min(0).max(6).optional(),
  reportHour: z.coerce.number().int().min(0).max(23).optional(),
  categoryOverrides: z.record(z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    in_app: z.boolean().optional(),
  }).passthrough()).optional(),
}).strict();

const pagination = z.object({
  page: z.coerce.number().int().min(1).max(100000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  isRead: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
}).passthrough();

const pushSubscription = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(4000),
    keys: z.object({
      p256dh: z.string().min(1).max(500),
      auth: z.string().min(1).max(500),
    }),
  }),
  userAgent: z.string().max(500).optional(),
});

const unsubscribe = z.object({ endpoint: z.string().url().max(4000) });
const deliveryId = z.object({ id: uuid });

const schemas = { notificationRequest, updatePreferences, pagination, pushSubscription, unsubscribe, deliveryId };

const validate = (schemaName, source = 'body') => (req, _res, next) => {
  const result = schemas[schemaName].safeParse(req[source]);
  if (!result.success) {
    return next(Object.assign(new Error('Dados inválidos'), {
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      details: result.error.flatten(),
    }));
  }
  req[source] = result.data;
  return next();
};

module.exports = { schemas, validate, uuid, channel };
