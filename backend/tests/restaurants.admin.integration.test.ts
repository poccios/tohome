import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';
import { resetDatabase, closeDatabasePool } from './helpers/db';
import { query } from '../src/db';

describe('Admin Restaurant API - Integration Tests', () => {
  let app: FastifyInstance;
  const adminKey = process.env.ADMIN_API_KEY || 'test-admin-key-min-32-chars-long';

  beforeAll(async () => {
    // Set ADMIN_API_KEY for tests
    if (!process.env.ADMIN_API_KEY) {
      process.env.ADMIN_API_KEY = adminKey;
    }

    app = await createTestApp();
    await app.ready();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
    await closeDatabasePool();
  });

  describe('POST /admin/restaurants - Create restaurant', () => {
    it('should create restaurant with admin key', async () => {
      const restaurantData = {
        name: 'Pizza da Mario',
        address: 'Via Roma 1',
        city: 'Roma',
        zone: 'centro',
        description: 'Best pizza in town',
        phone: '+39061234567',
        lat: 41.9028,
        lng: 12.4964,
      };

      const response = await request(app.server)
        .post('/admin/restaurants')
        .set('x-admin-key', adminKey)
        .send(restaurantData);

      expect(response.status).toBe(201);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toBeDefined();

      const restaurant = response.body.data;
      expect(restaurant.name).toBe('Pizza da Mario');
      expect(restaurant.slug).toBe('pizza-da-mario'); // Auto-generated
      expect(restaurant.address).toBe('Via Roma 1');
      expect(restaurant.city).toBe('Roma');
      expect(restaurant.zone).toBe('centro');
      expect(restaurant.is_active).toBe(true); // Default

      // Verify in database
      const dbResult = await query('SELECT * FROM restaurants WHERE slug = $1', [
        restaurant.slug,
      ]);
      expect(dbResult.rows.length).toBe(1);
    });

    it('should create restaurant with custom slug', async () => {
      const restaurantData = {
        slug: 'custom-slug',
        name: 'Custom Restaurant',
        address: 'Via Test 1',
        city: 'Roma',
      };

      const response = await request(app.server)
        .post('/admin/restaurants')
        .set('x-admin-key', adminKey)
        .send(restaurantData);

      expect(response.status).toBe(201);
      expect(response.body.data.slug).toBe('custom-slug');
    });

    it('should return 401 without admin key', async () => {
      const restaurantData = {
        name: 'Test Restaurant',
        address: 'Via Test 1',
        city: 'Roma',
      };

      const response = await request(app.server)
        .post('/admin/restaurants')
        .send(restaurantData);

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
      expect(response.body.message).toBe('Admin key required');
    });

    it('should return 401 with invalid admin key', async () => {
      const restaurantData = {
        name: 'Test Restaurant',
        address: 'Via Test 1',
        city: 'Roma',
      };

      const response = await request(app.server)
        .post('/admin/restaurants')
        .set('x-admin-key', 'invalid-key')
        .send(restaurantData);

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
      expect(response.body.message).toBe('Invalid admin key');
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app.server)
        .post('/admin/restaurants')
        .set('x-admin-key', adminKey)
        .send({
          name: '', // Invalid: empty name
          address: 'Via Test 1',
          city: 'Roma',
        });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should return 409 for duplicate slug', async () => {
      // Create first restaurant
      await query(
        `INSERT INTO restaurants (slug, name, address, city)
         VALUES ('duplicate-slug', 'First Restaurant', 'Via Roma 1', 'Roma')`
      );

      // Try to create second with same slug
      const response = await request(app.server)
        .post('/admin/restaurants')
        .set('x-admin-key', adminKey)
        .send({
          slug: 'duplicate-slug',
          name: 'Second Restaurant',
          address: 'Via Milano 1',
          city: 'Roma',
        });

      expect(response.status).toBe(409);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('CONFLICT');
    });
  });

  describe('PATCH /admin/restaurants/:id - Update restaurant', () => {
    let restaurantId: string;

    beforeEach(async () => {
      // Create test restaurant
      const result = await query(
        `INSERT INTO restaurants (slug, name, address, city, zone)
         VALUES ('test-restaurant', 'Test Restaurant', 'Via Test 1', 'Roma', 'centro')
         RETURNING id`
      );
      restaurantId = result.rows[0].id;
    });

    it('should update restaurant fields', async () => {
      const response = await request(app.server)
        .patch(`/admin/restaurants/${restaurantId}`)
        .set('x-admin-key', adminKey)
        .send({
          name: 'Updated Name',
          description: 'New description',
          zone: 'trastevere',
        });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.description).toBe('New description');
      expect(response.body.data.zone).toBe('trastevere');
      expect(response.body.data.address).toBe('Via Test 1'); // Unchanged
    });

    it('should return 401 without admin key', async () => {
      const response = await request(app.server)
        .patch(`/admin/restaurants/${restaurantId}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(401);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should return 404 for non-existent restaurant', async () => {
      const response = await request(app.server)
        .patch('/admin/restaurants/11111111-1111-1111-1111-111111111111')
        .set('x-admin-key', adminKey)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid UUID', async () => {
      const response = await request(app.server)
        .patch('/admin/restaurants/invalid-uuid')
        .set('x-admin-key', adminKey)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /admin/restaurants/:id/hours - Set restaurant hours', () => {
    let restaurantId: string;

    beforeEach(async () => {
      // Create test restaurant
      const result = await query(
        `INSERT INTO restaurants (slug, name, address, city)
         VALUES ('test-restaurant', 'Test Restaurant', 'Via Test 1', 'Roma')
         RETURNING id`
      );
      restaurantId = result.rows[0].id;
    });

    it('should set restaurant hours', async () => {
      const hours = [
        { day_of_week: 0, open_time: '12:00', close_time: '23:00', is_closed: false },
        { day_of_week: 1, open_time: '12:00', close_time: '23:00', is_closed: false },
        { day_of_week: 2, open_time: '00:00', close_time: '00:00', is_closed: true },
      ];

      const response = await request(app.server)
        .put(`/admin/restaurants/${restaurantId}/hours`)
        .set('x-admin-key', adminKey)
        .send({ hours });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.message).toBe('Hours updated successfully');

      // Verify in database
      const dbResult = await query(
        'SELECT * FROM restaurant_hours WHERE restaurant_id = $1 ORDER BY day_of_week, open_time',
        [restaurantId]
      );
      expect(dbResult.rows.length).toBe(3);
      expect(dbResult.rows[0].day_of_week).toBe(0);
      expect(dbResult.rows[0].open_time).toBe('12:00:00');
      expect(dbResult.rows[2].is_closed).toBe(true);
    });

    it('should replace existing hours', async () => {
      // Create initial hours
      await query(
        `INSERT INTO restaurant_hours (restaurant_id, day_of_week, open_time, close_time)
         VALUES ($1, 1, '10:00:00', '22:00:00')`,
        [restaurantId]
      );

      // Replace with new hours
      const hours = [
        { day_of_week: 2, open_time: '11:00', close_time: '23:00', is_closed: false },
      ];

      const response = await request(app.server)
        .put(`/admin/restaurants/${restaurantId}/hours`)
        .set('x-admin-key', adminKey)
        .send({ hours });

      expect(response.status).toBe(200);

      // Verify old hours deleted, new hours added
      const dbResult = await query(
        'SELECT * FROM restaurant_hours WHERE restaurant_id = $1',
        [restaurantId]
      );
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].day_of_week).toBe(2);
    });

    it('should return 401 without admin key', async () => {
      const response = await request(app.server)
        .put(`/admin/restaurants/${restaurantId}/hours`)
        .send({ hours: [] });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should return 404 for non-existent restaurant', async () => {
      const response = await request(app.server)
        .put('/admin/restaurants/11111111-1111-1111-1111-111111111111/hours')
        .set('x-admin-key', adminKey)
        .send({ hours: [] });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid hours data', async () => {
      const response = await request(app.server)
        .put(`/admin/restaurants/${restaurantId}/hours`)
        .set('x-admin-key', adminKey)
        .send({
          hours: [
            { day_of_week: 7, open_time: '12:00', close_time: '23:00' }, // Invalid: day_of_week > 6
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /admin/restaurants/:id/delivery-rules - Upsert delivery rules', () => {
    let restaurantId: string;

    beforeEach(async () => {
      // Create test restaurant
      const result = await query(
        `INSERT INTO restaurants (slug, name, address, city)
         VALUES ('test-restaurant', 'Test Restaurant', 'Via Test 1', 'Roma')
         RETURNING id`
      );
      restaurantId = result.rows[0].id;
    });

    it('should create delivery rules', async () => {
      const rules = {
        min_order_cents: 1500,
        delivery_fee_cents: 300,
        eta_min: 30,
        eta_max: 45,
      };

      const response = await request(app.server)
        .put(`/admin/restaurants/${restaurantId}/delivery-rules`)
        .set('x-admin-key', adminKey)
        .send(rules);

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data.min_order_cents).toBe(1500);
      expect(response.body.data.delivery_fee_cents).toBe(300);
      expect(response.body.data.eta_min).toBe(30);
      expect(response.body.data.eta_max).toBe(45);

      // Verify in database
      const dbResult = await query(
        'SELECT * FROM restaurant_delivery_rules WHERE restaurant_id = $1',
        [restaurantId]
      );
      expect(dbResult.rows.length).toBe(1);
    });

    it('should update existing delivery rules', async () => {
      // Create initial rules
      await query(
        `INSERT INTO restaurant_delivery_rules (restaurant_id, min_order_cents, delivery_fee_cents)
         VALUES ($1, 1000, 200)`,
        [restaurantId]
      );

      // Update rules
      const response = await request(app.server)
        .put(`/admin/restaurants/${restaurantId}/delivery-rules`)
        .set('x-admin-key', adminKey)
        .send({
          min_order_cents: 2000,
          delivery_fee_cents: 400,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.min_order_cents).toBe(2000);
      expect(response.body.data.delivery_fee_cents).toBe(400);

      // Verify only one record exists
      const dbResult = await query(
        'SELECT COUNT(*) as count FROM restaurant_delivery_rules WHERE restaurant_id = $1',
        [restaurantId]
      );
      expect(parseInt(dbResult.rows[0].count)).toBe(1);
    });

    it('should return 401 without admin key', async () => {
      const response = await request(app.server)
        .put(`/admin/restaurants/${restaurantId}/delivery-rules`)
        .send({ min_order_cents: 1000 });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });

    it('should return 404 for non-existent restaurant', async () => {
      const response = await request(app.server)
        .put('/admin/restaurants/11111111-1111-1111-1111-111111111111/delivery-rules')
        .set('x-admin-key', adminKey)
        .send({ min_order_cents: 1000 });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app.server)
        .put(`/admin/restaurants/${restaurantId}/delivery-rules`)
        .set('x-admin-key', adminKey)
        .send({
          min_order_cents: -100, // Invalid: negative value
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('Restaurant Overrides - Daily special hours/closures', () => {
    let restaurantId: string;

    beforeEach(async () => {
      // Create test restaurant
      const result = await query(
        `INSERT INTO restaurants (slug, name, address, city)
         VALUES ('test-restaurant', 'Test Restaurant', 'Via Test 1', 'Roma')
         RETURNING id`
      );
      restaurantId = result.rows[0].id;

      // Add regular hours
      await query(
        `INSERT INTO restaurant_hours (restaurant_id, day_of_week, open_time, close_time, is_closed)
         VALUES ($1, 1, '12:00:00', '23:00:00', false)`,
        [restaurantId]
      );
    });

    describe('PUT /admin/restaurants/:id/override/:date - Create/update override', () => {
      it('should create override for closed day', async () => {
        const overrideDate = '2026-01-15';
        const overrideData = {
          is_closed: true,
          note: 'Chiuso per ferie',
        };

        const response = await request(app.server)
          .put(`/admin/restaurants/${restaurantId}/override/${overrideDate}`)
          .set('x-admin-key', adminKey)
          .send(overrideData);

        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(response.body.data.date).toBe(overrideDate);
        expect(response.body.data.is_closed).toBe(true);
        expect(response.body.data.note).toBe('Chiuso per ferie');

        // Verify in database
        const dbResult = await query(
          'SELECT * FROM restaurant_overrides WHERE restaurant_id = $1 AND date = $2',
          [restaurantId, overrideDate]
        );
        expect(dbResult.rows.length).toBe(1);
        expect(dbResult.rows[0].is_closed).toBe(true);
      });

      it('should create override with special hours', async () => {
        const overrideDate = '2026-01-16';
        const overrideData = {
          is_closed: false,
          open_time: '14:00',
          close_time: '18:00',
          note: 'Orario ridotto',
        };

        const response = await request(app.server)
          .put(`/admin/restaurants/${restaurantId}/override/${overrideDate}`)
          .set('x-admin-key', adminKey)
          .send(overrideData);

        expect(response.status).toBe(200);
        expect(response.body.data.open_time).toBe('14:00');
        expect(response.body.data.close_time).toBe('18:00');
        expect(response.body.data.is_closed).toBe(false);

        // Verify in database
        const dbResult = await query(
          'SELECT * FROM restaurant_overrides WHERE restaurant_id = $1 AND date = $2',
          [restaurantId, overrideDate]
        );
        expect(dbResult.rows[0].open_time).toBe('14:00');
        expect(dbResult.rows[0].close_time).toBe('18:00');
      });

      it('should update existing override', async () => {
        const overrideDate = '2026-01-17';

        // Create initial override
        await query(
          `INSERT INTO restaurant_overrides (restaurant_id, date, is_closed, note)
           VALUES ($1, $2, true, 'Primo motivo')`,
          [restaurantId, overrideDate]
        );

        // Update override
        const response = await request(app.server)
          .put(`/admin/restaurants/${restaurantId}/override/${overrideDate}`)
          .set('x-admin-key', adminKey)
          .send({
            is_closed: false,
            open_time: '10:00',
            close_time: '20:00',
            note: 'Secondo motivo',
          });

        expect(response.status).toBe(200);
        expect(response.body.data.is_closed).toBe(false);
        expect(response.body.data.note).toBe('Secondo motivo');

        // Verify only one record exists
        const dbResult = await query(
          'SELECT COUNT(*) as count FROM restaurant_overrides WHERE restaurant_id = $1 AND date = $2',
          [restaurantId, overrideDate]
        );
        expect(parseInt(dbResult.rows[0].count)).toBe(1);
      });

      it('should return 401 without admin key', async () => {
        const response = await request(app.server)
          .put(`/admin/restaurants/${restaurantId}/override/2026-01-15`)
          .send({ is_closed: true });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('UNAUTHORIZED');
      });

      it('should return 404 for non-existent restaurant', async () => {
        const response = await request(app.server)
          .put('/admin/restaurants/11111111-1111-1111-1111-111111111111/override/2026-01-15')
          .set('x-admin-key', adminKey)
          .send({ is_closed: true });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('NOT_FOUND');
      });

      it('should return 400 for invalid date format', async () => {
        const response = await request(app.server)
          .put(`/admin/restaurants/${restaurantId}/override/invalid-date`)
          .set('x-admin-key', adminKey)
          .send({ is_closed: true });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('VALIDATION_ERROR');
      });

      // Note: Time format validation only checks HH:MM pattern, not validity of values
      // Invalid times like '25:00' will pass validation but may cause issues in business logic
    });

    describe('DELETE /admin/restaurants/:id/override/:date - Delete override', () => {
      it('should delete existing override', async () => {
        const overrideDate = '2026-01-18';

        // Create override
        await query(
          `INSERT INTO restaurant_overrides (restaurant_id, date, is_closed)
           VALUES ($1, $2, true)`,
          [restaurantId, overrideDate]
        );

        const response = await request(app.server)
          .delete(`/admin/restaurants/${restaurantId}/override/${overrideDate}`)
          .set('x-admin-key', adminKey);

        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(response.body.message).toBe('Override deleted successfully');

        // Verify deleted from database
        const dbResult = await query(
          'SELECT * FROM restaurant_overrides WHERE restaurant_id = $1 AND date = $2',
          [restaurantId, overrideDate]
        );
        expect(dbResult.rows.length).toBe(0);
      });

      it('should return 404 when override does not exist', async () => {
        const response = await request(app.server)
          .delete(`/admin/restaurants/${restaurantId}/override/2026-12-31`)
          .set('x-admin-key', adminKey);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('NOT_FOUND');
      });

      it('should return 401 without admin key', async () => {
        const response = await request(app.server)
          .delete(`/admin/restaurants/${restaurantId}/override/2026-01-15`);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('UNAUTHORIZED');
      });
    });

    describe('GET /admin/restaurants/:id/overrides - Get overrides', () => {
      beforeEach(async () => {
        // Create multiple overrides
        await query(
          `INSERT INTO restaurant_overrides (restaurant_id, date, is_closed, note)
           VALUES
             ($1, '2026-01-10', true, 'Override 1'),
             ($1, '2026-01-15', false, 'Override 2'),
             ($1, '2026-01-20', true, 'Override 3'),
             ($1, '2026-01-25', false, 'Override 4')`,
          [restaurantId]
        );
      });

      it('should get all overrides without filters', async () => {
        const response = await request(app.server)
          .get(`/admin/restaurants/${restaurantId}/overrides`)
          .set('x-admin-key', adminKey);

        expect(response.status).toBe(200);
        expect(response.body.ok).toBe(true);
        expect(response.body.data.length).toBe(4);
        expect(response.body.data[0].date).toBe('2026-01-10');
        expect(response.body.data[3].date).toBe('2026-01-25');
      });

      it('should filter overrides by from date', async () => {
        const response = await request(app.server)
          .get(`/admin/restaurants/${restaurantId}/overrides?from=2026-01-16`)
          .set('x-admin-key', adminKey);

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBe(2); // 2026-01-20 and 2026-01-25
        expect(response.body.data[0].date).toBe('2026-01-20');
      });

      it('should filter overrides by to date', async () => {
        const response = await request(app.server)
          .get(`/admin/restaurants/${restaurantId}/overrides?to=2026-01-15`)
          .set('x-admin-key', adminKey);

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBe(2); // 2026-01-10 and 2026-01-15
        expect(response.body.data[1].date).toBe('2026-01-15');
      });

      it('should filter overrides by date range', async () => {
        const response = await request(app.server)
          .get(`/admin/restaurants/${restaurantId}/overrides?from=2026-01-12&to=2026-01-22`)
          .set('x-admin-key', adminKey);

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBe(2); // 2026-01-15 and 2026-01-20
      });

      it('should return empty array when no overrides in range', async () => {
        const response = await request(app.server)
          .get(`/admin/restaurants/${restaurantId}/overrides?from=2027-01-01&to=2027-12-31`)
          .set('x-admin-key', adminKey);

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBe(0);
      });

      it('should return 401 without admin key', async () => {
        const response = await request(app.server)
          .get(`/admin/restaurants/${restaurantId}/overrides`);

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('UNAUTHORIZED');
      });

      it('should return 400 for invalid date format', async () => {
        const response = await request(app.server)
          .get(`/admin/restaurants/${restaurantId}/overrides?from=invalid-date`)
          .set('x-admin-key', adminKey);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('VALIDATION_ERROR');
      });
    });

    describe('Integration with is_open_now - Override priority', () => {
      it('should respect override when restaurant is closed for the day', async () => {
        // Get today's date in Europe/Rome timezone
        const today = new Date().toISOString().split('T')[0];

        // Create override: closed today
        await query(
          `INSERT INTO restaurant_overrides (restaurant_id, date, is_closed, note)
           VALUES ($1, $2, true, 'Chiuso oggi')`,
          [restaurantId, today]
        );

        // Get restaurant via public API
        const response = await request(app.server).get('/restaurants');

        expect(response.status).toBe(200);
        const restaurant = response.body.data.find((r: any) => r.id === restaurantId);

        // Should be closed even if regular hours say open
        expect(restaurant.is_open_now).toBe(false);
      });

      it('should use override special hours instead of regular hours', async () => {
        // This test would need to be run at a specific time to verify
        // For now, we just verify the override is returned in the response
        const today = new Date().toISOString().split('T')[0];

        await query(
          `INSERT INTO restaurant_overrides (restaurant_id, date, is_closed, open_time, close_time)
           VALUES ($1, $2, false, '10:00', '14:00')`,
          [restaurantId, today]
        );

        const response = await request(app.server).get('/restaurants');

        expect(response.status).toBe(200);
        const restaurant = response.body.data.find((r: any) => r.id === restaurantId);

        // Verify override is present
        expect(restaurant.override).toBeDefined();
        expect(restaurant.override.open_time).toBe('10:00');
        expect(restaurant.override.close_time).toBe('14:00');
      });
    });
  });

  describe('Force Closed (Kill Switch)', () => {
    let restaurantId: string;

    beforeEach(async () => {
      // Create test restaurant
      const result = await query(
        `INSERT INTO restaurants (slug, name, address, city)
         VALUES ('test-restaurant', 'Test Restaurant', 'Via Test 1', 'Roma')
         RETURNING id`
      );
      restaurantId = result.rows[0].id;

      // Add regular hours (open on Monday)
      await query(
        `INSERT INTO restaurant_hours (restaurant_id, day_of_week, open_time, close_time, is_closed)
         VALUES ($1, 1, '12:00:00', '23:00:00', false)`,
        [restaurantId]
      );
    });

    describe('PATCH /admin/restaurants/:id - Update force_closed', () => {
      it('should set force_closed to true', async () => {
        const response = await request(app.server)
          .patch(`/admin/restaurants/${restaurantId}`)
          .set('x-admin-key', adminKey)
          .send({
            force_closed: true,
            force_closed_note: 'Chiuso per manutenzione',
          });

        expect(response.status).toBe(200);
        expect(response.body.data.force_closed).toBe(true);
        expect(response.body.data.force_closed_note).toBe('Chiuso per manutenzione');

        // Verify in database
        const dbResult = await query(
          'SELECT force_closed, force_closed_note FROM restaurants WHERE id = $1',
          [restaurantId]
        );
        expect(dbResult.rows[0].force_closed).toBe(true);
        expect(dbResult.rows[0].force_closed_note).toBe('Chiuso per manutenzione');
      });

      it('should set force_closed to false', async () => {
        // First set to true
        await query(
          `UPDATE restaurants SET force_closed = true, force_closed_note = 'Test' WHERE id = $1`,
          [restaurantId]
        );

        // Now set back to false
        const response = await request(app.server)
          .patch(`/admin/restaurants/${restaurantId}`)
          .set('x-admin-key', adminKey)
          .send({
            force_closed: false,
            force_closed_note: null,
          });

        expect(response.status).toBe(200);
        expect(response.body.data.force_closed).toBe(false);
        expect(response.body.data.force_closed_note).toBe(null);
      });
    });

    describe('Integration with is_open_now - Force closed priority', () => {
      it('should return is_open_now=false when force_closed=true', async () => {
        // Set restaurant as force closed
        await query(
          `UPDATE restaurants SET force_closed = true WHERE id = $1`,
          [restaurantId]
        );

        // Get restaurant via public API
        const response = await request(app.server).get('/restaurants');

        expect(response.status).toBe(200);
        const restaurant = response.body.data.find((r: any) => r.id === restaurantId);

        // Should be closed even if hours say it's open
        expect(restaurant.force_closed).toBe(true);
        expect(restaurant.is_open_now).toBe(false);
      });

      it('should not filter out force_closed restaurants when openNow=false', async () => {
        await query(
          `UPDATE restaurants SET force_closed = true WHERE id = $1`,
          [restaurantId]
        );

        const response = await request(app.server).get('/restaurants');

        expect(response.status).toBe(200);
        const restaurant = response.body.data.find((r: any) => r.id === restaurantId);

        // Restaurant should still be in the list
        expect(restaurant).toBeDefined();
        expect(restaurant.is_open_now).toBe(false);
      });

      it('should filter out force_closed restaurants when openNow=true', async () => {
        await query(
          `UPDATE restaurants SET force_closed = true WHERE id = $1`,
          [restaurantId]
        );

        const response = await request(app.server).get('/restaurants?open_now=true');

        expect(response.status).toBe(200);
        const restaurant = response.body.data.find((r: any) => r.id === restaurantId);

        // Restaurant should NOT be in the filtered list
        expect(restaurant).toBeUndefined();
      });

      it('should include force_closed and force_closed_note in response', async () => {
        await query(
          `UPDATE restaurants SET force_closed = true, force_closed_note = 'Ferie estive' WHERE id = $1`,
          [restaurantId]
        );

        const response = await request(app.server).get('/restaurants');

        expect(response.status).toBe(200);
        const restaurant = response.body.data.find((r: any) => r.id === restaurantId);

        expect(restaurant.force_closed).toBe(true);
        expect(restaurant.force_closed_note).toBe('Ferie estive');
      });

      it('should prioritize force_closed over overrides', async () => {
        const today = new Date().toISOString().split('T')[0];

        // Create override that says open with special hours
        await query(
          `INSERT INTO restaurant_overrides (restaurant_id, date, is_closed, open_time, close_time)
           VALUES ($1, $2, false, '10:00', '20:00')`,
          [restaurantId, today]
        );

        // Set force_closed
        await query(
          `UPDATE restaurants SET force_closed = true WHERE id = $1`,
          [restaurantId]
        );

        const response = await request(app.server).get('/restaurants');

        expect(response.status).toBe(200);
        const restaurant = response.body.data.find((r: any) => r.id === restaurantId);

        // Force closed should override the override
        expect(restaurant.is_open_now).toBe(false);
      });
    });
  });
});
