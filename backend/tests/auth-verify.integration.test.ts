import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';
import { resetDatabase, closeDatabasePool } from './helpers/db';
import { resetRateLimits } from '../src/middleware/rateLimiter';
import { query } from '../src/db';

describe('POST /auth/sms-link/verify - Integration Tests', () => {
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

  /**
   * Helper: Create a login link and return the token
   */
  async function createLoginLink(phone: string, deviceId?: string): Promise<string> {
    const response = await request(app.server)
      .post('/auth/sms-link/request')
      .send({
        phone_e164: phone,
        device_id: deviceId,
      });

    expect(response.status).toBe(200);
    const link = response.body.link;
    const token = new URL(link).searchParams.get('token');
    return token!;
  }

  /**
   * Helper: Manually expire a login link
   */
  async function expireLoginLink(phone: string) {
    await query(
      `UPDATE login_links
       SET expires_at = NOW() - INTERVAL '1 minute'
       WHERE phone_e164 = $1`,
      [phone]
    );
  }

  describe('Case 1: Valid token → login OK', () => {
    it('should verify token and create user if not exists', async () => {
      const phone = '+393401234567';
      const deviceId = 'test-device-123';
      const token = await createLoginLink(phone, deviceId);

      // Verify no user exists yet
      const beforeUsers = await query(
        'SELECT * FROM users WHERE phone_e164 = $1',
        [phone]
      );
      expect(beforeUsers.rows.length).toBe(0);

      // Verify the token
      const response = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({
          token: token,
          device_id: deviceId,
        });

      // Assert HTTP 200
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true });

      // Assert user was created
      const afterUsers = await query(
        'SELECT * FROM users WHERE phone_e164 = $1',
        [phone]
      );
      expect(afterUsers.rows.length).toBe(1);

      const user = afterUsers.rows[0];
      expect(user.phone_e164).toBe(phone);
      expect(user.name).toBeTruthy();
      expect(user.status).toBe('active');
      expect(user.last_login_at).toBeTruthy();

      // Assert login_link was marked as used
      const loginLinks = await query(
        'SELECT used_at FROM login_links WHERE phone_e164 = $1',
        [phone]
      );
      expect(loginLinks.rows[0].used_at).toBeTruthy();

      // Assert session was created
      const sessions = await query(
        'SELECT * FROM sessions WHERE user_id = $1',
        [user.id]
      );
      expect(sessions.rows.length).toBe(1);

      const session = sessions.rows[0];
      expect(session.user_id).toBe(user.id);
      expect(session.refresh_token_hash).toBeTruthy();
      expect(session.device_id).toBe(deviceId);
      expect(session.expires_at).toBeTruthy();
      expect(session.revoked_at).toBeNull();
    });

    it('should use existing user if already exists', async () => {
      const phone = '+393401234567';
      const token1 = await createLoginLink(phone);

      // First login - creates user
      await request(app.server)
        .post('/auth/sms-link/verify')
        .send({ token: token1 });

      const usersBefore = await query(
        'SELECT id FROM users WHERE phone_e164 = $1',
        [phone]
      );
      const userId = usersBefore.rows[0].id;

      // Create another login link
      resetRateLimits();
      const token2 = await createLoginLink(phone);

      // Second login - reuses existing user
      const response = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({ token: token2 });

      expect(response.status).toBe(200);

      // Assert user count is still 1
      const usersAfter = await query(
        'SELECT id FROM users WHERE phone_e164 = $1',
        [phone]
      );
      expect(usersAfter.rows.length).toBe(1);
      expect(usersAfter.rows[0].id).toBe(userId); // Same user ID

      // Assert 2 sessions exist (one per login)
      const sessions = await query(
        'SELECT * FROM sessions WHERE user_id = $1',
        [userId]
      );
      expect(sessions.rows.length).toBe(2);
    });

    it('should update last_login_at on existing user', async () => {
      const phone = '+393401234567';
      const token1 = await createLoginLink(phone);

      // First login
      await request(app.server)
        .post('/auth/sms-link/verify')
        .send({ token: token1 });

      const firstLogin = await query(
        'SELECT last_login_at FROM users WHERE phone_e164 = $1',
        [phone]
      );
      const firstLoginAt = new Date(firstLogin.rows[0].last_login_at);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second login
      resetRateLimits();
      const token2 = await createLoginLink(phone);
      await request(app.server)
        .post('/auth/sms-link/verify')
        .send({ token: token2 });

      const secondLogin = await query(
        'SELECT last_login_at FROM users WHERE phone_e164 = $1',
        [phone]
      );
      const secondLoginAt = new Date(secondLogin.rows[0].last_login_at);

      // Assert last_login_at was updated
      expect(secondLoginAt.getTime()).toBeGreaterThan(firstLoginAt.getTime());
    });
  });

  describe('Case 2: Token used twice → second 401', () => {
    it('should reject already used token', async () => {
      const phone = '+393401234567';
      const deviceId = 'test-device-123';
      const token = await createLoginLink(phone, deviceId);

      // First verification - should succeed
      const firstResponse = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({
          token: token,
          device_id: deviceId,
        });

      expect(firstResponse.status).toBe(200);
      expect(firstResponse.body.ok).toBe(true);

      // Verify used_at is set
      const loginLink = await query(
        'SELECT used_at FROM login_links WHERE phone_e164 = $1',
        [phone]
      );
      expect(loginLink.rows[0].used_at).toBeTruthy();

      // Second verification with same token - should fail
      const secondResponse = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({
          token: token,
          device_id: deviceId,
        });

      expect(secondResponse.status).toBe(400); // Invalid token error
      expect(secondResponse.body).toHaveProperty('error');
      expect(secondResponse.body.message).toContain('Invalid or expired token');

      // Verify only one user and one session created
      const users = await query(
        'SELECT COUNT(*) as count FROM users WHERE phone_e164 = $1',
        [phone]
      );
      expect(parseInt(users.rows[0].count)).toBe(1);

      const sessions = await query(
        'SELECT COUNT(*) as count FROM sessions'
      );
      expect(parseInt(sessions.rows[0].count)).toBe(1);
    });

    it('should mark used_at atomically to prevent race conditions', async () => {
      const phone = '+393401234567';
      const token = await createLoginLink(phone);

      // Simulate concurrent requests (both should not succeed)
      const [response1, response2] = await Promise.all([
        request(app.server)
          .post('/auth/sms-link/verify')
          .send({ token }),
        request(app.server)
          .post('/auth/sms-link/verify')
          .send({ token }),
      ]);

      // One should succeed, one should fail
      const responses = [response1, response2];
      const successCount = responses.filter(r => r.status === 200).length;
      const failCount = responses.filter(r => r.status === 400).length;

      expect(successCount).toBe(1);
      expect(failCount).toBe(1);

      // Only one session should exist
      const sessions = await query('SELECT COUNT(*) as count FROM sessions');
      expect(parseInt(sessions.rows[0].count)).toBe(1);
    });
  });

  describe('Case 3: Token expired → 401', () => {
    it('should reject expired token', async () => {
      const phone = '+393401234567';
      const token = await createLoginLink(phone);

      // Manually expire the token
      await expireLoginLink(phone);

      // Try to verify expired token
      const response = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({ token });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('Invalid or expired token');

      // Verify no user created
      const users = await query(
        'SELECT COUNT(*) as count FROM users WHERE phone_e164 = $1',
        [phone]
      );
      expect(parseInt(users.rows[0].count)).toBe(0);

      // Verify no session created
      const sessions = await query('SELECT COUNT(*) as count FROM sessions');
      expect(parseInt(sessions.rows[0].count)).toBe(0);

      // Verify used_at is still NULL (token never used)
      const loginLink = await query(
        'SELECT used_at FROM login_links WHERE phone_e164 = $1',
        [phone]
      );
      expect(loginLink.rows[0].used_at).toBeNull();
    });

    it('should not accept token after 10 minutes', async () => {
      const phone = '+393401234567';
      const token = await createLoginLink(phone);

      // Set expires_at to exactly now
      await query(
        `UPDATE login_links
         SET expires_at = NOW()
         WHERE phone_e164 = $1`,
        [phone]
      );

      // Token should be rejected
      const response = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({ token });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid or expired token');
    });
  });

  describe('Case 4: Cookies access + refresh present', () => {
    it('should set access_token and refresh_token cookies', async () => {
      const phone = '+393401234567';
      const token = await createLoginLink(phone);

      const response = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({ token });

      expect(response.status).toBe(200);

      // Check Set-Cookie headers
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(Array.isArray(cookies)).toBe(true);

      // Find access_token and refresh_token cookies
      const accessTokenCookie = cookies.find((c: string) =>
        c.startsWith('access_token=')
      );
      const refreshTokenCookie = cookies.find((c: string) =>
        c.startsWith('refresh_token=')
      );

      expect(accessTokenCookie).toBeTruthy();
      expect(refreshTokenCookie).toBeTruthy();

      // Verify cookie attributes
      expect(accessTokenCookie).toContain('HttpOnly');
      expect(accessTokenCookie).toContain('SameSite=Lax');
      expect(accessTokenCookie).toContain('Path=/');
      expect(accessTokenCookie).toContain('Max-Age=900'); // 15 min

      expect(refreshTokenCookie).toContain('HttpOnly');
      expect(refreshTokenCookie).toContain('SameSite=Lax');
      expect(refreshTokenCookie).toContain('Path=/');
      expect(refreshTokenCookie).toContain('Max-Age=2592000'); // 30 days
    });

    it('should set different tokens for different logins', async () => {
      const phone = '+393401234567';
      const token1 = await createLoginLink(phone);

      const response1 = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({ token: token1 });

      const cookies1 = response1.headers['set-cookie'];
      const accessToken1 = cookies1
        .find((c: string) => c.startsWith('access_token='))!
        .split(';')[0]
        .split('=')[1];

      // Second login
      resetRateLimits();
      const token2 = await createLoginLink(phone);

      const response2 = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({ token: token2 });

      const cookies2 = response2.headers['set-cookie'];
      const accessToken2 = cookies2
        .find((c: string) => c.startsWith('access_token='))!
        .split(';')[0]
        .split('=')[1];

      // Tokens should be different
      expect(accessToken1).not.toBe(accessToken2);
    });

    it('should create valid JWT tokens', async () => {
      const phone = '+393401234567';
      const token = await createLoginLink(phone);

      const response = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({ token });

      const cookies = response.headers['set-cookie'];
      const accessToken = cookies
        .find((c: string) => c.startsWith('access_token='))!
        .split(';')[0]
        .split('=')[1];

      // JWT format: header.payload.signature
      const parts = accessToken.split('.');
      expect(parts.length).toBe(3);

      // Decode payload (base64url)
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString()
      );

      expect(payload).toHaveProperty('userId');
      expect(payload).toHaveProperty('phone', phone);
      expect(payload).toHaveProperty('exp'); // Expiration time
    });
  });

  describe('Case 5: User created if not exists', () => {
    it('should create new user on first login', async () => {
      const phone = '+393401234567';
      const token = await createLoginLink(phone);

      // Verify no user exists
      const beforeUsers = await query(
        'SELECT * FROM users WHERE phone_e164 = $1',
        [phone]
      );
      expect(beforeUsers.rows.length).toBe(0);

      // Verify token
      const response = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({ token });

      expect(response.status).toBe(200);

      // Verify user was created
      const afterUsers = await query(
        'SELECT * FROM users WHERE phone_e164 = $1',
        [phone]
      );
      expect(afterUsers.rows.length).toBe(1);

      const user = afterUsers.rows[0];
      expect(user.id).toBeTruthy();
      expect(user.phone_e164).toBe(phone);
      expect(user.name).toContain('User'); // Default name
      expect(user.email).toBeNull(); // No email initially
      expect(user.status).toBe('active');
      expect(user.created_at).toBeTruthy();
      expect(user.last_login_at).toBeTruthy();
    });

    it('should not create duplicate user on second login', async () => {
      const phone = '+393401234567';

      // First login
      const token1 = await createLoginLink(phone);
      await request(app.server)
        .post('/auth/sms-link/verify')
        .send({ token: token1 });

      // Get user ID
      const firstQuery = await query(
        'SELECT id FROM users WHERE phone_e164 = $1',
        [phone]
      );
      const userId = firstQuery.rows[0].id;

      // Second login
      resetRateLimits();
      const token2 = await createLoginLink(phone);
      await request(app.server)
        .post('/auth/sms-link/verify')
        .send({ token: token2 });

      // Verify still only one user
      const usersCount = await query(
        'SELECT COUNT(*) as count FROM users WHERE phone_e164 = $1',
        [phone]
      );
      expect(parseInt(usersCount.rows[0].count)).toBe(1);

      // Verify same user ID
      const secondQuery = await query(
        'SELECT id FROM users WHERE phone_e164 = $1',
        [phone]
      );
      expect(secondQuery.rows[0].id).toBe(userId);
    });

    it('should create different users for different phones', async () => {
      const phone1 = '+393401234567';
      const phone2 = '+393409876543';

      // Login with phone1
      const token1 = await createLoginLink(phone1);
      await request(app.server)
        .post('/auth/sms-link/verify')
        .send({ token: token1 });

      // Login with phone2
      resetRateLimits();
      const token2 = await createLoginLink(phone2);
      await request(app.server)
        .post('/auth/sms-link/verify')
        .send({ token: token2 });

      // Verify two users exist
      const users = await query('SELECT * FROM users ORDER BY created_at');
      expect(users.rows.length).toBe(2);

      expect(users.rows[0].phone_e164).toBe(phone1);
      expect(users.rows[1].phone_e164).toBe(phone2);

      // Different user IDs
      expect(users.rows[0].id).not.toBe(users.rows[1].id);
    });
  });

  describe('Additional edge cases', () => {
    it('should reject invalid token format', async () => {
      const response = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({
          token: 'invalid-token-123',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing token', async () => {
      const response = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({
          device_id: 'test-device',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should work without device_id', async () => {
      const phone = '+393401234567';
      const token = await createLoginLink(phone);

      const response = await request(app.server)
        .post('/auth/sms-link/verify')
        .send({ token }); // No device_id

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);

      // Session created with null device_id
      const sessions = await query('SELECT device_id FROM sessions');
      expect(sessions.rows[0].device_id).toBeNull();
    });

    it('should store user_agent and ip_hash in session', async () => {
      const phone = '+393401234567';
      const token = await createLoginLink(phone);

      const response = await request(app.server)
        .post('/auth/sms-link/verify')
        .set('User-Agent', 'Test/1.0')
        .send({ token });

      expect(response.status).toBe(200);

      const sessions = await query('SELECT user_agent, ip_hash FROM sessions');
      expect(sessions.rows[0].user_agent).toBeTruthy();
      expect(sessions.rows[0].ip_hash).toBeTruthy();
      expect(sessions.rows[0].ip_hash.length).toBe(64); // SHA256
    });
  });
});
