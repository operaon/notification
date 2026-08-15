const crypto = require('crypto');
const env = require('../config/env');
const { verifyAccessToken } = require('../utils/jwt');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');

const getBearerToken = (header) => {
  if (!header || typeof header !== 'string') return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
};

const authenticateServiceKey = (req) => {
  const provided = req.get('X-Service-Key');
  if (!provided) {
    throw new AuthenticationError('Credencial de serviço inválida', 'SERVICE_AUTH_INVALID');
  }

  const expectedBuffer = Buffer.from(String(env.serviceApiKey), 'utf8');
  const providedBuffer = Buffer.from(String(provided), 'utf8');
  const matches = providedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  if (!matches) {
    throw new AuthenticationError('Credencial de serviço inválida', 'SERVICE_AUTH_INVALID');
  }
};

const authenticate = (req, _res, next) => {
  try {
    authenticateServiceKey(req);
    const token = getBearerToken(req.get('Authorization'));
    if (!token) throw new AuthenticationError('Token de acesso ausente', 'ACCESS_TOKEN_MISSING');
    const claims = verifyAccessToken(token);
    if (!claims) throw new AuthenticationError('Token de acesso inválido ou expirado', 'ACCESS_TOKEN_INVALID');

    const headerTenantId = req.get('X-Tenant-Id') || null;
    if (headerTenantId && claims.tenantId && headerTenantId !== claims.tenantId) {
      throw new AuthorizationError('Contexto de tenant inconsistente', 'TENANT_CONTEXT_MISMATCH');
    }

    const tenantId = claims.tenantId || headerTenantId || null;
    if (!tenantId && !claims.service) {
      throw new AuthorizationError('Tenant ausente no contexto', 'TENANT_CONTEXT_MISSING');
    }

    req.auth = claims;
    req.context = {
      userId: claims.sub || claims.id || null,
      tenantId,
      roles: Array.isArray(claims.roles) ? claims.roles : [],
      permissions: Array.isArray(claims.permissions) ? claims.permissions : [],
      organizationIds: Array.isArray(claims.organizationIds) ? claims.organizationIds : [],
      isService: Boolean(claims.service),
      requestId: req.requestId || req.get('X-Request-Id') || null,
    };
    return next();
  } catch (error) {
    return next(error);
  }
};

const requirePermission = (resource, action) => (req, _res, next) => {
  const permissions = req.context?.permissions || [];
  if (permissions.includes(`${resource}:${action}`)) return next();
  return next(new AuthorizationError('Permissão insuficiente', 'PERMISSION_DENIED'));
};

module.exports = { authenticate, requirePermission, getBearerToken };
