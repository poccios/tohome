import { Pool } from 'pg';

const testPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function resetDatabase() {
  const client = await testPool.connect();
  try {
    // Truncate all tables at once with CASCADE
    // PostgreSQL will handle the dependencies automatically
    await client.query(`
      TRUNCATE TABLE
        sessions,
        login_links,
        email_otp_challenges,
        order_item_options,
        order_items,
        orders,
        product_option_items,
        product_option_groups,
        menu_products,
        menu_categories,
        restaurant_hours,
        restaurant_overrides,
        restaurant_delivery_rules,
        users,
        restaurants
      CASCADE
    `);
    // schema_migrations is intentionally not truncated
  } finally {
    client.release();
  }
}

export async function closeDatabasePool() {
  await testPool.end();
}
