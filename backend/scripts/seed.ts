/**
 * Seed script - Populates database with test data using admin API
 * Usage: npm run seed
 */

import * as dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:4000';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

if (!ADMIN_API_KEY) {
  console.error('❌ ADMIN_API_KEY not set in environment');
  process.exit(1);
}

interface FetchResult {
  ok: boolean;
  status: number;
  data?: any;
  error?: string;
}

/**
 * Fetch helper with admin authentication
 */
async function fetchAdmin(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  body?: any
): Promise<FetchResult> {
  const url = `${API_URL}${path}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_API_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let data: any;
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: JSON.stringify(data, null, 2),
      };
    }

    return {
      ok: true,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Main seed function
 */
async function seed() {
  console.log('🌱 Starting seed...\n');

  let restaurantId: string;
  const categoryIds: string[] = [];
  let productCount = 0;

  // 1. Create Restaurant (use timestamp to avoid conflicts)
  console.log('📍 Creating restaurant...');
  const timestamp = Date.now();
  const restaurantResult = await fetchAdmin('/admin/restaurants', 'POST', {
    name: 'Pizzeria Da Manu',
    slug: `pizzeria-da-manu-${timestamp}`,
    description: 'Pizzeria tradizionale con forno a legna',
    phone: '+39 06 1234567',
    address: 'Via Roma 123',
    city: 'Roma',
    zone: 'centro',
  });

  if (!restaurantResult.ok) {
    console.error(`❌ FAIL: ${restaurantResult.status}`);
    console.error(restaurantResult.error);
    process.exit(1);
  }

  restaurantId = restaurantResult.data.data.id;
  console.log(`✅ OK - Restaurant created: ${restaurantId}\n`);

  // 2. Set Hours
  console.log('⏰ Setting hours...');

  const hours = [
    // Mon-Sun evening: 19:00-23:30 (days 0-6)
    { day_of_week: 0, open_time: '19:00', close_time: '23:30' },
    { day_of_week: 1, open_time: '19:00', close_time: '23:30' },
    { day_of_week: 2, open_time: '19:00', close_time: '23:30' },
    { day_of_week: 3, open_time: '19:00', close_time: '23:30' },
    { day_of_week: 4, open_time: '19:00', close_time: '23:30' },
    { day_of_week: 5, open_time: '19:00', close_time: '23:30' },
    { day_of_week: 6, open_time: '19:00', close_time: '23:30' },
    // Sat-Sun lunch: 12:00-14:30 (days 5-6)
    { day_of_week: 5, open_time: '12:00', close_time: '14:30' },
    { day_of_week: 6, open_time: '12:00', close_time: '14:30' },
  ];

  const hourResult = await fetchAdmin(`/admin/restaurants/${restaurantId}/hours`, 'PUT', {
    hours,
  });

  if (!hourResult.ok) {
    console.error(`❌ FAIL setting hours: ${hourResult.status}`);
    console.error(hourResult.error);
    process.exit(1);
  }

  console.log('✅ OK - Hours set\n');

  // 3. Set Delivery Rules
  console.log('🚚 Setting delivery rules...');
  const deliveryResult = await fetchAdmin(`/admin/restaurants/${restaurantId}/delivery-rules`, 'PUT', {
    min_order_cents: 1000,
    delivery_fee_cents: 200,
    eta_min: 25,
    eta_max: 45,
  });

  if (!deliveryResult.ok) {
    console.error(`❌ FAIL: ${deliveryResult.status}`);
    console.error(deliveryResult.error);
    process.exit(1);
  }

  console.log('✅ OK - Delivery rules set\n');

  // 4. Create Categories
  console.log('📂 Creating categories...');
  const categories = [
    { name: 'Pizze', sort_order: 1 },
    { name: 'Panini', sort_order: 2 },
    { name: 'Bevande', sort_order: 3 },
  ];

  for (const cat of categories) {
    const catResult = await fetchAdmin(`/admin/restaurants/${restaurantId}/categories`, 'POST', {
      name: cat.name,
      sort_order: cat.sort_order,
    });

    if (!catResult.ok) {
      console.error(`❌ FAIL creating category ${cat.name}: ${catResult.status}`);
      console.error(catResult.error);
      process.exit(1);
    }

    categoryIds.push(catResult.data.data.id);
    console.log(`✅ OK - Category created: ${cat.name}`);
  }

  console.log('');

  // 5. Create Products
  console.log('🍕 Creating products...');

  const products = [
    // Pizze
    { category_idx: 0, name: 'Margherita', price: 700, sort_order: 1, description: 'Pomodoro, mozzarella, basilico' },
    { category_idx: 0, name: 'Diavola', price: 900, sort_order: 2, description: 'Pomodoro, mozzarella, salame piccante' },
    { category_idx: 0, name: '4 Formaggi', price: 1000, sort_order: 3, description: 'Mozzarella, gorgonzola, parmigiano, fontina' },
    { category_idx: 0, name: 'Capricciosa', price: 950, sort_order: 4, description: 'Pomodoro, mozzarella, prosciutto, funghi, carciofi' },
    // Panini
    { category_idx: 1, name: 'Panino Porchetta', price: 600, sort_order: 1, description: 'Porchetta artigianale' },
    { category_idx: 1, name: 'Panino Pollo', price: 650, sort_order: 2, description: 'Pollo grigliato, insalata, salsa' },
    { category_idx: 1, name: 'Panino Veg', price: 550, sort_order: 3, description: 'Verdure grigliate, hummus' },
    // Bevande
    { category_idx: 2, name: 'Acqua 50cl', price: 100, sort_order: 1, description: 'Acqua naturale' },
    { category_idx: 2, name: 'Coca-Cola 33cl', price: 250, sort_order: 2, description: 'Coca-Cola lattina' },
    { category_idx: 2, name: 'Birra 33cl', price: 400, sort_order: 3, description: 'Birra artigianale' },
  ];

  const productIds: Record<string, string> = {};

  for (const product of products) {
    const prodResult = await fetchAdmin(`/admin/restaurants/${restaurantId}/products`, 'POST', {
      category_id: categoryIds[product.category_idx],
      name: product.name,
      description: product.description,
      base_price_cents: product.price,
      is_available: true,
      sort_order: product.sort_order,
    });

    if (!prodResult.ok) {
      console.error(`❌ FAIL creating product ${product.name}: ${prodResult.status}`);
      console.error(prodResult.error);
      process.exit(1);
    }

    productIds[product.name] = prodResult.data.data.id;
    productCount++;
    console.log(`✅ OK - Product created: ${product.name}`);
  }

  console.log('');

  // 6. Create Option Groups and Items
  console.log('🎛️  Creating options...');

  // A) Margherita - Dimensione
  const margheritaId = productIds['Margherita'];

  const margheritaOptionsResult = await fetchAdmin(
    `/admin/products/${margheritaId}/options`,
    'PUT',
    {
      groups: [
        {
          name: 'Dimensione',
          min_select: 1,
          max_select: 1,
          items: [
            { name: 'Normale', price_delta_cents: 0 },
            { name: 'Maxi', price_delta_cents: 200 },
          ],
        },
      ],
    }
  );

  if (!margheritaOptionsResult.ok) {
    console.error(`❌ FAIL setting options for Margherita: ${margheritaOptionsResult.status}`);
    console.error(margheritaOptionsResult.error);
    process.exit(1);
  }

  console.log(`✅ OK - Options set for Margherita`);

  // B) Panino Porchetta - Extra
  const porchettaId = productIds['Panino Porchetta'];

  const porchettaOptionsResult = await fetchAdmin(
    `/admin/products/${porchettaId}/options`,
    'PUT',
    {
      groups: [
        {
          name: 'Extra',
          min_select: 0,
          max_select: 3,
          items: [
            { name: 'Patatine', price_delta_cents: 250 },
            { name: 'Bacon', price_delta_cents: 150 },
            { name: 'Formaggio', price_delta_cents: 100 },
          ],
        },
      ],
    }
  );

  if (!porchettaOptionsResult.ok) {
    console.error(`❌ FAIL setting options for Panino Porchetta: ${porchettaOptionsResult.status}`);
    console.error(porchettaOptionsResult.error);
    process.exit(1);
  }

  console.log(`✅ OK - Options set for Panino Porchetta`);

  // Summary
  console.log('\n✨ Seed completed successfully!\n');
  console.log('📊 Summary:');
  console.log(`   Restaurant ID: ${restaurantId}`);
  console.log(`   Category IDs: ${categoryIds.join(', ')}`);
  console.log(`   Products created: ${productCount}`);
}

// Run seed
seed().catch((error) => {
  console.error('\n💥 Seed failed with error:');
  console.error(error);
  process.exit(1);
});
