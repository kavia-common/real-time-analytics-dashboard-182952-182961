'use strict';

const mongoose = require('mongoose');

/**
 * Initialize a MongoDB connection using Mongoose.
 * Uses MONGODB_URI from environment.
 * Provides graceful error handling and reconnection behavior via Mongoose defaults.
 *
 * Exports the connect and disconnect helpers.
 */

// PUBLIC_INTERFACE
async function connectMongo() {
  /** Connect to MongoDB using the MONGODB_URI env var. */
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Missing MONGODB_URI environment variable. Please set it in your environment.');
  }

  // Recommended options for mongoose >=6 are minimal, it sets sensible defaults
  mongoose.set('strictQuery', true);

  // Helpful connection logs
  mongoose.connection.on('connected', () => {
    // eslint-disable-next-line no-console
    console.log('[MongoDB] connected');
  });
  mongoose.connection.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[MongoDB] connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    // eslint-disable-next-line no-console
    console.log('[MongoDB] disconnected');
  });

  await mongoose.connect(uri);
  return mongoose.connection;
}

// PUBLIC_INTERFACE
async function disconnectMongo() {
  /** Disconnect from MongoDB. */
  await mongoose.disconnect();
}

module.exports = {
  connectMongo,
  disconnectMongo,
};
