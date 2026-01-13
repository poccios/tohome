import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { adminOnly } from '../../middleware/adminAuth';
import * as ordersRepo from '../../repos/ordersRepo';

// ============================================================================
// Validation Schemas
// ============================================================================

const orderIdParamsSchema = z.object({
  orderId: z.string().uuid(),
});

const updateOrderStatusSchema = z.object({
  status: z.enum([
    'CREATED',
    'PAID',
    'ACCEPTED',
    'PREPARING',
    'READY',
    'PICKED_UP',
    'DELIVERING',
    'DELIVERED',
    'CANCELLED',
  ]),
});

// ============================================================================
// Routes
// ============================================================================

export async function registerAdminOrdersRoutes(fastify: FastifyInstance) {
  /**
   * PATCH /admin/orders/:orderId/status
   * Update order status (admin only)
   */
  fastify.patch(
    '/admin/orders/:orderId/status',
    { preHandler: adminOnly },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const paramsData = orderIdParamsSchema.parse(request.params);
        const bodyData = updateOrderStatusSchema.parse(request.body);

        // Get the order first to check if it exists
        const existingOrder = await ordersRepo.getOrderById(paramsData.orderId);

        if (!existingOrder) {
          return reply.status(404).send({
            ok: false,
            error: 'NOT_FOUND',
            message: 'Order not found',
          });
        }

        // Update the status
        const updatedOrder = await ordersRepo.updateOrderStatus(
          paramsData.orderId,
          bodyData.status
        );

        return reply.status(200).send({
          ok: true,
          data: updatedOrder,
        });
      } catch (error: any) {
        console.error('Error updating order status:', error);

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
          message: error.message || 'Unknown error',
        });
      }
    }
  );
}
