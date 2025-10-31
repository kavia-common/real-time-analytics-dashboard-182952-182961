'use strict';

const { requireAuth, requireAdmin } = require('./auth');

// This file will export middleware as the application grows
module.exports = {
  requireAuth,
  requireAdmin,
};
