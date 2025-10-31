'use strict';

const mongoose = require('mongoose');

/**
 * Admin model stored in the 'admins' collection.
 * Fields:
 *  - email (unique, lowercase)
 *  - username (unique)
 *  - password_hash (bcrypt hash)
 *  - created_at (Date)
 */
const AdminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 256,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 64,
      unique: true,
      index: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    created_at: {
      type: Date,
      default: () => new Date(),
      immutable: true,
    },
  },
  {
    versionKey: false,
    timestamps: false,
    collection: 'admins',
  }
);

AdminSchema.index({ email: 1 }, { unique: true });
AdminSchema.index({ username: 1 }, { unique: true });

const Admin = mongoose.model('Admin', AdminSchema);

module.exports = Admin;
