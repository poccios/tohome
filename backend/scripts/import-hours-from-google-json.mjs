/**
 * Import Restaurant Hours from Google JSON
 * Reads backend/out/amantea-restaurants-2km.json and imports opening hours
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_URL = process.env.API_URL || 'http://localhost:4000';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

if (!ADMIN_API_KEY) {
  console.error('❌ ADMIN_API_KEY not found in .env');
  process.exit(1);
}

/**
 * Convert Google time format (HHMM) to standard (HH:MM)
 */
function convertTime(googleTime) {
  const hours = googleTime.substring(0, 2);
  const minutes = googleTime.substring(2, 4);
  return `${hours}:${minutes}`;
}

/**
 * Parse Google opening hours periods into our format
 */
function parseOpeningHours(openingHours) {
  if (!openingHours?.periods || !Array.isArray(openingHours.periods)) {
    return null;
  }

  // Collect all time slots per day
  const daySlots = Array.from({ length: 7 }, () => []);

  for (const period of openingHours.periods) {
    const openDay = period.open.day;
    const openTime = convertTime(
      period.open.hour.toString().padStart(2, '0') +
      period.open.minute.toString().padStart(2, '0')
    );

    // Handle closing time
    if (!period.close) {
      // Open 24 hours on this day
      daySlots[openDay].push({
        open_time: '00:00',
        close_time: '23:59',
      });
      continue;
    }

    const closeDay = period.close.day;
    const closeTime = convertTime(
      period.close.hour.toString().padStart(2, '0') +
      period.close.minute.toString().padStart(2, '0')
    );

    if (openDay === closeDay) {
      // Same day - simple slot
      daySlots[openDay].push({
        open_time: openTime,
        close_time: closeTime,
      });
    } else {
      // Crosses midnight - split into two slots
      // First slot: open day until 23:59
      daySlots[openDay].push({
        open_time: openTime,
        close_time: '23:59',
      });

      // Second slot: next day from 00:00 to close time
      daySlots[closeDay].push({
        open_time: '00:00',
        close_time: closeTime,
      });
    }
  }

  // Build final hours array
  const hours = [];
  for (let day = 0; day < 7; day++) {
    const slots = daySlots[day];

    if (slots.length === 0) {
      // No slots = closed
      hours.push({
        day_of_week: day,
        open_time: '00:00',
        close_time: '00:00',
        is_closed: true,
      });
    } else {
      // Add all slots for this day
      slots.forEach(slot => {
        hours.push({
          day_of_week: day,
          open_time: slot.open_time,
          close_time: slot.close_time,
          is_closed: false,
        });
      });
    }
  }

  return hours;
}

/**
 * Get existing restaurants from public API
 */
async function getExistingRestaurants() {
  try {
    const response = await fetch(`${API_URL}/restaurants`);
    if (!response.ok) {
      console.warn(`⚠️  Failed to fetch existing restaurants: ${response.status}`);
      return [];
    }

    const data = await response.json();
    // Normalize response
    if (Array.isArray(data)) return data;
    if (data.restaurants) return data.restaurants;
    if (data.data) return data.data;
    return [];
  } catch (error) {
    console.warn(`⚠️  Error fetching existing restaurants:`, error.message);
    return [];
  }
}

/**
 * Update restaurant hours via Admin API
 */
async function updateRestaurantHours(restaurantId, hours) {
  const response = await fetch(`${API_URL}/admin/restaurants/${restaurantId}/hours`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_API_KEY,
    },
    body: JSON.stringify({ hours }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }

  return await response.json();
}

/**
 * Match restaurant by name and address
 */
function matchRestaurant(item, restaurants) {
  const itemKey = `${item.name}|${item.formatted_address || ''}`.toLowerCase().trim();

  for (const restaurant of restaurants) {
    const restKey = `${restaurant.name}|${restaurant.address || ''}`.toLowerCase().trim();
    if (itemKey === restKey) {
      return restaurant;
    }
  }

  return null;
}

/**
 * Main function
 */
