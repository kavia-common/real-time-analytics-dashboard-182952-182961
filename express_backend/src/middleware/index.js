'use strict';

const { requireAuth, requireAdmin, requireAdminAuth } = require('./auth');

// This file will export middleware as the application grows
module.exports = {
  requireAuth,
  requireAdmin,
  requireAdminAuth,
};
