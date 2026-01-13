import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth';
import { query } from '../db';

export async function meRoutes(fastify: FastifyInstance) {
  // GET /me
  fastify.get(
    '/me',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'User not authenticated',
          });
        }

        const userId = request.user.userId;

        // Get user from database
        const result = await query(
          `SELECT id, phone_e164, name, email, status, created_at, last_login_at
           FROM users
           WHERE id = $1`,
          [userId]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not found',
            message: 'User not found',
          });
        }

        const user = result.rows[0];

        return reply.send({
          user: {
            id: user.id,
            phone: user.phone_e164,
            name: user.name,
            email: user.email,
            status: user.status,
            createdAt: user.created_at,
            lastLoginAt: user.last_login_at,
          },
        });
      } catch (error) {
        console.error('Get me error:', error);
        return reply.status(500).send({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}
