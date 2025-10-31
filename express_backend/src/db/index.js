'use strict';

const mongoose = require('mongoose');

let retryTimer = null;
let lastError = null;

/**
 * Initialize a MongoDB connection using Mongoose.
 * Uses MONGODB_URI from environment.
 * Provides graceful error handling and reconnection behavior via Mongoose defaults.
 *
 * Exports helpers to connect with retry, disconnect, and check state.
 */

// Attach connection logs once
let listenersAttached = false;
function attachConnectionLogs() {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    // eslint-disable-next-line no-console
    console.log('[MongoDB] connected');
    lastError = null;
  });
  mongoose.connection.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[MongoDB] connection error:', err.message);
    lastError = err;
  });
  mongoose.connection.on('disconnected', () => {
    // eslint-disable-next-line no-console
    console.log('[MongoDB] disconnected');
  });
}

/**
 * Attempt a single MongoDB connection. Throws on failure.
 */
// PUBLIC_INTERFACE
async function connectMongo() {
  /** Connect to MongoDB using the MONGODB_URI env var. */
  attachConnectionLogs();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Missing MONGODB_URI environment variable. Please set it in your environment.');
  }
  await mongoose.connect(uri);
  return mongoose.connection;
}

/**
 * Start a background retry loop to connect to Mongo without blocking server start.
 * It retries with exponential backoff (max 30s).
 */
// PUBLIC_INTERFACE
function connectMongoWithRetry(initialDelayMs = 2000, maxDelayMs = 30000) {
  /** Start background Mongo connection attempts with exponential backoff. */
  attachConnectionLogs();

  let delay = initialDelayMs;

  const attempt = async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      // eslint-disable-next-line no-console
      console.warn('[MongoDB] MONGODB_URI not set. Will retry in', Math.round(delay / 1000), 's');
      scheduleNext();
      return;
    }

    try {
      await mongoose.connect(uri);
      // Connected successfully
      // eslint-disable-next-line no-console
      console.log('[MongoDB] connected via retry loop');
      clearTimer();
    } catch (err) {
      lastError = err;
      // eslint-disable-next-line no-console
      console.error(`[MongoDB] connect failed (${err.message}). Retrying in ${Math.round(delay / 1000)}s...`);
      scheduleNext();
      delay = Math.min(delay * 2, maxDelayMs);
    }
  };

  const scheduleNext = () => {
    clearTimer();
    retryTimer = setTimeout(attempt, delay);
    // Do not keep process alive solely for timers
    if (retryTimer.unref) retryTimer.unref();
  };

  const clearTimer = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  // Kick off first attempt without blocking
  attempt();

  return {
    stop: () => clearTimer(),
  };
}

// PUBLIC_INTERFACE
async function disconnectMongo() {
  /** Disconnect from MongoDB and stop retry loop if any. */
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

// PUBLIC_INTERFACE
function isMongoConnected() {
  /** Returns true if mongoose connection is ready. */
  // 1 = connected, 2 = connecting
  return mongoose.connection.readyState === 1;
}

// PUBLIC_INTERFACE
function getLastMongoError() {
  /** Returns last connection error if any. */
  return lastError;
}

module.exports = {
  connectMongo,
  connectMongoWithRetry,
  disconnectMongo,
  isMongoConnected,
  getLastMongoError,
};
