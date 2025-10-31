'use strict';

const jwt = require('jsonwebtoken');

/**
 * Extracts JWT token from Authorization header.
 * Expects header: Authorization: Bearer <token>
 */
function extractToken(req) {
  const header = req.get('authorization') || req.get('Authorization');
  if (!header) return null;
  const parts = header.split(' ');
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
    return parts[1];
  }
  return null;
}

/**
 * Decode and verify JWT using shared secret.
 * Returns standardized principal shape: { id, username, email, roles[], role? }
 */
function verifyAndNormalizeToken(req) {
  const token = extractToken(req);
  if (!token) {
    const err = new Error('Missing Authorization Bearer token');
    err.statusCode = 401;
    throw err;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error('JWT not configured');
    err.statusCode = 500;
    throw err;
  }
  const payload = jwt.verify(token, secret);
  const roles = Array.isArray(payload.roles) ? payload.roles : (payload.role ? [payload.role] : []);
  return {
    id: payload.sub,
    username: payload.username,
    email: payload.email,
    roles,
    role: payload.role || (roles.includes('admin') ? 'admin' : undefined),
  };
}

// PUBLIC_INTERFACE
function requireAuth(req, res, next) {
  /** Express middleware to require a valid JWT (user or admin) and attach principal to req.user */
  try {
    const principal = verifyAndNormalizeToken(req);
    req.user = principal;
    return next();
  } catch (err) {
    return res.status(err.statusCode || 401).json({ error: err.message || 'Invalid or expired token' });
  }
}

// PUBLIC_INTERFACE
function requireAdmin(req, res, next) {
  /** Express middleware to require admin role after requireAuth */
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const roles = req.user.roles || [];
  const explicitRole = req.user.role;
  if (explicitRole === 'admin' || roles.includes('admin')) {
    return next();
  }
  return res.status(403).json({ error: 'Admin role required' });
}

// PUBLIC_INTERFACE
function requireAdminAuth(req, res, next) {
  /** Express middleware to require a valid admin JWT specifically. */
  try {
    const principal = verifyAndNormalizeToken(req);
    const roles = principal.roles || [];
    if (principal.role === 'admin' || roles.includes('admin')) {
      req.user = principal;
      return next();
    }
    return res.status(403).json({ error: 'Admin role required' });
  } catch (err) {
    return res.status(err.statusCode || 401).json({ error: err.message || 'Invalid or expired token' });
  }
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireAdminAuth,
};
