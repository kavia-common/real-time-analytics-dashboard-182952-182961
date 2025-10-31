'use strict';

const mongoose = require('mongoose');

const RolesEnum = ['user', 'admin'];

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 64,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 256,
      unique: true,
      index: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    roles: {
      type: [String],
      enum: RolesEnum,
      default: ['user'],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'At least one role must be specified',
      },
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
  }
);

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });

const User = mongoose.model('User', UserSchema);

module.exports = User;
