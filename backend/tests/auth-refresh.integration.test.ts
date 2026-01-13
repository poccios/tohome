import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';
import { resetDatabase, closeDatabasePool } from './helpers/db';
import { resetRateLimits } from '../src/middleware/rateLimiter';
import { query } from '../src/db';

describe('POST /auth/token/refresh - Integration Tests', () => {
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
   * Helper: Complete login flow to get refresh token cookie
   */
  async function loginUser(phone: string = '+393401234567'): Promise<{
    cookies: string[];
    userId: string;
    sessionId: string;
  }> {
    // Request login link
    const requestResponse = await request(app.server)
      .post('/auth/sms-link/request')
      .send({ phone_e164: phone });

    const link = requestResponse.body.link;
    const token = new URL(link).searchParams.get('token');

    // Verify token to get cookies
    const verifyResponse = await request(app.server)
      .post('/auth/sms-link/verify')
      .send({ token });

    const cookies = verifyResponse.headers['set-cookie'];

    // Get user and session IDs
    const userQuery = await query(
      'SELECT id FROM users WHERE phone_e164 = $1',
      [phone]
    );
    const userId = userQuery.rows[0].id;

    const sessionQuery = await query(
      'SELECT id FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    const sessionId = sessionQuery.rows[0].id;

    return { cookies, userId, sessionId };
  }

  /**
   * Helper: Extract cookie value
   */
  function extractCookieValue(cookies: string[], name: string): string {
    const cookie = cookies.find((c: string) => c.startsWith(`${name}=`));
    if (!cookie) throw new Error(`Cookie ${name} not found`);
    return cookie.split(';')[0].split('=')[1];
  }

  describe('Case 1: Valid refresh → new cookies', () => {
    it('should refresh tokens and return new cookies', async () => {
      const { cookies: initialCookies, userId } = await loginUser();

      const initialAccessToken = extractCookieValue(initialCookies, 'access_token');
      const initialRefreshToken = extractCookieValue(initialCookies, 'refresh_token');

      // Wait a bit to ensure timestamps differ
      await new Promise(resolve => setTimeout(resolve, 100));

      // Refresh tokens
      const refreshResponse = await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', initialCookies);

      // Assert HTTP 200
      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body).toEqual({ ok: true });

      // Assert new cookies set
      const newCookies = refreshResponse.headers['set-cookie'];
      expect(newCookies).toBeDefined();

      const newAccessToken = extractCookieValue(newCookies, 'access_token');
      const newRefreshToken = extractCookieValue(newCookies, 'refresh_token');

      // Tokens should be different (rotated)
      expect(newAccessToken).not.toBe(initialAccessToken);
      expect(newRefreshToken).not.toBe(initialRefreshToken);

      // Verify JWT format
      expect(newAccessToken.split('.').length).toBe(3);
      expect(newRefreshToken.split('.').length).toBe(3);
    });

    it('should update session refresh_token_hash in DB', async () => {
      const { cookies, sessionId } = await loginUser();

      // Get initial refresh_token_hash
      const beforeRefresh = await query(
        'SELECT refresh_token_hash FROM sessions WHERE id = $1',
        [sessionId]
      );
      const initialHash = beforeRefresh.rows[0].refresh_token_hash;

      // Refresh tokens
      await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', cookies);

      // Get new refresh_token_hash
      const afterRefresh = await query(
        'SELECT refresh_token_hash FROM sessions WHERE id = $1',
        [sessionId]
      );
      const newHash = afterRefresh.rows[0].refresh_token_hash;

      // Hash should be different (token rotated)
      expect(newHash).not.toBe(initialHash);
    });

    it('should extend session expires_at', async () => {
      const { cookies, sessionId } = await loginUser();

      // Get initial expires_at
      const beforeRefresh = await query(
        'SELECT expires_at FROM sessions WHERE id = $1',
        [sessionId]
      );
      const initialExpiresAt = new Date(beforeRefresh.rows[0].expires_at);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Refresh tokens
      await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', cookies);

      // Get new expires_at
      const afterRefresh = await query(
        'SELECT expires_at FROM sessions WHERE id = $1',
        [sessionId]
      );
      const newExpiresAt = new Date(afterRefresh.rows[0].expires_at);

      // Should be extended (30 days from now)
      expect(newExpiresAt.getTime()).toBeGreaterThan(initialExpiresAt.getTime());

      // Should be ~30 days in future
      const now = new Date();
      const diffDays = (newExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(29);
      expect(diffDays).toBeLessThan(31);
    });

    it('should include correct userId and phone in new access token', async () => {
      const phone = '+393401234567';
      const { cookies, userId } = await loginUser(phone);

      const refreshResponse = await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', cookies);

      const newCookies = refreshResponse.headers['set-cookie'];
      const newAccessToken = extractCookieValue(newCookies, 'access_token');

      // Decode JWT payload
      const payload = JSON.parse(
        Buffer.from(newAccessToken.split('.')[1], 'base64url').toString()
      );

      expect(payload.userId).toBe(userId);
      expect(payload.phone).toBe(phone);
      expect(payload.exp).toBeTruthy();
    });

    it('should set cookie attributes correctly', async () => {
      const { cookies } = await loginUser();

      const refreshResponse = await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', cookies);

      const newCookies = refreshResponse.headers['set-cookie'];

      const accessCookie = newCookies.find((c: string) =>
        c.startsWith('access_token=')
      );
      const refreshCookie = newCookies.find((c: string) =>
        c.startsWith('refresh_token=')
      );

      // Access token cookie attributes
      expect(accessCookie).toContain('HttpOnly');
      expect(accessCookie).toContain('SameSite=Lax');
      expect(accessCookie).toContain('Path=/');
      expect(accessCookie).toContain('Max-Age=900'); // 15 min

      // Refresh token cookie attributes
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('SameSite=Lax');
      expect(refreshCookie).toContain('Path=/');
      expect(refreshCookie).toContain('Max-Age=2592000'); // 30 days
    });
  });

  describe('Case 2: Refresh rotated → old not valid', () => {
    it('should invalidate old refresh token after rotation', async () => {
      const { cookies: initialCookies } = await loginUser();

      // First refresh - should succeed
      const firstRefreshResponse = await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', initialCookies);

      expect(firstRefreshResponse.status).toBe(200);

      // Try to use old refresh token again - should fail
      const secondRefreshResponse = await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', initialCookies); // Using OLD cookies

      expect(secondRefreshResponse.status).toBe(401);
      expect(secondRefreshResponse.body).toHaveProperty('error');
      expect(secondRefreshResponse.body.message).toContain('refresh token');
    });

    it('should allow refresh with new token after rotation', async () => {
      const { cookies: initialCookies } = await loginUser();

      // First refresh
      const firstRefreshResponse = await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', initialCookies);

      const firstNewCookies = firstRefreshResponse.headers['set-cookie'];

      // Second refresh with NEW cookies - should succeed
      const secondRefreshResponse = await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', firstNewCookies);

      expect(secondRefreshResponse.status).toBe(200);
      expect(secondRefreshResponse.body.ok).toBe(true);

      // Should get even newer cookies
      const secondNewCookies = secondRefreshResponse.headers['set-cookie'];
      const secondAccessToken = extractCookieValue(secondNewCookies, 'access_token');
      const firstAccessToken = extractCookieValue(firstNewCookies, 'access_token');

      expect(secondAccessToken).not.toBe(firstAccessToken);
    });

    it('should update refresh_token_hash on each rotation', async () => {
      const { cookies, sessionId } = await loginUser();

      // Get initial hash
      const initial = await query(
        'SELECT refresh_token_hash FROM sessions WHERE id = $1',
        [sessionId]
      );
      const hash1 = initial.rows[0].refresh_token_hash;

      // First refresh
      const firstResponse = await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', cookies);

      const after1 = await query(
        'SELECT refresh_token_hash FROM sessions WHERE id = $1',
        [sessionId]
      );
      const hash2 = after1.rows[0].refresh_token_hash;

      expect(hash2).not.toBe(hash1);

      // Second refresh with new cookies
      const newCookies = firstResponse.headers['set-cookie'];
      await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', newCookies);

      const after2 = await query(
        'SELECT refresh_token_hash FROM sessions WHERE id = $1',
        [sessionId]
      );
      const hash3 = after2.rows[0].refresh_token_hash;

      // All three hashes should be different
      expect(hash3).not.toBe(hash2);
      expect(hash3).not.toBe(hash1);
    });

    it('should maintain session continuity across rotations', async () => {
      const { cookies, sessionId, userId } = await loginUser();

      // Multiple refreshes
      let currentCookies = cookies;
      for (let i = 0; i < 3; i++) {
        const response = await request(app.server)
          .post('/auth/token/refresh')
          .set('Cookie', currentCookies);

        expect(response.status).toBe(200);
        currentCookies = response.headers['set-cookie'];
      }

      // Session should still exist and be the same
      const sessions = await query(
        'SELECT id, user_id, revoked_at FROM sessions WHERE id = $1',
        [sessionId]
      );

      expect(sessions.rows.length).toBe(1);
      expect(sessions.rows[0].id).toBe(sessionId);
      expect(sessions.rows[0].user_id).toBe(userId);
      expect(sessions.rows[0].revoked_at).toBeNull();
    });
  });

  describe('Case 3: Refresh revoked → 401', () => {
    it('should reject refresh with revoked session', async () => {
      const { cookies, sessionId } = await loginUser();

      // Manually revoke the session
      await query(
        'UPDATE sessions SET revoked_at = NOW() WHERE id = $1',
        [sessionId]
      );

      // Try to refresh - should fail
      const refreshResponse = await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', cookies);

      expect(refreshResponse.status).toBe(401);
      expect(refreshResponse.body).toHaveProperty('error');
      expect(refreshResponse.body.message).toContain('revoked');
    });

    it('should not update session if revoked', async () => {
      const { cookies, sessionId } = await loginUser();

      // Get refresh_token_hash before
      const before = await query(
        'SELECT refresh_token_hash, revoked_at FROM sessions WHERE id = $1',
        [sessionId]
      );
      const initialHash = before.rows[0].refresh_token_hash;

      // Revoke session
      await query(
        'UPDATE sessions SET revoked_at = NOW() WHERE id = $1',
        [sessionId]
      );

      // Try to refresh
      await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', cookies);

      // Verify hash not updated
      const after = await query(
        'SELECT refresh_token_hash, revoked_at FROM sessions WHERE id = $1',
        [sessionId]
      );

      expect(after.rows[0].refresh_token_hash).toBe(initialHash);
      expect(after.rows[0].revoked_at).not.toBeNull();
    });

    it('should handle multiple revoked sessions for same user', async () => {
      const phone = '+393401234567';

      // Create two sessions via two logins
      const { cookies: cookies1 } = await loginUser(phone);

      resetRateLimits();
      const { cookies: cookies2 } = await loginUser(phone);

      // Verify two sessions exist
      const userQuery = await query(
        'SELECT id FROM users WHERE phone_e164 = $1',
        [phone]
      );
      const userId = userQuery.rows[0].id;

      const sessionsBefore = await query(
        'SELECT COUNT(*) as count FROM sessions WHERE user_id = $1',
        [userId]
      );
      expect(parseInt(sessionsBefore.rows[0].count)).toBe(2);

      // Revoke first session
      const session1Query = await query(
        'SELECT id FROM sessions WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
        [userId]
      );
      await query(
        'UPDATE sessions SET revoked_at = NOW() WHERE id = $1',
        [session1Query.rows[0].id]
      );

      // First session refresh should fail
      const refresh1 = await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', cookies1);

      expect(refresh1.status).toBe(401);

      // Second session refresh should succeed
      const refresh2 = await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', cookies2);

      expect(refresh2.status).toBe(200);
    });
  });

  describe('Additional edge cases', () => {
    it('should reject missing refresh token cookie', async () => {
      const response = await request(app.server)
        .post('/auth/token/refresh');
      // No cookies sent

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Unauthorized');
      expect(response.body.message).toContain('Refresh token not found');
    });

    it('should reject invalid refresh token JWT', async () => {
      const response = await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', ['refresh_token=invalid-jwt-token']);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject expired session', async () => {
      const { cookies, sessionId } = await loginUser();

      // Manually expire the session
      await query(
        'UPDATE sessions SET expires_at = NOW() - INTERVAL \'1 day\' WHERE id = $1',
        [sessionId]
      );

      const refreshResponse = await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', cookies);

      expect(refreshResponse.status).toBe(401);
      expect(refreshResponse.body.message).toContain('expired');
    });

    it('should reject non-existent session', async () => {
      const { cookies } = await loginUser();

      // Delete the session
      await query('DELETE FROM sessions');

      const refreshResponse = await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', cookies);

      expect(refreshResponse.status).toBe(401);
      expect(refreshResponse.body.message).toContain('not found');
    });

    it('should reject session with mismatched user', async () => {
      const { cookies, sessionId } = await loginUser();

      // Create another user
      await query(
        `INSERT INTO users (phone_e164, name, status)
         VALUES ('+393409999999', 'Other User', 'active')`
      );

      const otherUser = await query(
        'SELECT id FROM users WHERE phone_e164 = $1',
        ['+393409999999']
      );

      // Update session to point to different user (data corruption scenario)
      await query(
        'UPDATE sessions SET user_id = $1 WHERE id = $2',
        [otherUser.rows[0].id, sessionId]
      );

      // This should fail due to JWT userId not matching session user_id
      const refreshResponse = await request(app.server)
        .post('/auth/token/refresh')
        .set('Cookie', cookies);

      // Should fail because JWT contains original userId but session points to different user
      expect(refreshResponse.status).toBe(401);
    });

    it('should handle concurrent refresh requests', async () => {
      const { cookies } = await loginUser();

      // Simulate concurrent refresh requests
      const [response1, response2] = await Promise.all([
        request(app.server)
          .post('/auth/token/refresh')
          .set('Cookie', cookies),
        request(app.server)
          .post('/auth/token/refresh')
          .set('Cookie', cookies),
      ]);

      // Both might succeed initially (before token rotation completes)
      // Or one succeeds and one fails
      const statuses = [response1.status, response2.status];

      // At least one should succeed
      expect(statuses).toContain(200);

      // If both succeeded, they should have different tokens
      if (response1.status === 200 && response2.status === 200) {
        const cookies1 = response1.headers['set-cookie'];
        const cookies2 = response2.headers['set-cookie'];

        const token1 = extractCookieValue(cookies1, 'access_token');
        const token2 = extractCookieValue(cookies2, 'access_token');

        // Tokens should be different
        expect(token1).not.toBe(token2);
      }
    });
  });
});
