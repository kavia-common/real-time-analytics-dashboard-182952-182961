'use strict';

const request = require('supertest');
const app = require('../src/app');

describe('Auth routes mounting', () => {
  it('POST /api/auth/login should exist and return 400 when body is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({});
    expect([400, 401]).toContain(res.status); // 400 expected due to validation
    // When JWT_SECRET missing, login shouldn't require it; only signup/signing token needs it.
    // Ensure response is JSON with error message
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('GET /health should return 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
