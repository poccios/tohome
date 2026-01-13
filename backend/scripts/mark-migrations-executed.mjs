import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const migrations = [
  '001_initial_schema.sql',
  '002_add_email_support.sql',
  '003_add_email_otp.sql',
  '004_restaurants.sql',
  '005_menu.sql',
  '006_orders.sql',
];

async function markMigrationsExecuted() {
  try {
    for (const filename of migrations) {
      await pool.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
        [filename]
      );
      console.log(`✓ Marked as executed: ${filename}`);
    }
    console.log('\n✓ All existing migrations marked as executed');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

markMigrationsExecuted();
