'use strict';

const express = require('express');
const User = require('../models/User');
const UserEvent = require('../models/UserEvent');
const Answer = require('../models/Answer');
const Event = require('../models/Event');

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

/**
 * @swagger
 * /api/metrics/users-answered-today:
 *   get:
 *     summary: Unique users who answered today (UTC)
 *     description: >
 *       Returns the total count of distinct users who submitted answers today (from 00:00 UTC to now),
 *       and a time series aggregated per minute showing distinct user counts for each minute bucket.
 *     tags: [Metrics]
 *     responses:
 *       200:
 *         description: Aggregated unique answerers for today
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 series:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       time:
 *                         type: string
 *                         description: ISO string for the minute bucket (UTC, e.g., 2025-01-01T12:34:00.000Z)
 *                       value:
 *                         type: integer
 *                 timezone:
 *                   type: string
 *                   description: Aggregation uses UTC ('UTC')
 */
router.get('/metrics/users-answered-today', async (req, res, next) => {
  try {
    // Compute UTC start of "today" and now (UTC)
    const now = new Date();
    const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

    // Aggregate distinct users who answered today using Answer.created_at
    // total: distinct user_id
    const totalAgg = await Answer.aggregate([
      { $match: { created_at: { $gte: startOfTodayUtc, $lte: now } } },
      { $group: { _id: '$user_id' } },
      { $group: { _id: null, total: { $sum: 1 } } },
      { $project: { _id: 0, total: 1 } },
    ]).catch(() => []);

    const total = Array.isArray(totalAgg) && totalAgg.length ? totalAgg[0].total : 0;

    // series: per minute bucket distinct user_id
    // Use $dateTrunc where available (MongoDB 5.0+); fallback to $dateToString-based grouping for portability
    let series = [];
    try {
      series = await Answer.aggregate([
        { $match: { created_at: { $gte: startOfTodayUtc, $lte: now } } },
        {
          $group: {
            _id: {
              minute: {
                $dateTrunc: { date: '$created_at', unit: 'minute', timezone: 'UTC' },
              },
              user_id: '$user_id',
            },
          },
        },
        {
          $group: {
            _id: '$_id.minute',
            value: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            time: '$_id',
            value: 1,
          },
        },
        { $sort: { time: 1 } },
      ]);
    } catch (_) {
      // Fallback approach using date string truncation
      series = await Answer.aggregate([
        { $match: { created_at: { $gte: startOfTodayUtc, $lte: now } } },
        {
          $group: {
            _id: {
              minute: {
                $dateToString: { format: '%Y-%m-%dT%H:%M:00Z', date: '$created_at' },
              },
              user_id: '$user_id',
            },
          },
        },
        {
          $group: {
            _id: '$_id.minute',
            value: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            time: '$_id',
            value: 1,
          },
        },
        { $sort: { time: 1 } },
      ]);

      // Normalize string time to Date to ensure consistent ISO output
      series = series.map((pt) => ({
        time: new Date(pt.time),
        value: pt.value,
      }));
    }

    // Ensure output times are ISO strings
    const normalizedSeries = series.map((pt) => ({
      time: (pt.time instanceof Date ? pt.time : new Date(pt.time)).toISOString(),
      value: Number(pt.value) || 0,
    }));

    return res.status(200).json({
      total: Number(total) || 0,
      series: normalizedSeries,
      timezone: 'UTC',
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/metrics/event-heatmap:
 *   get:
 *     summary: Event heatmap by hour and day-of-week (UTC)
 *     description: >
 *       Aggregates events grouped by hour-of-day (0-23) and day-of-week (0-6, Sunday=0) in UTC.
 *       Query param range supports 24h or 7d (default 7d). Falls back to Event model if UserEvent not available.
 *     tags: [Metrics]
 *     parameters:
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [24h, 7d]
 *         description: Time range for aggregation (default 7d)
 *     responses:
 *       200:
 *         description: Heatmap buckets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timezone:
 *                   type: string
 *                   example: UTC
 *                 buckets:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       hour:
 *                         type: integer
 *                         description: Hour of day (0-23)
 *                       dow:
 *                         type: integer
 *                         description: Day of week (0-6, Sunday=0)
 *                       count:
 *                         type: integer
 *                 last24h:
 *                   type: boolean
 *                   description: true if range=24h
 */
router.get('/metrics/event-heatmap', async (req, res, next) => {
  try {
    const range = (req.query.range || '7d').toLowerCase();
    const last24h = range === '24h';
    const since = last24h ? new Date(Date.now() - 24 * 3600 * 1000) : new Date(Date.now() - 7 * 24 * 3600 * 1000);

    // Prefer UserEvent if available; fallback to Event
    let Model = UserEvent;
    if (!Model || !Model.aggregate) {
      Model = Event;
    }

    // Ensure an index on timestamp exists in the selected model (noop if already there)
    try {
      await Model.collection.createIndex({ timestamp: -1 });
    } catch (_) {
      // ignore index creation errors in runtime
    }

    // Use $dateToParts with timezone 'UTC' to extract hour and dayOfWeek (1=Sun ... 7=Sat in Mongo)
    // Convert to 0-6 with (dayOfWeek % 7)
    const pipeline = [
      { $match: { timestamp: { $gte: since } } },
      {
        $addFields: {
          parts: { $dateToParts: { date: '$timestamp', timezone: 'UTC' } },
        },
      },
      {
        $group: {
          _id: {
            hour: '$parts.hour',
            dow1based: '$parts.dayOfWeek',
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          hour: '$_id.hour',
          dow: { $mod: ['$_id.dow1based', 7] }, // 1..7 -> 1..6,0 mapping where 1=>1 .. 7=>0 (Sun=0)
          count: 1,
        },
      },
      { $sort: { dow: 1, hour: 1 } },
    ];

    let buckets = await Model.aggregate(pipeline);

    // Normalize numbers
    buckets = (buckets || []).map((b) => ({
      hour: Number(b.hour) || 0,
      dow: Number(b.dow) || 0,
      count: Number(b.count) || 0,
    }));

    return res.status(200).json({
      timezone: 'UTC',
      buckets,
      last24h,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
