'use strict';

/**
 * Admin bootstrap utility.
 * - Reads VITE_ADMIN_EMAIL and VITE_ADMIN_PASSWORD from environment
 * - Idempotently upserts an admin user with a properly hashed password
 * - Subscribes to mongoose connection events to run once when connected
 * - Exposes a PUBLIC_INTERFACE function to trigger seeding manually
 */

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

// PUBLIC_INTERFACE
async function seedAdminUser({ force = false } = {}) {
  /** Seed or update the admin user from environment variables.
   * Env:
   *  - VITE_ADMIN_EMAIL (required)
   *  - VITE_ADMIN_PASSWORD (required)
   *  - VITE_ADMIN_USERNAME (optional; defaults to email local part)
   *
   * Returns: { ok: boolean, action: 'created'|'updated'|'skipped'|'noop', email: string, username: string|null, message?: string }
   */
  const email = (process.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.VITE_ADMIN_PASSWORD || '');
  const usernameFromEnv = (process.env.VITE_ADMIN_USERNAME || '').trim();

  if (!email || !password) {
    return { ok: false, action: 'noop', email, username: null, message: 'VITE_ADMIN_EMAIL or VITE_ADMIN_PASSWORD missing' };
  }

  const username = usernameFromEnv || email.split('@')[0];
  if (!username || username.length < 3) {
    return { ok: false, action: 'noop', email, username, message: 'Derived admin username invalid; set VITE_ADMIN_USERNAME' };
  }

  // Ensure mongoose is connected
  if (mongoose.connection.readyState !== 1) {
    return { ok: false, action: 'noop', email, username, message: 'Mongo not connected' };
  }

  const existing = await User.findOne({ email }).exec();
  const saltRounds = 10;

  if (!existing) {
    const password_hash = await bcrypt.hash(password, saltRounds);
    const doc = new User({
      username,
      email,
      password_hash,
      roles: ['admin'],
    });
    await doc.save();
    // eslint-disable-next-line no-console
    console.log(`[Bootstrap] Created admin user ${email} (username=${username})`);
    return { ok: true, action: 'created', email, username };
  }

  // If exists, ensure admin role and update password if force=true
  const update = {};
  let changed = false;

  if (!Array.isArray(existing.roles) || !existing.roles.includes('admin')) {
    const roles = Array.isArray(existing.roles) ? Array.from(new Set([...existing.roles, 'admin'])) : ['admin'];
    update.roles = roles;
    changed = true;
  }

  if (force) {
    const password_hash = await bcrypt.hash(password, saltRounds);
    update.password_hash = password_hash;
    changed = true;
  }

  if (username && existing.username !== username) {
    // Try updating username; if it collides, keep old
    try {
      existing.username = username;
      await existing.save();
      // eslint-disable-next-line no-console
      console.log(`[Bootstrap] Updated admin username for ${email} -> ${username}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[Bootstrap] Could not update username for ${email}: ${e.message}`);
    }
  }

  if (changed) {
    await User.updateOne({ _id: existing._id }, { $set: update }).exec();
    // eslint-disable-next-line no-console
    console.log(`[Bootstrap] Updated admin for ${email}${force ? ' (password reset)' : ''}`);
    return { ok: true, action: 'updated', email, username: existing.username || username };
  }

  // eslint-disable-next-line no-console
  console.log(`[Bootstrap] Admin user already up-to-date for ${email}`);
  return { ok: true, action: 'skipped', email, username: existing.username || username };
}

/**
 * Attach a one-time listener to run seeding when Mongo connects.
 * Safe to call multiple times; it only runs once per process.
 */
let subscribed = false;
function subscribeAdminBootstrapOnConnect() {
  if (subscribed) return;
  subscribed = true;

  mongoose.connection.once('connected', async () => {
    try {
      const result = await seedAdminUser();
      if (!result.ok) {
        // eslint-disable-next-line no-console
        console.warn('[Bootstrap] Admin seeding did not run:', result.message || 'unknown reason');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[Bootstrap] Admin seeding error:', e && e.message ? e.message : e);
    }
  });
}

module.exports = {
  seedAdminUser,
  subscribeAdminBootstrapOnConnect,
};
