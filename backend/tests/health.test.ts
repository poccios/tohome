import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';
import { closeDatabasePool } from './helpers/db';

describe('Health Endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await closeDatabasePool();
  });

  it('GET /health should return ok', async () => {
    const response = await request(app.server).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});
