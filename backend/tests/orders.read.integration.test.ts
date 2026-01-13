import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';
import { resetDatabase, closeDatabasePool } from './helpers/db';
import { query } from '../src/db';
import jwt from 'jsonwebtoken';

describe('Orders Read API - Integration Tests', () => {
  let app: FastifyInstance;
  let restaurantId: string;
  let userId: string;
  let userToken: string;
  let user2Id: string;
  let user2Token: string;
  const adminApiKey = process.env.ADMIN_API_KEY || 'test-admin-key';

  beforeAll(async () => {
    app = await createTestApp();
    await app.ready();
  });

  beforeEach(async () => {
    await resetDatabase();

    // Create test users
    const userResult = await query(
      `INSERT INTO users (phone_e164, name, status)
       VALUES ('+393331234567', 'Test User', 'active')
       RETURNING id`
    );
    userId = userResult.rows[0].id;

    userToken = jwt.sign(
      { userId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    const user2Result = await query(
      `INSERT INTO users (phone_e164, name, status)
       VALUES ('+393337654321', 'User 2', 'active')
       RETURNING id`
    );
    user2Id = user2Result.rows[0].id;

    user2Token = jwt.sign(
      { userId: user2Id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

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

  describe('GET /orders/:orderId - Get single order', () => {
    it('should return order with items and options', async () => {
      // Create order
      const orderResult = await query(
        `INSERT INTO orders (user_id, restaurant_id, status, payment_method, payment_status, subtotal_cents, delivery_fee_cents, service_fee_cents, total_cents, address_json, notes)
         VALUES ($1, $2, 'ACCEPTED', 'CASH', 'PAID', 1600, 0, 0, 1600, $3, 'Test notes')
         RETURNING *`,
        [userId, restaurantId, JSON.stringify({ street: 'Via Roma 123', city: 'Roma', postal_code: '00100' })]
      );
      const orderId = orderResult.rows[0].id;

      // Create order item
      const itemResult = await query(
        `INSERT INTO order_items (order_id, product_id, name, unit_price_cents, qty, total_cents)
         VALUES ($1, NULL, 'Margherita', 800, 2, 1600)
         RETURNING *`,
        [orderId]
      );
      const itemId = itemResult.rows[0].id;

      // Create order item option
      await query(
        `INSERT INTO order_item_options (order_item_id, group_name, item_name, price_delta_cents)
         VALUES ($1, 'Dimensione', 'Normale', 0)`,
        [itemId]
      );

      // Get order
      const response = await request(app.server)
        .get(`/orders/${orderId}`)
        .set('Cookie', `access_token=${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(orderId);
      expect(response.body.data.user_id).toBe(userId);
      expect(response.body.data.restaurant_id).toBe(restaurantId);
      expect(response.body.data.status).toBe('ACCEPTED');
      expect(response.body.data.payment_method).toBe('CASH');
      expect(response.body.data.payment_status).toBe('PAID');
      expect(response.body.data.subtotal_cents).toBe(1600);
      expect(response.body.data.total_cents).toBe(1600);
      expect(response.body.data.notes).toBe('Test notes');
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].name).toBe('Margherita');
      expect(response.body.data.items[0].unit_price_cents).toBe(800);
      expect(response.body.data.items[0].qty).toBe(2);
      expect(response.body.data.items[0].total_cents).toBe(1600);
      expect(response.body.data.items[0].options).toHaveLength(1);
      expect(response.body.data.items[0].options[0].group_name).toBe('Dimensione');
      expect(response.body.data.items[0].options[0].item_name).toBe('Normale');
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app.server)
        .get('/orders/00000000-0000-0000-0000-000000000000');

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });

    it('should return 404 if order not found', async () => {
      const response = await request(app.server)
        .get('/orders/00000000-0000-0000-0000-000000000000')
        .set('Cookie', `access_token=${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('NOT_FOUND');
    });

    it('should return 404 if user does not own order', async () => {
      // Create order for user2
      const orderResult = await query(
        `INSERT INTO orders (user_id, restaurant_id, status, payment_method, payment_status, subtotal_cents, delivery_fee_cents, service_fee_cents, total_cents, address_json)
         VALUES ($1, $2, 'ACCEPTED', 'CASH', 'PAID', 1000, 0, 0, 1000, '{}')
         RETURNING id`,
        [user2Id, restaurantId]
      );
      const orderId = orderResult.rows[0].id;

      // Try to get with user1's token
      const response = await request(app.server)
        .get(`/orders/${orderId}`)
        .set('Cookie', `access_token=${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('NOT_FOUND');
    });
  });

  describe('GET /orders - List user orders', () => {
    it('should return user orders with pagination', async () => {
      // Create multiple orders
      for (let i = 0; i < 5; i++) {
        await query(
          `INSERT INTO orders (user_id, restaurant_id, status, payment_method, payment_status, subtotal_cents, delivery_fee_cents, service_fee_cents, total_cents, address_json)
           VALUES ($1, $2, 'ACCEPTED', 'CASH', 'PAID', ${1000 + i * 100}, 0, 0, ${1000 + i * 100}, '{}')`,
          [userId, restaurantId]
        );
      }

      const response = await request(app.server)
        .get('/orders')
        .set('Cookie', `access_token=${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data).toHaveLength(5);
      // Orders should be sorted by created_at DESC
      expect(response.body.data[0].subtotal_cents).toBe(1400); // Most recent
      expect(response.body.data[4].subtotal_cents).toBe(1000); // Oldest
    });

    it('should support limit and offset', async () => {
      // Create 10 orders
      for (let i = 0; i < 10; i++) {
        await query(
          `INSERT INTO orders (user_id, restaurant_id, status, payment_method, payment_status, subtotal_cents, delivery_fee_cents, service_fee_cents, total_cents, address_json)
           VALUES ($1, $2, 'ACCEPTED', 'CASH', 'PAID', ${1000 + i * 100}, 0, 0, ${1000 + i * 100}, '{}')`,
          [userId, restaurantId]
        );
      }

      // Get first 5
      const response1 = await request(app.server)
        .get('/orders?limit=5&offset=0')
        .set('Cookie', `access_token=${userToken}`);

      expect(response1.status).toBe(200);
      expect(response1.body.data).toHaveLength(5);

      // Get next 5
      const response2 = await request(app.server)
        .get('/orders?limit=5&offset=5')
        .set('Cookie', `access_token=${userToken}`);

      expect(response2.status).toBe(200);
      expect(response2.body.data).toHaveLength(5);
      // Check they're different
      expect(response2.body.data[0].id).not.toBe(response1.body.data[0].id);
    });

    it('should return empty array if user has no orders', async () => {
      const response = await request(app.server)
        .get('/orders')
        .set('Cookie', `access_token=${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should only return orders for authenticated user', async () => {
      // Create orders for both users
      await query(
        `INSERT INTO orders (user_id, restaurant_id, status, payment_method, payment_status, subtotal_cents, delivery_fee_cents, service_fee_cents, total_cents, address_json)
         VALUES ($1, $2, 'ACCEPTED', 'CASH', 'PAID', 1000, 0, 0, 1000, '{}')`,
        [userId, restaurantId]
      );
      await query(
        `INSERT INTO orders (user_id, restaurant_id, status, payment_method, payment_status, subtotal_cents, delivery_fee_cents, service_fee_cents, total_cents, address_json)
         VALUES ($1, $2, 'ACCEPTED', 'CASH', 'PAID', 2000, 0, 0, 2000, '{}')`,
        [user2Id, restaurantId]
      );

      // Get orders for user1
      const response = await request(app.server)
        .get('/orders')
        .set('Cookie', `access_token=${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].user_id).toBe(userId);
      expect(response.body.data[0].subtotal_cents).toBe(1000);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app.server).get('/orders');

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });
  });

  describe('PATCH /admin/orders/:orderId/status - Update order status', () => {
    it('should update order status with admin key', async () => {
      // Create order
      const orderResult = await query(
        `INSERT INTO orders (user_id, restaurant_id, status, payment_method, payment_status, subtotal_cents, delivery_fee_cents, service_fee_cents, total_cents, address_json)
         VALUES ($1, $2, 'ACCEPTED', 'CASH', 'PAID', 1000, 0, 0, 1000, '{}')
         RETURNING id`,
        [userId, restaurantId]
      );
      const orderId = orderResult.rows[0].id;

      const response = await request(app.server)
        .patch(`/admin/orders/${orderId}/status`)
        .set('x-admin-key', adminApiKey)
        .send({ status: 'PREPARING' });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.status).toBe('PREPARING');
    });

    it('should return 401 without admin key', async () => {
      const orderResult = await query(
        `INSERT INTO orders (user_id, restaurant_id, status, payment_method, payment_status, subtotal_cents, delivery_fee_cents, service_fee_cents, total_cents, address_json)
         VALUES ($1, $2, 'ACCEPTED', 'CASH', 'PAID', 1000, 0, 0, 1000, '{}')
         RETURNING id`,
        [userId, restaurantId]
      );
      const orderId = orderResult.rows[0].id;

      const response = await request(app.server)
        .patch(`/admin/orders/${orderId}/status`)
        .send({ status: 'PREPARING' });

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });

    it('should return 404 if order not found', async () => {
      const response = await request(app.server)
        .patch('/admin/orders/00000000-0000-0000-0000-000000000000/status')
        .set('x-admin-key', adminApiKey)
        .send({ status: 'PREPARING' });

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('NOT_FOUND');
    });

    it('should accept all valid status values', async () => {
      const validStatuses = [
        'CREATED',
        'PAID',
        'ACCEPTED',
        'PREPARING',
        'READY',
        'PICKED_UP',
        'DELIVERING',
        'DELIVERED',
        'CANCELLED',
      ];

      for (const status of validStatuses) {
        // Create order
        const orderResult = await query(
          `INSERT INTO orders (user_id, restaurant_id, status, payment_method, payment_status, subtotal_cents, delivery_fee_cents, service_fee_cents, total_cents, address_json)
           VALUES ($1, $2, 'ACCEPTED', 'CASH', 'PAID', 1000, 0, 0, 1000, '{}')
           RETURNING id`,
          [userId, restaurantId]
        );
        const orderId = orderResult.rows[0].id;

        const response = await request(app.server)
          .patch(`/admin/orders/${orderId}/status`)
          .set('x-admin-key', adminApiKey)
          .send({ status });

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe(status);
      }
    });

    it('should return 400 for invalid status', async () => {
      const orderResult = await query(
        `INSERT INTO orders (user_id, restaurant_id, status, payment_method, payment_status, subtotal_cents, delivery_fee_cents, service_fee_cents, total_cents, address_json)
         VALUES ($1, $2, 'ACCEPTED', 'CASH', 'PAID', 1000, 0, 0, 1000, '{}')
         RETURNING id`,
        [userId, restaurantId]
      );
      const orderId = orderResult.rows[0].id;

      const response = await request(app.server)
        .patch(`/admin/orders/${orderId}/status`)
        .set('x-admin-key', adminApiKey)
        .send({ status: 'INVALID_STATUS' });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });
});
