import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';
import { resetDatabase, closeDatabasePool } from './helpers/db';
import { resetRateLimits, resetOneMinuteLimit } from '../src/middleware/rateLimiter';
import { query } from '../src/db';

describe('POST /auth/sms-link/request - Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
    await app.ready();
  });

  beforeEach(async () => {
    await resetDatabase();
    resetRateLimits();
  });

  afterAll(async () => {
    await app.close();
    await closeDatabasePool();
  });

  describe('Case 1: Valid phone number', () => {
    it('should return 200 OK and create login_link record', async () => {
      const phone = '+393401234567';
      const deviceId = 'test-device-123';

      const response = await request(app.server)
        .post('/auth/sms-link/request')
        .send({
          phone_e164: phone,
          device_id: deviceId,
        });

      // Assert HTTP response
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ok', true);
      expect(response.body).toHaveProperty('message', 'Login link sent');
      expect(response.body).toHaveProperty('link'); // In test env

      // Assert database record created
      const dbResult = await query(
        'SELECT * FROM login_links WHERE phone_e164 = $1 ORDER BY created_at DESC LIMIT 1',
        [phone]
      );

      expect(dbResult.rows.length).toBe(1);
      const loginLink = dbResult.rows[0];

      // Assert record fields
      expect(loginLink.phone_e164).toBe(phone);
      expect(loginLink.device_id).toBe(deviceId);
      expect(loginLink.used_at).toBeNull(); // Not used yet
      expect(loginLink.token_hash).toBeTruthy();
      expect(loginLink.expires_at).toBeTruthy();

      // Assert expires_at is valid (should be ~10 minutes in future)
      const expiresAt = new Date(loginLink.expires_at);
      const now = new Date();
      const diffMinutes = (expiresAt.getTime() - now.getTime()) / (1000 * 60);

      expect(diffMinutes).toBeGreaterThan(9); // At least 9 minutes
      expect(diffMinutes).toBeLessThan(11); // At most 11 minutes
    });

    it('should use MockSmsProvider (no real SMS sent)', async () => {
      // This test verifies SMS_PROVIDER is mock in test env
      expect(process.env.SMS_PROVIDER).toBe('mock');

      const response = await request(app.server)
        .post('/auth/sms-link/request')
        .send({
          phone_e164: '+393401234567',
          device_id: 'test-device',
        });

      // Should succeed with mock provider
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
    });
  });

  describe('Case 2: Rate limit - 1 request per minute', () => {
    it('should reject second request within 1 minute', async () => {
      const phone = '+393401234567';
      const deviceId = 'test-device-123';

      // First request - should succeed
      const firstResponse = await request(app.server)
        .post('/auth/sms-link/request')
        .send({
          phone_e164: phone,
          device_id: deviceId,
        });

      expect(firstResponse.status).toBe(200);
      expect(firstResponse.body.ok).toBe(true);

      // Second request immediately - should fail with 429
      const secondResponse = await request(app.server)
        .post('/auth/sms-link/request')
        .send({
          phone_e164: phone,
          device_id: deviceId,
        });

      expect(secondResponse.status).toBe(429);
      expect(secondResponse.body).toHaveProperty('error', 'Too many requests');
      expect(secondResponse.body).toHaveProperty('message');
      expect(secondResponse.body.message).toContain('1 minute');
      expect(secondResponse.body).toHaveProperty('retryAfter');
      expect(secondResponse.body.retryAfter).toBeGreaterThan(0);

      // Assert only one record in database
      const dbResult = await query(
        'SELECT COUNT(*) as count FROM login_links WHERE phone_e164 = $1',
        [phone]
      );

      expect(parseInt(dbResult.rows[0].count)).toBe(1);
    });

    it('should allow request from different phone number', async () => {
      const phone1 = '+393401234567';
      const phone2 = '+393409876543';

      // First request with phone1
      const firstResponse = await request(app.server)
        .post('/auth/sms-link/request')
        .send({ phone_e164: phone1 });

      expect(firstResponse.status).toBe(200);

      // Immediate request with phone2 - should succeed
      const secondResponse = await request(app.server)
        .post('/auth/sms-link/request')
        .send({ phone_e164: phone2 });

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.ok).toBe(true);
    });
  });

  describe('Case 3: Rate limit - 3 requests per 10 minutes', () => {
    it('should reject 4th request within 10 minutes', async () => {
      const phone = '+393401234567';

      // Requests 1, 2, 3 - should succeed (with delays to bypass 1-min limit)
      for (let i = 1; i <= 3; i++) {
        // Reset 1-minute limit between requests (keep 10-minute counter)
        resetOneMinuteLimit();

        const response = await request(app.server)
          .post('/auth/sms-link/request')
          .send({
            phone_e164: phone,
            device_id: `device-${i}`,
          });

        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
      }

      // Verify 3 records created
      const countResult = await query(
        'SELECT COUNT(*) as count FROM login_links WHERE phone_e164 = $1',
        [phone]
      );
      expect(parseInt(countResult.rows[0].count)).toBe(3);

      // Reset 1-minute limit for 4th attempt (keep 10-minute counter)
      resetOneMinuteLimit();

      // 4th request - should fail with 429
      const fourthResponse = await request(app.server)
        .post('/auth/sms-link/request')
        .send({
          phone_e164: phone,
          device_id: 'device-4',
        });

      expect(fourthResponse.status).toBe(429);
      expect(fourthResponse.body).toHaveProperty('error', 'Too many requests');
      expect(fourthResponse.body.message).toContain('10 minutes');
      expect(fourthResponse.body).toHaveProperty('retryAfter');

      // Verify still only 3 records (4th was rejected)
      const finalCountResult = await query(
        'SELECT COUNT(*) as count FROM login_links WHERE phone_e164 = $1',
        [phone]
      );
      expect(parseInt(finalCountResult.rows[0].count)).toBe(3);
    });
  });

  describe('Case 4: Challenge stored in DB with valid expires_at', () => {
    it('should create login_link with correct expires_at', async () => {
      const phone = '+393401234567';
      const beforeRequest = new Date();

      await request(app.server)
        .post('/auth/sms-link/request')
        .send({ phone_e164: phone });

      const afterRequest = new Date();

      // Query database
      const dbResult = await query(
        'SELECT * FROM login_links WHERE phone_e164 = $1',
        [phone]
      );

      expect(dbResult.rows.length).toBe(1);
      const loginLink = dbResult.rows[0];

      // Assert expires_at is set
      expect(loginLink.expires_at).toBeTruthy();

      const expiresAt = new Date(loginLink.expires_at);

      // Should expire ~10 minutes from now
      const expectedExpiresAt = new Date(beforeRequest.getTime() + 10 * 60 * 1000);
      const timeDiff = Math.abs(expiresAt.getTime() - expectedExpiresAt.getTime());

      // Allow 5 second tolerance
      expect(timeDiff).toBeLessThan(5000);

      // Verify expires_at is in the future
      expect(expiresAt.getTime()).toBeGreaterThan(afterRequest.getTime());
    });

    it('should store token_hash and not plain token', async () => {
      const phone = '+393401234567';

      const response = await request(app.server)
        .post('/auth/sms-link/request')
        .send({ phone_e164: phone });

      const link = response.body.link;
      const token = new URL(link).searchParams.get('token');

      // Query database
      const dbResult = await query(
        'SELECT token_hash FROM login_links WHERE phone_e164 = $1',
        [phone]
      );

      const tokenHash = dbResult.rows[0].token_hash;

      // Token hash should not equal plain token
      expect(tokenHash).not.toBe(token);

      // Token hash should be 64 characters (SHA256 hex)
      expect(tokenHash.length).toBe(64);
    });
  });

  describe('Case 5: SMS not real (mock)', () => {
    it('should not send real SMS in test environment', async () => {
      // Verify environment
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.SMS_PROVIDER).toBe('mock');

      const response = await request(app.server)
        .post('/auth/sms-link/request')
        .send({ phone_e164: '+393401234567' });

      // Should succeed with mock SMS
      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);

      // Link returned in non-production
      expect(response.body.link).toBeTruthy();
    });
  });

  describe('Additional assertions', () => {
    it('should set used_at to NULL on creation', async () => {
      const phone = '+393401234567';

      await request(app.server)
        .post('/auth/sms-link/request')
        .send({ phone_e164: phone });

      const dbResult = await query(
        'SELECT used_at FROM login_links WHERE phone_e164 = $1',
        [phone]
      );

      expect(dbResult.rows[0].used_at).toBeNull();
    });

    it('should store ip_hash', async () => {
      const phone = '+393401234567';

      await request(app.server)
        .post('/auth/sms-link/request')
        .send({ phone_e164: phone });

      const dbResult = await query(
        'SELECT ip_hash FROM login_links WHERE phone_e164 = $1',
        [phone]
      );

      expect(dbResult.rows[0].ip_hash).toBeTruthy();
      // IP hash should be 64 characters (SHA256 hex)
      expect(dbResult.rows[0].ip_hash.length).toBe(64);
    });

    it('should store device_id when provided', async () => {
      const phone = '+393401234567';
      const deviceId = 'my-device-123';

      await request(app.server)
        .post('/auth/sms-link/request')
        .send({
          phone_e164: phone,
          device_id: deviceId,
        });

      const dbResult = await query(
        'SELECT device_id FROM login_links WHERE phone_e164 = $1',
        [phone]
      );

      expect(dbResult.rows[0].device_id).toBe(deviceId);
    });

    it('should allow NULL device_id', async () => {
      const phone = '+393401234567';

      await request(app.server)
        .post('/auth/sms-link/request')
        .send({ phone_e164: phone });

      const dbResult = await query(
        'SELECT device_id FROM login_links WHERE phone_e164 = $1',
        [phone]
      );

      expect(dbResult.rows[0].device_id).toBeNull();
    });
  });
});
