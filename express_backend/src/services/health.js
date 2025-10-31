'use strict';

const { isMongoConnected, getLastMongoError } = require('../db');
let socketReady = false;

/**
 * Internal setter used by server to update socket readiness if needed.
 * Not exported publicly for now; readiness inferred below if possible.
 */
function inferSocketReady() {
  try {
    // Lazy require to avoid cyclic errors during import
    const socket = require('../socket');
    if (socket && typeof socket.getIO === 'function') {
      socket.getIO();
      socketReady = true;
    } else {
      socketReady = false;
    }
  } catch (_) {
    socketReady = false;
  }
}

class HealthService {
  // PUBLIC_INTERFACE
  getStatus() {
    /** Returns JSON health status including environment, mongo, and process info. */
    inferSocketReady();
    const mongoOk = isMongoConnected();
    const lastErr = getLastMongoError();
    return {
      status: 'ok',
      message: 'Service is healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      mongo: {
        connected: mongoOk,
        lastError: lastErr ? lastErr.message : null,
      },
      socket: {
        ready: socketReady,
      },
      process: {
        uptimeSec: Math.round(process.uptime()),
        pid: process.pid,
      },
    };
  }
}

module.exports = new HealthService();
