'use strict';

const mongoose = require('mongoose');

/**
 * Question model represents a multiple-choice question (MCQ) with options.
 * Each question has text, an array of options, and an index of the correct option.
 */
const OptionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 1024,
    },
    // Optional: key/label for the option (e.g., "A", "B")
    key: {
      type: String,
      required: false,
      trim: true,
      maxlength: 8,
    },
  },
  {
    _id: false,
  }
);

const QuestionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 4096,
      index: true,
    },
    options: {
      type: [OptionSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 2 && arr.length <= 10,
        message: 'A question must have between 2 and 10 options',
      },
      required: true,
    },
    correctOptionIndex: {
      type: Number,
      required: true,
      min: 0,
      // No max here; validated against options length in pre-validate hook
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'easy',
    },
    tags: {
      type: [String],
      default: [],
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    created_at: {
      type: Date,
      default: () => new Date(),
      immutable: true,
    },
    updated_at: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    versionKey: false,
    timestamps: false,
  }
);

// Ensure correctOptionIndex is within options range
QuestionSchema.pre('validate', function (next) {
  if (Array.isArray(this.options)) {
    if (typeof this.correctOptionIndex !== 'number' || this.correctOptionIndex < 0 || this.correctOptionIndex >= this.options.length) {
      return next(new Error('correctOptionIndex must be a valid index within options array'));
    }
  }
  this.updated_at = new Date();
  return next();
});

const Question = mongoose.model('Question', QuestionSchema);

module.exports = Question;
