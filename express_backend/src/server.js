'use strict';

require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectMongoWithRetry, disconnectMongo } = require('./db');
const { initIO } = require('./socket');
const { subscribeAdminBootstrapOnConnect } = require('./bootstrap/admin');

const PORT = process.env.PORT || process.env.VITE_PORT || 3001;
const HOST = process.env.HOST || process.env.VITE_HOST || '0.0.0.0';

const server = http.createServer(app);

// Initialize Socket.io (does not block startup)
const io = initIO(server);

// Start HTTP server immediately; do not block on DB availability
server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running at http://${HOST}:${PORT}`);
});

 // Start background Mongo connection retry loop
const retryController = connectMongoWithRetry(2000, 30000);

// Subscribe admin bootstrap to run once when Mongo connects
try {
  subscribeAdminBootstrapOnConnect();
  // eslint-disable-next-line no-console
  console.log('[Bootstrap] Admin bootstrap subscribed to Mongo connection event');
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('[Bootstrap] Failed to subscribe admin bootstrap:', e && e.message ? e.message : e);
}

// Global safety: avoid process crash on unhandled promise rejections during startup
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[Process] Unhandled Promise Rejection:', reason && reason.message ? reason.message : reason);
});

process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[Process] Uncaught Exception:', err && err.message ? err.message : err);
});

// Graceful shutdown
async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`${signal} signal received: closing HTTP server`);
  server.close(async () => {
    // eslint-disable-next-line no-console
    console.log('HTTP server closed');
    try {
      // stop retry loop and disconnect if connected
      if (retryController && typeof retryController.stop === 'function') {
        retryController.stop();
      }
      await disconnectMongo();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Mongo disconnect error:', e.message);
    }
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { server, io };
