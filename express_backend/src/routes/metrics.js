'use strict';

const express = require('express');
const User = require('../models/User');
const UserEvent = require('../models/UserEvent');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Metrics
 *   description: Analytics and metrics API
 */

/**
 * @swagger
 * /api/metrics/signups-per-day:
 *   get:
 *     summary: Signups per day
 *     description: Returns an array of { date, count } aggregated by day from users.created_at.
 *     tags: [Metrics]
 *     responses:
 *       200:
 *         description: Aggregated signup counts per day
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date:
 *                     type: string
 *                     description: Day in YYYY-MM-DD
 *                   count:
 *                     type: integer
 */
router.get('/metrics/signups-per-day', async (req, res, next) => {
  try {
    const docs = await User.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$created_at' },
          },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, date: '$_id', count: 1 } },
      { $sort: { date: 1 } },
    ]);
    return res.status(200).json(docs);
  } catch (err) {
    return next(err);
  }
});

/**
 * Parse time window string like "10m", "2h", "1d" into milliseconds.
 */
function parseWindowToMs(windowStr, defaultMs = 10 * 60 * 1000) {
  if (!windowStr || typeof windowStr !== 'string') return defaultMs;
  const match = /^(\d+)\s*([smhd])$/i.exec(windowStr.trim());
  if (!match) return defaultMs;
  const val = Number(match[1]);
  const unit = match[2].toLowerCase();
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60000 : unit === 'h' ? 3600000 : 86400000;
  return val * mult;
}

/**
 * @swagger
 * /api/metrics/active-users:
 *   get:
 *     summary: Active users over a time window
 *     description: >
 *       Returns time series per minute for unique active users within the specified window.
 *       Query param window supports s/m/h/d (e.g., ?window=10m). Output items are { minute, count }.
 *     tags: [Metrics]
 *     parameters:
 *       - in: query
 *         name: window
 *         schema:
 *           type: string
 *           example: 10m
 *         description: Time window like 10m, 1h, 1d. Default 10m.
 *     responses:
 *       200:
 *         description: Per-minute active users counts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   minute:
 *                     type: string
 *                     description: Minute bucket in YYYY-MM-DDTHH:mm:00Z
 *                   count:
 *                     type: integer
 */
router.get('/metrics/active-users', async (req, res, next) => {
  try {
    const windowParam = req.query.window || '10m';
    const windowMs = parseWindowToMs(windowParam);
    const since = new Date(Date.now() - windowMs);

    // Aggregate per minute distinct users active within window
    const series = await UserEvent.aggregate([
      { $match: { timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            minute: {
              $dateToString: {
                format: '%Y-%m-%dT%H:%M:00Z',
                date: '$timestamp',
              },
            },
            user_id: '$user_id',
            username: '$username',
          },
        },
      },
      {
        $group: {
          _id: '$_id.minute',
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          minute: '$_id',
          count: 1,
        },
      },
      { $sort: { minute: 1 } },
    ]);

    return res.status(200).json(series);
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/metrics/event-types:
 *   get:
 *     summary: Distribution of user event types
 *     description: Returns counts of user_events grouped by event_type for pie chart.
 *     tags: [Metrics]
 *     responses:
 *       200:
 *         description: Event type counts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   event_type:
 *                     type: string
 *                   count:
 *                     type: integer
 */
router.get('/metrics/event-types', async (req, res, next) => {
  try {
    const data = await UserEvent.aggregate([
      {
        $group: {
          _id: '$event_type',
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, event_type: '$_id', count: 1 } },
      { $sort: { count: -1 } },
    ]);
    return res.status(200).json(data);
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/metrics/total-events:
 *   get:
 *     summary: Total user events count
 *     description: Returns a single number representing total count of user_events.
 *     tags: [Metrics]
 *     responses:
 *       200:
 *         description: Total count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 */
router.get('/metrics/total-events', async (req, res, next) => {
  try {
    const total = await UserEvent.countDocuments({});
    return res.status(200).json({ total });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/metrics/recent-activity:
 *   get:
 *     summary: Recent user activity
 *     description: Returns last 10 user_events ordered by timestamp descending.
 *     tags: [Metrics]
 *     responses:
 *       200:
 *         description: Recent user events
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: string }
 *                   user_id: { type: string }
 *                   username: { type: string }
 *                   event_type: { type: string }
 *                   timestamp: { type: string, format: date-time }
 *                   meta: { type: object }
 */
router.get('/metrics/recent-activity', async (req, res, next) => {
  try {
    const items = await UserEvent.find({})
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();
    return res.status(200).json(items);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
