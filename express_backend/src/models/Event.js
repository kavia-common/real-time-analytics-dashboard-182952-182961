'use strict';

const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    event_type: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    versionKey: false,
    timestamps: false,
  }
);

// Index on timestamp desc for efficient recent queries
EventSchema.index({ timestamp: -1 });

const Event = mongoose.model('Event', EventSchema);

module.exports = Event;
