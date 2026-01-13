import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import * as ordersRepo from '../repos/ordersRepo';

// ============================================================================
// Validation Schemas
// ============================================================================

const cartItemOptionSchema = z.object({
  group_id: z.string().uuid(),
  item_id: z.string().uuid(),
});

const cartItemSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.number().int().min(1),
  options: z.array(cartItemOptionSchema).default([]),
});

const deliveryAddressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  postal_code: z.string().min(1),
  notes: z.string().optional(),
});

const createOrderSchema = z.object({
  restaurant_id: z.string().uuid(),
  payment_method: z.enum(['ONLINE', 'CASH']),
  delivery_address: deliveryAddressSchema,
  items: z.array(cartItemSchema).min(1),
  notes: z.string().optional(),
});

const orderIdParamsSchema = z.object({
  orderId: z.string().uuid(),
});

const listOrdersQuerySchema = z.object({
  limit: z.string().optional().default('20').transform(Number),
  offset: z.string().optional().default('0').transform(Number),
});

// ============================================================================
// Routes
// ============================================================================

export async function ordersRoutes(fastify: FastifyInstance) {
  // POST /orders - Create new order
  fastify.post(
    '/orders',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            ok: false,
            error: 'UNAUTHORIZED',
            message: 'User not authenticated',
          });
        }

        const bodyData = createOrderSchema.parse(request.body);

        const orderInput: ordersRepo.CreateOrderInput = {
          user_id: request.user.userId,
          restaurant_id: bodyData.restaurant_id,
          payment_method: bodyData.payment_method,
          delivery_address: bodyData.delivery_address,
          items: bodyData.items,
          notes: bodyData.notes,
        };

        const order = await ordersRepo.createOrder(orderInput);

        return reply.status(201).send({
          ok: true,
          data: order,
        });
      } catch (error) {
        console.error('Create order error:', error);

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          });
        }

        if (error instanceof Error) {
          // Handle specific business errors
          if (error.message === 'RESTAURANT_NOT_FOUND') {
            return reply.status(404).send({
              ok: false,
              error: 'RESTAURANT_NOT_FOUND',
              message: 'Restaurant not found',
            });
          }
          if (error.message === 'RESTAURANT_NOT_ACTIVE') {
            return reply.status(400).send({
              ok: false,
              error: 'RESTAURANT_NOT_ACTIVE',
              message: 'Restaurant is not currently accepting orders',
            });
          }
          if (error.message === 'RESTAURANT_CLOSED') {
            return reply.status(400).send({
              ok: false,
              error: 'RESTAURANT_CLOSED',
              message: 'Restaurant is currently closed',
            });
          }
          if (error.message === 'CART_EMPTY') {
            return reply.status(400).send({
              ok: false,
              error: 'CART_EMPTY',
              message: 'Cart cannot be empty',
            });
          }
          if (error.message.startsWith('PRODUCT_NOT_FOUND')) {
            return reply.status(404).send({
              ok: false,
              error: 'PRODUCT_NOT_FOUND',
              message: error.message,
            });
          }
          if (error.message.startsWith('PRODUCT_NOT_ACTIVE')) {
            return reply.status(400).send({
              ok: false,
              error: 'PRODUCT_NOT_ACTIVE',
              message: error.message,
            });
          }
          if (error.message.startsWith('OPTION_MIN_NOT_MET')) {
            return reply.status(400).send({
              ok: false,
              error: 'OPTION_MIN_NOT_MET',
              message: error.message,
            });
          }
          if (error.message.startsWith('OPTION_MAX_EXCEEDED')) {
            return reply.status(400).send({
              ok: false,
              error: 'OPTION_MAX_EXCEEDED',
              message: error.message,
            });
          }
          if (error.message.startsWith('MIN_ORDER_NOT_MET')) {
            return reply.status(400).send({
              ok: false,
              error: 'MIN_ORDER_NOT_MET',
              message: error.message,
            });
          }
          if (error.message.startsWith('OPTION_NOT_FOUND')) {
            return reply.status(404).send({
              ok: false,
              error: 'OPTION_NOT_FOUND',
              message: error.message,
            });
          }
          if (error.message.startsWith('OPTION_NOT_ACTIVE')) {
            return reply.status(400).send({
              ok: false,
              error: 'OPTION_NOT_ACTIVE',
              message: error.message,
            });
          }
        }

        return reply.status(500).send({
          ok: false,
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // GET /orders/:orderId - Get single order
  fastify.get(
    '/orders/:orderId',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            ok: false,
            error: 'UNAUTHORIZED',
            message: 'User not authenticated',
          });
        }

        const paramsData = orderIdParamsSchema.parse(request.params);

        // Get order with ownership check
        const order = await ordersRepo.getOrderById(
          paramsData.orderId,
          request.user.userId
        );

        if (!order) {
          return reply.status(404).send({
            ok: false,
            error: 'NOT_FOUND',
            message: 'Order not found',
          });
        }

        return reply.status(200).send({
          ok: true,
          data: order,
        });
      } catch (error) {
        console.error('Get order error:', error);

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          });
        }

        return reply.status(500).send({
          ok: false,
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // GET /orders - List user's orders
  fastify.get(
    '/orders',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            ok: false,
            error: 'UNAUTHORIZED',
            message: 'User not authenticated',
          });
        }

        const queryData = listOrdersQuerySchema.parse(request.query);

        const orders = await ordersRepo.listOrdersByUser(
          request.user.userId,
          queryData.limit,
          queryData.offset
        );

        return reply.status(200).send({
          ok: true,
          data: orders,
        });
      } catch (error) {
        console.error('List orders error:', error);

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          });
        }

        return reply.status(500).send({
          ok: false,
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // POST /orders/:orderId/pay - Mock payment endpoint
  fastify.post(
    '/orders/:orderId/pay',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            ok: false,
            error: 'UNAUTHORIZED',
            message: 'User not authenticated',
          });
        }

        const paramsData = orderIdParamsSchema.parse(request.params);

        // Get order with ownership check
        const order = await ordersRepo.getOrderById(
          paramsData.orderId,
          request.user.userId
        );

        if (!order) {
          return reply.status(404).send({
            ok: false,
            error: 'NOT_FOUND',
            message: 'Order not found',
          });
        }

        // Check if order is already paid
        if (order.payment_status === 'PAID') {
          return reply.status(400).send({
            ok: false,
            error: 'ALREADY_PAID',
            message: 'Order is already paid',
          });
        }

        // Check if payment method is ONLINE
        if (order.payment_method !== 'ONLINE') {
          return reply.status(400).send({
            ok: false,
            error: 'INVALID_PAYMENT_METHOD',
            message: 'Payment not required for CASH orders',
          });
        }

        // Mock payment - always successful
        // Update payment status and move to ACCEPTED
        const updatedOrder = await ordersRepo.updatePaymentStatus(
          paramsData.orderId,
          'PAID',
          'ACCEPTED'
        );

        return reply.status(200).send({
          ok: true,
          data: updatedOrder,
        });
      } catch (error) {
        console.error('Pay order error:', error);

        if (error instanceof z.ZodError) {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors,
          });
        }

        return reply.status(500).send({
          ok: false,
          error: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}
