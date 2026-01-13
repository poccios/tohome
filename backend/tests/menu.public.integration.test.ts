import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';
import { resetDatabase, closeDatabasePool } from './helpers/db';
import { query } from '../src/db';

describe('Public Menu API - Integration Tests', () => {
  let app: FastifyInstance;
  let restaurantId: string;

  beforeAll(async () => {
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

  describe('GET /restaurants/:slug/menu - Get restaurant menu', () => {
    it('should return empty menu for restaurant without categories', async () => {
      const response = await request(app.server).get('/restaurants/pizza-test/menu');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.restaurant).toEqual({
        id: restaurantId,
        slug: 'pizza-test',
        name: 'Pizza Test',
      });
      expect(response.body.data.categories).toEqual([]);
    });

    it('should return 404 for non-existent restaurant', async () => {
      const response = await request(app.server).get('/restaurants/non-existent/menu');

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('NOT_FOUND');
    });

    it('should return complete menu with categories, products, and options', async () => {
      // Create categories
      const cat1 = await query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order, is_active)
         VALUES ($1, 'Pizze', 0, true) RETURNING id`,
        [restaurantId]
      );
      const cat2 = await query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order, is_active)
         VALUES ($1, 'Bevande', 1, true) RETURNING id`,
        [restaurantId]
      );

      const categoryId1 = cat1.rows[0].id;
      const categoryId2 = cat2.rows[0].id;

      // Create products
      const prod1 = await query(
        `INSERT INTO menu_products (restaurant_id, category_id, name, description, base_price_cents, sort_order, is_active)
         VALUES ($1, $2, 'Margherita', 'Pomodoro e mozzarella', 800, 0, true) RETURNING id`,
        [restaurantId, categoryId1]
      );
      const prod2 = await query(
        `INSERT INTO menu_products (restaurant_id, category_id, name, description, base_price_cents, sort_order, is_active)
         VALUES ($1, $2, 'Diavola', 'Pomodoro, mozzarella, salame piccante', 950, 1, true) RETURNING id`,
        [restaurantId, categoryId1]
      );
      const prod3 = await query(
        `INSERT INTO menu_products (restaurant_id, category_id, name, description, base_price_cents, sort_order, is_active)
         VALUES ($1, $2, 'Coca Cola', null, 250, 0, true) RETURNING id`,
        [restaurantId, categoryId2]
      );

      const productId1 = prod1.rows[0].id;

      // Create option groups for Margherita
      const group1 = await query(
        `INSERT INTO product_option_groups (restaurant_id, product_id, name, min_select, max_select, sort_order)
         VALUES ($1, $2, 'Dimensione', 1, 1, 0) RETURNING id`,
        [restaurantId, productId1]
      );

      const groupId = group1.rows[0].id;

      // Create option items
      await query(
        `INSERT INTO product_option_items (restaurant_id, group_id, name, price_delta_cents, is_active, sort_order)
         VALUES
           ($1, $2, 'Normale', 0, true, 0),
           ($1, $2, 'Maxi', 300, true, 1)`,
        [restaurantId, groupId]
      );

      const response = await request(app.server).get('/restaurants/pizza-test/menu');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);

      const menu = response.body.data;
      expect(menu.restaurant.slug).toBe('pizza-test');
      expect(menu.categories).toHaveLength(2);

      // Check first category (Pizze)
      expect(menu.categories[0].name).toBe('Pizze');
      expect(menu.categories[0].products).toHaveLength(2);
      expect(menu.categories[0].products[0].name).toBe('Margherita');
      expect(menu.categories[0].products[0].base_price_cents).toBe(800);
      expect(menu.categories[0].products[0].option_groups).toHaveLength(1);
      expect(menu.categories[0].products[0].option_groups[0].name).toBe('Dimensione');
      expect(menu.categories[0].products[0].option_groups[0].items).toHaveLength(2);
      expect(menu.categories[0].products[0].option_groups[0].items[0].name).toBe('Normale');
      expect(menu.categories[0].products[0].option_groups[0].items[1].name).toBe('Maxi');

      // Check second category (Bevande)
      expect(menu.categories[1].name).toBe('Bevande');
      expect(menu.categories[1].products).toHaveLength(1);
      expect(menu.categories[1].products[0].name).toBe('Coca Cola');
      expect(menu.categories[1].products[0].option_groups).toHaveLength(0);
    });

    it('should not include inactive products or categories', async () => {
      // Create active category
      const cat1 = await query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order, is_active)
         VALUES ($1, 'Pizze', 0, true) RETURNING id`,
        [restaurantId]
      );

      // Create inactive category
      await query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order, is_active)
         VALUES ($1, 'Inactive Category', 1, false) RETURNING id`,
        [restaurantId]
      );

      const categoryId = cat1.rows[0].id;

      // Create active product
      await query(
        `INSERT INTO menu_products (restaurant_id, category_id, name, base_price_cents, sort_order, is_active)
         VALUES ($1, $2, 'Margherita', 800, 0, true)`,
        [restaurantId, categoryId]
      );

      // Create inactive product
      await query(
        `INSERT INTO menu_products (restaurant_id, category_id, name, base_price_cents, sort_order, is_active)
         VALUES ($1, $2, 'Inactive Product', 500, 1, false)`,
        [restaurantId, categoryId]
      );

      const response = await request(app.server).get('/restaurants/pizza-test/menu');

      expect(response.status).toBe(200);
      expect(response.body.data.categories).toHaveLength(1);
      expect(response.body.data.categories[0].name).toBe('Pizze');
      expect(response.body.data.categories[0].products).toHaveLength(1);
      expect(response.body.data.categories[0].products[0].name).toBe('Margherita');
    });

    it('should not include inactive option items', async () => {
      // Create category and product
      const cat = await query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order, is_active)
         VALUES ($1, 'Pizze', 0, true) RETURNING id`,
        [restaurantId]
      );
      const prod = await query(
        `INSERT INTO menu_products (restaurant_id, category_id, name, base_price_cents, sort_order, is_active)
         VALUES ($1, $2, 'Margherita', 800, 0, true) RETURNING id`,
        [restaurantId, cat.rows[0].id]
      );

      // Create option group
      const group = await query(
        `INSERT INTO product_option_groups (restaurant_id, product_id, name, min_select, max_select, sort_order)
         VALUES ($1, $2, 'Size', 1, 1, 0) RETURNING id`,
        [restaurantId, prod.rows[0].id]
      );

      // Create active and inactive option items
      await query(
        `INSERT INTO product_option_items (restaurant_id, group_id, name, price_delta_cents, is_active, sort_order)
         VALUES
           ($1, $2, 'Normale', 0, true, 0),
           ($1, $2, 'Inactive Item', 200, false, 1),
           ($1, $2, 'Maxi', 300, true, 2)`,
        [restaurantId, group.rows[0].id]
      );

      const response = await request(app.server).get('/restaurants/pizza-test/menu');

      expect(response.status).toBe(200);
      const items = response.body.data.categories[0].products[0].option_groups[0].items;
      expect(items).toHaveLength(2);
      expect(items[0].name).toBe('Normale');
      expect(items[1].name).toBe('Maxi');
    });

    it('should respect sort_order for categories and products', async () => {
      // Create categories with different sort orders
      await query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order, is_active)
         VALUES
           ($1, 'Dolci', 2, true),
           ($1, 'Pizze', 0, true),
           ($1, 'Bevande', 1, true)`,
        [restaurantId]
      );

      const response = await request(app.server).get('/restaurants/pizza-test/menu');

      expect(response.status).toBe(200);
      const categories = response.body.data.categories;
      expect(categories[0].name).toBe('Pizze'); // sort_order 0
      expect(categories[1].name).toBe('Bevande'); // sort_order 1
      expect(categories[2].name).toBe('Dolci'); // sort_order 2
    });
  });
});
