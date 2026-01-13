import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { transaction } from '../db';
import { hashToken, generateOTP } from '../utils/crypto';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { createEmailProvider } from '../email';
import { authRequestRateLimit } from '../middleware/rateLimiter';

const requestSchema = z.object({
  email: z.string().email(),
  device_id: z.string().optional(),
});

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d{6}$/),
  device_id: z.string().optional(),
});

export async function authRoutes(fastify: FastifyInstance) {
  const emailProvider = createEmailProvider();

  // POST /auth/email-otp/request
  fastify.post(
    '/auth/email-otp/request',
    {
      preHandler: authRequestRateLimit,
    },
    async (request, reply) => {
    try {
      const body = requestSchema.parse(request.body);
      const { email, device_id } = body;

      const ip_hash = hashToken(request.ip);

      // Generate 6-digit OTP and hash it
      const otp = generateOTP(6);
      const codeHash = hashToken(otp);

      // Check if there's an existing locked challenge
      const result = await transaction(async (client) => {
        // Check for locked challenges
        const lockCheck = await client.query(
          `SELECT id, locked_until
           FROM email_otp_challenges
           WHERE email = $1
             AND locked_until IS NOT NULL
             AND locked_until > NOW()
           ORDER BY created_at DESC
           LIMIT 1`,
          [email]
        );

        if (lockCheck.rows.length > 0) {
          const lockedUntil = new Date(lockCheck.rows[0].locked_until);
          const retryAfter = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
          throw new Error(`LOCKED:${retryAfter}`);
        }

        // Create new OTP challenge
        await client.query(
          `INSERT INTO email_otp_challenges (
            email,
            code_hash,
            expires_at,
            device_id,
            ip_hash,
            last_sent_at
          ) VALUES ($1, $2, NOW() + INTERVAL '5 minutes', $3, $4, NOW())`,
          [email, codeHash, device_id || null, ip_hash]
        );

        return { otp };
      });

      // Send email
      try {
        const emailSubject = 'Codice ToHome';
        const emailText = `Ciao,

Il tuo codice di accesso è: ${result.otp}

Il codice è valido per 5 minuti.

Se non hai richiesto questo codice, ignora questa email.

--
ToHome`;

        await emailProvider.send(email, emailSubject, emailText);
      } catch (emailError) {
        console.error('Email send failed:', emailError);
        return reply.status(502).send({
          ok: false,
          error: 'EMAIL_SEND_FAILED',
        });
      }

      // E2E Mode: include debug_code in response for testing
      const isE2EMode = process.env.E2E_MODE === '1';

      return reply.send({
        ok: true,
        message: 'OTP code sent',
        ...(isE2EMode && { debug_code: result.otp }),
      });
    } catch (error) {
      // Handle locked account
      if (error instanceof Error && error.message.startsWith('LOCKED:')) {
        const retryAfter = parseInt(error.message.split(':')[1]);
        return reply.status(429).send({
          error: 'Account temporarily locked',
          message: 'Too many failed attempts. Please try again later.',
          retryAfter,
        });
      }

      console.error('Request OTP error:', error);
      return reply.status(400).send({
        error: 'Request failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // POST /auth/email-otp/verify
  fastify.post('/auth/email-otp/verify', async (request, reply) => {
    try {
      const body = verifySchema.parse(request.body);
      const { email, code, device_id } = body;

      const codeHash = hashToken(code);
      const ip_hash = hashToken(request.ip);

      const result = await transaction(async (client) => {
        // Find the most recent valid challenge
        const challengeResult = await client.query(
          `SELECT id, code_hash, attempts, max_attempts, locked_until
           FROM email_otp_challenges
           WHERE email = $1
             AND expires_at > NOW()
           ORDER BY created_at DESC
           LIMIT 1`,
          [email]
        );

        if (challengeResult.rows.length === 0) {
          throw new Error('Invalid or expired code');
        }

        const challenge = challengeResult.rows[0];

        // Check if locked
        if (challenge.locked_until && new Date(challenge.locked_until) > new Date()) {
          throw new Error('Account temporarily locked');
        }

        // Increment attempts
        const newAttempts = challenge.attempts + 1;

        // Check if max attempts reached
        if (newAttempts > challenge.max_attempts) {
          // Lock the challenge for 15 minutes
          await client.query(
            `UPDATE email_otp_challenges
             SET attempts = $1, locked_until = NOW() + INTERVAL '15 minutes'
             WHERE id = $2`,
            [newAttempts, challenge.id]
          );
          throw new Error('Too many failed attempts');
        }

        // Verify the code
        if (codeHash !== challenge.code_hash) {
          // Increment attempts but don't lock yet
          await client.query(
            `UPDATE email_otp_challenges
             SET attempts = $1
             WHERE id = $2`,
            [newAttempts, challenge.id]
          );
          throw new Error('Invalid code');
        }

        // Code is correct! Mark challenge as consumed
        await client.query(
          'DELETE FROM email_otp_challenges WHERE id = $1',
          [challenge.id]
        );

        // Find or create user
        let userResult = await client.query(
          'SELECT id, email, name FROM users WHERE email = $1',
          [email]
        );

        let user;
        if (userResult.rows.length === 0) {
          // Create new user
          const newUserResult = await client.query(
            `INSERT INTO users (email, name, status, last_login_at)
             VALUES ($1, $2, 'active', NOW())
             RETURNING id, email, name`,
            [email, `User ${email}`]
          );
          user = newUserResult.rows[0];
        } else {
          user = userResult.rows[0];
          // Update last login
          await client.query(
            'UPDATE users SET last_login_at = NOW() WHERE id = $1',
            [user.id]
          );
        }

        // Create session
        const sessionResult = await client.query(
          `INSERT INTO sessions (
            user_id,
            refresh_token_hash,
            device_id,
            user_agent,
            ip_hash,
            expires_at
          ) VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days')
          RETURNING id`,
          [
            user.id,
            'temp', // Temporary value, will update after generating JWT
            device_id || null,
            request.headers['user-agent'] || null,
            ip_hash,
          ]
        );

        const sessionId = sessionResult.rows[0].id;

        // Generate tokens
        const accessToken = generateAccessToken({
          userId: user.id,
          phone: user.email, // Keep 'phone' for backward compatibility in JWT
        });

        const refreshTokenJWT = generateRefreshToken({
          userId: user.id,
          sessionId: sessionId,
        });

        // Hash the JWT and update session
        const refreshTokenHash = hashToken(refreshTokenJWT);
        await client.query(
          'UPDATE sessions SET refresh_token_hash = $1 WHERE id = $2',
          [refreshTokenHash, sessionId]
        );

        return { accessToken, refreshToken: refreshTokenJWT, user };
      });

      // Determine if we're in production
      const isProduction = process.env.NODE_ENV === 'production';

      // Set cookies
      reply
        .setCookie('access_token', result.accessToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax',
          path: '/',
          maxAge: 15 * 60, // 15 minutes in seconds
        })
        .setCookie('refresh_token', result.refreshToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax',
          path: '/',
          maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
        })
        .send({ ok: true });
    } catch (error) {
      console.error('Verify error:', error);

      if (error instanceof Error) {
        if (error.message === 'Account temporarily locked') {
          return reply.status(429).send({
            error: 'Account locked',
            message: 'Too many failed attempts. Please wait 15 minutes.',
          });
        }
        if (error.message === 'Too many failed attempts') {
          return reply.status(429).send({
            error: 'Account locked',
            message: 'Too many failed attempts. Your account has been locked for 15 minutes.',
          });
        }
      }

      return reply.status(400).send({
        error: 'Verification failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // POST /auth/token/refresh
  fastify.post('/auth/token/refresh', async (request, reply) => {
    try {
      const refreshTokenCookie = request.cookies.refresh_token;

      if (!refreshTokenCookie) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Refresh token not found',
        });
      }

      // Verify refresh token JWT
      const payload = verifyRefreshToken(refreshTokenCookie);
      const { userId, sessionId } = payload;

      const result = await transaction(async (client) => {
        // Check if session exists and is valid
        const sessionResult = await client.query(
          `SELECT id, user_id, expires_at, revoked_at, refresh_token_hash
           FROM sessions
           WHERE id = $1 AND user_id = $2`,
          [sessionId, userId]
        );

        if (sessionResult.rows.length === 0) {
          throw new Error('Session not found');
        }

        const session = sessionResult.rows[0];

        if (session.revoked_at) {
          throw new Error('Session has been revoked');
        }

        if (new Date(session.expires_at) < new Date()) {
          throw new Error('Session has expired');
        }

        // Verify the refresh token hash matches (prevents reuse of old tokens)
        const currentTokenHash = hashToken(refreshTokenCookie);
        if (currentTokenHash !== session.refresh_token_hash) {
          throw new Error('Invalid refresh token');
        }

        // Get user info
        const userResult = await client.query(
          'SELECT id, email, name FROM users WHERE id = $1',
          [userId]
        );

        if (userResult.rows.length === 0) {
          throw new Error('User not found');
        }

        const user = userResult.rows[0];

        // Generate new tokens
        const accessToken = generateAccessToken({
          userId: user.id,
          phone: user.email, // Keep 'phone' for backward compatibility
        });

        const refreshTokenJWT = generateRefreshToken({
          userId: user.id,
          sessionId: sessionId,
        });

        // Hash the new JWT and update session (rotation)
        const newRefreshTokenHash = hashToken(refreshTokenJWT);
        await client.query(
          `UPDATE sessions
           SET refresh_token_hash = $1,
               expires_at = NOW() + INTERVAL '30 days'
           WHERE id = $2`,
          [newRefreshTokenHash, sessionId]
        );

        return { accessToken, refreshToken: refreshTokenJWT };
      });

      const isProduction = process.env.NODE_ENV === 'production';

      // Set new cookies
      reply
        .setCookie('access_token', result.accessToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax',
          path: '/',
          maxAge: 15 * 60,
        })
        .setCookie('refresh_token', result.refreshToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax',
          path: '/',
          maxAge: 30 * 24 * 60 * 60,
        })
        .send({ ok: true });
    } catch (error) {
      console.error('Refresh error:', error);
      return reply.status(401).send({
        error: 'Token refresh failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
