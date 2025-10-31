'use strict';

const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware');
const Question = require('../models/Question');
const Answer = require('../models/Answer');
const UserEvent = require('../models/UserEvent');
const { getIO } = require('../socket');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: MCQ
 *   description: MCQ questions and answers API
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Question:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: MongoDB id
 *         text:
 *           type: string
 *         options:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *               key:
 *                 type: string
 *         correctOptionIndex:
 *           type: integer
 *         difficulty:
 *           type: string
 *           enum: [easy, medium, hard]
 *         tags:
 *           type: array
 *           items: { type: string }
 *     PublicQuestion:
 *       allOf:
 *         - $ref: '#/components/schemas/Question'
 *       properties:
 *         correctOptionIndex:
 *           type: integer
 *           description: Will be omitted from public listing
 *     NewQuestionRequest:
 *       type: object
 *       required: [text, options, correctOptionIndex]
 *       properties:
 *         text:
 *           type: string
 *         options:
 *           type: array
 *           minItems: 2
 *           items:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *               key:
 *                 type: string
 *         correctOptionIndex:
 *           type: integer
 *         difficulty:
 *           type: string
 *           enum: [easy, medium, hard]
 *         tags:
 *           type: array
 *           items: { type: string }
 *     NewAnswerRequest:
 *       type: object
 *       required: [question_id, selectedOptionIndex]
 *       properties:
 *         question_id:
 *           type: string
 *         selectedOptionIndex:
 *           type: integer
 *   responses:
 *     ValidationError:
 *       description: Invalid request body
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 */

/**
 * @swagger
 * /api/questions:
 *   post:
 *     summary: Create a new MCQ (admin)
 *     description: Admin-only endpoint to create a new MCQ question with options and correct answer index.
 *     tags: [MCQ]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewQuestionRequest'
 *     responses:
 *       201:
 *         description: Created question
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Question'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin role required
 */
router.post('/questions', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { text, options, correctOptionIndex, difficulty, tags } = req.body || {};
    if (!text || !Array.isArray(options) || typeof correctOptionIndex !== 'number') {
      return res.status(400).json({ error: 'text, options (array), and correctOptionIndex are required' });
    }
    if (options.length < 2) {
      return res.status(400).json({ error: 'At least two options are required' });
    }
    if (correctOptionIndex < 0 || correctOptionIndex >= options.length) {
      return res.status(400).json({ error: 'correctOptionIndex is out of range' });
    }

    const doc = new Question({
      text,
      options,
      correctOptionIndex,
      difficulty: difficulty || 'easy',
      tags: Array.isArray(tags) ? tags : [],
      created_by: req.user?.id || undefined,
    });

    const saved = await doc.save();
    return res.status(201).json(saved);
  } catch (err) {
    if (err && err.message && /correctOptionIndex/.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
});

/**
 * @swagger
 * /api/questions:
 *   get:
 *     summary: List MCQ questions (public)
 *     description: Returns list of MCQ questions without exposing the correct answer index.
 *     tags: [MCQ]
 *     responses:
 *       200:
 *         description: Array of questions without correct answer
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: string }
 *                   text: { type: string }
 *                   options:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         text: { type: string }
 *                         key: { type: string }
 *                   difficulty: { type: string }
 *                   tags:
 *                     type: array
 *                     items: { type: string }
 */
router.get('/questions', async (req, res, next) => {
  try {
    const docs = await Question.find({})
      .sort({ created_at: -1 })
      .lean();

    // Remove correctOptionIndex for public listing
    const sanitized = docs.map(({ correctOptionIndex, ...rest }) => rest);
    return res.status(200).json(sanitized);
  } catch (err) {
    return next(err);
  }
});

/**
 * @swagger
 * /api/answers:
 *   post:
 *     summary: Submit an answer to a MCQ (auth required)
 *     description: Creates an answer record, emits 'new_answer' via Socket.io, and logs a user_event.
 *     tags: [MCQ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewAnswerRequest'
 *     responses:
 *       201:
 *         description: Created answer with correctness
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id: { type: string }
 *                 question_id: { type: string }
 *                 user_id: { type: string }
 *                 username: { type: string }
 *                 selectedOptionIndex: { type: integer }
 *                 isCorrect: { type: boolean }
 *                 created_at: { type: string, format: date-time }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Unauthorized
 */
router.post('/answers', requireAuth, async (req, res, next) => {
  try {
    const { question_id, selectedOptionIndex } = req.body || {};
    if (!question_id || typeof selectedOptionIndex !== 'number') {
      return res.status(400).json({ error: 'question_id and selectedOptionIndex are required' });
    }

    const question = await Question.findById(question_id).lean();
    if (!question) {
      return res.status(400).json({ error: 'Invalid question_id' });
    }

    if (selectedOptionIndex < 0 || selectedOptionIndex >= question.options.length) {
      return res.status(400).json({ error: 'selectedOptionIndex out of range' });
    }

    const isCorrect = Number(selectedOptionIndex) === Number(question.correctOptionIndex);

    const answerDoc = new Answer({
      question_id,
      user_id: req.user.id,
      username: req.user.username,
      selectedOptionIndex,
      isCorrect,
      meta: {
        ua: req.get('user-agent') || '',
      },
    });

    const saved = await answerDoc.save();

    // Emit new_answer via Socket.io for real-time analytics
    try {
      const io = getIO();
      io.emit('new_answer', {
        _id: String(saved._id),
        question_id: String(saved.question_id),
        user_id: String(saved.user_id),
        username: saved.username,
        selectedOptionIndex: saved.selectedOptionIndex,
        isCorrect: saved.isCorrect,
        created_at: saved.created_at,
      });
    } catch (emitErr) {
      // eslint-disable-next-line no-console
      console.warn('[Socket.io] new_answer emit failed:', emitErr.message);
    }

    // Log user_event for analytics
    try {
      await new UserEvent({
        user_id: req.user.id,
        username: req.user.username,
        event_type: 'answer', // Note: extend enum if needed
        meta: {
          question_id: String(question._id),
          isCorrect,
        },
      }).save();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[UserEvent] answer log failed:', e.message);
    }

    return res.status(201).json(saved.toObject());
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
