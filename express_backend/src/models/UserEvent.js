'use strict';

const mongoose = require('mongoose');

/**
 * UserEvent stores user-related events for metrics (e.g., signup, login).
 */
const UserEventSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      ref: 'User',
    },
    username: {
      type: String,
      required: false,
      trim: true,
    },
    event_type: {
      type: String,
      required: true,
      enum: ['signup', 'login'],
    },
    timestamp: {
      type: Date,
      default: () => new Date(),
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

UserEventSchema.index({ timestamp: -1 });

const UserEvent = mongoose.model('UserEvent', UserEventSchema);

module.exports = UserEvent;
