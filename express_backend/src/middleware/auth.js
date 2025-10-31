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

// PUBLIC_INTERFACE
function requireAuth(req, res, next) {
  /** Express middleware to require a valid JWT and attach user to req.user */
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization Bearer token' });
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      // Do not leak config details in production, but make it clear for devs
      return res.status(500).json({ error: 'JWT not configured' });
    }
    const payload = jwt.verify(token, secret);
    // Attach limited user info
    req.user = {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// PUBLIC_INTERFACE
function requireAdmin(req, res, next) {
  /** Express middleware to require admin role on an authenticated user */
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const roles = req.user.roles || [];
  if (!roles.includes('admin')) {
    return res.status(403).json({ error: 'Admin role required' });
  }
  return next();
}

module.exports = {
  requireAuth,
  requireAdmin,
};
