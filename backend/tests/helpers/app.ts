import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { authRoutes } from '../../src/routes/auth';
import { meRoutes } from '../../src/routes/me';
import { registerRestaurantsRoutes } from '../../src/routes/restaurants';
import { ordersRoutes } from '../../src/routes/orders';
import { registerAdminRestaurantsRoutes } from '../../src/routes/admin/restaurants';
import { registerAdminMenuRoutes } from '../../src/routes/admin/menu';
import { registerAdminOrdersRoutes } from '../../src/routes/admin/orders';

export async function createTestApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Disable logging in tests
  });

  await app.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  await app.register(cookie);

  // Register routes
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(registerRestaurantsRoutes);
  await app.register(ordersRoutes);
  await app.register(registerAdminRestaurantsRoutes);
  await app.register(registerAdminMenuRoutes);
  await app.register(registerAdminOrdersRoutes);

  app.get('/health', async (request, reply) => {
    return { ok: true };
  });

  return app;
}
