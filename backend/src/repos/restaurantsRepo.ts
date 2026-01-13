import { query, transaction } from '../db';
import { isRestaurantOpenNow, RestaurantHours, RestaurantOverride as UtilRestaurantOverride } from '../utils/openNow';
import { DateTime } from 'luxon';

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  phone: string | null;
  address: string;
  city: string;
  zone: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
  force_closed: boolean;
  force_closed_note: string | null;
  created_at: Date;
}

export interface RestaurantWithDetails extends Restaurant {
  hours?: RestaurantHours[];
  delivery_rules?: DeliveryRules;
  override?: UtilRestaurantOverride | null;
  is_open_now?: boolean;
}

export interface DeliveryRules {
  id: string;
  restaurant_id: string;
  min_order_cents: number;
  delivery_fee_cents: number;
  eta_min: number;
  eta_max: number;
}

export interface CreateRestaurantData {
  slug?: string;
  name: string;
  description?: string;
  phone?: string;
  address: string;
  city: string;
  zone?: string;
  lat?: number;
  lng?: number;
  is_active?: boolean;
  force_closed?: boolean;
  force_closed_note?: string;
}

export interface UpdateRestaurantData {
  slug?: string;
  name?: string;
  description?: string;
  phone?: string;
  address?: string;
  city?: string;
  zone?: string;
  lat?: number;
  lng?: number;
  is_active?: boolean;
  force_closed?: boolean;
  force_closed_note?: string;
}

export interface SetHoursData {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed?: boolean;
}

export interface UpsertDeliveryRulesData {
  min_order_cents?: number;
  delivery_fee_cents?: number;
  eta_min?: number;
  eta_max?: number;
}

