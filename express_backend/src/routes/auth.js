'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserEvent = require('../models/UserEvent');
const { getIO } = require('../socket');

const router = express.Router();

/**
 * Build JWT for a user.
 */
function signToken(user) {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.TOKEN_EXPIRES_IN || '1d';
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  const payload = {
    sub: String(user._id),
    username: user.username,
    email: user.email,
    roles: user.roles || [],
  };
  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Sanitize user response
 */
function toPublicUser(user) {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    roles: user.roles || [],
    created_at: user.created_at,
  };
}

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication API
 */

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: User signup
 *     description: Create a new user with a unique email and username, returns JWT.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *             required: [username, email, password]
 *     responses:
 *       201:
 *         description: Created user with token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                 token:
 *                   type: string
 *       400:
 *         description: Validation or conflict error
 */
router.post('auth/signup', async (req, res, next) => {
  try {
    const { username, email, password, roles } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email, and password are required' });
    }

    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    }).lean();
    if (existing) {
      return res.status(400).json({ error: 'User with same email or username already exists' });
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const doc = new User({
      username,
      email: email.toLowerCase(),
      password_hash,
      roles: Array.isArray(roles) && roles.length ? roles : undefined,
    });
    const saved = await doc.save();

    // Log user_event for signup
    try {
      const ue = await new UserEvent({
        user_id: saved._id,
        username: saved.username,
        event_type: 'signup',
        meta: { ua: req.get('user-agent') || '' },
      }).save();
      // Emit granular and aggregate metrics updates
      try {
        const io = getIO();
        io.emit('user_event_created', ue.toObject());
        io.emit('metrics_update', { type: 'signup' });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[Socket.io] emit metrics_update failed:', e.message);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[UserEvent] signup log failed:', e.message);
    }

    const token = signToken(saved);
    return res.status(201).json({ user: toPublicUser(saved), token });
  } catch (err) {
    // Duplicate key handling
    if (err && err.code === 11000) {
      return res.status(400).json({ error: 'Email or username already in use' });
    }
    return next(err);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     description: Login with email and password, returns JWT.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *             required: [email, password]
 *     responses:
 *       200:
 *         description: Authenticated user with token
 *       401:
 *         description: Invalid credentials
 */
router.post('auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) {
      // eslint-disable-next-line no-console
      console.warn(`[Auth] Login failed: user not found for email ${String(email).toLowerCase()}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.warn(`[Auth] Login failed: bad password for ${user.email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Log user_event for login
    try {
      const ue = await new UserEvent({
        user_id: user._id,
        username: user.username,
        event_type: 'login',
        meta: { ua: req.get('user-agent') || '' },
      }).save();
      try {
        const io = getIO();
        io.emit('user_event_created', ue.toObject());
        io.emit('metrics_update', { type: 'login' });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[Socket.io] emit metrics_update failed:', e.message);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[UserEvent] login log failed:', e.message);
    }

    const token = signToken(user);
    return res.status(200).json({ user: toPublicUser(user), token });
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     description: Returns the profile of the currently authenticated user from the JWT.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *       401:
 *         description: Unauthorized
 */
const { requireAuth } = require('../middleware');

router.get('auth/me', requireAuth, async (req, res, next) => {
  try {
    // Fetch fresh user to ensure up-to-date roles/email if needed
    const userDoc = await User.findById(req.user.id);
    if (!userDoc) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(200).json({ user: toPublicUser(userDoc) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
