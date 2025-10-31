'use strict';

const mongoose = require('mongoose');

/**
 * UserEvent stores user-related events for metrics (e.g., signup, login, answer, click, logout).
 * Includes user reference and username for quick lookups.
 */
const UserEventSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: 'User',
      index: true,
    },
    username: {
      type: String,
      required: false,
      trim: true,
      index: true,
    },
    event_type: {
      type: String,
      required: true,
      enum: ['signup', 'login', 'answer', 'click', 'logout'],
      index: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    meta: {
      type: Object,
      default: {},
    },
  },
  {
    versionKey: false,
    timestamps: false,
  }
);

// Compound index for frequent analytics queries by time and type
UserEventSchema.index({ event_type: 1, timestamp: -1 });
UserEventSchema.index({ user_id: 1, timestamp: -1 });

const UserEvent = mongoose.model('UserEvent', UserEventSchema);

module.exports = UserEvent;
