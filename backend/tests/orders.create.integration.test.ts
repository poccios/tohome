import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';
import { resetDatabase, closeDatabasePool } from './helpers/db';
import { query } from '../src/db';
import jwt from 'jsonwebtoken';

describe('Orders Create API - Integration Tests', () => {
  let app: FastifyInstance;
  let restaurantId: string;
  let userId: string;
  let userToken: string;
  let categoryId: string;
  let productId: string;
  let optionGroupId: string;
  let optionItem1Id: string;
  let optionItem2Id: string;

  beforeAll(async () => {
    app = await createTestApp();
    await app.ready();
  });

  beforeEach(async () => {
    await resetDatabase();

    // Create test user
    const userResult = await query(
      `INSERT INTO users (phone_e164, name, status)
       VALUES ('+393331234567', 'Test User', 'active')
       RETURNING id`
    );
    userId = userResult.rows[0].id;

    // Generate JWT token
    userToken = jwt.sign(
      { userId },
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

    // Create delivery rules with min order
    await query(
      `INSERT INTO restaurant_delivery_rules (restaurant_id, min_order_cents, delivery_fee_cents)
       VALUES ($1, 1000, 0)`,
      [restaurantId]
    );

    // Create restaurant hours (open now for testing)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    await query(
      `INSERT INTO restaurant_hours (restaurant_id, day_of_week, open_time, close_time)
       VALUES ($1, $2, '08:00', '23:00')`,
      [restaurantId, dayOfWeek]
    );

    // Create menu category
    const categoryResult = await query(
      `INSERT INTO menu_categories (restaurant_id, name, sort_order, is_active)
       VALUES ($1, 'Pizze', 0, true) RETURNING id`,
      [restaurantId]
    );
    categoryId = categoryResult.rows[0].id;

    // Create menu product
    const productResult = await query(
      `INSERT INTO menu_products (restaurant_id, category_id, name, description, base_price_cents, sort_order, is_active)
       VALUES ($1, $2, 'Margherita', 'Pomodoro e mozzarella', 800, 0, true) RETURNING id`,
      [restaurantId, categoryId]
    );
    productId = productResult.rows[0].id;

    // Create option group
    const groupResult = await query(
      `INSERT INTO product_option_groups (restaurant_id, product_id, name, min_select, max_select, sort_order)
       VALUES ($1, $2, 'Dimensione', 1, 1, 0) RETURNING id`,
      [restaurantId, productId]
    );
    optionGroupId = groupResult.rows[0].id;

    // Create option items
    const item1Result = await query(
      `INSERT INTO product_option_items (restaurant_id, group_id, name, price_delta_cents, is_active, sort_order)
       VALUES ($1, $2, 'Normale', 0, true, 0) RETURNING id`,
      [restaurantId, optionGroupId]
    );
    optionItem1Id = item1Result.rows[0].id;

    const item2Result = await query(
      `INSERT INTO product_option_items (restaurant_id, group_id, name, price_delta_cents, is_active, sort_order)
       VALUES ($1, $2, 'Maxi', 300, true, 1) RETURNING id`,
      [restaurantId, optionGroupId]
    );
    optionItem2Id = item2Result.rows[0].id;
  });

  afterAll(async () => {
    await app.close();
    await closeDatabasePool();
  });

  describe('POST /orders - Create order', () => {
    it('should create order with CASH payment (auto-accept)', async () => {
      const response = await request(app.server)
        .post('/orders')
        .set('Cookie', `access_token=${userToken}`)
        .send({
          restaurant_id: restaurantId,
          payment_method: 'CASH',
          delivery_address: {
            street: 'Via Roma 123',
            city: 'Roma',
            postal_code: '00100',
            notes: 'Citofono: Rossi',
          },
          items: [
            {
              product_id: productId,
              qty: 2,
              options: [{ group_id: optionGroupId, item_id: optionItem1Id }],
            },
          ],
          notes: 'Nessun aglio',
        });

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.status).toBe('ACCEPTED'); // Auto-accept for CASH
      expect(response.body.data.payment_status).toBe('PAID'); // Auto-paid for CASH
      expect(response.body.data.payment_method).toBe('CASH');
      expect(response.body.data.subtotal_cents).toBe(1600); // 2 * 800
      expect(response.body.data.total_cents).toBe(1600);
      expect(response.body.data.user_id).toBe(userId);
      expect(response.body.data.restaurant_id).toBe(restaurantId);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].name).toBe('Margherita'); // Snapshot
      expect(response.body.data.items[0].unit_price_cents).toBe(800);
      expect(response.body.data.items[0].qty).toBe(2);
      expect(response.body.data.items[0].total_cents).toBe(1600);
      expect(response.body.data.items[0].options).toHaveLength(1);
      expect(response.body.data.items[0].options[0].group_name).toBe('Dimensione');
      expect(response.body.data.items[0].options[0].item_name).toBe('Normale');
      expect(response.body.data.items[0].options[0].price_delta_cents).toBe(0);
    });

    it('should create order with ONLINE payment (status=CREATED)', async () => {
      const response = await request(app.server)
        .post('/orders')
        .set('Cookie', `access_token=${userToken}`)
        .send({
          restaurant_id: restaurantId,
          payment_method: 'ONLINE',
          delivery_address: {
            street: 'Via Roma 123',
            city: 'Roma',
            postal_code: '00100',
          },
          items: [
            {
              product_id: productId,
              qty: 1,
              options: [{ group_id: optionGroupId, item_id: optionItem2Id }],
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.status).toBe('CREATED'); // Not auto-accepted
      expect(response.body.data.payment_status).toBe('PENDING');
      expect(response.body.data.payment_method).toBe('ONLINE');
      expect(response.body.data.subtotal_cents).toBe(1100); // 800 + 300
      expect(response.body.data.items[0].unit_price_cents).toBe(1100); // With option
      expect(response.body.data.items[0].options[0].item_name).toBe('Maxi');
      expect(response.body.data.items[0].options[0].price_delta_cents).toBe(300);
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app.server)
        .post('/orders')
        .send({
          restaurant_id: restaurantId,
          payment_method: 'CASH',
          delivery_address: {
            street: 'Via Roma 123',
            city: 'Roma',
            postal_code: '00100',
          },
          items: [
            {
              product_id: productId,
              qty: 1,
              options: [{ group_id: optionGroupId, item_id: optionItem1Id }],
            },
          ],
        });

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
    });

    it('should return 404 if restaurant not found', async () => {
      const response = await request(app.server)
        .post('/orders')
        .set('Cookie', `access_token=${userToken}`)
        .send({
          restaurant_id: '00000000-0000-0000-0000-000000000000',
          payment_method: 'CASH',
          delivery_address: {
            street: 'Via Roma 123',
            city: 'Roma',
            postal_code: '00100',
          },
          items: [
            {
              product_id: productId,
              qty: 1,
              options: [{ group_id: optionGroupId, item_id: optionItem1Id }],
            },
          ],
        });

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('RESTAURANT_NOT_FOUND');
    });

    it('should return 400 if restaurant is not active', async () => {
      await query('UPDATE restaurants SET is_active = false WHERE id = $1', [restaurantId]);

      const response = await request(app.server)
        .post('/orders')
        .set('Cookie', `access_token=${userToken}`)
        .send({
          restaurant_id: restaurantId,
          payment_method: 'CASH',
          delivery_address: {
            street: 'Via Roma 123',
            city: 'Roma',
            postal_code: '00100',
          },
          items: [
            {
              product_id: productId,
              qty: 1,
              options: [{ group_id: optionGroupId, item_id: optionItem1Id }],
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('RESTAURANT_NOT_ACTIVE');
    });

    it('should return 400 if restaurant is closed', async () => {
      // Delete all restaurant hours to make it closed
      await query('DELETE FROM restaurant_hours WHERE restaurant_id = $1', [restaurantId]);

      const response = await request(app.server)
        .post('/orders')
        .set('Cookie', `access_token=${userToken}`)
        .send({
          restaurant_id: restaurantId,
          payment_method: 'CASH',
          delivery_address: {
            street: 'Via Roma 123',
            city: 'Roma',
            postal_code: '00100',
          },
          items: [
            {
              product_id: productId,
              qty: 1,
              options: [{ group_id: optionGroupId, item_id: optionItem1Id }],
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('RESTAURANT_CLOSED');
    });

    it('should return 400 if cart is empty', async () => {
      const response = await request(app.server)
        .post('/orders')
        .set('Cookie', `access_token=${userToken}`)
        .send({
          restaurant_id: restaurantId,
          payment_method: 'CASH',
          delivery_address: {
            street: 'Via Roma 123',
            city: 'Roma',
            postal_code: '00100',
          },
          items: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('CART_EMPTY');
    });

    it('should return 400 if product is not active', async () => {
      await query('UPDATE menu_products SET is_active = false WHERE id = $1', [productId]);

      const response = await request(app.server)
        .post('/orders')
        .set('Cookie', `access_token=${userToken}`)
        .send({
          restaurant_id: restaurantId,
          payment_method: 'CASH',
          delivery_address: {
            street: 'Via Roma 123',
            city: 'Roma',
            postal_code: '00100',
          },
          items: [
            {
              product_id: productId,
              qty: 1,
              options: [{ group_id: optionGroupId, item_id: optionItem1Id }],
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('PRODUCT_NOT_ACTIVE');
    });

    it('should return 400 if min order amount not met', async () => {
      // Restaurant has min_order_cents = 1000
      // Create a cheaper product
      const cheapProduct = await query(
        `INSERT INTO menu_products (restaurant_id, category_id, name, base_price_cents, sort_order, is_active)
         VALUES ($1, $2, 'Cheap Pizza', 500, 1, true) RETURNING id`,
        [restaurantId, categoryId]
      );

      const response = await request(app.server)
        .post('/orders')
        .set('Cookie', `access_token=${userToken}`)
        .send({
          restaurant_id: restaurantId,
          payment_method: 'CASH',
          delivery_address: {
            street: 'Via Roma 123',
            city: 'Roma',
            postal_code: '00100',
          },
          items: [
            {
              product_id: cheapProduct.rows[0].id,
              qty: 1,
              options: [],
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('MIN_ORDER_NOT_MET');
    });

    it('should return 400 if option min_select not met', async () => {
      const response = await request(app.server)
        .post('/orders')
        .set('Cookie', `access_token=${userToken}`)
        .send({
          restaurant_id: restaurantId,
          payment_method: 'CASH',
          delivery_address: {
            street: 'Via Roma 123',
            city: 'Roma',
            postal_code: '00100',
          },
          items: [
            {
              product_id: productId,
              qty: 2,
              options: [], // Missing required selection
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('OPTION_MIN_NOT_MET');
    });

    it('should return 400 if option max_select exceeded', async () => {
      const response = await request(app.server)
        .post('/orders')
        .set('Cookie', `access_token=${userToken}`)
        .send({
          restaurant_id: restaurantId,
          payment_method: 'CASH',
          delivery_address: {
            street: 'Via Roma 123',
            city: 'Roma',
            postal_code: '00100',
          },
          items: [
            {
              product_id: productId,
              qty: 1,
              options: [
                { group_id: optionGroupId, item_id: optionItem1Id },
                { group_id: optionGroupId, item_id: optionItem2Id }, // Too many
              ],
            },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('OPTION_MAX_EXCEEDED');
    });

    it('should preserve price snapshots even if menu changes', async () => {
      // Create order
      const response = await request(app.server)
        .post('/orders')
        .set('Cookie', `access_token=${userToken}`)
        .send({
          restaurant_id: restaurantId,
          payment_method: 'CASH',
          delivery_address: {
            street: 'Via Roma 123',
            city: 'Roma',
            postal_code: '00100',
          },
          items: [
            {
              product_id: productId,
              qty: 1,
              options: [{ group_id: optionGroupId, item_id: optionItem1Id }],
            },
          ],
        });

      expect(response.status).toBe(201);
      const orderId = response.body.data.id;
      const originalPrice = response.body.data.items[0].unit_price_cents;

      // Change product price
      await query('UPDATE menu_products SET base_price_cents = 1500 WHERE id = $1', [productId]);

      // Retrieve order again
      const getResponse = await request(app.server)
        .get(`/orders/${orderId}`)
        .set('Cookie', `access_token=${userToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.data.items[0].unit_price_cents).toBe(originalPrice); // Snapshot preserved
    });
  });

  describe('POST /orders/:orderId/pay - Mock payment', () => {
    it('should successfully pay for ONLINE order', async () => {
      // Create ONLINE order
      const createResponse = await request(app.server)
        .post('/orders')
        .set('Cookie', `access_token=${userToken}`)
        .send({
          restaurant_id: restaurantId,
          payment_method: 'ONLINE',
          delivery_address: {
            street: 'Via Roma 123',
            city: 'Roma',
            postal_code: '00100',
          },
          items: [
            {
              product_id: productId,
              qty: 1,
              options: [{ group_id: optionGroupId, item_id: optionItem1Id }],
            },
          ],
        });

      const orderId = createResponse.body.data.id;

      // Pay for order
      const payResponse = await request(app.server)
        .post(`/orders/${orderId}/pay`)
        .set('Cookie', `access_token=${userToken}`);

      expect(payResponse.status).toBe(200);
      expect(payResponse.body.ok).toBe(true);
      expect(payResponse.body.data.payment_status).toBe('PAID');
      expect(payResponse.body.data.status).toBe('ACCEPTED'); // Auto-accept after payment
    });

    it('should return 400 if order is already paid', async () => {
      // Create CASH order (auto-paid)
      const createResponse = await request(app.server)
        .post('/orders')
        .set('Cookie', `access_token=${userToken}`)
        .send({
          restaurant_id: restaurantId,
          payment_method: 'CASH',
          delivery_address: {
            street: 'Via Roma 123',
            city: 'Roma',
            postal_code: '00100',
          },
          items: [
            {
              product_id: productId,
              qty: 2,
              options: [{ group_id: optionGroupId, item_id: optionItem1Id }],
            },
          ],
        });

      const orderId = createResponse.body.data.id;

      // Try to pay again
      const payResponse = await request(app.server)
        .post(`/orders/${orderId}/pay`)
        .set('Cookie', `access_token=${userToken}`);

      expect(payResponse.status).toBe(400);
      expect(payResponse.body.ok).toBe(false);
      expect(payResponse.body.error).toBe('ALREADY_PAID');
    });

    it('should return 400 for CASH payment method', async () => {
      // Create CASH order
      const createResponse = await request(app.server)
        .post('/orders')
        .set('Cookie', `access_token=${userToken}`)
        .send({
          restaurant_id: restaurantId,
          payment_method: 'CASH',
          delivery_address: {
            street: 'Via Roma 123',
            city: 'Roma',
            postal_code: '00100',
          },
          items: [
            {
              product_id: productId,
              qty: 2,
              options: [{ group_id: optionGroupId, item_id: optionItem1Id }],
            },
          ],
        });

      const orderId = createResponse.body.data.id;

      // Manually set payment_status back to PENDING to test
      await query("UPDATE orders SET payment_status = 'PENDING' WHERE id = $1", [orderId]);

      const payResponse = await request(app.server)
        .post(`/orders/${orderId}/pay`)
        .set('Cookie', `access_token=${userToken}`);

      expect(payResponse.status).toBe(400);
      expect(payResponse.body.ok).toBe(false);
      expect(payResponse.body.error).toBe('INVALID_PAYMENT_METHOD');
    });

    it('should return 404 if order not found', async () => {
      const response = await request(app.server)
        .post('/orders/00000000-0000-0000-0000-000000000000/pay')
        .set('Cookie', `access_token=${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('NOT_FOUND');
    });

    it('should return 404 if user does not own order', async () => {
      // Create another user
      const user2Result = await query(
        `INSERT INTO users (phone_e164, name, status)
         VALUES ('+393337654321', 'User 2', 'active')
         RETURNING id`
      );
      const user2Id = user2Result.rows[0].id;

      // Create order for user2
      await query(
        `INSERT INTO orders (user_id, restaurant_id, status, payment_method, payment_status, subtotal_cents, delivery_fee_cents, service_fee_cents, total_cents, address_json)
         VALUES ($1, $2, 'CREATED', 'ONLINE', 'PENDING', 1000, 0, 0, 1000, '{}')
         RETURNING id`,
        [user2Id, restaurantId]
      );

      const orderId = (await query('SELECT id FROM orders WHERE user_id = $1', [user2Id])).rows[0].id;

      // Try to pay with user1's token
      const response = await request(app.server)
        .post(`/orders/${orderId}/pay`)
        .set('Cookie', `access_token=${userToken}`);

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
    });
  });
});