async function main() {
  console.log('🕒 Starting hours import from Google JSON...\n');

  // Step 1: Read JSON file
  const jsonPath = join(__dirname, '..', 'out', 'amantea-restaurants-2km.json');
  console.log(`📄 Reading: ${jsonPath}`);

  let items;
  try {
    const jsonContent = readFileSync(jsonPath, 'utf-8');
    items = JSON.parse(jsonContent);
  } catch (error) {
    console.error('❌ Error reading JSON file:', error.message);
    process.exit(1);
  }

  console.log(`✅ Found ${items.length} restaurants in JSON\n`);

  // Step 2: Get existing restaurants
  console.log('📋 Fetching existing restaurants from API...');
  const restaurants = await getExistingRestaurants();
  console.log(`✅ Found ${restaurants.length} existing restaurants\n`);

  // Step 3: Process each restaurant
  const results = {
    imported: [],
    skipped_no_data: [],
    skipped_no_match: [],
    failed: [],
  };

  console.log('🚀 Starting hours import...\n');

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const num = `[${i + 1}/${items.length}]`;

    console.log(`${num} Processing: ${item.name}`);

    // Match restaurant
    const restaurant = matchRestaurant(item, restaurants);
    if (!restaurant) {
      console.log(`  ⏭️  HOURS_SKIPPED_NO_MATCH - Restaurant not found in database`);
      results.skipped_no_match.push({
        name: item.name,
        reason: 'not_found_in_db',
      });
      continue;
    }

    // Check if hours data exists
    if (!item.opening_hours) {
      console.log(`  ⏭️  HOURS_SKIPPED_NO_DATA - No opening hours in source data`);
      results.skipped_no_data.push({
        name: item.name,
        restaurant_id: restaurant.id,
        reason: 'no_opening_hours',
      });
      continue;
    }

    // Parse hours
    const hours = parseOpeningHours(item.opening_hours);
    if (!hours || hours.length === 0) {
      console.log(`  ⏭️  HOURS_SKIPPED_NO_DATA - Failed to parse opening hours`);
      results.skipped_no_data.push({
        name: item.name,
        restaurant_id: restaurant.id,
        reason: 'parse_failed',
      });
      continue;
    }

    // Import hours
    try {
      await updateRestaurantHours(restaurant.id, hours);
      console.log(`  ✅ HOURS_IMPORTED - ${hours.length} time slots created`);

      results.imported.push({
        name: item.name,
        restaurant_id: restaurant.id,
        slots_count: hours.length,
      });

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.log(`  ❌ HOURS_FAIL - ${error.message}`);
      results.failed.push({
        name: item.name,
        restaurant_id: restaurant.id,
        error: error.message,
      });
    }
  }

  // Step 4: Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 HOURS IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Imported:          ${results.imported.length}`);
  console.log(`⏭️  Skipped (no data): ${results.skipped_no_data.length}`);
  console.log(`⏭️  Skipped (no match):${results.skipped_no_match.length}`);
  console.log(`❌ Failed:            ${results.failed.length}`);
  console.log(`📋 Total:             ${items.length}`);
  console.log('='.repeat(60) + '\n');

  // Step 5: Save report
  const reportPath = join(__dirname, '..', 'out', 'import-hours-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: items.length,
      imported: results.imported.length,
      skipped_no_data: results.skipped_no_data.length,
      skipped_no_match: results.skipped_no_match.length,
      failed: results.failed.length,
    },
    details: results,
  };

  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`📁 Report saved to: ${reportPath}\n`);

  // Show details
  if (results.imported.length > 0) {
    console.log('✅ Hours imported for:');
    results.imported.forEach(r => console.log(`  - ${r.name} (${r.slots_count} slots)`));
    console.log('');
  }

  if (results.skipped_no_data.length > 0) {
    console.log('⏭️  Skipped (no data):');
    results.skipped_no_data.forEach(r => console.log(`  - ${r.name} (${r.reason})`));
    console.log('');
  }

  if (results.skipped_no_match.length > 0) {
    console.log('⏭️  Skipped (no match):');
    results.skipped_no_match.forEach(r => console.log(`  - ${r.name}`));
    console.log('');
  }

  if (results.failed.length > 0) {
    console.log('❌ Failed:');
    results.failed.forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    console.log('');
  }

  console.log('✨ Hours import completed!\n');
}

main();
