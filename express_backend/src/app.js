'use strict';

require('dotenv').config();
const cors = require('cors');
const express = require('express');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('../swagger');

// Initialize express app
const app = express();

// Configure CORS using FRONTEND_ORIGIN with sane local defaults
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const STRICT_CORS = String(process.env.STRICT_CORS || '').toLowerCase() === 'true';

// Allow several local origins by default; fall back to wildcard in non-strict mode
const localOrigins = [
  FRONTEND_ORIGIN,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

app.use(cors({
  origin: STRICT_CORS
    ? function (origin, callback) {
        const allowed = !origin || localOrigins.includes(origin);
        return callback(null, allowed);
      }
    : ((origin, callback) => {
        // In dev or no origin (curl, health checks), allow
        if (!origin) return callback(null, true);
        return callback(null, true);
      }),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
}));

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
