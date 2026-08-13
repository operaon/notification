const { UserNotificationPreference } = require('../models');
const { ValidationError } = require('../utils/errors');

const DEFAULTS = {
  emailEnabled: true,
  pushEnabled: true,
  sessionReportsEnabled: false,
  reportWeekday: 1,
  reportHour: 8,
  categoryOverrides: {},
};

const getPreferences = async (userId, tenantId = null) => {
  const [record] = await UserNotificationPreference.findOrCreate({
    where: { userId },
    defaults: { ...DEFAULTS, tenantId },
  });
  return record;
};

const updatePreferences = async (userId, tenantId, changes) => {
  if (changes.reportWeekday !== undefined && (changes.reportWeekday < 0 || changes.reportWeekday > 6)) {
    throw new ValidationError('reportWeekday deve estar entre 0 e 6');
  }
  if (changes.reportHour !== undefined && (changes.reportHour < 0 || changes.reportHour > 23)) {
    throw new ValidationError('reportHour deve estar entre 0 e 23');
  }
  const record = await getPreferences(userId, tenantId);
  await record.update({ ...changes, tenantId: tenantId || record.tenantId });
  return record;
};

const canDeliver = async (userId, tenantId, category, channel) => {
  const preferences = await getPreferences(userId, tenantId);
  if (channel === 'in_app') return true;
  if (channel === 'email' && preferences.emailEnabled === false) return false;
  if (channel === 'web_push' && preferences.pushEnabled === false) return false;
  const override = preferences.categoryOverrides?.[category]?.[channel];
  return override === undefined ? true : Boolean(override);
};

module.exports = { DEFAULTS, getPreferences, updatePreferences, canDeliver };
