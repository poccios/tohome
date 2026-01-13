import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';
import { resetDatabase, closeDatabasePool } from './helpers/db';
import { query } from '../src/db';

describe('Admin Menu API - Integration Tests', () => {
  let app: FastifyInstance;
  const adminKey = process.env.ADMIN_API_KEY || 'test-admin-key-min-32-chars-long';
  let restaurantId: string;

  beforeAll(async () => {
    if (!process.env.ADMIN_API_KEY) {
      process.env.ADMIN_API_KEY = adminKey;
    }

    app = await createTestApp();
    await app.ready();
  });

  beforeEach(async () => {
    await resetDatabase();

    // Create test restaurant
    const restaurantResult = await query(
      `INSERT INTO restaurants (slug, name, address, city, is_active)
       VALUES ('pizza-test', 'Pizza Test', 'Via Test 1', 'Roma', true)
       RETURNING id`
    );
    restaurantId = restaurantResult.rows[0].id;
  });

  afterAll(async () => {
    await app.close();
    await closeDatabasePool();
  });

  describe('POST /admin/restaurants/:restaurantId/categories - Create category', () => {
    it('should create category with admin key', async () => {
      const response = await request(app.server)
        .post(`/admin/restaurants/${restaurantId}/categories`)
        .set('x-admin-key', adminKey)
        .send({
          name: 'Pizze',
          sort_order: 0,
        });

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.name).toBe('Pizze');
      expect(response.body.data.sort_order).toBe(0);
      expect(response.body.data.is_active).toBe(true);

      // Verify in database
      const dbResult = await query(
        'SELECT * FROM menu_categories WHERE id = $1',
        [response.body.data.id]
      );
      expect(dbResult.rows.length).toBe(1);
    });

    it('should return 401 without admin key', async () => {
      const response = await request(app.server)
        .post(`/admin/restaurants/${restaurantId}/categories`)
        .send({ name: 'Pizze' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should return 401 with invalid admin key', async () => {
      const response = await request(app.server)
        .post(`/admin/restaurants/${restaurantId}/categories`)
        .set('x-admin-key', 'invalid-key')
        .send({ name: 'Pizze' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should return 409 for duplicate category name in same restaurant', async () => {
      // Create first category
      await query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order)
         VALUES ($1, 'Pizze', 0)`,
        [restaurantId]
      );

      // Try to create duplicate
      const response = await request(app.server)
        .post(`/admin/restaurants/${restaurantId}/categories`)
        .set('x-admin-key', adminKey)
        .send({ name: 'Pizze' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('CONFLICT');
    });

    it('should return 404 for non-existent restaurant', async () => {
      const response = await request(app.server)
        .post('/admin/restaurants/11111111-1111-1111-1111-111111111111/categories')
        .set('x-admin-key', adminKey)
        .send({ name: 'Pizze' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /admin/categories/:categoryId - Update category', () => {
    let categoryId: string;

    beforeEach(async () => {
      const result = await query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order)
         VALUES ($1, 'Pizze', 0) RETURNING id`,
        [restaurantId]
      );
      categoryId = result.rows[0].id;
    });

    it('should update category fields', async () => {
      const response = await request(app.server)
        .patch(`/admin/categories/${categoryId}`)
        .set('x-admin-key', adminKey)
        .send({
          name: 'Pizza Speciali',
          sort_order: 5,
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.name).toBe('Pizza Speciali');
      expect(response.body.data.sort_order).toBe(5);
    });

    it('should return 401 without admin key', async () => {
      const response = await request(app.server)
        .patch(`/admin/categories/${categoryId}`)
        .send({ name: 'Updated' });

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent category', async () => {
      const response = await request(app.server)
        .patch('/admin/categories/11111111-1111-1111-1111-111111111111')
        .set('x-admin-key', adminKey)
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /admin/restaurants/:restaurantId/products - Create product', () => {
    let categoryId: string;

    beforeEach(async () => {
      const result = await query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order)
         VALUES ($1, 'Pizze', 0) RETURNING id`,
        [restaurantId]
      );
      categoryId = result.rows[0].id;
    });

    it('should create product with admin key', async () => {
      const response = await request(app.server)
        .post(`/admin/restaurants/${restaurantId}/products`)
        .set('x-admin-key', adminKey)
        .send({
          category_id: categoryId,
          name: 'Margherita',
          description: 'Pomodoro e mozzarella',
          base_price_cents: 800,
          sort_order: 0,
          allergens: 'Glutine, Lattosio',
        });

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.name).toBe('Margherita');
      expect(response.body.data.base_price_cents).toBe(800);
      expect(response.body.data.allergens).toBe('Glutine, Lattosio');
      expect(response.body.data.is_active).toBe(true);
    });

    it('should return 401 without admin key', async () => {
      const response = await request(app.server)
        .post(`/admin/restaurants/${restaurantId}/products`)
        .send({
          category_id: categoryId,
          name: 'Margherita',
          base_price_cents: 800,
        });

      expect(response.status).toBe(401);
    });

    it('should return 409 for duplicate product name', async () => {
      await query(
        `INSERT INTO menu_products (restaurant_id, category_id, name, base_price_cents, sort_order)
         VALUES ($1, $2, 'Margherita', 800, 0)`,
        [restaurantId, categoryId]
      );

      const response = await request(app.server)
        .post(`/admin/restaurants/${restaurantId}/products`)
        .set('x-admin-key', adminKey)
        .send({
          category_id: categoryId,
          name: 'Margherita',
          base_price_cents: 800,
        });

      expect(response.status).toBe(409);
    });

    it('should return 400 for negative price', async () => {
      const response = await request(app.server)
        .post(`/admin/restaurants/${restaurantId}/products`)
        .set('x-admin-key', adminKey)
        .send({
          category_id: categoryId,
          name: 'Invalid Product',
          base_price_cents: -100,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent category', async () => {
      const response = await request(app.server)
        .post(`/admin/restaurants/${restaurantId}/products`)
        .set('x-admin-key', adminKey)
        .send({
          category_id: '11111111-1111-1111-1111-111111111111',
          name: 'Product',
          base_price_cents: 800,
        });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /admin/products/:productId - Update product', () => {
    let categoryId: string;
    let productId: string;

    beforeEach(async () => {
      const catResult = await query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order)
         VALUES ($1, 'Pizze', 0) RETURNING id`,
        [restaurantId]
      );
      categoryId = catResult.rows[0].id;

      const prodResult = await query(
        `INSERT INTO menu_products (restaurant_id, category_id, name, base_price_cents, sort_order)
         VALUES ($1, $2, 'Margherita', 800, 0) RETURNING id`,
        [restaurantId, categoryId]
      );
      productId = prodResult.rows[0].id;
    });

    it('should update product fields', async () => {
      const response = await request(app.server)
        .patch(`/admin/products/${productId}`)
        .set('x-admin-key', adminKey)
        .send({
          name: 'Margherita Speciale',
          base_price_cents: 950,
          description: 'Con bufala',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Margherita Speciale');
      expect(response.body.data.base_price_cents).toBe(950);
      expect(response.body.data.description).toBe('Con bufala');
    });

    it('should return 401 without admin key', async () => {
      const response = await request(app.server)
        .patch(`/admin/products/${productId}`)
        .send({ name: 'Updated' });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /admin/products/:productId - Soft delete product', () => {
    let categoryId: string;
    let productId: string;

    beforeEach(async () => {
      const catResult = await query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order)
         VALUES ($1, 'Pizze', 0) RETURNING id`,
        [restaurantId]
      );
      categoryId = catResult.rows[0].id;

      const prodResult = await query(
        `INSERT INTO menu_products (restaurant_id, category_id, name, base_price_cents, sort_order)
         VALUES ($1, $2, 'Margherita', 800, 0) RETURNING id`,
        [restaurantId, categoryId]
      );
      productId = prodResult.rows[0].id;
    });

    it('should soft delete product', async () => {
      const response = await request(app.server)
        .delete(`/admin/products/${productId}`)
        .set('x-admin-key', adminKey);

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);

      // Verify product is_active = false
      const dbResult = await query(
        'SELECT is_active FROM menu_products WHERE id = $1',
        [productId]
      );
      expect(dbResult.rows[0].is_active).toBe(false);
    });

    it('should not appear in public menu after soft delete', async () => {
      await request(app.server)
        .delete(`/admin/products/${productId}`)
        .set('x-admin-key', adminKey);

      const menuResponse = await request(app.server).get('/restaurants/pizza-test/menu');

      expect(menuResponse.status).toBe(200);
      expect(menuResponse.body.data.categories[0].products).toHaveLength(0);
    });

    it('should return 401 without admin key', async () => {
      const response = await request(app.server).delete(`/admin/products/${productId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /admin/products/:productId/options - Replace product options', () => {
    let categoryId: string;
    let productId: string;

    beforeEach(async () => {
      const catResult = await query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order)
         VALUES ($1, 'Pizze', 0) RETURNING id`,
        [restaurantId]
      );
      categoryId = catResult.rows[0].id;

      const prodResult = await query(
        `INSERT INTO menu_products (restaurant_id, category_id, name, base_price_cents, sort_order)
         VALUES ($1, $2, 'Margherita', 800, 0) RETURNING id`,
        [restaurantId, categoryId]
      );
      productId = prodResult.rows[0].id;
    });

    it('should create option groups and items', async () => {
      const response = await request(app.server)
        .put(`/admin/products/${productId}/options`)
        .set('x-admin-key', adminKey)
        .send({
          groups: [
            {
              name: 'Dimensione',
              min_select: 1,
              max_select: 1,
              sort_order: 0,
              items: [
                { name: 'Normale', price_delta_cents: 0, sort_order: 0 },
                { name: 'Maxi', price_delta_cents: 300, sort_order: 1 },
              ],
            },
            {
              name: 'Extra',
              min_select: 0,
              max_select: 3,
              sort_order: 1,
              items: [
                { name: 'Mozzarella extra', price_delta_cents: 150, sort_order: 0 },
                { name: 'Prosciutto', price_delta_cents: 200, sort_order: 1 },
              ],
            },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);

      // Verify in database
      const groupsResult = await query(
        'SELECT * FROM product_option_groups WHERE product_id = $1 ORDER BY sort_order',
        [productId]
      );
      expect(groupsResult.rows.length).toBe(2);
      expect(groupsResult.rows[0].name).toBe('Dimensione');
      expect(groupsResult.rows[1].name).toBe('Extra');

      const itemsResult = await query(
        'SELECT * FROM product_option_items WHERE group_id = $1 ORDER BY sort_order',
        [groupsResult.rows[0].id]
      );
      expect(itemsResult.rows.length).toBe(2);
      expect(itemsResult.rows[0].name).toBe('Normale');
      expect(itemsResult.rows[1].name).toBe('Maxi');
    });

    it('should replace existing options (delete old, insert new)', async () => {
      // First, create initial options
      const group1 = await query(
        `INSERT INTO product_option_groups (restaurant_id, product_id, name, min_select, max_select, sort_order)
         VALUES ($1, $2, 'Old Group', 1, 1, 0) RETURNING id`,
        [restaurantId, productId]
      );
      await query(
        `INSERT INTO product_option_items (restaurant_id, group_id, name, price_delta_cents, sort_order)
         VALUES ($1, $2, 'Old Item', 100, 0)`,
        [restaurantId, group1.rows[0].id]
      );

      // Replace with new options
      const response = await request(app.server)
        .put(`/admin/products/${productId}/options`)
        .set('x-admin-key', adminKey)
        .send({
          groups: [
            {
              name: 'New Group 1',
              min_select: 0,
              max_select: 2,
              items: [{ name: 'New Item 1', price_delta_cents: 200 }],
            },
            {
              name: 'New Group 2',
              min_select: 1,
              max_select: 1,
              items: [{ name: 'New Item 2', price_delta_cents: 300 }],
            },
          ],
        });

      expect(response.status).toBe(200);

      // Verify old groups are gone
      const oldGroupsResult = await query(
        'SELECT * FROM product_option_groups WHERE product_id = $1',
        [productId]
      );
      expect(oldGroupsResult.rows.length).toBe(2);
      expect(oldGroupsResult.rows[0].name).toBe('New Group 1');
      expect(oldGroupsResult.rows[1].name).toBe('New Group 2');

      // Verify old items are gone
      const oldItemsResult = await query(
        'SELECT * FROM product_option_items WHERE restaurant_id = $1',
        [restaurantId]
      );
      expect(oldItemsResult.rows.length).toBe(2);
      expect(oldItemsResult.rows[0].name).toBe('New Item 1');
      expect(oldItemsResult.rows[1].name).toBe('New Item 2');
    });

    it('should return 401 without admin key', async () => {
      const response = await request(app.server)
        .put(`/admin/products/${productId}/options`)
        .send({ groups: [] });

      expect(response.status).toBe(401);
    });

    it('should return 404 for non-existent product', async () => {
      const response = await request(app.server)
        .put('/admin/products/11111111-1111-1111-1111-111111111111/options')
        .set('x-admin-key', adminKey)
        .send({ groups: [] });

      expect(response.status).toBe(404);
    });

    it('should return 400 if max_select < min_select', async () => {
      const response = await request(app.server)
        .put(`/admin/products/${productId}/options`)
        .set('x-admin-key', adminKey)
        .send({
          groups: [
            {
              name: 'Invalid',
              min_select: 2,
              max_select: 1, // Invalid: max < min
              items: [{ name: 'Item', price_delta_cents: 0 }],
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should allow negative price_delta_cents (discounts)', async () => {
      const response = await request(app.server)
        .put(`/admin/products/${productId}/options`)
        .set('x-admin-key', adminKey)
        .send({
          groups: [
            {
              name: 'Sconti',
              min_select: 0,
              max_select: 1,
              items: [{ name: 'Sconto studenti', price_delta_cents: -100 }],
            },
          ],
        });

      expect(response.status).toBe(200);

      const itemsResult = await query(
        `SELECT * FROM product_option_items WHERE restaurant_id = $1`,
        [restaurantId]
      );
      expect(itemsResult.rows[0].price_delta_cents).toBe(-100);
    });
  });
});
