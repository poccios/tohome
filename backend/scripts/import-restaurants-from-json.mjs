/**
 * Import Restaurants from JSON to ToHome Database
 * Reads backend/out/amantea-restaurants-2km.json and creates restaurants via Admin API
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
 * Slugify a string
 */
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')      // Replace spaces with -
    .replace(/-+/g, '-')       // Replace multiple - with single -
    .substring(0, 60);         // Max 60 chars
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
 * Create restaurant via Admin API
 */
async function createRestaurant(restaurant) {
  const response = await fetch(`${API_URL}/admin/restaurants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_API_KEY,
    },
    body: JSON.stringify(restaurant),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }

  return await response.json();
}

/**
 * Main function
 */
async function main() {
  console.log('📥 Starting restaurant import from JSON...\n');

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
  const existingRestaurants = await getExistingRestaurants();
  console.log(`✅ Found ${existingRestaurants.length} existing restaurants\n`);

  // Create lookup map for deduplication
  const existingMap = new Set();
  existingRestaurants.forEach(r => {
    const key = `${r.name}|${r.address || ''}`.toLowerCase();
    existingMap.add(key);
  });

  // Step 3: Process each restaurant
  const results = {
    created: [],
    skipped: [],
    failed: [],
  };

  const usedSlugs = new Set();
  existingRestaurants.forEach(r => usedSlugs.add(r.slug));

  console.log('🚀 Starting import...\n');

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const num = `[${i + 1}/${items.length}]`;

    console.log(`${num} Processing: ${item.name}`);

    // Check for duplicate
    const dedupKey = `${item.name}|${item.formatted_address || ''}`.toLowerCase();
    if (existingMap.has(dedupKey)) {
      console.log(`  ⏭️  SKIPPED - Already exists`);
      results.skipped.push({
        name: item.name,
        reason: 'duplicate',
      });
      continue;
    }

    // Generate unique slug
    let slug = slugify(item.name);
    if (usedSlugs.has(slug)) {
      let counter = 2;
      while (usedSlugs.has(`${slug}-${counter}`)) {
        counter++;
      }
      slug = `${slug}-${counter}`;
    }
    usedSlugs.add(slug);

    // Build restaurant data
    const restaurant = {
      name: item.name,
      slug: slug,
      address: item.formatted_address || null,
      city: 'Amantea',
      zone: 'Amantea',
      latitude: item.lat,
      longitude: item.lng,
      phone: item.phone || null,
      description: item.website ? `Sito: ${item.website}` : '',
      is_active: true,
    };

    // Create restaurant
    try {
      const created = await createRestaurant(restaurant);
      console.log(`  ✅ CREATED - slug: ${slug}`);

      results.created.push({
        name: item.name,
        slug: slug,
        id: created.id || created.restaurant?.id || null,
      });

      // Check if hours present
      if (item.opening_hours) {
        console.log(`  ⏸️  HOURS_SKIPPED - will be added in phase 2`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.log(`  ❌ FAILED - ${error.message}`);
      results.failed.push({
        name: item.name,
        error: error.message,
      });
    }
  }

  // Step 4: Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Created:  ${results.created.length}`);
  console.log(`⏭️  Skipped:  ${results.skipped.length}`);
  console.log(`❌ Failed:   ${results.failed.length}`);
  console.log(`📋 Total:    ${items.length}`);
  console.log('='.repeat(60) + '\n');

  // Step 5: Save report
  const reportPath = join(__dirname, '..', 'out', 'import-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: items.length,
      created: results.created.length,
      skipped: results.skipped.length,
      failed: results.failed.length,
    },
    details: results,
  };

  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`📁 Report saved to: ${reportPath}\n`);

  // Show details
  if (results.created.length > 0) {
    console.log('✅ Created restaurants:');
    results.created.forEach(r => console.log(`  - ${r.name} (${r.slug})`));
    console.log('');
  }

  if (results.skipped.length > 0) {
    console.log('⏭️  Skipped restaurants:');
    results.skipped.forEach(r => console.log(`  - ${r.name} (${r.reason})`));
    console.log('');
  }

  if (results.failed.length > 0) {
    console.log('❌ Failed restaurants:');
    results.failed.forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    console.log('');
  }

  console.log('✨ Import completed!\n');
}

main();