export interface RestaurantOverride {
  id: string;
  restaurant_id: string;
  date: string; // YYYY-MM-DD
  is_closed: boolean;
  open_time: string | null; // HH:MM
  close_time: string | null; // HH:MM
  note: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertOverrideData {
  is_closed: boolean;
  open_time?: string | null;
  close_time?: string | null;
  note?: string | null;
}

/**
 * Generate a URL-friendly slug from a string
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // Normalize accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * List restaurants with optional filters
 */
export async function listRestaurants(filters?: {
  openNow?: boolean;
  zone?: string;
}): Promise<RestaurantWithDetails[]> {
  // Get today's date in Europe/Rome timezone
  const todayDate = DateTime.now().setZone('Europe/Rome').toFormat('yyyy-MM-dd');

  // Build query with filters
  let queryText = `
    SELECT r.*,
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
           ) as delivery_rules,
           CASE
             WHEN ro.id IS NOT NULL THEN json_build_object(
               'date', TO_CHAR(ro.date, 'YYYY-MM-DD'),
               'is_closed', ro.is_closed,
               'open_time', ro.open_time,
               'close_time', ro.close_time
             )
             ELSE NULL
           END as override
    FROM restaurants r
    LEFT JOIN restaurant_hours rh ON r.id = rh.restaurant_id
    LEFT JOIN restaurant_delivery_rules rdr ON r.id = rdr.restaurant_id
    LEFT JOIN restaurant_overrides ro ON r.id = ro.restaurant_id AND ro.date = $1
    WHERE r.is_active = true
  `;

  const params: any[] = [todayDate];

  if (filters?.zone) {
    params.push(filters.zone);
    queryText += ` AND r.zone = $${params.length}`;
  }

  queryText += ` GROUP BY r.id, rdr.id, rdr.restaurant_id, rdr.min_order_cents, rdr.delivery_fee_cents, rdr.eta_min, rdr.eta_max, ro.id, ro.date, ro.is_closed, ro.open_time, ro.close_time`;
  queryText += ` ORDER BY r.name ASC`;

  const result = await query<RestaurantWithDetails>(queryText, params);

  let restaurants = result.rows;

  // Apply openNow filter if requested
  if (filters?.openNow) {
    restaurants = restaurants.filter((restaurant) => {
      // Force closed takes priority
      if (restaurant.force_closed) {
        return false;
      }
      if (!restaurant.hours || restaurant.hours.length === 0) {
        return false;
      }
      return isRestaurantOpenNow(restaurant.hours, restaurant.override);
    });
  }

  // Add is_open_now field to all restaurants
  restaurants = restaurants.map((restaurant) => ({
    ...restaurant,
    is_open_now: restaurant.force_closed
      ? false
      : (restaurant.hours ? isRestaurantOpenNow(restaurant.hours, restaurant.override) : false),
  }));

  return restaurants;
}

/**
 * Get a single restaurant by slug
 */
export async function getRestaurantBySlug(
  slug: string
): Promise<RestaurantWithDetails | null> {
  // Get today's date in Europe/Rome timezone
  const todayDate = DateTime.now().setZone('Europe/Rome').toFormat('yyyy-MM-dd');

  const result = await query<RestaurantWithDetails>(
    `
    SELECT r.*,
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
           ) as delivery_rules,
           CASE
             WHEN ro.id IS NOT NULL THEN json_build_object(
               'date', TO_CHAR(ro.date, 'YYYY-MM-DD'),
               'is_closed', ro.is_closed,
               'open_time', ro.open_time,
               'close_time', ro.close_time
             )
             ELSE NULL
           END as override
    FROM restaurants r
    LEFT JOIN restaurant_hours rh ON r.id = rh.restaurant_id
    LEFT JOIN restaurant_delivery_rules rdr ON r.id = rdr.restaurant_id
    LEFT JOIN restaurant_overrides ro ON r.id = ro.restaurant_id AND ro.date = $2
    WHERE r.slug = $1
    GROUP BY r.id, rdr.id, rdr.restaurant_id, rdr.min_order_cents, rdr.delivery_fee_cents, rdr.eta_min, rdr.eta_max, ro.id, ro.date, ro.is_closed, ro.open_time, ro.close_time
    `,
    [slug, todayDate]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const restaurant = result.rows[0];
  restaurant.is_open_now = restaurant.force_closed
    ? false
    : (restaurant.hours ? isRestaurantOpenNow(restaurant.hours, restaurant.override) : false);

  return restaurant;
}

/**
 * Create a new restaurant
 */
export async function createRestaurant(
  data: CreateRestaurantData
): Promise<Restaurant> {
  // Generate slug if not provided
  const slug = data.slug || generateSlug(data.name);

  const result = await query<Restaurant>(
    `
    INSERT INTO restaurants (
      slug, name, description, phone, address, city, zone, lat, lng, is_active, force_closed, force_closed_note
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
    `,
    [
      slug,
      data.name,
      data.description || null,
      data.phone || null,
      data.address,
      data.city,
      data.zone || null,
      data.lat || null,
      data.lng || null,
      data.is_active !== undefined ? data.is_active : true,
      data.force_closed !== undefined ? data.force_closed : false,
      data.force_closed_note || null,
    ]
  );

  return result.rows[0];
}

/**
 * Update a restaurant (partial update)
 */
export async function updateRestaurant(
  id: string,
  patch: UpdateRestaurantData
): Promise<Restaurant | null> {
  // Build dynamic UPDATE query
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (patch.slug !== undefined) {
    fields.push(`slug = $${paramCount++}`);
    values.push(patch.slug);
  }
  if (patch.name !== undefined) {
    fields.push(`name = $${paramCount++}`);
    values.push(patch.name);
  }
  if (patch.description !== undefined) {
    fields.push(`description = $${paramCount++}`);
    values.push(patch.description);
  }
  if (patch.phone !== undefined) {
    fields.push(`phone = $${paramCount++}`);
    values.push(patch.phone);
  }
  if (patch.address !== undefined) {
    fields.push(`address = $${paramCount++}`);
    values.push(patch.address);
  }
  if (patch.city !== undefined) {
    fields.push(`city = $${paramCount++}`);
    values.push(patch.city);
  }
  if (patch.zone !== undefined) {
    fields.push(`zone = $${paramCount++}`);
    values.push(patch.zone);
  }
  if (patch.lat !== undefined) {
    fields.push(`lat = $${paramCount++}`);
    values.push(patch.lat);
  }
  if (patch.lng !== undefined) {
    fields.push(`lng = $${paramCount++}`);
    values.push(patch.lng);
  }
  if (patch.is_active !== undefined) {
    fields.push(`is_active = $${paramCount++}`);
    values.push(patch.is_active);
  }
  if (patch.force_closed !== undefined) {
    fields.push(`force_closed = $${paramCount++}`);
    values.push(patch.force_closed);
  }
  if (patch.force_closed_note !== undefined) {
    fields.push(`force_closed_note = $${paramCount++}`);
    values.push(patch.force_closed_note);
  }

  if (fields.length === 0) {
    // No fields to update, just return the current restaurant
    const result = await query<Restaurant>(
      'SELECT * FROM restaurants WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  values.push(id);
  const queryText = `
    UPDATE restaurants
    SET ${fields.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `;

  const result = await query<Restaurant>(queryText, values);
  return result.rows[0] || null;
}

/**
 * Replace all hours for a restaurant (delete + insert in transaction)
 */
export async function setRestaurantHours(
  restaurantId: string,
  hours: SetHoursData[]
): Promise<void> {
  await transaction(async (client) => {
    // Check if restaurant exists
    const restaurantCheck = await client.query(
      'SELECT id FROM restaurants WHERE id = $1',
      [restaurantId]
    );

    if (restaurantCheck.rows.length === 0) {
      throw new Error('Restaurant not found');
    }

    // Delete all existing hours
    await client.query('DELETE FROM restaurant_hours WHERE restaurant_id = $1', [
      restaurantId,
    ]);

    // Insert new hours
    if (hours.length > 0) {
      const values: any[] = [];
      const valuePlaceholders: string[] = [];

      hours.forEach((hour, index) => {
        const offset = index * 5;
        valuePlaceholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
        );
        values.push(
          restaurantId,
          hour.day_of_week,
          hour.open_time,
          hour.close_time,
          hour.is_closed !== undefined ? hour.is_closed : false
        );
      });

      await client.query(
        `
        INSERT INTO restaurant_hours (restaurant_id, day_of_week, open_time, close_time, is_closed)
        VALUES ${valuePlaceholders.join(', ')}
        `,
        values
      );
    }
  });
}

/**
 * Upsert delivery rules for a restaurant
 */
export async function upsertDeliveryRules(
  restaurantId: string,
  rules: UpsertDeliveryRulesData
): Promise<DeliveryRules> {
  const result = await query<DeliveryRules>(
    `
    INSERT INTO restaurant_delivery_rules (
      restaurant_id, min_order_cents, delivery_fee_cents, eta_min, eta_max
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (restaurant_id) DO UPDATE SET
      min_order_cents = COALESCE($2, restaurant_delivery_rules.min_order_cents),
      delivery_fee_cents = COALESCE($3, restaurant_delivery_rules.delivery_fee_cents),
      eta_min = COALESCE($4, restaurant_delivery_rules.eta_min),
      eta_max = COALESCE($5, restaurant_delivery_rules.eta_max)
    RETURNING *
    `,
    [
      restaurantId,
      rules.min_order_cents !== undefined ? rules.min_order_cents : 0,
      rules.delivery_fee_cents !== undefined ? rules.delivery_fee_cents : 0,
      rules.eta_min !== undefined ? rules.eta_min : 25,
      rules.eta_max !== undefined ? rules.eta_max : 45,
    ]
  );

  return result.rows[0];
}

/**
 * Upsert an override for a specific date
 */
export async function upsertRestaurantOverride(
  restaurantId: string,
  date: string, // YYYY-MM-DD
  data: UpsertOverrideData
): Promise<RestaurantOverride> {
  const result = await query<RestaurantOverride>(
    `
    INSERT INTO restaurant_overrides (
      restaurant_id, date, is_closed, open_time, close_time, note
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (restaurant_id, date) DO UPDATE SET
      is_closed = $3,
      open_time = $4,
      close_time = $5,
      note = $6,
      updated_at = NOW()
    RETURNING id, restaurant_id, TO_CHAR(date, 'YYYY-MM-DD') as date, is_closed, open_time, close_time, note, created_at, updated_at
    `,
    [
      restaurantId,
      date,
      data.is_closed,
      data.open_time !== undefined ? data.open_time : null,
      data.close_time !== undefined ? data.close_time : null,
      data.note !== undefined ? data.note : null,
    ]
  );

  return result.rows[0];
}

/**
 * Delete an override for a specific date
 */
export async function deleteRestaurantOverride(
  restaurantId: string,
  date: string
): Promise<boolean> {
  const result = await query(
    'DELETE FROM restaurant_overrides WHERE restaurant_id = $1 AND date = $2',
    [restaurantId, date]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

/**
 * Get overrides for a restaurant within a date range
 */
export async function getRestaurantOverrides(
  restaurantId: string,
  fromDate?: string,
  toDate?: string
): Promise<RestaurantOverride[]> {
  let queryText = 'SELECT id, restaurant_id, TO_CHAR(date, \'YYYY-MM-DD\') as date, is_closed, open_time, close_time, note, created_at, updated_at FROM restaurant_overrides WHERE restaurant_id = $1';
  const params: any[] = [restaurantId];

  if (fromDate) {
    params.push(fromDate);
    queryText += ` AND date >= $${params.length}`;
  }

  if (toDate) {
    params.push(toDate);
    queryText += ` AND date <= $${params.length}`;
  }

  queryText += ' ORDER BY date ASC';

  const result = await query<RestaurantOverride>(queryText, params);
  return result.rows;
}

/**
 * Get a single override for a specific date
 */
export async function getRestaurantOverrideForDate(
  restaurantId: string,
  date: string
): Promise<RestaurantOverride | null> {
  const result = await query<RestaurantOverride>(
    'SELECT id, restaurant_id, TO_CHAR(date, \'YYYY-MM-DD\') as date, is_closed, open_time, close_time, note, created_at, updated_at FROM restaurant_overrides WHERE restaurant_id = $1 AND date = $2',
    [restaurantId, date]
  );

  return result.rows[0] || null;
}
