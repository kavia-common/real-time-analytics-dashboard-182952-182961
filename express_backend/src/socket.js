'use strict';

let ioInstance = null;

/**
 * Initialize Socket.io on a given HTTP server with CORS configured.
 * FRONTEND_ORIGIN env variable is used for CORS origins.
 *
 * @param {import('http').Server} server
 */
// PUBLIC_INTERFACE
function initIO(server) {
  /** Initialize a singleton Socket.io instance on the given server. */
  const { Server } = require('socket.io');
  const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

  ioInstance = new Server(server, {
    cors: {
      origin: FRONTEND_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  ioInstance.on('connection', (socket) => {
    // eslint-disable-next-line no-console
    console.log('[Socket.io] client connected', socket.id);
    socket.on('disconnect', () => {
      // eslint-disable-next-line no-console
      console.log('[Socket.io] client disconnected', socket.id);
    });
  });

  return ioInstance;
}

/**
 * Get the initialized Socket.io instance.
 * Throws if not yet initialized.
 */
// PUBLIC_INTERFACE
function getIO() {
  /** Return the Socket.io server instance. */
  if (!ioInstance) {
    throw new Error('Socket.io has not been initialized. Call initIO(server) first.');
  }
  return ioInstance;
}

module.exports = {
  initIO,
  getIO,
};
