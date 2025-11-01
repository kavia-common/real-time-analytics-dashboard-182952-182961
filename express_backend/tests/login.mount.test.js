'use strict';

const request = require('supertest');
const app = require('../src/app');

describe('Auth router mounting and handlers', () => {
  it('POST /api/auth/login should not return 404', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({}); // missing body should yield 400
    expect([400, 401]).toContain(res.status);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('POST /api/auth/signup should not return 404', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .set('Content-Type', 'application/json')
      .send({});
    expect([400, 401]).toContain(res.status);
  });

  it('GET /health should return 200 and JSON', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
