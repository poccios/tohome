/**
 * E2E Mode Tests for Auth Routes
 * Tests that E2E_MODE properly exposes/hides debug_code
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../test-utils/buildApp';
import type { FastifyInstance } from 'fastify';

describe('Auth E2E Mode', () => {
  let app: FastifyInstance;
  const testEmail = 'e2e-test@example.com';

  describe('E2E_MODE=1 (debug_code exposed)', () => {
    beforeAll(async () => {
      // Set E2E_MODE to 1 and use mock email provider
      process.env.E2E_MODE = '1';
      process.env.EMAIL_PROVIDER = 'mock';
      app = await buildApp();
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
      delete process.env.E2E_MODE;
    });

    it('should include debug_code in OTP request response', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/email-otp/request',
        payload: {
          email: testEmail,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.debug_code).toBeDefined();
      expect(body.debug_code).toMatch(/^\d{6}$/); // 6-digit code
    });

    it('debug_code should be a valid OTP that can be verified', async () => {
      // Request OTP
      const requestResponse = await app.inject({
        method: 'POST',
        url: '/auth/email-otp/request',
        payload: {
          email: testEmail + '.verify',
        },
      });

      const requestBody = JSON.parse(requestResponse.body);
      const otp = requestBody.debug_code;

      expect(otp).toBeDefined();

      // Verify the OTP
      const verifyResponse = await app.inject({
        method: 'POST',
        url: '/auth/email-otp/verify',
        payload: {
          email: testEmail + '.verify',
          code: otp,
        },
      });

      expect(verifyResponse.statusCode).toBe(200);
      const verifyBody = JSON.parse(verifyResponse.body);
      expect(verifyBody.ok).toBe(true);
    });
  });

  describe('E2E_MODE=0 (production mode)', () => {
    beforeAll(async () => {
      // Set E2E_MODE to 0 and use mock email provider
      process.env.E2E_MODE = '0';
      process.env.EMAIL_PROVIDER = 'mock';
      app = await buildApp();
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
      delete process.env.E2E_MODE;
    });

    it('should NOT include debug_code in OTP request response', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/email-otp/request',
        payload: {
          email: testEmail + '.prod',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.debug_code).toBeUndefined();
      expect(body.message).toBe('OTP code sent');
    });
  });

  describe('E2E_MODE unset (default behavior)', () => {
    beforeAll(async () => {
      // Ensure E2E_MODE is not set but use mock email provider
      delete process.env.E2E_MODE;
      process.env.EMAIL_PROVIDER = 'mock';
      app = await buildApp();
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
      delete process.env.EMAIL_PROVIDER;
    });

    it('should NOT include debug_code when E2E_MODE is unset', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/email-otp/request',
        payload: {
          email: testEmail + '.default',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.debug_code).toBeUndefined();
    });
  });
});
