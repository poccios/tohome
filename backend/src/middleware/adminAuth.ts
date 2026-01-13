import { FastifyRequest, FastifyReply } from 'fastify';

export async function adminOnly(request: FastifyRequest, reply: FastifyReply) {
  const adminKey = request.headers['x-admin-key'];

  if (!adminKey) {
    return reply.status(401).send({
      ok: false,
      error: 'UNAUTHORIZED',
      message: 'Admin key required',
    });
  }

  const expectedKey = process.env.ADMIN_API_KEY;

  if (!expectedKey) {
    console.error('ADMIN_API_KEY not configured');
    return reply.status(500).send({
      ok: false,
      error: 'SERVER_ERROR',
      message: 'Admin authentication not configured',
    });
  }

  if (adminKey !== expectedKey) {
    return reply.status(401).send({
      ok: false,
      error: 'UNAUTHORIZED',
      message: 'Invalid admin key',
    });
  }

  // Admin authenticated successfully
}
