import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { adminOnly } from '../../middleware/adminAuth';
import * as restaurantsRepo from '../../repos/restaurantsRepo';
import { query } from '../../db';

// Validation schemas
const createRestaurantSchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().min(1),
  city: z.string().min(1),
  zone: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  is_active: z.boolean().optional(),
  force_closed: z.boolean().optional(),
  force_closed_note: z.string().optional(),
});

const updateRestaurantSchema = z.object({
  slug: z.string().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  zone: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  is_active: z.boolean().optional(),
  force_closed: z.boolean().optional(),
  force_closed_note: z.string().nullable().optional(),
});

const restaurantIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const setHoursSchema = z.object({
  hours: z.array(
    z.object({
      day_of_week: z.number().int().min(0).max(6),
      open_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      close_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      is_closed: z.boolean().optional(),
    })
  ),
});

const upsertDeliveryRulesSchema = z.object({
  min_order_cents: z.number().int().min(0).optional(),
  delivery_fee_cents: z.number().int().min(0).optional(),
  eta_min: z.number().int().min(1).optional(),
  eta_max: z.number().int().min(1).optional(),
});

const overrideDateParamsSchema = z.object({
  id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
});

const upsertOverrideSchema = z.object({
  is_closed: z.boolean(),
  open_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(), // HH:MM
  close_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(), // HH:MM
  note: z.string().nullable().optional(),
});

const getOverridesQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
});

