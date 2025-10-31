'use strict';

const mongoose = require('mongoose');

/**
 * Answer model represents a user's response to a Question.
 * Stores selected option index and derives correctness from the Question at creation time.
 */
const AnswerSchema = new mongoose.Schema(
  {
    question_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: false,
      trim: true,
    },
    selectedOptionIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    isCorrect: {
      type: Boolean,
      required: true,
    },
    created_at: {
      type: Date,
      default: () => new Date(),
      immutable: true,
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

// Index for analytics: per-question answer time
AnswerSchema.index({ question_id: 1, created_at: -1 });

const Answer = mongoose.model('Answer', AnswerSchema);

module.exports = Answer;
