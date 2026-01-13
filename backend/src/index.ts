import dotenv from 'dotenv';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { z } from 'zod';
import { authRoutes } from './routes/auth';
import { meRoutes } from './routes/me';
import { registerRestaurantsRoutes } from './routes/restaurants';
import { ordersRoutes } from './routes/orders';
import { registerAdminRestaurantsRoutes } from './routes/admin/restaurants';
import { registerAdminMenuRoutes } from './routes/admin/menu';
import { registerAdminOrdersRoutes } from './routes/admin/orders';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string(),
  SMS_PROVIDER: z.enum(['mock', 'skebby']).default('mock'),
  APP_PUBLIC_URL: z.string().default('http://localhost:3000'),
  SKEBBY_EMAIL: z.string().optional(),
  SKEBBY_PASSWORD: z.string().optional(),
  SKEBBY_BASE_URL: z.string().optional(),
  SKEBBY_MESSAGE_TYPE: z.enum(['GP', 'TI', 'SI']).optional(),
  SKEBBY_SENDER: z.string().optional(),
  ADMIN_API_KEY: z.string().min(32).optional(),
});

const env = envSchema.parse(process.env);

const server = Fastify({
  logger: true,
});

async function start() {
  try {
    await server.register(cors, {
      origin: env.FRONTEND_URL,
      credentials: true,
    });

    await server.register(cookie);

    // Register routes
    await server.register(authRoutes);
    await server.register(meRoutes);
    await server.register(registerRestaurantsRoutes);
    await server.register(ordersRoutes);
    await server.register(registerAdminRestaurantsRoutes);
    await server.register(registerAdminMenuRoutes);
    await server.register(registerAdminOrdersRoutes);

    server.get('/health', async (request, reply) => {
      return { ok: true };
    });

    const port = parseInt(env.PORT, 10);
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
