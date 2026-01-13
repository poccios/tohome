import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { adminOnly } from '../../middleware/adminAuth';
import * as menuRepo from '../../repos/menuRepo';

// Validation schemas
const restaurantIdParamsSchema = z.object({
  restaurantId: z.string().uuid(),
});

const categoryIdParamsSchema = z.object({
  categoryId: z.string().uuid(),
});

const productIdParamsSchema = z.object({
  productId: z.string().uuid(),
});

const createCategorySchema = z.object({
  name: z.string().min(1),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});

const createProductSchema = z.object({
  category_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  image_url: z.string().url().optional(),
  base_price_cents: z.number().int().min(0),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
  allergens: z.string().optional(),
});

const updateProductSchema = z.object({
  category_id: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  image_url: z.string().url().optional(),
  base_price_cents: z.number().int().min(0).optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
  allergens: z.string().optional(),
});

const optionItemSchema = z.object({
  name: z.string().min(1),
  price_delta_cents: z.number().int(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

const optionGroupSchema = z.object({
  name: z.string().min(1),
  min_select: z.number().int().min(0),
  max_select: z.number().int().min(0),
  sort_order: z.number().int().optional(),
  items: z.array(optionItemSchema).min(1),
}).refine((data) => data.max_select >= data.min_select, {
  message: 'max_select must be >= min_select',
  path: ['max_select'],
});

const setProductOptionsSchema = z.object({
  groups: z.array(optionGroupSchema),
});

export async function registerAdminMenuRoutes(fastify: FastifyInstance) {
  // ===== Category Routes =====

  /**
   * POST /admin/restaurants/:restaurantId/categories
   * Create a new menu category
   */
  fastify.post(
    '/admin/restaurants/:restaurantId/categories',
    { preHandler: adminOnly },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const paramsData = restaurantIdParamsSchema.parse(request.params);
        const bodyData = createCategorySchema.parse(request.body);

        const category = await menuRepo.createCategory(
          paramsData.restaurantId,
          bodyData
        );

        return reply.status(201).send({
          ok: true,
          data: category,
        });
      } catch (error: any) {
        console.error('Error creating category:', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: error.errors,
          });
        }

        // Handle unique constraint violation
        if (error.code === '23505') {
          return reply.status(409).send({
            ok: false,
            error: 'CONFLICT',
            message: 'Category with this name already exists',
          });
        }

        // Handle foreign key violation (restaurant not found)
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
          message: 'Failed to create category',
        });
      }
    }
  );

  /**
   * PATCH /admin/categories/:categoryId
   * Update a menu category
   */
  fastify.patch(
    '/admin/categories/:categoryId',
    { preHandler: adminOnly },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const paramsData = categoryIdParamsSchema.parse(request.params);
        const bodyData = updateCategorySchema.parse(request.body);

        const category = await menuRepo.updateCategory(
          paramsData.categoryId,
          bodyData
        );

        if (!category) {
          return reply.status(404).send({
            ok: false,
            error: 'NOT_FOUND',
            message: 'Category not found',
          });
        }

        return reply.status(200).send({
          ok: true,
          data: category,
        });
      } catch (error: any) {
        console.error('Error updating category:', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: error.errors,
          });
        }

        // Handle unique constraint violation
        if (error.code === '23505') {
          return reply.status(409).send({
            ok: false,
            error: 'CONFLICT',
            message: 'Category with this name already exists',
          });
        }

        return reply.status(500).send({
          ok: false,
          error: 'SERVER_ERROR',
          message: 'Failed to update category',
        });
      }
    }
  );

  // ===== Product Routes =====

  /**
   * POST /admin/restaurants/:restaurantId/products
   * Create a new menu product
   */
  fastify.post(
    '/admin/restaurants/:restaurantId/products',
    { preHandler: adminOnly },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const paramsData = restaurantIdParamsSchema.parse(request.params);
        const bodyData = createProductSchema.parse(request.body);

        const product = await menuRepo.createProduct(
          paramsData.restaurantId,
          bodyData
        );

        return reply.status(201).send({
          ok: true,
          data: product,
        });
      } catch (error: any) {
        console.error('Error creating product:', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: error.errors,
          });
        }

        // Handle unique constraint violation
        if (error.code === '23505') {
          return reply.status(409).send({
            ok: false,
            error: 'CONFLICT',
            message: 'Product with this name already exists',
          });
        }

        // Handle foreign key violation
        if (error.code === '23503') {
          return reply.status(404).send({
            ok: false,
            error: 'NOT_FOUND',
            message: 'Restaurant or category not found',
          });
        }

        return reply.status(500).send({
          ok: false,
          error: 'SERVER_ERROR',
          message: 'Failed to create product',
        });
      }
    }
  );

  /**
   * PATCH /admin/products/:productId
   * Update a menu product
   */
  fastify.patch(
    '/admin/products/:productId',
    { preHandler: adminOnly },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const paramsData = productIdParamsSchema.parse(request.params);
        const bodyData = updateProductSchema.parse(request.body);

        const product = await menuRepo.updateProduct(
          paramsData.productId,
          bodyData
        );

        if (!product) {
          return reply.status(404).send({
            ok: false,
            error: 'NOT_FOUND',
            message: 'Product not found',
          });
        }

        return reply.status(200).send({
          ok: true,
          data: product,
        });
      } catch (error: any) {
        console.error('Error updating product:', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: error.errors,
          });
        }

        // Handle unique constraint violation
        if (error.code === '23505') {
          return reply.status(409).send({
            ok: false,
            error: 'CONFLICT',
            message: 'Product with this name already exists',
          });
        }

        // Handle foreign key violation (category not found)
        if (error.code === '23503') {
          return reply.status(404).send({
            ok: false,
            error: 'NOT_FOUND',
            message: 'Category not found',
          });
        }

        return reply.status(500).send({
          ok: false,
          error: 'SERVER_ERROR',
          message: 'Failed to update product',
        });
      }
    }
  );

  /**
   * DELETE /admin/products/:productId
   * Soft delete a menu product
   */
  fastify.delete(
    '/admin/products/:productId',
    { preHandler: adminOnly },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const paramsData = productIdParamsSchema.parse(request.params);

        await menuRepo.softDeleteProduct(paramsData.productId);

        return reply.status(200).send({
          ok: true,
          message: 'Product deleted successfully',
        });
      } catch (error: any) {
        console.error('Error deleting product:', error);

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
          message: 'Failed to delete product',
        });
      }
    }
  );

  // ===== Product Options Routes =====

  /**
   * PUT /admin/products/:productId/options
   * Replace all option groups and items for a product
   */
  fastify.put(
    '/admin/products/:productId/options',
    { preHandler: adminOnly },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const paramsData = productIdParamsSchema.parse(request.params);
        const bodyData = setProductOptionsSchema.parse(request.body);

        await menuRepo.setProductOptionGroups(
          paramsData.productId,
          bodyData.groups
        );

        return reply.status(200).send({
          ok: true,
          message: 'Product options updated successfully',
        });
      } catch (error: any) {
        console.error('Error setting product options:', error);

        if (error.name === 'ZodError') {
          return reply.status(400).send({
            ok: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: error.errors,
          });
        }

        // Handle product not found error
        if (error.message === 'Product not found') {
          return reply.status(404).send({
            ok: false,
            error: 'NOT_FOUND',
            message: 'Product not found',
          });
        }

        return reply.status(500).send({
          ok: false,
          error: 'SERVER_ERROR',
          message: 'Failed to update product options',
        });
      }
    }
  );
}
