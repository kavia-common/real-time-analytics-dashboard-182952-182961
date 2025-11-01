'use strict';

const express = require('express');
const healthController = require('../controllers/health');
const eventsApi = require('./events');
const authApi = require('./auth');
const adminAuthApi = require('./adminAuth');
const mcqApi = require('./mcq');
const metricsApi = require('./metrics');

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

/* API routes (mount under /api)
 * Includes:
 * - Auth (/api/auth/...)
 * - Events (/api/events)
 * - MCQ (/api/questions, /api/answers)
 * - Metrics (/api/metrics/...)
 */
router.use('/api/auth', authApi);
router.use('/api', adminAuthApi);
router.use('/api', eventsApi);
router.use('/api', mcqApi);
router.use('/api', metricsApi);

/**
 * @swagger
 * /api/admin/seed:
 *   post:
 *     summary: Trigger admin seeding (maintenance)
 *     description: >
 *       Triggers admin user seeding from environment variables. Guarded by X-Maintenance-Token header matching VITE_MAINTENANCE_TOKEN.
 *       This endpoint should be disabled/removed after successful provisioning.
 *     tags: [Auth]
 *     parameters:
 *       - in: header
 *         name: X-Maintenance-Token
 *         required: true
 *         schema:
 *           type: string
 *         description: One-time maintenance token configured via VITE_MAINTENANCE_TOKEN
 *     responses:
 *       200:
 *         description: Result of seeding
 *       401:
 *         description: Unauthorized
 */
const { seedAdminUser } = require('../bootstrap/admin');
// PUBLIC_INTERFACE
router.post('/api/admin/seed', async (req, res) => {
  /** Maintenance endpoint to seed admin from env. Requires X-Maintenance-Token matching VITE_MAINTENANCE_TOKEN. */
  const configured = String(process.env.VITE_MAINTENANCE_TOKEN || '');
  const provided = String(req.get('X-Maintenance-Token') || '');
  if (!configured || !provided || configured !== provided) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const force = String(req.query.force || '').toLowerCase() === 'true';
    const result = await seedAdminUser({ force });
    return res.status(200).json(result);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[Maintenance] admin seed error:', e && e.message ? e.message : e);
    return res.status(500).json({ error: 'Seeding failed' });
  }
});

module.exports = router;
