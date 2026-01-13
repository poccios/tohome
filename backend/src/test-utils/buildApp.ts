/**
 * Test utility to build Fastify app for testing
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { authRoutes } from '../routes/auth';
import { meRoutes } from '../routes/me';
import { registerRestaurantsRoutes } from '../routes/restaurants';
import { ordersRoutes } from '../routes/orders';
import { registerAdminRestaurantsRoutes } from '../routes/admin/restaurants';
import { registerAdminMenuRoutes } from '../routes/admin/menu';
import { registerAdminOrdersRoutes } from '../routes/admin/orders';

export async function buildApp() {
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
