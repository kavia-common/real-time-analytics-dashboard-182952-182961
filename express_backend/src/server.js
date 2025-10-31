'use strict';

require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectMongo, disconnectMongo } = require('./db');
const { initIO } = require('./socket');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(app);

// Initialize Socket.io
const io = initIO(server);

// Start server after attempting Mongo connect
(async () => {
  try {
    await connectMongo();
    server.listen(PORT, HOST, () => {
      // eslint-disable-next-line no-console
      console.log(`Server running at http://${HOST}:${PORT}`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server due to Mongo connection error:', err.message);
    process.exit(1);
  }
})();

// Graceful shutdown
async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`${signal} signal received: closing HTTP server`);
  server.close(async () => {
    // eslint-disable-next-line no-console
    console.log('HTTP server closed');
    try {
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
