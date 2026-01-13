import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';
import { resetDatabase, closeDatabasePool } from './helpers/db';
import { resetRateLimits } from '../src/middleware/rateLimiter';

describe('Auth Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
    await app.ready();
  });

  beforeEach(async () => {
    // Reset database before each test
    await resetDatabase();
    resetRateLimits();
  });

  afterAll(async () => {
    await app.close();
    await closeDatabasePool();
  });

  describe('POST /auth/sms-link/request', () => {
    it('should create login link with valid phone number', async () => {
      const response = await request(app.server)
        .post('/auth/sms-link/request')
        .send({
          phone_e164: '+393401234567',
          device_id: 'test-device-123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('message', 'Login link sent');
      // In non-production, link should be returned
      expect(response.body).toHaveProperty('link');
      expect(response.body.link).toContain('/auth/callback?token=');
    });

    it('should reject invalid phone number format', async () => {
      const response = await request(app.server)
        .post('/auth/sms-link/request')
        .send({
          phone_e164: '123456789', // Missing +
          device_id: 'test-device-123',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing phone number', async () => {
      const response = await request(app.server)
        .post('/auth/sms-link/request')
        .send({
          device_id: 'test-device-123',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should work without device_id', async () => {
      const response = await request(app.server)
        .post('/auth/sms-link/request')
        .send({
          phone_e164: '+393401234567',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ok', true);
    });
  });

  describe('POST /auth/sms-link/verify', () => {
    it('should verify valid token', async () => {
      // First, create a login link
      const requestResponse = await request(app.server)
        .post('/auth/sms-link/request')
        .send({
          phone_e164: '+393401234567',
          device_id: 'test-device-123',
        });

      expect(requestResponse.status).toBe(200);
      const link = requestResponse.body.link;
      const token = new URL(link).searchParams.get('token');

      // Now verify the token
      const verifyResponse = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({
          token: token,
          device_id: 'test-device-123',
        });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body).toHaveProperty('ok', true);

      // Check cookies are set
      const cookies = verifyResponse.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.startsWith('access_token='))).toBe(true);
      expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
    });

    it('should reject invalid token', async () => {
      const response = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({
          token: 'invalid-token-123',
          device_id: 'test-device-123',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject already used token', async () => {
      // Create and use a token
      const requestResponse = await request(app.server)
        .post('/auth/sms-link/request')
        .send({
          phone_e164: '+393401234567',
          device_id: 'test-device-123',
        });

      const link = requestResponse.body.link;
      const token = new URL(link).searchParams.get('token');

      // Use the token first time
      await request(app.server).post('/auth/sms-link/verify').send({
        token: token,
        device_id: 'test-device-123',
      });

      // Try to use the same token again
      const secondResponse = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({
          token: token,
          device_id: 'test-device-123',
        });

      expect(secondResponse.status).toBe(400);
      expect(secondResponse.body).toHaveProperty('error');
    });
  });
});
