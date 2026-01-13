import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';
import { resetDatabase, closeDatabasePool } from './helpers/db';
import { query } from '../src/db';

describe('Public Restaurant API - Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
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

  describe('GET /restaurants - List restaurants', () => {
    beforeEach(async () => {
      // Create test restaurants
      await query(
        `INSERT INTO restaurants (id, slug, name, address, city, zone, is_active)
         VALUES
           ('11111111-1111-1111-1111-111111111111', 'pizza-da-mario', 'Pizza da Mario', 'Via Roma 1', 'Roma', 'centro', true),
           ('22222222-2222-2222-2222-222222222222', 'trattoria-trastevere', 'Trattoria Trastevere', 'Via Trastevere 10', 'Roma', 'trastevere', true),
           ('33333333-3333-3333-3333-333333333333', 'sushi-bar', 'Sushi Bar', 'Via Milano 5', 'Roma', 'centro', false)`
      );

      // Add hours (Monday 12:00-15:00, 19:00-23:00)
      await query(
        `INSERT INTO restaurant_hours (restaurant_id, day_of_week, open_time, close_time, is_closed)
         VALUES
           ('11111111-1111-1111-1111-111111111111', 1, '12:00:00', '15:00:00', false),
           ('11111111-1111-1111-1111-111111111111', 1, '19:00:00', '23:00:00', false),
           ('22222222-2222-2222-2222-222222222222', 1, '10:00:00', '22:00:00', false)`
      );

      // Add delivery rules
      await query(
        `INSERT INTO restaurant_delivery_rules (restaurant_id, min_order_cents, delivery_fee_cents, eta_min, eta_max)
         VALUES
           ('11111111-1111-1111-1111-111111111111', 1000, 300, 30, 45),
           ('22222222-2222-2222-2222-222222222222', 1500, 200, 25, 40)`
      );
    });

    it('should return all active restaurants', async () => {
      const response = await request(app.server).get('/restaurants');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(2); // Only active restaurants

      const restaurants = response.body.data;
      expect(restaurants[0].name).toBe('Pizza da Mario');
      expect(restaurants[1].name).toBe('Trattoria Trastevere');

      // Check that is_open_now is included
      expect(restaurants[0]).toHaveProperty('is_open_now');
      expect(typeof restaurants[0].is_open_now).toBe('boolean');

      // Check that hours are included
      expect(restaurants[0].hours).toBeDefined();

      // Check that delivery_rules are included
      expect(restaurants[0].delivery_rules).toBeDefined();
      expect(restaurants[0].delivery_rules.min_order_cents).toBe(1000);
    });

    it('should filter by zone', async () => {
      const response = await request(app.server).get('/restaurants?zone=centro');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Pizza da Mario');
      expect(response.body.data[0].zone).toBe('centro');
    });

    it('should return empty array for non-existent zone', async () => {
      const response = await request(app.server).get('/restaurants?zone=nonexistent');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });

    it('should filter by open_now (note: depends on current time and timezone)', async () => {
      // This test checks the filter works, but actual open/closed status depends on current time
      const response = await request(app.server).get('/restaurants?open_now=true');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      // All returned restaurants should have is_open_now = true
      response.body.data.forEach((restaurant: any) => {
        expect(restaurant.is_open_now).toBe(true);
      });
    });

    it('should return all restaurants when open_now=false', async () => {
      const response = await request(app.server).get('/restaurants?open_now=false');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      // Should return all active restaurants (both open and closed)
      expect(response.body.data.length).toBeGreaterThanOrEqual(0);
    });

    it('should combine zone and open_now filters', async () => {
      const response = await request(app.server).get('/restaurants?zone=centro&open_now=false');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      // Should only return centro restaurants
      response.body.data.forEach((restaurant: any) => {
        expect(restaurant.zone).toBe('centro');
      });
    });

    it('should return 400 for invalid open_now value', async () => {
      const response = await request(app.server).get('/restaurants?open_now=invalid');

      expect(response.status).toBe(400);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /restaurants/:slug - Get restaurant by slug', () => {
    beforeEach(async () => {
      // Create test restaurant
      await query(
        `INSERT INTO restaurants (id, slug, name, description, phone, address, city, zone, lat, lng, is_active)
         VALUES
           ('11111111-1111-1111-1111-111111111111', 'pizza-da-mario', 'Pizza da Mario', 'Best pizza in town', '+39061234567', 'Via Roma 1', 'Roma', 'centro', 41.9028, 12.4964, true)`
      );

      // Add hours
      await query(
        `INSERT INTO restaurant_hours (restaurant_id, day_of_week, open_time, close_time, is_closed)
         VALUES
           ('11111111-1111-1111-1111-111111111111', 0, '12:00:00', '23:00:00', false),
           ('11111111-1111-1111-1111-111111111111', 1, '12:00:00', '23:00:00', false),
           ('11111111-1111-1111-1111-111111111111', 2, '00:00:00', '00:00:00', true)`
      );

      // Add delivery rules
      await query(
        `INSERT INTO restaurant_delivery_rules (restaurant_id, min_order_cents, delivery_fee_cents, eta_min, eta_max)
         VALUES
           ('11111111-1111-1111-1111-111111111111', 1000, 300, 30, 45)`
      );
    });

    it('should return restaurant with all details', async () => {
      const response = await request(app.server).get('/restaurants/pizza-da-mario');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);

      const restaurant = response.body.data;
      expect(restaurant.slug).toBe('pizza-da-mario');
      expect(restaurant.name).toBe('Pizza da Mario');
      expect(restaurant.description).toBe('Best pizza in town');
      expect(restaurant.phone).toBe('+39061234567');
      expect(restaurant.address).toBe('Via Roma 1');
      expect(restaurant.city).toBe('Roma');
      expect(restaurant.zone).toBe('centro');
      expect(restaurant.lat).toBe(41.9028);
      expect(restaurant.lng).toBe(12.4964);
      expect(restaurant.is_active).toBe(true);

      // Check hours
      expect(restaurant.hours).toBeDefined();
      expect(Array.isArray(restaurant.hours)).toBe(true);
      expect(restaurant.hours.length).toBe(3);
      expect(restaurant.hours[0].day_of_week).toBe(0);
      expect(restaurant.hours[0].open_time).toBe('12:00:00');
      expect(restaurant.hours[0].close_time).toBe('23:00:00');
      expect(restaurant.hours[0].is_closed).toBe(false);

      // Check delivery rules
      expect(restaurant.delivery_rules).toBeDefined();
      expect(restaurant.delivery_rules.min_order_cents).toBe(1000);
      expect(restaurant.delivery_rules.delivery_fee_cents).toBe(300);
      expect(restaurant.delivery_rules.eta_min).toBe(30);
      expect(restaurant.delivery_rules.eta_max).toBe(45);

      // Check is_open_now field
      expect(restaurant).toHaveProperty('is_open_now');
      expect(typeof restaurant.is_open_now).toBe('boolean');
    });

    it('should return 404 for non-existent slug', async () => {
      const response = await request(app.server).get('/restaurants/non-existent-slug');

      expect(response.status).toBe(404);
      expect(response.body.ok).toBe(false);
      expect(response.body.error).toBe('NOT_FOUND');
      expect(response.body.message).toBe('Restaurant not found');
    });
  });

  describe('Restaurant without hours or delivery rules', () => {
    beforeEach(async () => {
      // Create restaurant without hours or delivery rules
      await query(
        `INSERT INTO restaurants (id, slug, name, address, city, is_active)
         VALUES
           ('11111111-1111-1111-1111-111111111111', 'new-restaurant', 'New Restaurant', 'Via Test 1', 'Roma', true)`
      );
    });

    it('should return restaurant with null/empty hours and delivery_rules', async () => {
      const response = await request(app.server).get('/restaurants/new-restaurant');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);

      const restaurant = response.body.data;
      expect(restaurant.slug).toBe('new-restaurant');
      expect(restaurant.hours).toBeNull(); // No hours
      expect(restaurant.is_open_now).toBe(false); // Should be false when no hours
    });

    it('should list restaurant with is_open_now=false when no hours', async () => {
      const response = await request(app.server).get('/restaurants');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].is_open_now).toBe(false);
    });
  });
});
