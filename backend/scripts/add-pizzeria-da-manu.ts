import { query, transaction } from '../src/db';

async function addPizzeriaDaManu() {
  try {
    await transaction(async (client) => {
      // 1. Create restaurant
      console.log('Creating Pizzeria Da Manu...');
      const restaurantResult = await client.query(
        `INSERT INTO restaurants (slug, name, description, phone, address, city, zone, is_active, force_closed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          'pizzeria-da-manu',
          'Pizzeria Da Manu',
          'La migliore pizza della città! Impasto fatto in casa e ingredienti freschi.',
          '+39 0982 123456',
          'Via Roma 123',
          'Amantea',
          'centro',
          true,
          false,
        ]
      );
      const restaurantId = restaurantResult.rows[0].id;
      console.log(`✓ Restaurant created with ID: ${restaurantId}`);

      // 2. Add hours (open every day 18:00-23:30)
      console.log('Adding restaurant hours...');
      const hoursValues: string[] = [];
      const hoursParams: any[] = [];
      for (let day = 0; day <= 6; day++) {
        const offset = day * 5;
        hoursValues.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
        );
        hoursParams.push(restaurantId, day, '18:00:00', '23:30:00', false);
      }
      await client.query(
        `INSERT INTO restaurant_hours (restaurant_id, day_of_week, open_time, close_time, is_closed)
         VALUES ${hoursValues.join(', ')}`,
        hoursParams
      );
      console.log('✓ Hours added (18:00-23:30 every day)');

      // 3. Add delivery rules
      console.log('Adding delivery rules...');
      await client.query(
        `INSERT INTO restaurant_delivery_rules (restaurant_id, min_order_cents, delivery_fee_cents, eta_min, eta_max)
         VALUES ($1, $2, $3, $4, $5)`,
        [restaurantId, 1000, 200, 30, 45] // €10 min, €2 delivery, 30-45min
      );
      console.log('✓ Delivery rules added (min €10, fee €2, 30-45min)');

      // 4. Create menu categories
      console.log('Creating menu categories...');
      const pizzeResult = await client.query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order, is_active)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [restaurantId, 'Pizze', 1, true]
      );
      const pizzeCategoryId = pizzeResult.rows[0].id;

      const bevandeResult = await client.query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order, is_active)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [restaurantId, 'Bevande', 2, true]
      );
      const bevandeCategoryId = bevandeResult.rows[0].id;

      const dolciResult = await client.query(
        `INSERT INTO menu_categories (restaurant_id, name, sort_order, is_active)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [restaurantId, 'Dolci', 3, true]
      );
      const dolciCategoryId = dolciResult.rows[0].id;

      console.log('✓ Categories created: Pizze, Bevande, Dolci');

      // 5. Add pizza items
      console.log('Adding menu items...');
      const pizzas = [
        { name: 'Margherita', description: 'Pomodoro, mozzarella, basilico', price: 650 },
        { name: 'Diavola', description: 'Pomodoro, mozzarella, salame piccante', price: 750 },
        { name: 'Capricciosa', description: 'Pomodoro, mozzarella, prosciutto, funghi, carciofi', price: 850 },
        { name: 'Quattro Formaggi', description: 'Mozzarella, gorgonzola, parmigiano, fontina', price: 800 },
        { name: 'Napoli', description: 'Pomodoro, mozzarella, acciughe, capperi', price: 700 },
      ];

      for (let i = 0; i < pizzas.length; i++) {
        await client.query(
          `INSERT INTO menu_products (restaurant_id, category_id, name, description, base_price_cents, is_active, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [restaurantId, pizzeCategoryId, pizzas[i].name, pizzas[i].description, pizzas[i].price, true, i + 1]
        );
      }
      console.log(`✓ Added ${pizzas.length} pizzas`);

      // 6. Add drinks
      const drinks = [
        { name: 'Coca Cola 33cl', description: 'Lattina', price: 250 },
        { name: 'Acqua Naturale 50cl', description: 'Bottiglia', price: 150 },
        { name: 'Birra Peroni 33cl', description: 'Bottiglia', price: 350 },
      ];

      for (let i = 0; i < drinks.length; i++) {
        await client.query(
          `INSERT INTO menu_products (restaurant_id, category_id, name, description, base_price_cents, is_active, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [restaurantId, bevandeCategoryId, drinks[i].name, drinks[i].description, drinks[i].price, true, i + 1]
        );
      }
      console.log(`✓ Added ${drinks.length} drinks`);

      // 7. Add desserts
      const desserts = [
        { name: 'Tiramisù', description: 'Fatto in casa', price: 450 },
        { name: 'Panna Cotta', description: 'Con frutti di bosco', price: 400 },
      ];

      for (let i = 0; i < desserts.length; i++) {
        await client.query(
          `INSERT INTO menu_products (restaurant_id, category_id, name, description, base_price_cents, is_active, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [restaurantId, dolciCategoryId, desserts[i].name, desserts[i].description, desserts[i].price, true, i + 1]
        );
      }
      console.log(`✓ Added ${desserts.length} desserts`);
    });

    console.log('\n✅ Pizzeria Da Manu created successfully with full menu!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addPizzeriaDaManu();
