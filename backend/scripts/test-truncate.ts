import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testTruncate() {
  const client = await pool.connect();
  try {
    console.log('Testing TRUNCATE on order_item_options...');
    await client.query('TRUNCATE TABLE order_item_options CASCADE');
    console.log('✓ TRUNCATE order_item_options successful');

    console.log('\nTesting TRUNCATE on all order tables...');
    await client.query(`
      TRUNCATE TABLE
        order_item_options,
        order_items,
        orders
      CASCADE
    `);
    console.log('✓ TRUNCATE all order tables successful');
  } catch (error) {
    console.error('✗ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testTruncate();
