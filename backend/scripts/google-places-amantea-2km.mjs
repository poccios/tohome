/**
 * Google Places API - Fetch Restaurants near Amantea (2km radius)
 * Uses the new Google Places API (v1)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const AMANTEA_CENTER = { lat: 39.12658, lng: 16.07512 };
const RADIUS_METERS = 2000;

if (!API_KEY) {
  console.error('❌ GOOGLE_PLACES_API_KEY not found in .env');
  process.exit(1);
}

/**
 * Search for nearby restaurants
 */
async function searchNearbyRestaurants() {
  const url = 'https://places.googleapis.com/v1/places:searchNearby';

  const body = {
    includedTypes: ['restaurant'],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: {
          latitude: AMANTEA_CENTER.lat,
          longitude: AMANTEA_CENTER.lng,
        },
        radius: RADIUS_METERS,
      },
    },
    languageCode: 'it',
    regionCode: 'IT',
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.name,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Places API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.places || [];
}

/**
 * Get detailed information for a place
 */
async function getPlaceDetails(placeName) {
  const url = `https://places.googleapis.com/v1/${placeName}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask':
          'name,displayName,formattedAddress,location,' +
          'internationalPhoneNumber,nationalPhoneNumber,' +
          'websiteUri,regularOpeningHours',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.warn(`⚠️  Failed to fetch details for ${placeName}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn(`⚠️  Network error fetching ${placeName}:`, error.message);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Searching for restaurants near Amantea (2km radius)...\n');
  console.log(`Center: ${AMANTEA_CENTER.lat}, ${AMANTEA_CENTER.lng}`);
  console.log(`Radius: ${RADIUS_METERS}m\n`);

  try {
    // Step 1: Search nearby
    const places = await searchNearbyRestaurants();
    console.log(`✅ Found ${places.length} restaurants\n`);

    if (places.length === 0) {
      console.log('No restaurants found.');
      return;
    }

    // Step 2: Get details for each place
    console.log('📋 Fetching detailed information...\n');
    const detailedPlaces = [];

    for (const place of places) {
      const placeName = place.name; // e.g., "places/ChIJ..."
      console.log(`  Fetching: ${place.displayName?.text || 'Unknown'}`);

      const details = await getPlaceDetails(placeName);
      if (details) {
        detailedPlaces.push(details);
      }

      // Rate limiting: wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n✅ Retrieved details for ${detailedPlaces.length} restaurants\n`);

    // Step 3: Transform and deduplicate
    const restaurants = detailedPlaces.map(place => ({
      google_place_id: place.name, // Resource name: "places/ChIJ..."
      name: place.displayName?.text || '',
      formatted_address: place.formattedAddress || '',
      lat: place.location?.latitude || null,
      lng: place.location?.longitude || null,
      phone: place.internationalPhoneNumber || place.nationalPhoneNumber || null,
      website: place.websiteUri || null,
      opening_hours: place.regularOpeningHours || null,
    }));

    // Deduplicate by name + formatted_address (case-insensitive)
    const seen = new Set();
    const dedupedRestaurants = restaurants.filter(r => {
      const key = `${r.name}|${r.formatted_address}`.toLowerCase();
      if (seen.has(key)) {
        console.log(`  ⚠️  Duplicate removed: ${r.name}`);
        return false;
      }
      seen.add(key);
      return true;
    });

    console.log(`\n📊 Final count: ${dedupedRestaurants.length} unique restaurants\n`);

    // Step 4: Save to JSON
    const outDir = join(__dirname, '..', 'out');
    const outFile = join(outDir, 'amantea-restaurants-2km.json');

    // Create output directory if it doesn't exist
    mkdirSync(outDir, { recursive: true });

    // Write JSON file
    writeFileSync(outFile, JSON.stringify(dedupedRestaurants, null, 2), 'utf-8');

    console.log(`✅ Saved to: ${outFile}`);
    console.log(`\n📁 Output:`);
    console.log(JSON.stringify(dedupedRestaurants, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
