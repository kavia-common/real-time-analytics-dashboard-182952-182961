'use strict';

const express = require('express');
const Event = require('../models/Event');
const { getIO } = require('../socket');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Events
 *   description: Events API
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Event:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: MongoDB id
 *         username:
 *           type: string
 *           description: Username related to the event
 *         event_type:
 *           type: string
 *           description: Type of the event
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Event timestamp
 *       required:
 *         - username
 *         - event_type
 *   responses:
 *     ValidationError:
 *       description: Invalid request body
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 */

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Get recent events
 *     description: Returns up to the last 10 events sorted by timestamp descending.
 *     tags: [Events]
 *     responses:
 *       200:
 *         description: Array of events
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Event'
 */
router.get('/events', async (req, res, next) => {
  try {
    const events = await Event.find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();
    return res.status(200).json(events);
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Create new event
 *     description: Creates a new event and emits a 'new_event' websocket message to connected clients.
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               event_type:
 *                 type: string
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *             required:
 *               - username
 *               - event_type
 *     responses:
 *       201:
 *         description: Created event
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Event'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/events', async (req, res, next) => {
  try {
    const { username, event_type, timestamp } = req.body || {};
    if (!username || !event_type) {
      return res.status(400).json({ error: 'username and event_type are required' });
    }

    const doc = new Event({
      username,
      event_type,
      timestamp: timestamp ? new Date(timestamp) : undefined,
    });

    const saved = await doc.save();

    // Emit to all connected clients
    try {
      const io = getIO();
      io.emit('new_event', saved.toObject());
      // Also notify metrics listeners for general updates
      io.emit('metrics_update', { type: 'event' });
    } catch (emitErr) {
      // Log but do not fail the request
      // eslint-disable-next-line no-console
      console.warn('[Socket.io] emit failed:', emitErr.message);
    }

    return res.status(201).json(saved);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
