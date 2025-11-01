'use strict';

require('dotenv').config();
const cors = require('cors');
const express = require('express');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
// Defensive load of swagger spec; if it fails, fall back to minimal spec later.
let swaggerSpec;
try {
  // PUBLIC_INTERFACE
  /** Load generated swagger spec for API docs. Falls back to empty spec on error. */
  swaggerSpec = require('../swagger');
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('[Swagger] Failed to load swagger spec:', e && e.message ? e.message : e);
  swaggerSpec = { openapi: '3.0.0', info: { title: 'API', version: '1.0.0' }, paths: {} };
}

// Initialize express app
const app = express();

/**
 * Global CORS configuration
 * - Origin restricted to deployed frontend: https://real-time-analytics-dashboard.kavia.app
 * - Methods allowed: GET, POST, PUT, PATCH, DELETE, OPTIONS
 * - Headers allowed: Content-Type, Authorization
 * - Credentials: true (safe for cookies/JWT if used)
 * - Ensure OPTIONS preflight returns 204
 *
 * Note: We keep this middleware at the very top (before routes) to avoid
 * any restrictive overrides later in the chain.
 */
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || process.env.VITE_FRONTEND_ORIGIN || 'http://localhost:3000';
const corsOptions = {
  origin: FRONTEND_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
  credentials: true, // keep true if cookies are used; harmless for bearer tokens
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
// Explicitly handle preflight across all routes
app.options('*', cors(corsOptions));

app.set('trust proxy', true);

// Swagger docs with dynamic server URL and guards for ports behind proxies
app.use('/docs', swaggerUi.serve, (req, res, next) => {
  try {
    const hostHeader = req.get('host') || 'localhost';
    let protocol = req.secure ? 'https' : (req.protocol || 'http');

    // In some proxies localPort may be undefined; fall back to X-Forwarded-Port or parsed host
    const forwardedPort = req.get('x-forwarded-port');
    const actualPort = Number(forwardedPort || req.socket?.localPort || '') || (protocol === 'https' ? 443 : 80);
    const hasPort = hostHeader.includes(':');

    const needsPort =
      !hasPort &&
      ((protocol === 'http' && actualPort !== 80) ||
       (protocol === 'https' && actualPort !== 443));

    const fullHost = needsPort ? `${hostHeader}:${actualPort}` : hostHeader;

    const dynamicSpec = {
      ...swaggerSpec,
      servers: [
        {
          url: `${protocol}://${fullHost}`,
        },
      ],
    };
    swaggerUi.setup(dynamicSpec)(req, res, next);
  } catch (e) {
    // Fail safe to static swagger if dynamic fails
    swaggerUi.setup(swaggerSpec)(req, res, next);
  }
});

// Parse JSON request body
app.use(express.json());

// Mount routes
app.use('/', routes);

// Error handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Internal Server Error',
  });
});

module.exports = app;
