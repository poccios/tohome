import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessTokenPayload;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const accessToken = request.cookies.access_token;

    if (!accessToken) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Access token not found',
      });
    }

    const payload = verifyAccessToken(accessToken);
    request.user = payload;
  } catch (error) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: error instanceof Error ? error.message : 'Invalid token',
    });
  }
}
