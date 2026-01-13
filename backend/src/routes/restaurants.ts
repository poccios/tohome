import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as restaurantsRepo from '../repos/restaurantsRepo';
import * as menuRepo from '../repos/menuRepo';

// Validation schemas
const listRestaurantsQuerySchema = z.object({
  open_now: z.enum(['true', 'false']).optional(),
  zone: z.string().optional(),
});

const getRestaurantParamsSchema = z.object({
  slug: z.string(),
});

export async function registerRestaurantsRoutes(fastify: FastifyInstance) {
  /**
   * GET /restaurants
   * List all active restaurants with optional filters
   */
  fastify.get('/restaurants', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate query parameters
      const queryData = listRestaurantsQuerySchema.parse(request.query);

      // Parse filters
      const filters: { openNow?: boolean; zone?: string } = {};

      if (queryData.open_now) {
        filters.openNow = queryData.open_now === 'true';
      }

      if (queryData.zone) {
        filters.zone = queryData.zone;
      }

      // Fetch restaurants
      const restaurants = await restaurantsRepo.listRestaurants(filters);

      return reply.status(200).send({
        ok: true,
        data: restaurants,
      });
    } catch (error: any) {
      console.error('Error listing restaurants:', error);

      if (error.name === 'ZodError') {
        return reply.status(400).send({
          ok: false,
          error: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: error.errors,
        });
      }

      return reply.status(500).send({
        ok: false,
        error: 'SERVER_ERROR',
        message: 'Failed to list restaurants',
      });
    }
  });

  /**
   * GET /restaurants/:slug
   * Get a single restaurant by slug
   */
  fastify.get(
    '/restaurants/:slug',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Validate params
        const paramsData = getRestaurantParamsSchema.parse(request.params);

        // Fetch restaurant
        const restaurant = await restaurantsRepo.getRestaurantBySlug(
          paramsData.slug
        );

        if (!restaurant) {
          return reply.status(404).send({
            ok: false,
            error: 'NOT_FOUND',
            message: 'Restaurant not found',
          });
        }

        return reply.status(200).send({
          ok: true,
          data: restaurant,
        });
      } catch (error: any) {
        console.error('Error getting restaurant:', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid parameters',
            details: error.errors,
          });
        }

        return reply.status(500).send({
          ok: false,
          error: 'SERVER_ERROR',
          message: 'Failed to get restaurant',
        });
      }
    }
  );

  /**
   * GET /restaurants/:slug/menu
   * Get complete menu for a restaurant
   */
  fastify.get(
    '/restaurants/:slug/menu',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Validate params
        const paramsData = getRestaurantParamsSchema.parse(request.params);

        // Fetch menu
        const menu = await menuRepo.getMenuByRestaurantSlug(paramsData.slug);

        if (!menu) {
          return reply.status(404).send({
            ok: false,
            error: 'NOT_FOUND',
            message: 'Restaurant not found',
          });
        }

        return reply.status(200).send({
          ok: true,
          data: menu,
        });
      } catch (error: any) {
        console.error('Error getting menu:', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid parameters',
            details: error.errors,
          });
        }

        return reply.status(500).send({
          ok: false,
          error: 'SERVER_ERROR',
          message: 'Failed to get menu',
        });
      }
    }
  );
}