export async function registerAdminRestaurantsRoutes(fastify: FastifyInstance) {
  /**
   * POST /admin/restaurants
   * Create a new restaurant
   */
  fastify.post(
    '/admin/restaurants',
    { preHandler: adminOnly },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Validate body
        const bodyData = createRestaurantSchema.parse(request.body);

        // Create restaurant
        const restaurant = await restaurantsRepo.createRestaurant(bodyData);

        return reply.status(201).send({
          ok: true,
          data: restaurant,
        });
      } catch (error: any) {
        console.error('Error creating restaurant:', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors,
          });
        }

        // Handle unique constraint violation
        if (error.code === '23505' && error.constraint === 'restaurants_slug_key') {
          return reply.status(409).send({
            ok: false,
            error: 'CONFLICT',
            message: 'Restaurant with this slug already exists',
          });
        }

        return reply.status(500).send({
          ok: false,
          error: 'SERVER_ERROR',
          message: 'Failed to create restaurant',
        });
      }
    }
  );

  /**
   * GET /admin/restaurants/:id
   * Get a single restaurant by ID with all details
   */
  fastify.get(
    '/admin/restaurants/:id',
    { preHandler: adminOnly },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Validate params
        const paramsData = restaurantIdParamsSchema.parse(request.params);

        // Get restaurant by ID
        const result = await query(
          `SELECT r.*,
                  json_agg(
                    json_build_object(
                      'day_of_week', rh.day_of_week,
                      'open_time', rh.open_time,
                      'close_time', rh.close_time,
                      'is_closed', rh.is_closed
                    ) ORDER BY rh.day_of_week, rh.open_time
                  ) FILTER (WHERE rh.id IS NOT NULL) as hours,
                  json_build_object(
                    'id', rdr.id,
                    'restaurant_id', rdr.restaurant_id,
                    'min_order_cents', rdr.min_order_cents,
                    'delivery_fee_cents', rdr.delivery_fee_cents,
                    'eta_min', rdr.eta_min,
                    'eta_max', rdr.eta_max
                  ) as delivery_rules
           FROM restaurants r
           LEFT JOIN restaurant_hours rh ON r.id = rh.restaurant_id
           LEFT JOIN restaurant_delivery_rules rdr ON r.id = rdr.restaurant_id
           WHERE r.id = $1
           GROUP BY r.id, rdr.id, rdr.restaurant_id, rdr.min_order_cents, rdr.delivery_fee_cents, rdr.eta_min, rdr.eta_max`,
          [paramsData.id]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({
            ok: false,
            error: 'NOT_FOUND',
            message: 'Restaurant not found',
          });
        }

        return reply.status(200).send({
          ok: true,
          data: result.rows[0],
        });
      } catch (error: any) {
        console.error('Error getting restaurant:', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request',
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
   * PATCH /admin/restaurants/:id
   * Update a restaurant (partial update)
   */
  fastify.patch(
    '/admin/restaurants/:id',
    { preHandler: adminOnly },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Validate params
        const paramsData = restaurantIdParamsSchema.parse(request.params);

        // Validate body
        const bodyData = updateRestaurantSchema.parse(request.body);

        // Update restaurant
        const restaurant = await restaurantsRepo.updateRestaurant(
          paramsData.id,
          bodyData
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
        console.error('Error updating restaurant:', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: error.errors,
          });
        }

        // Handle unique constraint violation
        if (error.code === '23505' && error.constraint === 'restaurants_slug_key') {
          return reply.status(409).send({
            ok: false,
            error: 'CONFLICT',
            message: 'Restaurant with this slug already exists',
          });
        }

        return reply.status(500).send({
          ok: false,
          error: 'SERVER_ERROR',
          message: 'Failed to update restaurant',
        });
      }
    }
  );

  /**
   * PUT /admin/restaurants/:id/hours
   * Replace all hours for a restaurant
   */
  fastify.put(
    '/admin/restaurants/:id/hours',
    { preHandler: adminOnly },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Validate params
        const paramsData = restaurantIdParamsSchema.parse(request.params);

        // Validate body
        const bodyData = setHoursSchema.parse(request.body);

        // Normalize time format (ensure HH:MM:SS)
        const normalizedHours = bodyData.hours.map((hour) => ({
          ...hour,
          open_time: hour.open_time.length === 5 ? `${hour.open_time}:00` : hour.open_time,
          close_time: hour.close_time.length === 5 ? `${hour.close_time}:00` : hour.close_time,
        }));

        // Set hours
        await restaurantsRepo.setRestaurantHours(paramsData.id, normalizedHours);

        return reply.status(200).send({
          ok: true,
          message: 'Hours updated successfully',
        });
      } catch (error: any) {
        console.error('Error setting restaurant hours:', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: error.errors,
          });
        }

        // Handle restaurant not found error
        if (error.message === 'Restaurant not found') {
          return reply.status(404).send({
            ok: false,
            error: 'NOT_FOUND',
            message: 'Restaurant not found',
          });
        }

        // Handle foreign key violation
        if (error.code === '23503') {
          return reply.status(404).send({
            ok: false,
            error: 'NOT_FOUND',
            message: 'Restaurant not found',
          });
        }

        return reply.status(500).send({
          ok: false,
          error: 'SERVER_ERROR',
          message: 'Failed to set restaurant hours',
        });
      }
    }
  );

  /**
   * PUT /admin/restaurants/:id/delivery-rules
   * Upsert delivery rules for a restaurant
   */
  fastify.put(
    '/admin/restaurants/:id/delivery-rules',
    { preHandler: adminOnly },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Validate params
        const paramsData = restaurantIdParamsSchema.parse(request.params);

        // Validate body
        const bodyData = upsertDeliveryRulesSchema.parse(request.body);

        // Upsert delivery rules
        const rules = await restaurantsRepo.upsertDeliveryRules(
          paramsData.id,
          bodyData
        );

        return reply.status(200).send({
          ok: true,
          data: rules,
        });
      } catch (error: any) {
        console.error('Error upserting delivery rules:', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: error.errors,
          });
        }

        // Handle foreign key violation
        if (error.code === '23503') {
          return reply.status(404).send({
            ok: false,
            error: 'NOT_FOUND',
            message: 'Restaurant not found',
          });
        }

        return reply.status(500).send({
          ok: false,
          error: 'SERVER_ERROR',
          message: 'Failed to upsert delivery rules',
        });
      }
    }
  );

  /**
   * PUT /admin/restaurants/:id/override/:date
   * Upsert an override for a specific date
   */
  fastify.put(
    '/admin/restaurants/:id/override/:date',
    { preHandler: adminOnly },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Validate params
        const paramsData = overrideDateParamsSchema.parse(request.params);

        // Validate body
        const bodyData = upsertOverrideSchema.parse(request.body);

        // Upsert override
        const override = await restaurantsRepo.upsertRestaurantOverride(
          paramsData.id,
          paramsData.date,
          bodyData
        );

        return reply.status(200).send({
          ok: true,
          data: override,
        });
      } catch (error: any) {
        console.error('Error upserting restaurant override:', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: error.errors,
          });
        }

        // Handle foreign key violation
        if (error.code === '23503') {
          return reply.status(404).send({
            ok: false,
            error: 'NOT_FOUND',
            message: 'Restaurant not found',
          });
        }

        return reply.status(500).send({
          ok: false,
          error: 'SERVER_ERROR',
          message: 'Failed to upsert override',
        });
      }
    }
  );

  /**
   * DELETE /admin/restaurants/:id/override/:date
   * Delete an override for a specific date
   */
  fastify.delete(
    '/admin/restaurants/:id/override/:date',
    { preHandler: adminOnly },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Validate params
        const paramsData = overrideDateParamsSchema.parse(request.params);

        // Delete override
        const deleted = await restaurantsRepo.deleteRestaurantOverride(
          paramsData.id,
          paramsData.date
        );

        if (!deleted) {
          return reply.status(404).send({
            ok: false,
            error: 'NOT_FOUND',
            message: 'Override not found',
          });
        }

        return reply.status(200).send({
          ok: true,
          message: 'Override deleted successfully',
        });
      } catch (error: any) {
        console.error('Error deleting restaurant override:', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: error.errors,
          });
        }

        return reply.status(500).send({
          ok: false,
          error: 'SERVER_ERROR',
          message: 'Failed to delete override',
        });
      }
    }
  );

  /**
   * GET /admin/restaurants/:id/overrides
   * Get overrides for a restaurant within a date range
   */
  fastify.get(
    '/admin/restaurants/:id/overrides',
    { preHandler: adminOnly },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Validate params
        const paramsData = restaurantIdParamsSchema.parse(request.params);

        // Validate query
        const queryData = getOverridesQuerySchema.parse(request.query);

        // Get overrides
        const overrides = await restaurantsRepo.getRestaurantOverrides(
          paramsData.id,
          queryData.from,
          queryData.to
        );

        return reply.status(200).send({
          ok: true,
          data: overrides,
        });
      } catch (error: any) {
        console.error('Error getting restaurant overrides:', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: error.errors,
          });
        }

        return reply.status(500).send({
          ok: false,
          error: 'SERVER_ERROR',
          message: 'Failed to get overrides',
        });
      }
    }
  );
}
