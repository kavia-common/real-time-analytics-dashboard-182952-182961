'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const router = express.Router();

/**
 * Build JWT for an admin.
 * role=admin is embedded for middleware checks.
 */
function signAdminToken(admin) {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.TOKEN_EXPIRES_IN || '1d';
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  const payload = {
    sub: String(admin._id),
    username: admin.username,
    email: admin.email,
    roles: ['admin'], // explicit admin role
    role: 'admin',
    subjectType: 'admin',
  };
  return jwt.sign(payload, secret, { expiresIn });
}

function toPublicAdmin(admin) {
  return {
    id: String(admin._id),
    username: admin.username,
    email: admin.email,
    created_at: admin.created_at,
    role: 'admin',
  };
}

/**
 * @swagger
 * tags:
 *   name: AdminAuth
 *   description: Admin Authentication API
 */

/**
 * @swagger
 * /api/admin/auth/signup:
 *   post:
 *     summary: Admin signup
 *     description: Create a new admin with unique email and username, returns JWT with role=admin.
 *     tags: [AdminAuth]
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
 *         description: Created admin with token
 *       400:
 *         description: Validation/conflict error
 */
router.post('/admin/auth/signup', async (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email, and password are required' });
    }

    const existing = await Admin.findOne({
      $or: [{ email: String(email).toLowerCase() }, { username }],
    }).lean();
    if (existing) {
      return res.status(400).json({ error: 'Admin with same email or username already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const admin = new Admin({
      username,
      email: String(email).toLowerCase(),
      password_hash,
    });
    const saved = await admin.save();
    const token = signAdminToken(saved);
    return res.status(201).json({ admin: toPublicAdmin(saved), token });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(400).json({ error: 'Email or username already in use' });
    }
    return next(err);
  }
});

/**
 * @swagger
 * /api/admin/auth/login:
 *   post:
 *     summary: Admin login
 *     description: Login with admin email and password, returns JWT with role=admin.
 *     tags: [AdminAuth]
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
 *         description: Authenticated admin with token
 *       401:
 *         description: Invalid credentials
 */
router.post('/admin/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const admin = await Admin.findOne({ email: String(email).toLowerCase() });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signAdminToken(admin);
    return res.status(200).json({ admin: toPublicAdmin(admin), token });
  } catch (err) {
    return next(err);
  }
});

const { requireAdminAuth } = require('../middleware');

/**
 * @swagger
 * /api/admin/auth/me:
 *   get:
 *     summary: Get current authenticated admin
 *     description: Returns the profile of the current admin from the JWT.
 *     tags: [AdminAuth]
 *     responses:
 *       200:
 *         description: Current admin profile
 *       401:
 *         description: Unauthorized
 */
router.get('/admin/auth/me', requireAdminAuth, async (req, res, next) => {
  try {
    const adminDoc = await Admin.findById(req.user.id);
    if (!adminDoc) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(200).json({ admin: toPublicAdmin(adminDoc) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
