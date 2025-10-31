'use strict';

const express = require('express');
const healthController = require('../controllers/health');
const eventsApi = require('./events');
const authApi = require('./auth');

const router = express.Router();

// Health endpoints
/**
 * @swagger
 * /:
 *   get:
 *     summary: Health endpoint
 *     responses:
 *       200:
 *         description: Service health check passed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 */
router.get('/', healthController.check.bind(healthController));

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health endpoint alias
 *     description: Returns service health status including environment and timestamp.
 *     responses:
 *       200:
 *         description: Service health check passed
 */
router.get('/health', healthController.check.bind(healthController));

// API routes (mount under /api)
router.use('/api', authApi);
router.use('/api', eventsApi);

module.exports = router;
